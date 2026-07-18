import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { clerkClient } from "@clerk/nextjs/server";
import { getPendingClient, deletePendingClient } from "@/app/lib/pending-client";

export const runtime = "nodejs";

/**
 * Clerk webhook — links a freshly self-serve-signed-up user to their paid
 * onboarding record (by email) and grants portal access immediately in the
 * "building" state. Configure the endpoint + signing secret in the Clerk
 * dashboard, subscribed to `user.created`. The secret is read from
 * CLERK_WEBHOOK_SIGNING_SECRET (Clerk's default) or CLERK_WEBHOOK_SECRET.
 *
 * A portal-load fallback in app/portal/page.tsx covers webhook lag, so a missed
 * or delayed delivery still self-heals on the client's first portal visit.
 */
export async function POST(req: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(req, {
      signingSecret:
        process.env.CLERK_WEBHOOK_SIGNING_SECRET ?? process.env.CLERK_WEBHOOK_SECRET,
    });
  } catch (err) {
    console.error("[clerk webhook] verification failed", err);
    return NextResponse.json({ error: "verification failed" }, { status: 400 });
  }

  if (event.type !== "user.created") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const { email_addresses, primary_email_address_id, id } = event.data;
  const email =
    email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ??
    email_addresses[0]?.email_address;

  if (!email) {
    return NextResponse.json({ received: true, note: "no email" });
  }

  try {
    const pending = await getPendingClient(email);
    if (!pending) {
      // Not a paying client (or already consumed) — nothing to grant.
      return NextResponse.json({ received: true, matched: false });
    }

    const client = await clerkClient();
    await client.users.updateUser(id, {
      publicMetadata: {
        slug: pending.slug,
        plan: pending.plan,
        name: pending.brandName,
        status: pending.status, // "building"
      },
    });
    await deletePendingClient(email);

    console.log("[clerk webhook] provisioned building portal", email, pending.slug);
    return NextResponse.json({ received: true, matched: true });
  } catch (e) {
    console.error("[clerk webhook] provisioning failed", email, e);
    return NextResponse.json({ error: "provisioning failed" }, { status: 500 });
  }
}
