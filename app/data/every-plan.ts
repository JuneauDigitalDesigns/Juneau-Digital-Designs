/**
 * What every plan gets: the three points /pricing sets beside its plan cards, and the homepage
 * repeats under "Every plan starts here." One list, so the two pages cannot drift apart.
 *
 * Client-facing copy, approved by Xander word for word (rows F1–F3 and F9 of the website-plan
 * copy batch, 24 Nov 2026). Do not edit without a fresh approval.
 *
 * Why these three. With the $97 website-only Starter, the receptionist and the lead texts are no
 * longer on every plan, so the old "It rings you first" and "One inbox for every lead" points
 * would promise a Starter client something it doesn't get. They moved onto the plan cards
 * (Starter carries the web-lead inbox; Starter + AI Receptionist carries the receptionist and
 * texts). What is left is true of all four plans: the site, its upkeep, and the terms.
 */
export interface EveryPlanPoint {
    /** The kicker above the title, where a page shows one (the homepage does). */
    label: string;
    title: string;
    detail: string;
}

export const EVERY_PLAN: EveryPlanPoint[] = [
    {
        label: "Your website",
        title: "A custom 4+ page site",
        detail: "Written and built for you, with pages for your services and the towns you work in.",
    },
    {
        label: "Your hosting",
        title: "Hosted and looked after",
        detail: "Hosting, SSL, daily backups and uptime monitoring, plus 2 content edits a month.",
    },
    {
        // True alongside Terms v7's 30-day refund: cancelling still costs nothing.
        label: "Your terms",
        title: "Month to month",
        detail: "No contract, no minimum term, no cancellation fee.",
    },
];
