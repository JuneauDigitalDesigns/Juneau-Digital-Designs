/**
 * Page additions in the client portal (L12, Phase 3; Xander 2026-11-14, mockups and W60–W130
 * approved word for word: https://claude.ai/artifact/LsqdNvjduNNY4YABQjPdhu).
 *
 * When the nightly Search Console job proposes a town + service page (or a town page), the client's
 * portal shows a notice. Read-only while JDD reviews it; once JDD approves a page that still needs
 * facts, the notice opens a wizard where the client sends photos and reviews from that town, or
 * says they don't want the page. Nothing the client sends publishes anything: it reaches the
 * console intake tagged Client, and JDD checks it before any export.
 *
 * Pure: a proposal record (seo-store.ts), the site's search profile and the client's facts in; the
 * notice to show, or null, out. Every visible string is here and approved; the W numbers are the
 * mockup's. Counts only: never a search, never a caller.
 */
import type { SearchProfile, SeoProposal } from "./seo-demand";

const DAY = 86_400_000;
/** Final notices go this long after the client first sees them; thank-you and paused, after they appear. */
export const NOTICE_DAYS = 7;

/** Where a page addition stands. Before stages existed the console wrote only `status`. */
export type Stage = "review" | "waiting" | "received" | "building" | "live" | "not-now" | "paused" | "cancelled" | "merged";

export interface PageProposal extends SeoProposal {
    stage?: Stage;
    stageAt?: string;
    /** The first time the client's portal showed the notice for `stage`. */
    seen?: { stage: Stage; at: string };
    /** The client's "I don't want this page" (W112), with their optional reason. */
    clientDecline?: { at: string; reason: string | null };
    /** Set by the console once the live site serves the page (W79). */
    liveUrl?: string;
}

