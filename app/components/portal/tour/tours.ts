import type { DriveStep } from "driver.js";

/**
 * The portal's tours, v2 (Xander, 2026-11-12).
 *
 * - **Welcome**: the first time someone signs in, a short walk down the tabs. When it ends, the
 *   tab they are on starts its own tour.
 * - **One tour per tab**: each plays once per person, the first time they open that tab
 *   (`tourForPath`). Growth's customer file, and its Contact info, Jobs and Notes tabs, start
 *   theirs the first time they appear on screen (`ELEMENT_TOURS`).
 * - **Locked tabs** on Starter (Customers, Calendar) get one honest card on the demo button.
 * - **No dimming**: the controller runs driver.js with no overlay and an outline on the target.
 *
 * Wording: every line from the first draft was approved by Xander word for word on 2026-11-12
 * ("approve all of the copy for the tour"). Lines the per-tab rework added are marked NEW below;
 * Xander approved them word for word the same day ("I approve the wording from the homepage demos
 * subagent"). No dashes anywhere (`test/portal-tours.test.mjs`).
 *
 * Anchors are `data-tour` attributes or element ids, never classes. A step whose anchor is not on
 * the page (an empty inbox, a building site, a phone without a rail) shows as a centred card.
 */

export type TourTier = "starter" | "growth";

export const TOUR_IDS = [
    "welcome",
    "overview",
    "inbox",
    "customers",
    "customer",
    "contact",
    "jobs",
    "notes",
    "calendar",
    "customers-locked",
    "calendar-locked",
    "analytics",
    "account",
    "billing",
    "support",
] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** The Help menu's two choices (NEW). */
export const HELP_MENU = { page: "Tour this page", all: "Replay all tours" };

const at = (tour: string) => `[data-tour="${tour}"]`;

type Side = "top" | "bottom" | "left" | "right";
function step(element: string | undefined, title: string, description: string, side: Side = "bottom", align: "start" | "center" | "end" = "start"): DriveStep {
    return { element, popover: { title, description, side, align } };
}

/* ── shared lines ─────────────────────────────────────────────────────── */

const L = {
    welcome: ["👋 Welcome to your portal", "Here's a quick look around. Each tab also gives you its own short tour the first time you open it."], // NEW
    glance: ["Your day at a glance", "Overview shows who needs you today, your new leads this week, and how fast callers were looked after."],
    yourInbox: ["Your inbox", "Every call your receptionist answers and every enquiry from your website lands here."], // NEW
    goFurther: [
        "Want to go further?",
        "Growth adds a file for every customer, a calendar for your jobs, texting from your business number, and Google review requests. Open Customers to see it in action.",
    ],
    yourCustomers: ["Your customers", "Every lead you keep gets a file here, and you move them along the board as the job progresses."], // NEW
    yourCalendar: ["Your calendar", "Job visits, estimates and call backs in one month view, each tied to its customer."],
    siteDoing: ["How your site is doing", "See who visits your site, where they came from, and how fast it loads."],
    alertsPlan: ["Your alerts and your plan", "Choose the mobile number that gets a text for every new lead, and see your plan and invoices."],
    needHand: [
        "Need a hand?",
        "Want something changed on your site, or something isn't right? Open a ticket here and we'll get back to you within one business day.",
    ],
    allSet: "You're all set",
    allSetBody: "Tap here anytime to tour the page you're on, or replay every tour.", // NEW
    allSetPhone: "That's it. Open the More menu anytime to tour the page you're on, or replay every tour.", // NEW
    winJobs: " Now go win some jobs.",
} as const;

/* ── the tours ────────────────────────────────────────────────────────── */

