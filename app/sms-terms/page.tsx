import type { ReactNode } from "react";
import { smsConsentCopy, splitConsentText } from "@/app/lib/sms-consent-text";

export const metadata = {
    title: "SMS Terms | Juneau Digital Designs",
    description:
        "Terms for the two text messaging programs involved in Juneau Digital Designs service: the Call Alerts program we send to account holders, and the customer messages a client's own business sends from its own number.",
};

/**
 * Public messaging program disclosure.
 *
 * Written to be read by two audiences at once: a client deciding whether to tick the box,
 * and a carrier or TCR reviewer checking that the program described here matches the
 * campaign registration and the consent language on /agreement. The sample message must
 * stay byte-identical to the body the Make.com post-call scenario actually sends and to
 * the sample submitted with the campaign.
 *
 * ── Why this page describes TWO programs ────────────────────────────────────────────────
 * It used to describe one, and asserted "we never message your customers". That stops being
 * true the moment a Growth client's portal texts a lead back or asks a customer for a review.
 * The two are genuinely different programs, not two features of one:
 *
 *   Account lane   JDD -> the business owner   JDD's ACCOUNT_NOTIFICATION campaign, JDD's number
 *   Customer lane  the business -> its customer  the CLIENT's own CUSTOMER_CARE campaign and number
 *
 * The distinction is legal, not cosmetic: different registrant, different consent basis, and the
 * client cannot grant consent on their own customers' behalf. So the opt-in on /agreement covers
 * the account lane ONLY, and this page says so before describing either.
 *
 * Both programs live on one page on purpose (operator's call): a reader who gets a text and comes
 * looking should not have to work out which of two documents applies to them.
 *
 * The consent sentence is rendered from `splitConsentText()`, never retyped. It was hardcoded
 * here as literal JSX, which meant the sentence existed twice — so editing the real one and
 * forgetting this copy would leave the public disclosure quoting words no client was ever shown,
 * on the page whose entire job is proving what they were shown. It is the wording the live
 * campaign shows (`smsConsentCopy()`, the `OWNER_TEXT_CAMPAIGN` switch), the same one the
 * agreement pages render beside the box.
 */

type Section = { heading: string; content: ReactNode };

const ulStyle = {
    paddingLeft: 20,
    margin: "0 0 14px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
};

const sampleStyle = {
    margin: "0 0 18px",
    padding: "14px 18px",
    background: "var(--surface)",
    border: "1px solid var(--rule)",
    borderRadius: 10,
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    lineHeight: 1.6,
    color: "var(--fg)",
};

const linkStyle = { color: "var(--accent)", textDecoration: "underline" };
const termStyle = { fontWeight: 600, color: "var(--fg)" };

const cellStyle = {
    border: "1px solid var(--rule)",
    padding: "9px 12px",
    textAlign: "left" as const,
    verticalAlign: "top" as const,
};

/* ── The orientation section, above both programs ───────────────────────────── */

const OPENING: Section = {
    heading: "Two different text programs",
    content: (
        <>
            <p style={{ marginBottom: 14 }}>
                This page covers two separate text messaging programs. They have different senders,
                different carrier registrations, and different people on the receiving end &mdash; so read
                the one that applies to you.
            </p>
            <table
                style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    margin: "0 0 14px",
                    fontSize: 14,
                }}
            >
                <thead>
                    <tr>
                        <th style={{ ...cellStyle, background: "var(--surface)", fontSize: 12.5 }}>Program</th>
                        <th style={{ ...cellStyle, background: "var(--surface)", fontSize: 12.5 }}>Who sends it</th>
                        <th style={{ ...cellStyle, background: "var(--surface)", fontSize: 12.5 }}>Who receives it</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={cellStyle}>
                            <span style={termStyle}>Account alerts</span>
                        </td>
                        <td style={cellStyle}>Juneau Digital Designs</td>
                        <td style={cellStyle}>the business owner who signed up</td>
                    </tr>
                    <tr>
                        <td style={cellStyle}>
                            <span style={termStyle}>Your customer messages</span>
                        </td>
                        <td style={cellStyle}>your business, from your own number</td>
                        <td style={cellStyle}>your business&rsquo;s own customers</td>
                    </tr>
                </tbody>
            </table>
            <p>
                Only the first is a Juneau Digital Designs program, and it is the only one the checkbox on
                our agreement page opts you into. The second is your business&rsquo;s own program: we build
                and operate the tools, but your business is the sender and the registrant.
            </p>
        </>
    ),
};

