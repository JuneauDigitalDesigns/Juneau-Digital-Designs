import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { provisionPaidSession } from "@/app/lib/checkout-fulfillment";

export const dynamic = "force-dynamic";

/**
 * Where Stripe returns the client after payment. Its whole job is to put them in front of the
 * wizard for the site they just bought.
 *
 * It used to redirect to `/portal/sign-up?session_id=…`, which was wrong in three ways at
 * once. The sign-up page never read `session_id`, so the only identifier that knew *which*
 * site had been bought was discarded. An already-signed-in client — which, now that the gate
 * runs before checkout, is everyone — gets no UI from Clerk's `<SignUp>` at all and is
 * bounced straight to `/portal`. And there, `selectSite` deliberately ranks
 * `pending-onboarding` last, so an existing client landed on their *old* live site with no
 * sign the purchase had happened.
 *
 * Fulfilment runs here as well as in the webhook. That is not belt-and-braces for its own
 * sake: the webhook is asynchronous, so the browser regularly arrives first, and a redirect
 * to a site that does not exist yet would 404 on someone who has just been charged. See
 * `provisionPaidSession` for why running it twice is safe.
 */
export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  if (!session_id) redirect("/pricing");

  // A session that expired between checkout and returning here must not lose the purchase.
  // Send them through sign-in and straight back, rather than to /pricing to buy it again.
  const { userId } = await auth();
  if (!userId) {
    const back = encodeURIComponent(`/checkout/success?session_id=${session_id}`);
    redirect(`/portal/sign-in?redirect_url=${back}`);
  }

  let slug: string | null = null;
  try {
    const fulfilled = await provisionPaidSession(session_id);
    slug = fulfilled?.slug ?? null;
  } catch (e) {
    // Never show an error page to someone who has just paid. The webhook is still coming, so
    // the site will exist shortly; the portal is a safe place to wait, and the banner there
    // surfaces it once it lands.
    console.error("[checkout/success] fulfilment failed", session_id, e);
  }

  if (!slug) {
    console.error("[checkout/success] no site resolved for session", session_id);
    redirect("/portal");
  }

  redirect(`/portal/onboarding?site=${encodeURIComponent(slug)}`);
}
