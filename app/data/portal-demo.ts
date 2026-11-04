/**
 * Script and sample data for the homepage portal demo (`PortalDemo.tsx`).
 *
 * Everything here is fictional: one small HVAC shop and its customers. Written to read like a
 * real owner's week rather than a template, so specific jobs, ordinary names and texts in the
 * owner's own voice. Every number is in the 555-01XX range reserved for fiction, so nothing on
 * the page dials anyone.
 *
 * The captions are client-facing copy, approved by Xander word for word on 4 Nov 2026. Do not
 * edit them without a fresh approval, and keep em dashes out of them.
 */

export interface DemoStep {
    key: "inbox" | "promote" | "pipeline" | "message" | "review";
    /** The step button's label. */
    short: string;
    /** "Every plan" or "Growth": which plan the step's feature comes with. */
    plan: "Every plan" | "Growth";
    caption: string;
    /**
     * Customer texting and review requests run on each client's own carrier registration. The
     * steps that show them carry `CARRIER_LINE` under the caption, and never a timeframe.
     */
    gated?: boolean;
    /** Roughly how long the step plays, for its progress bar. Kept in step with the script. */
    ms: number;
}

export const DEMO_STEPS: DemoStep[] = [
    {
        key: "inbox",
        short: "Inbox",
        plan: "Every plan",
        caption: "Every call and web enquiry lands in your inbox. Open one to see who it was and what they need.",
        ms: 7200,
    },
    {
        key: "promote",
        short: "Promote",
        plan: "Growth",
        caption: "Promote the lead to a customer. The call comes with it, summary and recording included.",
        ms: 6600,
    },
    {
        key: "pipeline",
        short: "Pipeline",
        plan: "Growth",
        caption: "Move them along as the job moves: Lead, Contacted, Quoted, Scheduled.",
        ms: 8600,
    },
    {
        key: "message",
        short: "Message",
        plan: "Growth",
        gated: true,
        caption: "Text them from your business number, right from their record.",
        ms: 9000,
    },
    {
        key: "review",
        short: "Review",
        plan: "Growth",
        gated: true,
        caption: "When the job is done, ask for a Google review. The message is already written.",
        ms: 10400,
    },
];

/**
 * The closing screen once the film ends. DRAFT, awaiting Xander's word-for-word approval like
 * the captions. It names nothing carrier-gated: texting and review requests carry their own
 * line on their steps, and a closing claim about them would have to repeat it.
 */
export const DEMO_CLOSING = {
    title: "One call. One customer. Nothing slipped.",
    body: "Dave called at 2:13 AM. By the afternoon he was a booked customer, with every step kept in one place.",
    replay: "Watch again",
    next: { label: "See pricing", href: "/pricing" },
};

/** Same wording and same rule as the section's third outcome: what it waits on, never how long. */
export const CARRIER_LINE = "Switches on once the carriers approve your business registration.";

export const DEMO_BUSINESS = { name: "Brannock Heating & Air", host: "brannockheating.com" };

/** The new lead: a 2 AM no-heat call the receptionist took. */
export const DEMO_LEAD = {
    name: "Dave Kowalski",
    initials: "DK",
    phone: "(512) 555-0129",
    address: "2210 Wren Hollow Rd",
    /** What the Inbox row and the drawer's "What was said" show. */
    preview: "Furnace quit overnight and the house is down to 58°. Two kids at home. Wants someone out first thing.",
    /** The call summary the customer record pins open as the call that started it. */
    summary:
        "Dave called at 2:13 AM. His furnace shut off sometime overnight and the house is down to 58 degrees, with two kids at home. He's at 2210 Wren Hollow Rd and asked for a call back as early as possible, so it's marked urgent.",
    /** About two minutes, like the call in the phone film above. */
    duration: "1m 58s",
    recording: "0:00 / 1:58",
    receivedAt: "11/4/2026, 2:13:40 AM",
    /** The Airtable outcome, which promotion carries over as a starting tag. */
    tag: "Urgent",
};

export interface DemoInboxRow {
    id: string;
    name: string;
    web?: boolean;
    unread?: boolean;
    preview: string;
    /** Single items carry their source tag; grouped rows show the count instead, as the live inbox does. */
    tag?: string;
    count?: number;
    time: string;
}

/** What was already in the inbox before the new call landed. Jim is a repeat caller (#52 grouping). */
export const DEMO_INBOX: DemoInboxRow[] = [
    { id: "carol", name: "Carol Ostrander", web: true, unread: true, preview: "We'd like a quote on swapping our old oil furnace for a heat pump. Ranch house, about 1,800 sq ft.", tag: "Web form", time: "3 hours" },
    { id: "jim", name: "Jim Petrakis", count: 2, preview: "Wants his yearly furnace tune-up booked. Mornings work best, any day but Friday.", time: "Yesterday" },
    { id: "tammy", name: "Tammy Reynolds", preview: "Thermostat screen went blank after the power flickered. Asked if that's covered.", tag: "Call · 48s", time: "2 days" },
];
/** The live inbox only shows the archived tab once something has been put away. */
export const DEMO_ARCHIVED_COUNT = 2;

export interface DemoCard {
    id: string;
    name: string;
    phone: string;
    tags: string[];
    note?: string;
    stale?: boolean;
}

export type WorkingStage = "lead" | "contacted" | "quoted" | "scheduled";

/** The rest of the board. Won and Lost are collapsed, as they are by default in the portal. */
export const DEMO_BOARD: Record<WorkingStage, DemoCard[]> = {
    lead: [{ id: "luis", name: "Luis Arredondo", phone: "(512) 555-0144", tags: ["Heat pump"], note: "Getting two other quotes first" }],
    contacted: [{ id: "kyle", name: "Kyle Dunbar", phone: "(512) 555-0186", tags: ["Duct cleaning"], stale: true }],
    quoted: [{ id: "brenda", name: "Brenda Huff", phone: "(512) 555-0152", tags: ["AC replacement"], note: "$6,400 quote sent Monday" }],
    scheduled: [{ id: "gary", name: "Gary Novak", phone: "(512) 555-0117", tags: ["Tune-up"], note: "Thu 9:00 AM" }],
};
export const DEMO_COLLAPSED = { won: 6, lost: 1 };

/** The timeline's day heading beside "Today": the weekday and date, as the record prints them. */
export const DEMO_TODAY = "Wednesday November 4";

/**
 * When each move happened, as the timeline shows it. Tom, the owner, saw the alert, added Dave
 * and rang him back at 2 AM, quoted and booked him in the morning, then texted to confirm.
 */
export const DEMO_TIMES = {
    added: "2:16 AM",
    contacted: "2:18 AM",
    quoted: "9:30 AM",
    scheduled: "9:41 AM",
    texted: "9:42 AM",
    /** After the 11 AM visit. */
    reviewed: "1:20 PM",
};

/** Written the way an owner texts from the truck: short, first names, no sign-off. */
export const DEMO_SMS = "Hi Dave, it's Tom with Brannock. You're down for 11 this morning. I'll text when I'm on my way.";

/**
 * The review request as the composer pre-fills it: `defaultReviewMessage` in
 * `app/lib/review-message.ts` (agency #53), which offers nothing in return because Google
 * prohibits incentivised reviews. The review link and the STOP line are appended by the server,
 * so they are not shown here.
 */
export const DEMO_REVIEW =
    "Hi Dave, thanks for choosing Brannock Heating & Air! If we did a great job, would you mind leaving us a quick Google review? It only takes a minute and it genuinely helps a small business like ours.";
