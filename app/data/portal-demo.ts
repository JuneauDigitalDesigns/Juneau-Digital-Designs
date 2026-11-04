/**
 * Script and sample data for the homepage portal demo (`PortalDemo.tsx`).
 *
 * Everything here is fictional. The business and the lead are the same ones the phone film in
 * the section above ends on (`switchboard-calls.ts`, the "hvac" scenario): Peak Comfort HVAC,
 * Robert Ochoa, no heat at 2:13 AM. So this section picks up exactly where that one stops. Every
 * number is in the 555-01XX range reserved for fiction, so nothing on the page dials anyone.
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

/** Same wording and same rule as the section's third outcome: what it waits on, never how long. */
export const CARRIER_LINE = "Switches on once the carriers approve your business registration.";

export const DEMO_BUSINESS = { name: "Peak Comfort HVAC", host: "peakcomforthvac.com" };

/** The lead the film delivered. */
export const DEMO_LEAD = {
    name: "Robert Ochoa",
    initials: "RO",
    phone: "(512) 555-0129",
    address: "847 Elm Street",
    /** What the Inbox row and the drawer's "What was said" show. */
    preview: "No heat, kids home. Furnace went out around 2 AM at 847 Elm Street. Wants a callback first thing.",
    /** The call summary the customer record pins open as the call that started it. */
    summary:
        "Robert Ochoa called at 2:13 AM. The heat went out and he has kids at home. Address is 847 Elm Street. He asked for a callback as soon as possible, so this was flagged urgent.",
    /** ~2 minutes, matching the film's call (`CALL_REPRESENTS_SEC` there is 118). */
    duration: "1m 58s",
    recording: "0:00 / 1:58",
    receivedAt: "11/4/2026, 2:13:40 AM",
    /** The Airtable outcome, which promotion carries over as a starting tag. */
    tag: "Urgent callback needed",
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

/** What was already in the inbox before the new call landed. Marcus is a repeat caller (#52 grouping). */
export const DEMO_INBOX: DemoInboxRow[] = [
    { id: "linda", name: "Linda Park", web: true, unread: true, preview: "Quote for a heat pump to replace an old oil furnace, 1,800 sq ft house.", tag: "Web form", time: "3 hours" },
    { id: "marcus", name: "Marcus Bell", count: 2, preview: "Furnace tune-up before winter. Flexible on days, prefers mornings.", time: "Yesterday" },
    { id: "ana", name: "Ana Reyes", preview: "Thermostat went blank after a power cut. Asked if it is covered.", tag: "Call · 48s", time: "2 days" },
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
    lead: [{ id: "grace", name: "Grace Liu", phone: "(512) 555-0144", tags: ["Heat pump"], note: "Wants two quotes before deciding" }],
    contacted: [{ id: "dev", name: "Dev Patel", phone: "(512) 555-0186", tags: ["Duct cleaning"], stale: true }],
    quoted: [{ id: "hannah", name: "Hannah Cole", phone: "(512) 555-0152", tags: ["AC replacement"], note: "$6,400 system quote sent" }],
    scheduled: [{ id: "sam", name: "Sam Ortiz", phone: "(512) 555-0117", tags: ["Tune-up"], note: "Thu 9:00 AM" }],
};
export const DEMO_COLLAPSED = { won: 6, lost: 1 };

/**
 * When each move happened, as the timeline shows it. The owner rang Robert back straight after
 * the 2:16 AM promotion, quoted and booked him in the morning, then texted to confirm.
 */
/** The timeline's day heading beside "Today": the weekday and date, as the record prints them. */
export const DEMO_TODAY = "Wednesday November 4";

export const DEMO_TIMES = {
    added: "2:16 AM",
    contacted: "2:18 AM",
    quoted: "9:30 AM",
    scheduled: "9:41 AM",
    texted: "9:42 AM",
};

export const DEMO_SMS =
    "Hi Robert, this is Peak Comfort HVAC. Mike is booked to come out at 11 AM today. Reply here if anything changes.";

/**
 * The review request as the composer pre-fills it: `defaultReviewMessage` in
 * `app/lib/review-message.ts` (agency #53), which offers nothing in return because Google
 * prohibits incentivised reviews. The review link and the STOP line are appended by the server,
 * so they are not shown here.
 */
export const DEMO_REVIEW =
    "Hi Robert, thanks for choosing Peak Comfort HVAC! If we did a great job, would you mind leaving us a quick Google review? It only takes a minute and it genuinely helps a small business like ours.";
