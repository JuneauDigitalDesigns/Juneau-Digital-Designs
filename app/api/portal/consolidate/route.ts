import { NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { upsertSite } from "@jdd/schema";
import { getAgreement, persistAgreement, saveAgreement } from "@/app/lib/kv";
import { sendStoredAgreementEmail } from "@/app/lib/agreement-email";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveAccount } from "@/app/lib/account-store";
import { writeSubToSlug } from "@/app/lib/cancel-kv";
import { changeSubscriptionPlan } from "@/app/lib/plan-billing";
import { dropBillingCache } from "@/app/lib/portal-kv";
import { sendOpsNotice } from "@/app/lib/ops-notice";
import { CARD_DECLINED, consolidationRefusal } from "@/app/lib/plan-change-copy";
import { acceptedBy, masterRefFor } from "@/app/lib/held-agreement";
import {
  cancelAbsorbedSubscription,
  getConsolidation,
  planConsolidation,
  saveConsolidation,
  withdrawScheduledChanges,
  type ConsolidationRecord,
} from "@/app/lib/consolidation";

export const runtime = "nodejs";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Move this account's Growth sites onto Enterprise, in place (see `lib/consolidation.ts`).
 *
 * Runs straight after the client accepts the Enterprise service agreement. The host subscription
 * is upgraded first, and Stripe refuses that if the card doesn't pay, so a failure there leaves
 * everything as it was. Only then are the other Growth subscriptions cancelled and credited, and
 * the records repointed last.
 *
 * Safe to repeat. A move that stopped partway is finished by running it again: the host already
 * on Enterprise is not charged twice, and subscriptions already cancelled are skipped.
 */
