import { SCHEDULES } from "@/app/lib/legal/schedules";
import { DEMO_TEL_DISPLAY } from "./demo-line";

/**
 * Every FAQ answer the marketing site prints, in one place.
 *
 * Two pages read this: /pricing prints `PRICING_FAQS` under its plan cards, and /faq prints
 * `FAQ_GROUPS`, which is the same pricing answers plus the four that used to sit in the
 * homepage's "Before you call." section. Both pages read the same objects, so an answer edited
 * here changes on both and the two cannot drift apart.
 *
 * Client-facing copy, approved by Xander word for word (the pricing answers when /pricing was
 * redesigned, the /faq page on 9 Nov 2026). Do not edit without a fresh approval.
 *
 * Answers are sourced from the Master Services Agreement so the marketing copy and the contract
 * can't drift apart. Section refs are noted per answer. Numbers come from Schedule A, never typed.
 */

export interface FaqEntry {
    q: string;
    /** One paragraph, or several. */
    a: string | string[];
    /** An anchor other copy links to. */
    id?: string;
}

const minutes = (slug: "starter" | "growth" | "enterprise") =>
    SCHEDULES[slug].callMinutes?.toLocaleString("en-US") ?? "0";
const overageRate = (slug: "starter" | "growth" | "enterprise") =>
    `$${(SCHEDULES[slug].overagePerMinute ?? 0.2).toFixed(2)}`;

/** The answer the Growth card's "After carrier approval" tags link to. */
export const LIVE_FAQ_ID = "how-fast-live";

/**
 * Leads the section on purpose, and replaced "What's the catch?".
 *
 * The old lead argued from price ("Growth is $297, agencies charge $600"), which no longer holds
 * at $497 and was the wrong objection anyway. Consumer resistance to AI answering a phone is real
 * and rising, so that is the first thing to answer. It is also the argument the whole product
 * rests on: human-first routing.
 */
const AI_INSTEAD_OF_ME: FaqEntry = {
    q: "Will my customers get an AI instead of me?",
    a: "No. The AI never answers before you do. A caller rings your real phone first, and only if nobody picks up does the AI step in. It is replacing your voicemail, not replacing you. Most people who call a business and reach a recording just hang up and call the next name on the list, so the comparison that matters isn't AI versus you, it's AI versus nobody.",
};

/**
 * The web-only concession.
 *
 * Deliberately an FAQ answer rather than a fourth card. Web-only is `plan: "starter"` with
 * `receptionistMode: "declined"`, priced identically to Starter precisely so it is never the
 * economically attractive choice (see `WEB_ONLY_SCHEDULE`). Putting it on the cards with a price
 * would invite people to choose it to save money, which is backwards. Answering it here means the
 * prospect who asks gets a straight answer without the option being advertised to everyone.
 */
const WEBSITE_ONLY: FaqEntry = {
    q: "Can I get the website without the AI receptionist?",
    a: "Yes, though we'll try to talk you out of it. The receptionist is where most of the value is — it's what turns a missed call into a lead. If you'd rather not have AI on your line, we'll build and host the same site at the same price and leave your phone alone. It's not a cheaper plan; it's the same plan with a piece switched off.",
};

const MINUTES: FaqEntry = {
    q: "What happens if I go over my minutes?",
    a: `They're billed at ${overageRate("growth")} a minute on your next invoice, and we'll give you a heads-up as you get close. On Starter especially, keep an eye on it: ${minutes("starter")} minutes is roughly twenty short calls, so a busy month can run past it.`, // MSA call volume section
};

const CONTRACT: FaqEntry = {
    q: "Am I locked into a contract?",
    a: "No. There is no minimum term, no commitment period, and no cancellation fee on any plan. It's month to month. If you cancel, you keep everything through the end of the month you've already paid for, and then it stops.", // MSA term and termination
};

const NOT_HAPPY: FaqEntry = {
    q: "What if I'm not happy with the site?",
    a: "We iterate. You get two content edit requests per month, and if the first build misses the mark, we redo it. If it's still not working after a fair run, there is no commitment holding you here. Month to month means you can leave at the end of any month.",
};

/* MSA delivery targets. The second paragraph is the carrier step for Growth's customer-facing
   texts: what it waits on, who handles it, and no timeframe, because approval is the carriers' to
   grant. The owner's own lead texts come from JDD's number and are live from the start, so the
   first paragraph says so. */
