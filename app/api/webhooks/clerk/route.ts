import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { getAccount, linkClerkUser } from "@/app/lib/account-store";

export const runtime = "nodejs";

/**
 * Clerk webhook — binds a newly signed-up user to their portal account.
 *
 * This is now an OPTIMISATION, not a dependency: portal access comes from the account
 * record (keyed by email, written at onboarding), and the portal links the Clerk user on
 * first load anyway. Doing it here just means the `jdd:account-by-user` index exists from
 * the moment they sign up.
 *
 * Configure the endpoint + signing secret in the Clerk dashboard, subscribed to
 * `user.created`. Secret is read from CLERK_WEBHOOK_SIGNING_SECRET (Clerk's default) or
 * CLERK_WEBHOOK_SECRET.
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

  // Only a verified address may bind to an account — an unverified sign-up must not
  // claim a paid client's portal.
  const verified = email_addresses.filter((e) => e.verification?.status === "verified");
  const email =
    verified.find((e) => e.id === primary_email_address_id)?.email_address ??
    verified[0]?.email_address;

  if (!email) {
    return NextResponse.json({ received: true, note: "no verified email" });
  }

  try {
    const account = await getAccount(email);
    if (!account) {
      // Not a client (or they onboarded under a different address) — nothing to bind.
      return NextResponse.json({ received: true, matched: false });
    }

    await linkClerkUser(account, id);
    console.log("[clerk webhook] linked account", email, "→", id);
    return NextResponse.json({ received: true, matched: true });
  } catch (e) {
    console.error("[clerk webhook] link failed", email, e);
    return NextResponse.json({ error: "link failed" }, { status: 500 });
  }
}