export async function POST(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;
  const { account } = ctx;

  let agreementId: string | undefined;
  try {
    ({ agreement_id: agreementId } = (await request.json()) as { agreement_id?: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!agreementId) {
    return NextResponse.json({ error: "Missing signed agreement" }, { status: 400 });
  }

  // The agreement has to be for Enterprise and has to be this account's own. A plan change is
  // accepted on the full master, which `/api/agreement` records on the signed-in account as it
  // is accepted. Without the check an agreement id is a bearer token for a plan change.
  const agreement = await getAgreement(agreementId);
  if (!agreement || agreement.plan !== "enterprise") {
    return NextResponse.json({ error: "Agreement not found or not for Enterprise" }, { status: 400 });
  }
  // A master is bound by who accepted it (it is held, so it isn't the account's master until the
  // move succeeds below); an addendum by the master it hangs off.
  const belongs =
    agreement.kind === "addendum"
      ? Boolean(account.masterAgreement?.agreementId) && agreement.parentAgreementId === account.masterAgreement?.agreementId
      : acceptedBy(agreement, account);
  if (!belongs) {
    return NextResponse.json({ error: "Agreement does not belong to this account" }, { status: 403 });
  }

  const plan = await planConsolidation(account);
  if (!plan.ok) {
    if (plan.code === "no-sites") {
      return NextResponse.json({ error: "No Growth sites to consolidate" }, { status: 409 });
    }
    console.warn("[consolidate] refused", account.email, plan.code);
    return NextResponse.json(
      { error: consolidationRefusal(plan.code, plan.cancelAt ? formatDate(plan.cancelAt) : undefined) },
      { status: 409 },
    );
  }

  const existing = await getConsolidation(account.email);
  let record: ConsolidationRecord = {
    id: existing && existing.status !== "done" ? existing.id : randomUUID(),
    accountEmail: account.email,
    absorbing: [plan.host, ...plan.others].map(({ site }) => site.slug),
    hostSlug: plan.host.site.slug,
    hostSubscriptionId: plan.host.subscription.id,
    customerId: plan.customerId,
    agreementId,
    status: "upgrading",
    startedAt: existing && existing.status !== "done" ? existing.startedAt : Date.now(),
    cancelled: existing && existing.status !== "done" ? existing.cancelled : [],
    updatedAt: Date.now(),
  };
  await saveConsolidation(record);

  try {
    await withdrawScheduledChanges(account, plan);
  } catch (e) {
    console.error("[consolidate] could not withdraw a scheduled change", account.email, e);
    await saveConsolidation({ ...record, status: "stalled", lastError: "withdraw scheduled change failed" });
    return NextResponse.json({ error: consolidationRefusal("unreadable") }, { status: 502 });
  }

  // 1. The host becomes Enterprise: prorated, invoiced now, refused if the card doesn't pay.
  const upgraded = await changeSubscriptionPlan({
    slug: plan.host.site.slug,
    accountEmail: account.email,
    site: plan.host.site,
    targetPlan: "enterprise",
    agreementId,
    initiatedBy: "client",
  });
  if (!upgraded.ok) {
    console.error(`[consolidate] host upgrade failed (${upgraded.code}) for ${account.email}: ${upgraded.message}`);
    await saveConsolidation({ ...record, status: "stalled", lastError: `upgrade: ${upgraded.code}` });
    if (upgraded.code === "payment-failed") {
      return NextResponse.json({ error: CARD_DECLINED }, { status: 402 });
    }
    return NextResponse.json({ error: consolidationRefusal("unreadable") }, { status: 502 });
  }
  record = { ...record, status: "cancelling" };
  await saveConsolidation(record);

  // 2. Every other Growth subscription is cancelled, its unused time credited to the balance.
  for (const { site, subscription } of plan.others) {
    if (record.cancelled.includes(subscription.id)) continue;
    try {
      await cancelAbsorbedSubscription(subscription.id, plan.host.subscription.id);
      record = { ...record, cancelled: [...record.cancelled, subscription.id] };
      await saveConsolidation(record);
      console.log("[consolidate] cancelled growth subscription", site.slug, subscription.id);
    } catch (e) {
      // The host is already on Enterprise and paid for. The client is briefly paying for both,
      // which is the recoverable direction: running the move again finishes it.
      const message = e instanceof Error ? e.message : String(e);
      await saveConsolidation({ ...record, status: "stalled", lastError: `cancel ${subscription.id}: ${message}` });
      console.error("[consolidate] cancel failed", site.slug, subscription.id, e);
      return NextResponse.json({ error: consolidationRefusal("unreadable") }, { status: 502 });
    }
  }

  // 3. Repoint every absorbed site at the host subscription. Last, so until here the records
  //    still describe what Stripe was billing.
  let next = account;
  for (const slug of record.absorbing) {
    next = upsertSite(next, {
      slug,
      plan: "enterprise",
      stripeSubscriptionId: plan.host.subscription.id,
      stripeCustomerId: plan.customerId,
    });
  }
  // The Enterprise agreement becomes the account's master with the move, not when it was accepted:
  // a refused or failed move leaves the master the client still holds.
  await saveAccount({
    ...next,
    stripeCustomerId: account.stripeCustomerId ?? plan.customerId,
    ...(agreement.kind === "addendum" ? {} : { masterAgreement: masterRefFor(agreement) }),
    updatedAt: Date.now(),
  });
  for (const slug of record.absorbing) {
    await dropBillingCache(account.email, slug);
  }
  await writeSubToSlug(plan.host.subscription.id, plan.host.site.slug).catch((e) =>
    console.error("[consolidate] sub-to-slug index write failed", plan.host.subscription.id, e),
  );

  record = { ...record, status: "done" };
  await saveConsolidation(record);
  console.log("[consolidate] complete", account.email, plan.host.subscription.id, record.absorbing);

  // The Enterprise agreement now governs the account: keep it past its TTL, and send the client
  // their copy, which the signing route held back until the move went through. Saved before
  // persisting, because `saveAgreement` sets the TTL again.
  const settled = { ...agreement, pendingConsolidation: false };
  await saveAgreement(settled);
  await persistAgreement(agreementId, account.email).catch((e) =>
    console.error("[consolidate] could not persist agreement", agreementId, e),
  );
  after(() => sendStoredAgreementEmail(settled));
  after(() =>
    sendOpsNotice(`[JDD] Consolidated: ${account.email} → Enterprise (${record.absorbing.length} sites)`, [
      `${account.email} moved ${record.absorbing.map((s) => `<strong>${s}</strong>`).join(", ")} onto Enterprise in the portal.`,
      `The Enterprise subscription is ${plan.host.subscription.id} (was ${plan.host.site.slug}'s Growth one). ${
        plan.others.length
      } other Growth subscription${plan.others.length === 1 ? " was" : "s were"} cancelled and credited.`,
      `In the console, the sites now read Enterprise in KV; site.ts and onboarding are yours to bring in line.`,
    ]),
  );

  return NextResponse.json({ ok: true });
}