/**
 * The consent sentence, read when the page renders rather than when this module loads, so it is
 * always the wording the campaign switch picks. (The page is prerendered, so in production that
 * is the deploy's env, the same as every other reader of the switch.)
 */
function ConsentQuote() {
    return (
        <>
            {splitConsentText(smsConsentCopy().text).map((seg, i) =>
                seg.kind === "link" ? (
                    <a key={i} href={seg.href} style={linkStyle}>
                        {seg.value}
                    </a>
                ) : (
                    <span key={i}>{seg.value}</span>
                ),
            )}
        </>
    );
}

/* ── Program One — the account lane ─────────────────────────────────────────── */

const PROGRAM_ONE: Section[] = [
    {
        heading: "What this program is",
        content: (
            <>
                <p style={{ marginBottom: 14 }}>
                    Juneau Digital Designs Call Alerts is a customer care text messaging program for business
                    owners who use our AI receptionist service. It sends three kinds of message:
                </p>
                <ul style={ulStyle}>
                    <li>
                        <span style={termStyle}>Call summaries.</span> When the receptionist handles a call for
                        your business, a short text tells you who called, what they wanted, and how urgent it
                        is.
                    </li>
                    <li>
                        <span style={termStyle}>New-lead alerts.</span> When someone fills in the contact form
                        on your website, a short text tells you a new lead arrived so you can open your portal
                        and follow up.
                    </li>
                    <li>
                        <span style={termStyle}>Service alerts.</span> Occasional notices about your own
                        account, such as your receptionist being unreachable, your included minutes running
                        low, or planned maintenance that affects call handling.
                    </li>
                </ul>
                <p style={{ marginBottom: 14 }}>
                    The program is available to Juneau Digital Designs clients who use our AI receptionist,
                    and only for the mobile number that client provides. We do not send marketing or
                    promotional messages through this program.
                </p>
                <p>
                    This program messages <span style={termStyle}>account holders only</span> &mdash; the
                    business owner who signed up. It never messages your customers. When your business texts
                    its own customers, that happens under your business&rsquo;s own registration and from your
                    own number: see <span style={termStyle}>Program Two</span> below.
                </p>
            </>
        ),
    },
    {
        heading: "What the messages look like",
        content: (
            <>
                <p style={{ marginBottom: 14 }}>A typical call summary reads:</p>
                <blockquote style={sampleStyle}>
                    Juneau Digital Designs call alert: Callback requested. New lead Maria Alvarez, callback (930)
                    555-0117. Reply STOP to opt out.
                </blockquote>
                <p style={{ marginBottom: 14 }}>A typical service alert reads:</p>
                <blockquote style={{ ...sampleStyle, margin: "0 0 14px" }}>
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
                Message frequency varies based on call and lead volume. You receive at most one message per
                handled call and one per new lead, so a quiet week may produce none and a busy day may produce
                several. Service alerts are infrequent and only sent when something about your own account
                needs your attention. We do not send scheduled or recurring messages of any other kind.
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
                    <a href="/agreement" style={linkStyle}>
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
                    <ConsentQuote />
                </blockquote>
                <p style={{ marginBottom: 14 }}>
                    The box starts unchecked and is separate from the checkbox accepting the service agreement.
                    Consent is not a condition of purchase: the service is sold, built, and billed the same way
                    whether you opt in or not.
                </p>
                <p style={{ marginBottom: 14 }}>
                    That consent covers this program only &mdash; messages from us to you about your own account.
                    It is not consent for your business to text its customers, which is a separate program with a
                    separate registration described below.
                </p>
                <p>
                    Alerts begin only after both the box is checked and your purchase is completed. If we send you
                    a confirmation text asking you to reply YES, alerts begin once you reply. If you sign but never
                    complete payment, the opt-in expires on its own and no message is ever sent.
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
                <a href="/privacy-policy" style={linkStyle}>
                    Privacy Policy
                </a>{" "}
                for the full picture.
            </p>
        ),
    },
];

/* ── Program Two — the customer lane ────────────────────────────────────────── */