export function buildTour(id: TourId, tier: TourTier, isMobile: boolean): DriveStep[] {
    const growth = tier === "growth";
    // The rail's tab links are hidden on a phone, so the welcome tour's stops become centred cards.
    const nav = (tab: string) => (isMobile ? undefined : at(`nav-${tab}`));

    switch (id) {
        case "welcome":
            return [
                step(undefined, L.welcome[0], L.welcome[1]),
                step(nav("overview"), L.glance[0], L.glance[1], "right"),
                step(nav("calls"), L.yourInbox[0], L.yourInbox[1], "right"),
                growth
                    ? step(nav("customers"), L.yourCustomers[0], L.yourCustomers[1], "right")
                    : step(nav("customers"), L.goFurther[0], L.goFurther[1], "right"),
                ...(growth ? [step(nav("calendar"), L.yourCalendar[0], L.yourCalendar[1], "right")] : []),
                step(nav("analytics"), L.siteDoing[0], L.siteDoing[1], "right"),
                step(nav("settings"), L.alertsPlan[0], L.alertsPlan[1], "right"),
                step(nav("support"), L.needHand[0], L.needHand[1], "right"),
                isMobile
                    ? step(undefined, L.allSet, L.allSetPhone + (growth ? L.winJobs : ""))
                    : step(at("portal-help"), L.allSet, L.allSetBody + (growth ? L.winJobs : ""), "right"),
            ];

        case "overview":
            // NEW: every card on this page.
            return [
                step(at("ov-needs"), "Who needs you", "Leads still waiting on you. Tap Open inbox to handle them."),
                step(at("ov-week"), "This week", "Your new leads this week, from calls and from your website."),
                step(at("ov-tiles"), "The numbers that matter", "How fast callers got a call back, how many you caught after hours, and what's due today."),
                ...(growth
                    ? []
                    : [step(at("ov-locked"), "What Growth adds", "This is what happens after the call on Growth. Tap Show me what Growth does for me for a quick demo.", "top")]),
                step(at("ov-activity"), "Latest activity", "Everything that's happened lately, newest first.", "top"),
            ];

        case "inbox":
            return [
                step(
                    at("inbox-list"),
                    "👋 This is your inbox",
                    "Every call your receptionist answers and every enquiry from your website lands here. Tap one to see who it was and what they wanted.",
                    isMobile ? "bottom" : "right",
                ),
                step(
                    at("inbox-filters"),
                    "Find anything fast",
                    "Needs you shows what's still waiting on you. Switch to All, Calls or Forms, or search by name, number or what they said.",
                ),
                isMobile
                    ? step(at("inbox-list"), "Handle it in one tap", "Swipe right on a lead to call them back, or swipe left to mark it done.")
                    : step(at("inbox-actions"), "Handle it in one tap", "Call them back, set a reminder for later, or mark it done once it's handled."),
                // The write-up and Promote live in the open lead, which only opens by itself on a computer.
                ...(isMobile
                    ? []
                    : [
                          step(at("inbox-detail"), "What they said", "Your receptionist writes up what they wanted. Play the recording to hear the whole call.", "left"),
                          ...(growth
                              ? [
                                    step(
                                        at("inbox-promote"),
                                        "Keep the ones that matter",
                                        "When an enquiry is a real job, promote them to a customer. Everything they've said is carried across automatically.",
                                        "top",
                                        "center",
                                    ),
                                ]
                              : []),
                      ]),
            ];

        case "customers":
            return [
                step(
                    isMobile ? at("crm-list") : at("crm-board"),
                    "Work the job",
                    isMobile
                        ? "Use the dropdown on each customer to move them along as the job progresses."
                        : "Drag a customer across as you quote and book the job. Anyone going quiet gets an amber dot so they don't slip.",
                    "top",
                    "center",
                ),
                // NEW
                step(at("crm-filters"), "Spot who needs you", "Needs reply, Going stale and Review-ready narrow the board to the customers worth a look right now."),
                // NEW
                step(isMobile ? at("crm-list") : at("crm-card"), "Open a customer", "Tap any customer to open their file.", "right"),
            ];

        case "customer":
            return [
                step(at("crm-drawer-stage"), "Everything in one place", "Open a customer to see where the job stands, and change the stage here as it moves along."),
                step(
                    at("crm-record-tabs"),
                    "Their whole file",
                    "Contact info, Jobs and Notes sit beside the timeline. Jobs is where you track what each job is worth and book the visit.",
                ),
                step(at("crm-drawer-tasks"), "Never forget a follow-up", "Set a reminder, like “send the quote Friday”, and it flags when it's overdue. Booked visits show here too."),
                step(at("crm-drawer-timeline"), "The whole story", "Every call, text and note, newest first. Tap any line to see the detail or play the recording.", "left"),
                step("#crm-composer", "Text them back", "Text them from your business number without leaving their file. Their replies land right here.", "top"),
                step(at("crm-drawer-review"), "⭐ Here's the magic", "After a happy job, one tap asks them for a Google review. More reviews bring more calls, so come back and do this often."),
            ];

        case "contact":
            // NEW
            return [step("#crm-tabpanel-contact", "Their details", "Their name, number, email and address. Click a field to correct it.", "top")];

        case "jobs":
            // NEW
            return [
                step(at("crm-jobs-add"), "Track every job", "Add a job for each piece of work: the service, its status and what it's worth."),
                step(at("crm-job-calendar"), "Book the visit", "Open a job and tap Add to calendar. The visit shows on your Calendar and under Coming up."),
            ];

        case "notes":
            // NEW
            return [step("#crm-tabpanel-notes", "Notes for you", "Jot down anything worth remembering about them. Notes also show in the timeline under Your notes.", "top")];

        case "calendar":
            // NEW
            return [
                step(at("cal-month"), "Your month", "Job visits, estimates, call backs and follow-ups, each on its day.", "top", "center"),
                step(at("cal-new"), "Book something", "Add an appointment and tie it to a customer and one of their jobs."),
                step(at("cal-day"), "The day ahead", "Pick a day to see everything on it. Drag an appointment to move it to another day.", "left"),
            ];

        case "customers-locked":
            // NEW
            return [step(at("growth-demo-open"), "On Growth", "Customer files, texting and review requests come with Growth. Tap here for a quick demo.")];

        case "calendar-locked":
            // NEW
            return [step(at("growth-demo-open"), "On Growth", "The calendar comes with Growth. Tap here for a quick demo.")];

        case "analytics":
            // NEW
            return [
                step(at("analytics-jump"), "How your site is doing", "Who visits, where they came from, and how fast your pages load. Jump to any section from here."),
                step("#visitors", "Visitors", "How many people found your site, day by day.", "top"),
            ];

        case "account":
            // NEW
            return [
                step(at("settings-alerts"), "Text alerts", "The mobile number here gets a text for every new lead. Change it any time.", "top"),
                step(at("settings-contact"), "Your details", "Who we contact about your account."),
            ];

        case "billing":
            // NEW
            return [
                step(at("billing-plan"), "Your plan", "What you pay and when the next charge is."),
                step(at("billing-minutes"), "Call minutes", "How many of your receptionist's call minutes you've used so far.", "top"),
            ];

        case "support":
            return [
                step(at("support-new"), L.needHand[0], L.needHand[1]),
                // NEW
                step(at("support-tickets"), "Your tickets", "Every ticket you've opened and where it stands.", "top"),
            ];
    }
}

