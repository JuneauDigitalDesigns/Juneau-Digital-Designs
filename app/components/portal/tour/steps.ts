import type { DriveStep } from "driver.js";

/**
 * The first-run tour, split by tier.
 *
 * **Growth/Enterprise** gets the whole loop, including a second act *inside* the customer
 * record — the drawer is where the work actually happens, and a client shown only the board
 * treats this as a list of names. **Starter** learns the Inbox and is handed off to the Growth
 * showcase, since the rest of the tour would be teaching a feature they do not have.
 *
 * Anchored to stable `data-tour` attributes, never CSS classes. Every popover is one or two
 * sentences: the tour is eight stops at its longest, and it is resumable, so brevity per step
 * matters more than covering everything.
 */

export type TourTier = "starter" | "growth";

export interface TourPlan {
    steps: DriveStep[];
    /** Index after which the drawer must be open for the remaining anchors to exist. */
    opensDrawerAfter: number | null;
}

export function buildTourPlan(tier: TourTier, isMobile: boolean): TourPlan {
    const inbox: DriveStep = {
        element: '[data-tour="inbox-list"]',
        popover: {
            title: "👋 This is your inbox",
            description:
                "Every call your receptionist answers and every enquiry from your website lands here. Tap one to see who it was and what they wanted.",
            side: isMobile ? "bottom" : "top",
            align: "center",
        },
    };

    if (tier === "starter") {
        return {
            opensDrawerAfter: null,
            steps: [
                inbox,
                {
                    element: '[data-tour="inbox-filters"]',
                    popover: {
                        title: "Find anything fast",
                        description:
                            "Filter to just the new ones, or just calls, and search by name or number when you're looking for someone in particular.",
                        side: "bottom",
                        align: "start",
                    },
                },
                {
                    element: isMobile ? undefined : '[data-tour="nav-customers"]',
                    popover: {
                        title: "Want to go further?",
                        description:
                            "Growth adds a place to track each customer, text them from your business number, and ask for Google reviews. Open Customers to see it in action.",
                        side: "right",
                        align: "start",
                    },
                },
            ],
        };
    }

    return {
        // Step index 2 is the board; the drawer opens before step 3.
        opensDrawerAfter: 2,
        steps: [
            inbox,
            {
                element: '[data-tour="inbox-promote"]',
                popover: {
                    title: "Keep the ones that matter",
                    description:
                        "When an enquiry is a real job, promote them to a customer. Everything they've said is carried across automatically.",
                    side: "top",
                    align: "center",
                },
            },
            {
                element: isMobile ? '[data-tour="crm-list"]' : '[data-tour="crm-board"]',
                popover: {
                    title: "Work the job",
                    description: isMobile
                        ? "Use the dropdown on each customer to move them along as the job progresses."
                        : "Drag a customer across as you quote and book the job. Anyone going quiet gets an amber dot so they don't slip.",
                    side: "top",
                    align: "center",
                },
            },
            {
                element: '[data-tour="crm-drawer-stage"]',
                popover: {
                    title: "Everything in one place",
                    description:
                        "Open a customer and you get their details, the stage they're at, and what the job is worth.",
                    side: "right",
                    align: "start",
                },
            },
            {
                element: '[data-tour="crm-drawer-tasks"]',
                popover: {
                    title: "Never forget a follow-up",
                    description:
                        "Set a reminder — \"send the quote Friday\" — and it flags when it's overdue.",
                    side: "right",
                    align: "start",
                },
            },
            {
                element: '[data-tour="crm-drawer-timeline"]',
                popover: {
                    title: "The whole story",
                    description:
                        "Every call, text and note, newest first. Tap any line to see the detail or play the recording.",
                    side: "left",
                    align: "start",
                },
            },
            {
                element: '[data-tour="crm-drawer-review"]',
                popover: {
                    title: "⭐ Here's the magic",
                    description:
                        "After a happy job, one tap asks them for a Google review. More reviews bring more calls — come back and do this often.",
                    side: "right",
                    align: "start",
                },
            },
            isMobile
                ? {
                      popover: {
                          title: "You're all set",
                          description:
                              "That's it. Open the More menu and tap “Replay tour” whenever you want to see this again.",
                      },
                  }
                : {
                      element: '[data-tour="portal-help"]',
                      popover: {
                          title: "You're all set",
                          description: "Tap here anytime to replay this. Now go win some jobs.",
                          side: "right",
                          align: "start",
                      },
                  },
        ],
    };
}
