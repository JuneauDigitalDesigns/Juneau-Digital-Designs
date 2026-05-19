import { redirect } from "next/navigation";
import { stripe } from "@/app/lib/stripe";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  if (!session_id) redirect("/pricing");

  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status !== "paid") redirect("/pricing");

  const plan = session.metadata?.plan ?? "starter";
  redirect(`/onboarding?plan=${plan}&session_id=${session_id}`);
}