/** The tour a page starts the first time it is opened, or null for pages without one. */
export function tourForPath(pathname: string, tier: TourTier): TourId | null {
    const p = pathname.replace(/\/+$/, "") || "/";
    const growth = tier === "growth";
    if (p === "/portal") return "overview";
    if (p === "/portal/calls") return "inbox";
    if (p === "/portal/customers") return growth ? "customers" : "customers-locked";
    if (p === "/portal/calendar") return growth ? "calendar" : "calendar-locked";
    if (p === "/portal/analytics") return "analytics";
    if (p === "/portal/settings") return "account";
    if (p === "/portal/settings/billing") return "billing";
    if (p === "/portal/support") return "support";
    return null;
}

/**
 * Tours that start when something appears rather than when a page opens: the customer file the
 * first time a customer is opened, and each of its tabs the first time that tab is shown.
 * Growth only, since Starter has no customer files. Checked in this order, so a file opening
 * on its Timeline starts `customer`, not a tab's tour.
 */
export const ELEMENT_TOURS: { id: TourId; path: string; trigger: string }[] = [
    { id: "customer", path: "/portal/customers", trigger: at("crm-drawer-stage") },
    { id: "contact", path: "/portal/customers", trigger: "#crm-tabpanel-contact" },
    { id: "jobs", path: "/portal/customers", trigger: "#crm-tabpanel-jobs" },
    { id: "notes", path: "/portal/customers", trigger: "#crm-tabpanel-notes" },
];