const PROGRAM_TWO: Section[] = [
    {
        heading: "What this program is",
        content: (
            <>
                <p style={{ marginBottom: 14 }}>
                    On the Growth and Enterprise plans, your client portal can text your own customers in two
                    specific ways. Starter and website-only plans never send customer-facing messages at all.
                </p>
                <ul style={ulStyle}>
                    <li>
                        <span style={termStyle}>Replies to people who contacted you.</span> When someone calls or
                        fills in your form, you can text them back from your portal.
                    </li>
                    <li>
                        <span style={termStyle}>Google review requests.</span> After you have done the work, you
                        can send one message asking that customer to leave a review.
                    </li>
                </ul>
                <p>
                    <span style={termStyle}>Your business is the sender.</span> These messages go out from your own
                    business number, under your own business&rsquo;s carrier registration, which we help you
                    complete during onboarding. They are not part of the Call Alerts program above, and the consent
                    you gave us for account alerts does not cover them.
                </p>
            </>
        ),
    },
    {
        heading: "What gets sent",
        content: (
            <>
                <p style={{ marginBottom: 14 }}>
                    You write the message. Your Google review link and the opt-out line are added automatically
                    and cannot be edited out, so every review request takes this shape:
                </p>
                <blockquote style={{ ...sampleStyle, whiteSpace: "pre-wrap" }}>
                    {"{your message}\n\n{your Google review link}\nReply STOP to opt out."}
                </blockquote>
                <p>
                    We do not send these on a schedule, in bulk, or on your behalf. Each one is a message you
                    choose to send to one customer.
                </p>
            </>
        ),
    },
    {
        heading: "When it turns on",
        content: (
            <p>
                Customer messaging activates once the mobile carriers approve your business registration. Your
                website, your phone number, the receptionist, your call log and your account alerts all work from
                day one and do not wait on it. Until the registration is approved, the texting and review actions
                in your portal stay switched off.
            </p>
        ),
    },
    {
        heading: "Review requests are one per customer",
        content: (
            <p>
                A customer who has already been asked for a review is never asked again, and a customer who
                replies STOP is never texted again. Both limits are enforced in the software rather than left to
                policy, so neither can be undone by accident.
            </p>
        ),
    },
    {
        heading: "Consent, and who is responsible",
        content: (
            <>
                <p style={{ marginBottom: 14 }}>
                    Because your business is the sender and the registrant, you are responsible for having a
                    proper basis to text each customer &mdash; in practice, someone who has just contacted you or
                    for whom you have just done work. These are single, transactional follow-ups to an existing
                    customer relationship, not a marketing campaign, and the portal gives you no way to send them
                    as one.
                </p>
                <p>
                    Every message carries &ldquo;Reply STOP to opt out.&rdquo; A customer who replies STOP is
                    opted out at the carrier and in our own records, and cannot be texted again.
                </p>
            </>
        ),
    },
];

const CONTACT: Section = {
    heading: "Contact",
    content: (
        <p>
            Questions about either messaging program? Email{" "}
            <a href="mailto:support@juneaudigitaldesigns.com" style={linkStyle}>
                support@juneaudigitaldesigns.com
            </a>
            .
        </p>
    ),
};

/* ── Rendering ──────────────────────────────────────────────────────────────── */

function SectionBlock({ section }: { section: Section }) {
    return (
        <section
            style={{
                marginTop: 36,
                paddingTop: 28,
                borderTop: "1px solid var(--rule)",
            }}
        >
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>{section.heading}</h2>
            <div style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 15 }}>{section.content}</div>
        </section>
    );
}

function ProgramHeading({ label, title, blurb }: { label: string; title: string; blurb: string }) {
    return (
        <div
            style={{
                marginTop: 52,
                padding: "20px 22px",
                background: "var(--surface)",
                border: "1px solid var(--rule)",
                borderLeft: "3px solid var(--accent)",
                borderRadius: 10,
            }}
        >
            <p
                style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--accent-2)",
                    margin: "0 0 8px",
                }}
            >
                {label}
            </p>
            <h2 style={{ fontSize: 22, margin: "0 0 10px" }}>{title}</h2>
            <p style={{ margin: 0, color: "var(--fg-2)", fontSize: 15, lineHeight: 1.65 }}>{blurb}</p>
        </div>
    );
}

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
                    Juneau Digital Designs Call Alerts &middot; Effective date: October 31, 2026
                </p>

                <SectionBlock section={OPENING} />

                <ProgramHeading
                    label="Program One"
                    title="Juneau Digital Designs Call Alerts"
                    blurb="Messages we send to you about your own account. This is the program the checkbox on our agreement page opts you into."
                />
                {PROGRAM_ONE.map((section) => (
                    <SectionBlock key={`one-${section.heading}`} section={section} />
                ))}

                <ProgramHeading
                    label="Program Two"
                    title="Messages your business sends to its customers"
                    blurb="Messages your business sends from its own number, under its own carrier registration. Growth and Enterprise only."
                />
                {PROGRAM_TWO.map((section) => (
                    <SectionBlock key={`two-${section.heading}`} section={section} />
                ))}

                <SectionBlock section={CONTACT} />
            </article>
        </main>
    );
}
