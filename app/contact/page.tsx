import type { Metadata } from "next";
import JsonLd from "@/app/components/JsonLd";
import ContactForm from "./ContactForm";
import { CONTACT } from "@/app/data/contact";
import { CONTACT_STEPS } from "@/app/data/contact-steps";
import { DEMO_TEL, DEMO_TEL_DISPLAY } from "@/app/data/demo-line";
import { FAQ_GROUPS } from "@/app/data/faq";
import { CONTACT_DESCRIPTION, CONTACT_TITLE, contactJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/contact", CONTACT_TITLE, CONTACT_DESCRIPTION);

/**
 * /contact — "Let's talk."
 *
 * Every word was approved by Xander from the round-1 mockup (19 Nov 2026):
 * https://claude.ai/artifact/NyHkZhS2FnHwM6J1gJCy5T. Nothing here may be reworded without a fresh
 * approval; `test/contact-page.test.mjs` pins the sentences.
 *
 * The page is the landing page for Google Ads campaigns, so the form is on the page (not behind a
 * button) and a send goes to /contact/thank-you, where the conversion fires. The form is the same
 * `LeadForm` the Get Started slide-over uses — shared, never copied, so the fields, the human
 * check and the approved words have one home.
 *
 * Three sections, each its own device, as on /about and /hvac: a split hero with the ways to
 * reach us beside the form, a five-stop track of what follows, and three questions answered from
 * the FAQ's own entries so the two can't drift. No second "Get started" block: the form is the
 * ask. No hours or address, because none exist; add them only when Xander gives real ones.
 */

/* Pulled from the FAQ's own entries (never retyped), in the order the mockup shows them. */
const BEFORE_YOU_ASK_QUESTIONS = [
    "Am I locked into a contract?",
    "Do I have to write the content?",
    "What if I already have a website?",
] as const;

const BEFORE_YOU_ASK = BEFORE_YOU_ASK_QUESTIONS.map((q) => {
    const entry = FAQ_GROUPS.flatMap((g) => g.entries).find((e) => e.q === q);
    if (!entry) throw new Error(`/contact references an FAQ question that no longer exists: ${q}`);
    return { q: entry.q, a: Array.isArray(entry.a) ? entry.a.join(" ") : entry.a };
});

function PhoneIcon() {
    return (
        <svg className="contact-way-ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}
function MailIcon() {
    return (
        <svg className="contact-way-ic" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-10 6L2 7" />
        </svg>
    );
}
function EarIcon() {
    return (
        <svg className="contact-way-ic" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 8.5a6 6 0 1 1 12 0c0 6.5-6 6.5-6 10a3.5 3.5 0 0 1-6.5 1.5" />
            <path d="M15 8.5a3 3 0 1 0-6 0" />
        </svg>
    );
}

export default function ContactPage() {
    return (
        <main className="contact-page">
            <JsonLd data={contactJsonLd()} />

            {/* 1 · Split hero: the ways to reach us on the left, the form on the right. */}
            <div className="contact-shell contact-shell-hero">
                <div className="contact-hero">
                    <div>
                        <p className="kicker">Contact</p>
                        <h1 className="contact-h1">
                            Let&apos;s <span className="contact-coral">talk.</span>
                        </h1>
                        <p className="contact-lede">
                            A few details and we&apos;ll come back to you with what this would look like for your
                            business. No obligation, no pressure.
                        </p>

                        <ul className="contact-ways">
                            <li>
                                <PhoneIcon />
                                <p className="contact-way-how">Call us</p>
                                <a className="contact-way-what" href={CONTACT.phoneHref}>
                                    {CONTACT.phoneDisplay}
                                </a>
                            </li>
                            <li>
                                <MailIcon />
                                <p className="contact-way-how">Email us</p>
                                <a className="contact-way-what contact-way-small" href={CONTACT.emailHref}>
                                    {CONTACT.email}
                                </a>
                            </li>
                            <li>
                                <EarIcon />
                                <p className="contact-way-how">Need to hear it first? Call the demo.</p>
                                <a className="contact-way-what" href={DEMO_TEL}>
                                    {DEMO_TEL_DISPLAY}
                                </a>
                                <p className="contact-way-sub">The AI receptionist picks up. Ask it anything.</p>
                            </li>
                        </ul>
                    </div>

                    <div className="contact-sheet">
                        <p className="kicker contact-sheet-kicker">Tell us about you</p>
                        <ContactForm />
                    </div>
                </div>
            </div>

            {/* 2 · What follows, as a five-stop track. */}
            <section className="wash">
                <div className="contact-shell">
                    <div className="contact-split-head">
                        <h2 className="contact-h2">
                            What happens after <span className="contact-coral">you send.</span>
                        </h2>
                        <p className="contact-lede">
                            From this form to a live site and a receptionist answering your calls.
                        </p>
                    </div>
                    <ol className="contact-track">
                        {CONTACT_STEPS.map((step, i) => (
                            <li key={step.title}>
                                <span className="contact-track-dot">{i + 1}</span>
                                <p className="contact-track-when">{step.when ?? " "}</p>
                                <h3 className="contact-track-h">{step.title}</h3>
                                <p>{step.detail}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 3 · The questions people ask before they send, answered from the FAQ's own entries. */}
            <section>
                <div className="contact-shell">
                    <h2 className="contact-h2">
                        Before you <span className="contact-coral">ask.</span>
                    </h2>
                    <div className="contact-ledger">
                        {BEFORE_YOU_ASK.map((item) => (
                            <div key={item.q} className="contact-ledger-row">
                                <h3 className="contact-ledger-q">{item.q}</h3>
                                <p>{item.a}</p>
                            </div>
                        ))}
                    </div>
                    <p className="contact-more">
                        <a href="/faq">All questions &rarr;</a>
                    </p>
                </div>
            </section>
        </main>
    );
}
