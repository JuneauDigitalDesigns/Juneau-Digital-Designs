import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Payment received | Juneau Digital Designs",
    robots: { index: false },
};

/**
 * Where a client lands after paying from a link sent on a sales call.
 *
 * Not `/checkout/success`: that page requires sign-in (it sends a self-serve buyer on to their
 * onboarding form), and a client closed on a call has no login yet — they would be bounced to a
 * sign-in page for an account they never made. Their portal invite arrives by email instead, so
 * all this page has to do is say so.
 *
 * Static on purpose. Fulfilment runs from the Stripe webhook and the console's status check, so
 * nothing here needs the session id.
 */
export default async function CheckoutThanksPage({
    searchParams,
}: {
    searchParams: Promise<{ cancelled?: string }>;
}) {
    const { cancelled } = await searchParams;
    const heading = cancelled ? "Payment not completed" : "Payment received";
    const body = cancelled
        ? "Nothing was charged. If you meant to pay, use the link we sent you again, or reply to our email and we'll send a fresh one."
        : "Thank you. Check your email for a message from Juneau Digital Designs with a link to set up your portal login.";

    return (
        <main
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                padding: "64px max(24px, 4vw)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <article className="glass" style={{ maxWidth: 560, width: "100%", padding: "40px 36px", borderRadius: 18 }}>
                <h1 style={{ margin: "0 0 12px", fontSize: 32, lineHeight: 1.15, color: "var(--fg)" }}>{heading}</h1>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--fg-2, var(--fg))" }}>{body}</p>
            </article>
        </main>
    );
}
