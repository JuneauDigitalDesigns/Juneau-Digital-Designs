import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import {
  consentRequestContext,
  getConsentStateForAccount,
  normalizeE164,
  recordConsentEvent,
  type ConsentState,
} from "@/app/lib/sms-consent";

export const runtime = "nodejs";

/**
 * Client-side control over call alert texts.
 *
 * Twilio's Advanced Opt-Out already honours a STOP reply, but a self-serve switch matters
 * for the case STOP cannot handle: a client who changed cell numbers and needs alerts to
 * follow them. It also means opting out never requires waiting for a message to arrive
 * first.
 *
 * Every change appends events rather than editing state. Moving to a new number is a
 * revocation of the old one and a grant of the new one, in that order, because that is
 * literally what happened and a log that says otherwise is not evidence.
 */
export async function GET(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;

  const state = await getConsentStateForAccount(ctx.account.email);
  return NextResponse.json({ ok: true, consent: state });
}

export async function POST(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { enabled, phone } = body as Record<string, unknown>;
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }

  const email = ctx.account.email;
  const current = await getConsentStateForAccount(email);
  const { ip, userAgent } = consentRequestContext(request);

  if (!enabled) {
    // Nothing to revoke is a success, not an error: the client asked for alerts off and
    // alerts are off. Returning 400 here would make a double-click look like a failure.
    if (!current || current.status === "revoked") {
      return NextResponse.json({ ok: true, consent: current ?? null });
    }
    await recordConsentEvent({
      phone: current.phone,
      action: "revoked",
      source: "portal-settings",
      ip,
      userAgent,
      accountEmail: email,
    });
    return NextResponse.json({
      ok: true,
      consent: { ...current, status: "revoked" } satisfies ConsentState,
    });
  }

  const next = normalizeE164(typeof phone === "string" ? phone : "");
  if (!next) {
    return NextResponse.json(
      { error: "Enter a valid mobile number to receive call alerts." },
      { status: 400 },
    );
  }

  // Re-saving an unchanged, already-active consent is a no-op. Appending a duplicate grant
  // every time someone opens settings would bury the events that actually mean something.
  if (current && current.phone === next && current.status === "granted") {
    return NextResponse.json({ ok: true, consent: current });
  }

  if (current && current.phone !== next && current.status !== "revoked") {
    await recordConsentEvent({
      phone: current.phone,
      action: "revoked",
      source: "portal-settings",
      ip,
      userAgent,
      accountEmail: email,
    });
  }

  // The consent text is re-shown in the portal UI at the moment of the change, so the
  // default hash and version recorded here are the words they just read.
  await recordConsentEvent({
    phone: next,
    action: "granted",
    source: "portal-settings",
    ip,
    userAgent,
    accountEmail: email,
  });

  return NextResponse.json({
    ok: true,
    consent: await getConsentStateForAccount(email),
  });
}
