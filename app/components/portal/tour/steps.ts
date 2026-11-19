import type { TourDevice } from "@/app/lib/portal-tour-seen";
import { TOUR_LEAD_ID, TOUR_RECORD_ID } from "./sample-data";

/**
 * The portal tour, v3 (Xander, 19 Nov 2026): one walk through the whole portal that starts by
 * itself on a person's first visit, once on a computer and once on a phone, and moves from screen
 * to screen on its own. Every step of the v2 tours is kept, in the order of the app's tabs, with a
 * hand-off card at the end of each section. Repeats are folded ("Nothing should be said twice").
 *
 * Wording: approved by Xander word for word on 19 Nov 2026 ("the wording is approved"), from the
 * table in the tour mockup (Y1 to Y8 his own words, D1 to D18 drafts). Lines kept from the v2
 * tours were approved on 12 Nov 2026. No dashes anywhere (`test/portal-tours.test.mjs`).
 * `**words**` are set in bold: the Inbox's chip names (Xander: "it needs to be clear that we're
 * referencing the chips").
 *
 * Each step says, for the computer and for the phone, which screen it is on and what it outlines.
 * `null` means the step is not shown on that kind of device. Anchors are `data-tour` attributes or
 * element ids, never classes. A step whose anchor is not on the page shows as a centred card.
 */

export type TourTier = "starter" | "growth";
export type TourSection = "Home" | "Inbox" | "Customers" | "Calendar" | "More";
export type RecordTabId = "timeline" | "contact" | "jobs" | "notes";

export interface TourPlace {
    /** The page, under /portal. */
    path: string;
    /** Open the tour's sample lead in the Inbox, or its sample customer's file. */
    open?: "lead" | "record";
    /** The customer file's tab, when a record is open. */
    tab?: RecordTabId;
}

export interface TourStepView {
    at: TourPlace;
    /** What the step outlines. Absent: a centred card. */
    anchor?: string;
    /** Phone: give the row a small swipe nudge (right, then left), as the mockup showed. */
    nudge?: boolean;
}

export interface TourStep {
    id: string;
    section: TourSection;
    /** Which page of More (or of the rail) the step is on, shown after the section name. */
    label?: string;
    tier?: TourTier;
    /** A hand-off card: the title alone, pointing at the next section's tab. */
    handoff?: boolean;
    title: string;
    body: string;
    /** The phone's words, where they differ. */
    phone?: { title?: string; body?: string };
    /** Growth's last card adds "Now go win some jobs." */
    win?: boolean;
    desktop: TourStepView | null;
    mobile: TourStepView | null;
}

export const WIN_JOBS = " Now go win some jobs.";
export const SAMPLE_DATA_LABEL = "Sample data";

/** The Help menu's two choices (approved 2026-11-12), on the rail and in More. */
export const HELP_MENU = { page: "Tour this page", all: "Replay all tours" };

const at = (tour: string) => `[data-tour="${tour}"]`;
const both = (path: string, anchor?: string, extra: Partial<TourPlace> = {}): Pick<TourStep, "desktop" | "mobile"> => ({
    desktop: { at: { path, ...extra }, anchor },
    mobile: { at: { path, ...extra }, anchor },
});
const tabs = (desktop: string, mobile: string, path: string, extra: Partial<TourPlace> = {}): Pick<TourStep, "desktop" | "mobile"> => ({
    desktop: { at: { path, ...extra }, anchor: at(desktop) },
    mobile: { at: { path, ...extra }, anchor: at(mobile) },
});

const NEED_A_HAND = [
    "Need a hand?",
    "Want something changed on your site, or something isn't right? Open a ticket here and we'll get back to you within one business day.",
] as const;

