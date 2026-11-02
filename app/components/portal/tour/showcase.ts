import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour-theme.css";

/**
 * The Starter → Growth showcase — mockup M6b.
 *
 * Reuses the first-run tour's driver.js instance and theme rather than inventing a second
 * walkthrough mechanism. The difference is purpose: the tutorial teaches a feature the client
 * already owns, this one argues for a feature they do not. So it ends on a question and a CTA
 * rather than a "Done".
 *
 * It narrates over the ghost board on the locked Customers panel. The ghost deliberately shows
 * no numerals (see `GhostPreview`'s rules), so the *words* carry the story — each step explains
 * what the client would do at that point in the loop, and why it earns them work.
 */
export function runGrowthShowcase(upgradeUrl: string, onFinish?: () => void): void {
    const steps = [
        {
            element: '[data-tour="showcase-board"]',
            popover: {
                title: "Every customer in one place",
                description:
                    "Each person who calls or fills in your form becomes a card here — so you can see every job you're working at a glance, instead of keeping it in your head.",
            },
        },
        {
            element: '[data-tour="showcase-board"]',
            popover: {
                title: "Move them along as you go",
                description:
                    "Drag a customer across as you quote and book the job. Anyone who goes quiet gets flagged, so a job you forgot to chase doesn't quietly become a job you lost.",
            },
        },
        {
            element: '[data-tour="showcase-board"]',
            popover: {
                title: "Text them without giving out your mobile",
                description:
                    "Reply to customers straight from the portal, sent from your business number. Their answers come back here, so the whole conversation stays with the job.",
            },
        },
        {
            element: '[data-tour="showcase-board"]',
            popover: {
                title: "⭐ Then ask for a review",
                description:
                    "After a happy job, one tap sends a text asking for a Google review. More reviews push you up the local results — which brings more calls, which starts the whole thing again.",
            },
        },
        {
            popover: {
                title: "Are you ready to grow?",
                description:
                    "That's the loop: answer the call, work the job, ask for the review. Growth gives you all of it, and your Inbox keeps working exactly as it does today.",
                // driver.js renders this as the final button; clicking it leaves for checkout.
                doneBtnText: "Upgrade to Growth",
            },
        },
    ];

    const d = driver({
        showProgress: true,
        popoverClass: "jdd-tour",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Upgrade to Growth",
        steps,
        onDestroyed: () => {
            onFinish?.();
        },
        // Reaching the end *through* the final button is the conversion; dismissing with Esc or
        // the close control is not, so only the explicit click navigates.
        onNextClick: (_el, _step, opts) => {
            const i = opts.state.activeIndex ?? 0;
            if (i >= steps.length - 1) {
                d.destroy();
                window.location.href = upgradeUrl;
                return;
            }
            d.moveNext();
        },
    });

    d.drive(0);
}