export type FactStatus = "pending" | "accepted" | "rejected";
interface FactBase {
    id: string;
    town: string;
    service: string | null;
    addedAt: string;
    status: FactStatus;
    decidedAt?: string;
}
export interface ClientPhoto extends FactBase {
    url: string;
    filename: string;
    alt: string;
}
export interface ClientReview extends FactBase {
    text: string;
    name: string | null;
    verbatim: true;
}
export interface ClientJob extends FactBase {
    text: string;
}
/** `jdd:seo:clientfacts:v1:{acct}:{slug}:{proposalId}`: the contract the console intake reads. */
export interface ClientFacts {
    v: 1;
    proposalId: string;
    siteSlug: string;
    town: string;
    service: string | null;
    updatedAt: string;
    submittedAt: string | null;
    photos: ClientPhoto[];
    reviews: ClientReview[];
    jobs: ClientJob[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pageLabel = (service: string | null, town: string) => (service ? `${service} in ${town}` : town);

/** Every approved string of the portal side. */
export const PA = {
    inReview: "In review", // W60
    newPage: (service: string, town: string) => `A new page for ${service} in ${town}`, // W61
    newPageBody: (service: string, town: string) =>
        `People in ${town} are finding your site when they search for ${service}. We're reviewing whether a page for it would help, and we'll let you know soon.`, // W62
    count: (n: number) => `Your site showed up in these searches ${plural(n, "time", "times")} in the last 90 days.`, // W63
    townPage: (town: string) => `A page for ${town}`, // W64
    townPageBody: (town: string) =>
        `People in ${town} are finding your site. We're reviewing whether a page for the town would help, and we'll let you know soon.`, // W65
    needHelp: "We need your help", // W66
    helpBuild: (service: string | null, town: string) => `Help us build your ${pageLabel(service, town)} page`, // W67
    helpBody: (town: string) =>
        `We'd like to add this page. It needs photos and reviews from real jobs in ${town}. Nothing goes on your site until we've checked it.`, // W68
    moreNeeded: (n: number) => `${n} more needed`, // W69
    addFacts: "Add photos and reviews", // W70
    thankYou: "Thank you", // W71
    haveWhatWeNeed: (service: string | null, town: string) => `We have what we need for ${pageLabel(service, town)}`, // W72
    thankYouBody: "Thanks. We have all the information we need for this page and will follow up if we need anything else.", // W73
    beingBuilt: "Being built", // W74
    building: (service: string | null, town: string) => `We're building your ${pageLabel(service, town)} page`, // W75
    buildingBody: "We'll let you know here when it's live.", // W76
    live: "Live", // W77
    isLive: (service: string | null, town: string) => `Your ${pageLabel(service, town)} page is live`, // W78
    viewPage: "View the page", // W79
    notForNow: "Not for now", // W80
    noPageForNow: (service: string | null, town: string) => `No ${pageLabel(service, town)} page for now`, // W81
    notForNowBody: "We've decided not to add this page for now. Nothing on your site changes.", // W82
    paused: "Paused", // W83
    pausedHeading: (service: string | null, town: string) => `We've paused ${pageLabel(service, town)}`, // W84
    pausedBody: "Got it. We won't add this page, and we may be in touch about it. Anything you already sent stays with us.", // W85
    notGoingAhead: "Not going ahead", // W86
    wontAdd: (service: string | null, town: string) => `We won't add a ${pageLabel(service, town)} page`, // W87
    wontAddBody: "Nothing on your site changes. Anything you sent stays with us, and we may use it on your other pages.", // W88
    merged: "Page merged", // W89
    mergedHeading: (service: string, town: string) => `We've merged your ${service} in ${town} page into your ${town} page`, // W90
    mergedBody: (town: string) =>
        `Few people were finding it on its own. Its photos and reviews are still on your site, and its old address now leads to your ${town} page.`, // W91
    couldntUse: (n: number, m: number) => `We couldn't use ${n} of the photos or reviews you sent, so we still need ${m} more.`, // W92

    wizardTitle: (service: string | null, town: string) => pageLabel(service, town), // W93
    rule: (service: string | null, town: string) =>
        service
            ? `This page needs at least 2 photos or reviews from ${service} jobs in ${town}, and your ${town} page needs 3 facts of at least 2 kinds.`
            : `Your ${town} page needs 3 photos or reviews from jobs in ${town}, of at least 2 kinds.`, // W94
    photosTitle: (town: string) => `Photos from jobs in ${town}`, // W95
    photosHelp: (service: string, town: string) => `Photos of ${service} work you did in ${town}.`, // W96
    addPhotos: "Add photos", // W97
    reviewsTitle: (town: string) => `Reviews from customers in ${town}`, // W98
    review: "Review", // W99
    firstName: "Customer's first name", // W100
    optional: "Optional.", // W101
    addReview: "Add another review", // W102
    jobTitle: (town: string) => `A job you did in ${town}`, // W103
    jobHelp: "Optional. In your own words, for example what the problem was and how you fixed it. Never a customer's address.", // W104
    send: "Send to Juneau Digital Designs", // W105
    saveLater: "Save and finish later", // W106
    saved: "Saved", // W107
    sendNote: (n: number) => `You can send what you have now. The page needs ${n} more before we can build it.`, // W108
    declineTitle: "Don't want this page?", // W109
    declineBody: "We'll pause it and won't add it. Anything you've sent stays with us.", // W110
    declineReason: "Anything you'd like us to know?", // W111
    declineButton: "I don't want this page", // W112
    // Reused, approved where they first appeared: Q1 (onboarding) and the console's review tick.
    photoTownQ: "Which town was this job in?",
    photoTownHelp: "Town only, never the street.",
    verbatimTick: "Copied word for word from the review. Not edited, not combined.",
    // The agency's alert to JDD only (W126–W127).
    alertSubject: "Search Console nightly job needs attention",
    alertBody:
        "The nightly Search Console job failed or read nothing for any site on its last 2 runs. The usual cause is a revoked Google sign-in. Run npm run google-sign-in in jdd-ops, then update GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN on the agency's Vercel project.",
} as const;

export function stageOf(p: PageProposal): Stage {
    if (p.stage) return p.stage;
    if (p.status === "declined") return "not-now";
    if (p.status === "asked") return "waiting";
    if (p.status === "approved") return p.kind === "fold" ? "merged" : "building";
    return "review";
}

/** When the current stage began: what the console stamped, else the decision, else the proposal. */
function stageStart(p: PageProposal): number {
    return Date.parse(p.stageAt ?? p.decidedAt ?? p.createdAt);
}

/**
 * A client fact counts toward the page while it waits for JDD, or once JDD accepts it until the
 * next export folds it into the site's profile. A rejected fact counts for nothing.
 */
function counts(f: FactBase, profile: SearchProfile): boolean {
    if (f.status === "pending") return true;
    return f.status === "accepted" && Boolean(f.decidedAt) && Date.parse(f.decidedAt as string) > Date.parse(profile.updatedAt);
}

/**
 * How many more photos or reviews the page needs (W69), by the site gate: a page for (service,
 * town) needs 2 facts tagged to both, and the town needs a page of its own (3 facts of 2 kinds);
 * a town page needs the latter. A job description doesn't count.
 */
export function factsNeeded({ proposal, profile, facts }: { proposal: PageProposal; profile: SearchProfile; facts: ClientFacts | null }): number {
    const town = profile.towns.find((t) => t.name.toLowerCase() === proposal.town.toLowerCase());
    const same = (f: FactBase) =>
        f.town.toLowerCase() === proposal.town.toLowerCase() && (!proposal.service || f.service === proposal.service);
    const photos = (facts?.photos ?? []).filter((f) => same(f) && counts(f, profile));
    const reviews = (facts?.reviews ?? []).filter((f) => same(f) && counts(f, profile));
    const added = photos.length + reviews.length;

    let needTown = 0;
    if (!town || !(town.hub || town.qualifies)) {
        const kinds = new Set<string>((town as { kinds?: string[] } | undefined)?.kinds ?? []);
        if (photos.length) kinds.add("job");
        if (reviews.length) kinds.add("review");
        const short = Math.max(0, 3 - ((town?.facts ?? 0) + added));
        needTown = Math.max(short, kinds.size >= 2 ? 0 : 1);
    }
    if (!proposal.service) return needTown;
    const shared = profile.sharedFacts[`${town?.name ?? proposal.town}|${proposal.service}`] ?? 0;
    return Math.max(Math.max(0, 2 - shared - added), needTown);
}

export interface Notice {
    chip: string;
    heading: string;
    body?: string;
    tone: "blue" | "amber" | "green" | "grey";
    id: string;
    stage: Stage;
    count?: string;
    needed?: string;
    action?: string;
    href?: string;
    /** The notice opens the facts wizard (waiting for facts only). */
    opensWizard?: boolean;
}

/** The notice the client sees for one proposal now, or null when there is none to show. */
export function noticeFor({
    proposal: p,
    profile,
    facts,
    now,
}: {
    proposal: PageProposal;
    profile: SearchProfile;
    facts: ClientFacts | null;
    now: Date;
}): Notice | null {
    let stage = stageOf(p);
    const svc = p.service ? (profile.services.find((s) => s.slug === p.service)?.name ?? p.service) : null;
    const town = p.town;
    const t = now.getTime();
    const sinceStart = (days: number) => t - stageStart(p) > days * DAY;
    const sinceSeen = (days: number) => Boolean(p.seen && p.seen.stage === stage && t - Date.parse(p.seen.at) > days * DAY);
    const base = { id: p.id, stage };

    // Facts JDD rejected can take a "received" page back below its rule: it is waiting again.
    const needed = stage === "waiting" || stage === "received" ? factsNeeded({ proposal: p, profile, facts }) : 0;
    if (stage === "received" && needed > 0) stage = "waiting";

    switch (stage) {
        case "review":
            if (p.kind === "fold") return null;
            if (p.kind === "town-facts" || !svc) {
                return { chip: PA.inReview, heading: PA.townPage(town), body: PA.townPageBody(town), tone: "blue", ...base };
            }
            return {
                chip: PA.inReview,
                heading: PA.newPage(svc, town),
                body: PA.newPageBody(svc, town),
                tone: "blue",
                ...base,
                count: PA.count(p.evidence.impressions),
            };
        case "waiting": {
            const rejected = [...(facts?.photos ?? []), ...(facts?.reviews ?? [])].filter((f) => f.status === "rejected").length;
            return {
                chip: PA.needHelp,
                heading: PA.helpBuild(svc, town),
                body: rejected > 0 && needed > 0 ? PA.couldntUse(rejected, needed) : PA.helpBody(town),
                tone: "amber",
                ...base,
                stage: "waiting",
                needed: needed > 0 ? PA.moreNeeded(needed) : undefined,
                action: PA.addFacts,
                opensWizard: true,
            };
        }
        case "received":
            if (sinceStart(NOTICE_DAYS)) return null;
            return { chip: PA.thankYou, heading: PA.haveWhatWeNeed(svc, town), body: PA.thankYouBody, tone: "green", ...base };
        case "building":
            return { chip: PA.beingBuilt, heading: PA.building(svc, town), body: PA.buildingBody, tone: "blue", ...base };
        case "live":
            if (sinceSeen(NOTICE_DAYS)) return null;
            return { chip: PA.live, heading: PA.isLive(svc, town), tone: "green", ...base, action: p.liveUrl ? PA.viewPage : undefined, href: p.liveUrl };
        case "not-now":
            if (p.kind === "fold" || sinceSeen(NOTICE_DAYS)) return null;
            return { chip: PA.notForNow, heading: PA.noPageForNow(svc, town), body: PA.notForNowBody, tone: "grey", ...base };
        case "paused":
            if (sinceStart(NOTICE_DAYS)) return null;
            return { chip: PA.paused, heading: PA.pausedHeading(svc, town), body: PA.pausedBody, tone: "grey", ...base };
        case "cancelled":
            if (sinceSeen(NOTICE_DAYS)) return null;
            return { chip: PA.notGoingAhead, heading: PA.wontAdd(svc, town), body: PA.wontAddBody, tone: "grey", ...base };
        case "merged":
            if (!svc || sinceSeen(NOTICE_DAYS)) return null;
            return { chip: PA.merged, heading: PA.mergedHeading(svc, town), body: PA.mergedBody(town), tone: "grey", ...base };
    }
}