export const TOUR_STEPS: TourStep[] = [
    /* ── Home ── */
    {
        id: "welcome",
        section: "Home",
        title: "👋 Welcome to your portal",
        body: "Thanks for coming on board with us. Here's a quick walkthrough on how your portal works.",
        ...both("/portal"),
    },
    {
        id: "glance",
        section: "Home",
        title: "Your day at a glance",
        body: "Home shows who needs you today, your new leads this week, and how quickly you called them back.",
        ...tabs("nav-overview", "tab-overview", "/portal"),
    },
    {
        id: "needs",
        section: "Home",
        title: "Who needs you",
        body: "Leads still waiting on you. Tap Open inbox to handle them.",
        phone: { body: "Leads still waiting on you. Tap Call back, or Inbox to see them all." },
        ...both("/portal", at("ov-needs")),
    },
    { id: "week", section: "Home", title: "This week", body: "Your new leads this week, from calls and from your website.", ...both("/portal", at("ov-week")) },
    {
        id: "tiles",
        section: "Home",
        title: "The numbers that matter",
        body: "How fast callers got a call back, how many you caught after hours, and what's due today.",
        ...both("/portal", at("ov-tiles")),
    },
    {
        id: "growth-adds",
        section: "Home",
        tier: "starter",
        title: "What Growth adds",
        body: "This is what happens after the call on Growth. Tap Show me what Growth does for me for a quick demo.",
        ...both("/portal", at("ov-locked")),
    },
    { id: "activity", section: "Home", title: "Latest activity", body: "Everything that's happened lately, newest first.", ...both("/portal", at("ov-activity")) },
    { id: "to-inbox", section: "Home", handoff: true, title: "Now let's take a look at your Inbox.", body: "", ...tabs("nav-calls", "tab-calls", "/portal") },

    /* ── Inbox ── */
    {
        id: "inbox",
        section: "Inbox",
        title: "👋 This is your inbox",
        body: "Every call your receptionist answers and every inquiry from your website lands here. Tap one to see who it was and what they wanted.",
        ...both("/portal/calls", at("inbox-list")),
    },
    {
        id: "find",
        section: "Inbox",
        title: "Find anything fast",
        body: "**Needs you** shows what's still waiting on you. Switch to **All**, **Calls** or **Forms**, or search by name, number or what they said.",
        ...both("/portal/calls", at("inbox-filters")),
    },
    {
        id: "handle",
        section: "Inbox",
        title: "Handle it in one tap",
        body: "Call them back, set a reminder for later, or mark it done once it's handled.",
        phone: { title: "Handle it in one swipe", body: "Swipe right on a lead to call them back, or swipe left to mark it done." },
        desktop: { at: { path: "/portal/calls", open: "lead" }, anchor: at("inbox-actions") },
        mobile: { at: { path: "/portal/calls" }, anchor: `[data-row-id="${TOUR_LEAD_ID}"]`, nudge: true },
    },
    {
        id: "said",
        section: "Inbox",
        title: "What they said",
        body: "Your receptionist writes up what they wanted. Play the recording to hear the whole call.",
        ...both("/portal/calls", at("inbox-detail"), { open: "lead" }),
    },
    {
        id: "promote",
        section: "Inbox",
        tier: "growth",
        title: "Keep the ones that matter",
        body: "When an inquiry is a real job, promote them to a customer. Everything they've said is carried across automatically.",
        ...both("/portal/calls", at("inbox-promote"), { open: "lead" }),
    },
    {
        id: "to-customers",
        section: "Inbox",
        tier: "growth",
        handoff: true,
        title: "Now let's look at what happens when your leads become customers.",
        body: "",
        ...tabs("nav-customers", "tab-customers", "/portal/calls"),
    },

    /* ── Customers (Growth) ── */
    {
        id: "customers",
        section: "Customers",
        tier: "growth",
        title: "Your customers",
        body: "Every lead you keep gets a file here, and you move them along the board as the job progresses.",
        ...tabs("nav-customers", "tab-customers", "/portal/customers"),
    },
    {
        id: "work",
        section: "Customers",
        tier: "growth",
        title: "Work the job",
        body: "Drag a customer across as you quote and book the job. Anyone going quiet gets an amber dot so they don't slip.",
        phone: { body: "Tap a stage to see who's there. Press and hold a customer to move them along as the job progresses." },
        ...tabs("crm-board", "crm-list", "/portal/customers"),
    },
    {
        id: "spot",
        section: "Customers",
        tier: "growth",
        title: "Spot who needs you",
        body: "Needs reply, Going stale and Review-ready narrow the board to the customers worth a look right now.",
        ...both("/portal/customers", at("crm-filters")),
    },
    { id: "open", section: "Customers", tier: "growth", title: "Open a customer", body: "Tap any customer to open their file.", ...both("/portal/customers", at("crm-card")) },
    {
        id: "file",
        section: "Customers",
        tier: "growth",
        title: "Everything in one place",
        body: "Open a customer to see where the job stands, and change the stage here as it moves along.",
        ...both("/portal/customers", at("crm-drawer-stage"), { open: "record", tab: "timeline" }),
    },
    {
        id: "tabs",
        section: "Customers",
        tier: "growth",
        title: "Their whole file",
        body: "Contact, Jobs and Notes sit beside the timeline. Jobs is where you track what each job is worth and book the visit.",
        ...both("/portal/customers", at("crm-record-tabs"), { open: "record", tab: "timeline" }),
    },
    {
        id: "follow-up",
        section: "Customers",
        tier: "growth",
        title: "Never forget a follow-up",
        body: "Set a reminder, like “send the quote Friday”, and it flags when it's overdue. Booked visits show here too.",
        ...both("/portal/customers", at("crm-drawer-tasks"), { open: "record", tab: "timeline" }),
    },
    {
        id: "story",
        section: "Customers",
        tier: "growth",
        title: "The whole story",
        body: "Every call, text and note, newest first. Tap any line to see the detail or play the recording.",
        ...both("/portal/customers", at("crm-drawer-timeline"), { open: "record", tab: "timeline" }),
    },
    {
        id: "text",
        section: "Customers",
        tier: "growth",
        title: "Text them back",
        body: "Text them from your business number without leaving their file. Their replies land right here.",
        ...both("/portal/customers", "#crm-composer", { open: "record", tab: "timeline" }),
    },
    {
        id: "magic",
        section: "Customers",
        tier: "growth",
        title: "⭐ Here's the magic",
        body: "After a happy job, one tap asks them for a Google review. More reviews bring more calls, so come back and do this often.",
        ...both("/portal/customers", at("crm-drawer-review"), { open: "record", tab: "timeline" }),
    },
    {
        id: "contact",
        section: "Customers",
        tier: "growth",
        title: "Their details",
        body: "Their name, number, email and address. Click a field to correct it.",
        ...both("/portal/customers", "#crm-tabpanel-contact", { open: "record", tab: "contact" }),
    },
    {
        id: "jobs",
        section: "Customers",
        tier: "growth",
        title: "Track every job",
        body: "Add a job for each piece of work: the service, its status and what it's worth.",
        ...both("/portal/customers", at("crm-jobs-add"), { open: "record", tab: "jobs" }),
    },
    {
        id: "book",
        section: "Customers",
        tier: "growth",
        title: "Book the visit",
        body: "Open a job and tap Add to calendar. The visit shows on your Calendar and under Coming up.",
        ...both("/portal/customers", at("crm-job-calendar"), { open: "record", tab: "jobs" }),
    },
    {
        id: "notes",
        section: "Customers",
        tier: "growth",
        title: "Notes for you",
        body: "Jot down anything worth remembering about them. Notes also show in the timeline under Your notes.",
        ...both("/portal/customers", "#crm-tabpanel-notes", { open: "record", tab: "notes" }),
    },
    {
        id: "to-calendar",
        section: "Customers",
        tier: "growth",
        handoff: true,
        title: "Now let's take a look at your Calendar.",
        body: "",
        ...tabs("nav-calendar", "tab-calendar", "/portal/customers"),
    },

    /* ── Starter: Growth, from the Inbox (Xander, 19 Nov 2026) ── */
    {
        id: "further",
        section: "Customers",
        tier: "starter",
        title: "Want to go further?",
        body: "Growth adds a record for each customer, a calendar for your jobs, texting from the portal, and one-click Google review requests.",
        phone: { body: "Growth adds a record for each customer, a calendar for your jobs, texting from the portal, and one-tap Google review requests." },
        ...tabs("nav-customers", "tab-customers", "/portal/calls"),
    },
    {
        id: "further-calendar",
        section: "Customers",
        tier: "starter",
        title: "Want to go further?",
        body: "The calendar comes with Growth too. Book jobs, keep track of estimates and schedule follow-ups, all from the same customer record.",
        ...tabs("nav-calendar", "tab-calendar", "/portal/calls"),
    },
    {
        id: "to-more-starter",
        section: "Customers",
        tier: "starter",
        handoff: true,
        title: "Now let's take a look at everything in More.",
        body: "",
        // There is no More on a computer: the rail lists those pages, and the tour walks on to them.
        desktop: null,
        mobile: { at: { path: "/portal/calls" }, anchor: at("tab-more") },
    },

    /* ── Calendar (Growth) ── */
    {
        id: "calendar",
        section: "Calendar",
        tier: "growth",
        title: "Your calendar",
        body: "Job visits, estimates and call backs in one month view, each tied to its customer.",
        ...tabs("nav-calendar", "tab-calendar", "/portal/calendar"),
    },
    { id: "month", section: "Calendar", tier: "growth", title: "Your month", body: "Job visits, estimates, call backs and follow-ups, each on its day.", ...both("/portal/calendar", at("cal-month")) },
    {
        id: "new",
        section: "Calendar",
        tier: "growth",
        title: "Book something",
        body: "Add an appointment and tie it to a customer and one of their jobs.",
        ...tabs("cal-new", "cal-new-top", "/portal/calendar"),
    },
    {
        id: "day",
        section: "Calendar",
        tier: "growth",
        title: "The day ahead",
        body: "Pick a day to see everything on it. Drag an appointment to move it to another day.",
        phone: { body: "Tap a day to see everything on it. Open an appointment to move it to another day." },
        ...both("/portal/calendar", at("cal-day")),
    },
    {
        id: "to-more",
        section: "Calendar",
        tier: "growth",
        handoff: true,
        title: "Now let's take a look at everything in More.",
        body: "",
        desktop: null,
        mobile: { at: { path: "/portal/calendar" }, anchor: at("tab-more") },
    },

    /* ── More: Analytics, Settings, Review message, Support ── */
    {
        id: "analytics",
        section: "More",
        label: "Analytics",
        title: "How your site is doing",
        body: "Who visits, where they came from, and how fast your pages load. Jump to any section from here.",
        ...tabs("analytics-jump", "analytics-jump-phone", "/portal/analytics"),
    },
    { id: "visitors", section: "More", label: "Analytics", title: "Visitors", body: "How many people found your site, day by day.", ...both("/portal/analytics", "#visitors") },
    {
        id: "settings",
        section: "More",
        label: "Settings",
        title: "Your alerts and your plan",
        body: "Choose the mobile number that gets a text for every new lead, and see your plan and invoices.",
        desktop: { at: { path: "/portal/settings" }, anchor: at("nav-settings") },
        mobile: { at: { path: "/portal/more" }, anchor: at("more-settings") },
    },
    {
        id: "alerts",
        section: "More",
        label: "Settings",
        title: "Text alerts",
        body: "The mobile number here gets a text for every new lead. Change it any time.",
        ...both("/portal/settings", at("settings-alerts")),
    },
    { id: "details", section: "More", label: "Settings", title: "Your details", body: "Who we contact about your account.", ...both("/portal/settings", at("settings-contact")) },
    { id: "plan", section: "More", label: "Settings", title: "Your plan", body: "What you pay and when the next charge is.", ...both("/portal/settings/billing", at("billing-plan")) },
    {
        id: "minutes",
        section: "More",
        label: "Settings",
        title: "Call minutes",
        body: "How many of your receptionist's call minutes you've used so far.",
        ...both("/portal/settings/billing", at("billing-minutes")),
    },
    {
        id: "review-message",
        section: "More",
        label: "Review message",
        tier: "growth",
        title: "Your Review message",
        body: "This is the message that goes out when you tap Review on a customer. You start with one already written. Change it here any time.",
        ...both("/portal/more/review", at("review-text")),
    },
    { id: "support", section: "More", label: "Support", title: NEED_A_HAND[0], body: NEED_A_HAND[1], ...both("/portal/support", at("support-new")) },
    { id: "tickets", section: "More", label: "Support", title: "Your tickets", body: "Every ticket you've opened and where it stands.", ...both("/portal/support", at("support-tickets")) },
    {
        id: "all-set",
        section: "More",
        title: "You're all set",
        body: "Tap here anytime to tour the page you're on, or replay every tour.",
        phone: { body: "That's it. Open the More menu anytime to tour the page you're on, or replay every tour." },
        win: true,
        desktop: { at: { path: "/portal/support" }, anchor: at("portal-help") },
        mobile: { at: { path: "/portal/more" }, anchor: at("more-help") },
    },
];