const HOW_FAST: FaqEntry = {
    id: LIVE_FAQ_ID,
    q: "How fast can I be live?",
    a: [
        "You'll have a preview site within 72 hours of sending your onboarding form back, and you're fully live within a week. That covers your site, your receptionist, your portal, and the texts we send you about new leads.",
        "On Growth, two features wait on one more step: texting your customers and asking for reviews. Those messages come from your own business number, so the carriers have to approve your business's text-messaging registration first. We file it for you, handle the back and forth, and switch both on as soon as it clears. The approval is the carriers' call, so we can't put a date on it. The callback and the pipeline work from day one.",
    ],
};

const FORWARDING: FaqEntry = {
    q: "Do I have to forward my phone?",
    a: "You pick one of two ways: forward your existing business line to the number we give you, so the AI only ever hears the calls you didn't pick up, or publish our number as your business number. Either works. We walk you through it, though your phone carrier has to make the change, so we can't do that part for you.", // MSA activation
};

/* Was "It's yours. If you ever leave, it goes with you." — which the MSA does not support. The
   number sits on our master telephony account, and on termination the default is release, not
   transfer. Porting is real, but it's opt-in, time-boxed and paid, so all three conditions are
   stated rather than discovered later. */
const KEEP_NUMBER: FaqEntry = {
    q: "Do I get to keep my phone number?",
    a: "You get exclusive use of it for as long as you're a client: put it on your truck, your cards, your Google listing. It lives on our telephony account, so if you leave and want to keep it, tell us within 30 days and we'll port it to your carrier for a one-time $50 fee. Miss that window and it goes back into the pool.", // MSA phone number ownership
};

const OWN_SITE: FaqEntry = {
    q: "Do I own my website?",
    a: "Your content is yours: name, logo, photos, and copy, always. The site runs on our platform while you're a client. If you leave, ask within 30 days and we hand over a full static export of the site, your content as a file, and your call log. You'd need to arrange new hosting, but you leave with your site rather than a screenshot of it.", // MSA intellectual property
};

const HAVE_A_SITE: FaqEntry = {
    q: "What if I already have a website?",
    a: "We build you a new one and bring over the content worth keeping. You won't have to start from scratch.",
};

const REPLACING_RECEPTIONIST: FaqEntry = {
    q: "Is this replacing a receptionist?",
    a: "No, most of our clients never had one. When it's you and a truck, the phone rings while your hands are full. This picks it up. And if you do have someone answering, this is what catches the calls after they go home.",
};

/* ── From the homepage's old "Before you call." section ──────────────────────────────────────
   The four answers /pricing never had. They moved here when that section left the homepage. */

/* The homepage version said "Call the number at the bottom of this page". On /faq the number is
   not at the bottom of anything, so the answer gives it. */
const ROBOT: FaqEntry = {
    q: "Will it sound like a robot?",
    a: `Call our demo line at ${DEMO_TEL_DISPLAY} and decide for yourself. That's why it's there. We'd rather you hear it than take our word for it.`,
};

const CANT_ANSWER: FaqEntry = {
    q: "What if it can't answer something?",
    a: "It takes their details, puts the lead in your portal, and texts you that it's there. It doesn't guess, and it doesn't make things up about your business.",
};

const WRITE_CONTENT: FaqEntry = {
    q: "Do I have to write the content?",
    a: "No. You answer some questions about your business and we write it. Most people are done in one sitting. The writing is what stalls everyone for six months, so we took it off your plate.",
};

const GOOGLE: FaqEntry = {
    q: "Will I show up on Google?",
    a: "We do the technical side properly: page speed, titles and descriptions, structured data, sitemaps. What we won't do is promise you a ranking. Nobody controls Google's results, and anyone who says otherwise is selling something.", // MSA §SEO
};

/** /pricing's FAQ, in the order it prints them. */
export const PRICING_FAQS: FaqEntry[] = [
    AI_INSTEAD_OF_ME,
    WEBSITE_ONLY,
    MINUTES,
    CONTRACT,
    NOT_HAPPY,
    HOW_FAST,
    FORWARDING,
    KEEP_NUMBER,
    OWN_SITE,
    HAVE_A_SITE,
    REPLACING_RECEPTIONIST,
];

/** /faq: every pricing answer plus the four from the homepage, grouped by what they're about. */
export const FAQ_GROUPS: { label: string; entries: FaqEntry[] }[] = [
    { label: "The receptionist", entries: [AI_INSTEAD_OF_ME, REPLACING_RECEPTIONIST, ROBOT, CANT_ANSWER, WEBSITE_ONLY] },
    { label: "Your website", entries: [HAVE_A_SITE, WRITE_CONTENT, GOOGLE, OWN_SITE, NOT_HAPPY] },
    { label: "Your plan", entries: [CONTRACT, MINUTES, KEEP_NUMBER] },
    { label: "Getting set up", entries: [HOW_FAST, FORWARDING] },
];
