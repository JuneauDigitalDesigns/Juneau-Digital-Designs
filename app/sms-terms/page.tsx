export const metadata = {
    title: "SMS Terms | Juneau Digital Designs",
    description:
        "Terms for the Juneau Digital Designs Call Alerts text messaging program: what we send, how often, how to opt in, and how to stop.",
};

/**
 * Public messaging program disclosure.
 *
 * Written to be read by two audiences at once: a client deciding whether to tick the box,
 * and a carrier or TCR reviewer checking that the program described here matches the
 * campaign registration and the consent language on /agreement. The sample message must
 * stay byte-identical to the body the Make.com post-call scenario actually sends and to
 * the sample submitted with the campaign.
 */
export default function SmsTermsPage() {
    return (
        <main
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                padding: "64px max(24px, 4vw)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Subtle aurora backdrop */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                    background:
                        "radial-gradient(ellipse at 60% 10%, rgba(245,237,214,0.07) 0%, transparent 60%)",
                }}
            />

            <article
                className="glass"
                style={{
                    position: "relative",
                    zIndex: 1,
                    maxWidth: 800,
                    margin: "0 auto",
                    padding: "clamp(28px, 5vw, 56px)",
                }}
            >
                <h1 style={{ fontSize: "var(--text-3xl)", marginBottom: 8 }}>SMS Terms</h1>
                <p
                    style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--fg-3)",
                        marginBottom: 40,
                    }}
                >
                    Juneau Digital Designs Call Alerts · Effective date: August 13, 2026
                </p>

                {[
                    {
                        heading: "What this program is",
                        content: (
                            <>
                                <p style={{ marginBottom: 14 }}>
                                    Juneau Digital Designs Call Alerts is a customer care text messaging program for business
                                    owners who use our AI receptionist service. It sends two kinds of message:
                                </p>
                                <ul
                                    style={{
                                        paddingLeft: 20,
                                        margin: "0 0 14px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                    }}
                                >
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Call summaries.</span> When the
                                        receptionist handles a call for your business, a short text tells you who called, what
                                        they wanted, and how urgent it is.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Service alerts.</span> Occasional
                                        notices about your own account, such as your receptionist being unreachable, your included
                                        minutes running low, or planned maintenance that affects call handling.
                                    </li>
                                </ul>
                                <p>
                                    The program is available only to Juneau Digital Designs clients on the Growth and Enterprise
                                    plans, which are the plans that include the AI receptionist, and only for the mobile number
                                    that client provides. The Starter plan does not include the receptionist and receives no text
                                    messages. We do not send marketing or promotional messages through this program, and we never
                                    message your customers.
                                </p>
                            </>
                        ),
                    },
                    {
                        heading: "What the messages look like",
                        content: (
                            <>
                                <p style={{ marginBottom: 14 }}>A typical call summary reads:</p>
                                <blockquote
                                    style={{
                                        margin: "0 0 18px",
                                        padding: "14px 18px",
                                        background: "var(--surface)",
                                        border: "1px solid var(--rule)",
                                        borderRadius: 10,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        color: "var(--fg)",
                                    }}
                                >
                                    Juneau Digital Designs call alert: Callback requested. New lead Maria Alvarez, callback (930)
                                    555-0117. Reply STOP to opt out.
                                </blockquote>
                                <p style={{ marginBottom: 14 }}>A typical service alert reads:</p>
                                <blockquote
                                    style={{
                                        margin: "0 0 14px",
                                        padding: "14px 18px",
                                        background: "var(--surface)",
                                        border: "1px solid var(--rule)",
                                        borderRadius: 10,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        color: "var(--fg)",
                                    }}
                                >
                                    Juneau Digital Designs service alert: you have used 90% of your included minutes this billing
                                    period. Reply STOP to opt out.
                                </blockquote>
                                <p>
                                    Call summaries are sent only for calls the AI receptionist handles. Calls you answer yourself
                                    do not generate a text.
                                </p>
                            </>
                        ),
                    },
                    {
                        heading: "Message frequency",
                        content: (
                            <p>
                                Message frequency varies based on call volume. You receive at most one message per handled call,
                                so a quiet week may produce none and a busy day may produce several. Service alerts are
                                infrequent and only sent when something about your own account needs your attention. We do not
                                send scheduled or recurring messages of any other kind.
                            </p>
                        ),
                    },
                    {
                        heading: "Cost",
                        content: (
                            <p>
                                Message and data rates may apply. Juneau Digital Designs does not charge you for these messages,
                                but your mobile carrier may, depending on your plan. Check with your carrier if you are unsure.
                            </p>
                        ),
                    },
                    {
                        heading: "How to opt in",
                        content: (
                            <>
                                <p style={{ marginBottom: 14 }}>
                                    Opt-in happens on our{" "}
                                    <a
                                        href="/agreement"
                                        style={{ color: "var(--accent)", textDecoration: "underline" }}
                                    >
                                        service agreement page
                                    </a>
                                    . You enter the mobile number that should receive call alerts, and check the box beside it
                                    that reads:
                                </p>
                                <blockquote
                                    style={{
                                        margin: "0 0 14px",
                                        padding: "14px 18px",
                                        background: "var(--surface)",
                                        border: "1px solid var(--rule)",
                                        borderRadius: 10,
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                        color: "var(--fg)",
                                    }}
                                >
                                    Yes, text me call summaries and service alerts from Juneau Digital Designs at the mobile
                                    number above. Consent is not a condition of purchase. Message and data rates may apply.
                                    Message frequency varies based on call volume. Reply STOP to opt out, HELP for help. See SMS
                                    Terms and Privacy Policy.
                                </blockquote>
                                <p style={{ marginBottom: 14 }}>
                                    The box starts unchecked and is separate from the checkbox accepting the service agreement.
                                    Consent is not a condition of purchase: the service is sold, built, and billed the same way
                                    whether you opt in or not.
                                </p>
                                <p>
                                    Alerts begin only after both the box is checked and your purchase is completed. If you sign
                                    but never complete payment, the opt-in expires on its own and no message is ever sent.
                                </p>
                            </>
                        ),
                    },
                    {
                        heading: "How to stop the messages",
                        content: (
                            <>
                                <p style={{ marginBottom: 14 }}>
                                    Reply <strong style={{ color: "var(--fg)" }}>STOP</strong> to any message to stop receiving
                                    them. You will get one confirmation message and nothing after that. You can also turn call
                                    alerts off at any time in your client portal settings, or by emailing us.
                                </p>
                                <p>
                                    Reply <strong style={{ color: "var(--fg)" }}>HELP</strong> to any message for help, or contact
                                    us at the address below. To start again after opting out, reply START, or turn alerts back on
                                    in your portal settings.
                                </p>
                            </>
                        ),
                    },
                    {
                        heading: "Carriers and delivery",
                        content: (
                            <p>
                                Carriers are not liable for delayed or undelivered messages. Delivery depends on your carrier,
                                your device, and network conditions, none of which we control. Call alerts are a convenience and
                                should not be relied on as the only record of a call. Every call is also logged in your client
                                portal.
                            </p>
                        ),
                    },
                    {
                        heading: "Privacy",
                        content: (
                            <p>
                                No mobile information collected for call alerts is sold, rented, or shared with third parties or
                                affiliates for marketing or promotional purposes. Your mobile number is shared only with Twilio,
                                our messaging provider, and only to deliver the messages you asked for. We keep a record of your
                                opt-in and any opt-out, including the date, time, IP address, and the exact wording you were
                                shown. See our{" "}
                                <a
                                    href="/privacy-policy"
                                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                                >
                                    Privacy Policy
                                </a>{" "}
                                for the full picture.
                            </p>
                        ),
                    },
                    {
                        heading: "Contact",
                        content: (
                            <p>
                                Questions about this messaging program? Email{" "}
                                <a
                                    href="mailto:support@juneaudigitaldesigns.com"
                                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                                >
                                    support@juneaudigitaldesigns.com
                                </a>
                                .
                            </p>
                        ),
                    },
                ].map((section) => (
                    <section
                        key={section.heading}
                        style={{
                            marginTop: 36,
                            paddingTop: 28,
                            borderTop: "1px solid var(--rule)",
                        }}
                    >
                        <h2 style={{ fontSize: 18, marginBottom: 12 }}>{section.heading}</h2>
                        <div style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 15 }}>
                            {section.content}
                        </div>
                    </section>
                ))}
            </article>
        </main>
    );
}