/** The whole walk for a tier on a kind of device, in order. */
export function walkFor(tier: TourTier, device: TourDevice): TourStep[] {
    return TOUR_STEPS.filter((s) => (!s.tier || s.tier === tier) && s[device] !== null);
}

/** The words a step shows on a kind of device. */
export function wordsFor(step: TourStep, device: TourDevice, tier: TourTier): { title: string; body: string } {
    const phone = device === "mobile";
    const title = (phone && step.phone?.title) || step.title;
    const body = ((phone && step.phone?.body) || step.body) + (step.win && tier === "growth" ? WIN_JOBS : "");
    return { title, body };
}

/** The section a page belongs to, for "Tour this page". */
export function sectionForPath(pathname: string): TourSection | null {
    const p = pathname.replace(/\/+$/, "") || "/";
    if (p === "/portal") return "Home";
    if (p === "/portal/calls") return "Inbox";
    if (p === "/portal/customers") return "Customers";
    if (p === "/portal/calendar") return "Calendar";
    if (/^\/portal\/(more|analytics|settings|support)(\/|$)/.test(p)) return "More";
    return null;
}

/** "Tour this page": that section's cards, without the hand-off that leads out of it. */
export function sectionWalk(section: TourSection, tier: TourTier, device: TourDevice): TourStep[] {
    return walkFor(tier, device).filter((s) => s.section === section && !s.handoff);
}

/** The URL a step's screen lives at, for a site, with the tour's sample data on. */
export function hrefFor(place: TourPlace, siteSlug: string): string {
    const q = new URLSearchParams({ site: siteSlug, tour: "1" });
    if (place.open === "lead") q.set("open", TOUR_LEAD_ID);
    if (place.open === "record") q.set("open", TOUR_RECORD_ID);
    return `${place.path}?${q.toString()}`;
}

/** `**bold**` in a card's words, split for rendering. */
export function boldParts(text: string): { text: string; bold: boolean }[] {
    return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((t) => (t.startsWith("**") ? { text: t.slice(2, -2), bold: true } : { text: t, bold: false }));
}
