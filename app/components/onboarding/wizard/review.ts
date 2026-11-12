import {
    CHAPTERS,
    CUSTOM_HOURS,
    STAT_LABELS,
    TRADE_OPTIONS,
    isAnswered,
    profilesForPayload,
    serviceStatuses,
    slotsFor,
    type ScreenDef,
    type ServiceStatus,
    type WizardContext,
    type WizardState,
} from "./model";
import { C, PROFILE_SHORT } from "./copy-service-details";
import { RECEPTIONIST_OPTIONS } from "./receptionist-options";

/**
 * The "Ready to build?" cards (Xander, 2026-11-12): "it can have a better layout and be a little
 * more detailed ... click on each card to expand it and then see all of the details."
 *
 * One card per chapter. Closed, it shows its first two answers and its counts; open, every
 * question in the chapter with the full answer and its own Edit, and each service with what was
 * given for it. Approved word for word (mockup https://claude.ai/artifact/1jN9RQefsjuVy5sx65ZPVA,
 * R1 to R4); every other line reuses wording already approved.
 */

export const REVIEW = {
    counts: (answered: number, skipped: number) => (skipped ? `${answered} answered · ${skipped} skipped` : `${answered} answered`), // R1
    skipped: "Skipped", // R2
    openAll: "Open all", // R3
    closeAll: "Close all", // R3
    addressShown: "Shown on your site", // R4
    addressTown: "Town only", // R4
} as const;

export type ReviewRow = {
    /** The screen this row edits. */
    id: string;
    label: string;
    lines: string[];
    skipped: boolean;
    /** Set on a service's own row (under "details"): the service name. */
    service?: string;
};

export type ReviewCard = { label: string; rows: ReviewRow[]; answered: number; skipped: number; peek: string[] };

const STATUS_LINE: Record<ServiceStatus["state"], string> = { ready: C.stReady, near: C.stNear, core: C.stCore, none: C.stNone };

/** Every line one screen's answer shows when its card is open. */
export function detailLines(id: string, st: WizardState, ctx: WizardContext): string[] {
    const t = (v: string) => v.trim();
    const keep = (xs: string[]) => xs.map(t).filter(Boolean);
    switch (id) {
        case "trade": return keep([TRADE_OPTIONS.find((o) => o.id === st.trade)?.label ?? ""]);
        case "name": return keep([st.name]);
        case "contact": return keep([st.phone, st.email, st.address]);
        case "visit": return st.visitAddress === "yes" ? [REVIEW.addressShown] : st.visitAddress === "no" ? [REVIEW.addressTown] : [];
        case "area": return st.towns.length ? [st.towns.join(", ")] : [];
        case "website": return keep([st.website]);
        case "google": return keep([profilesForPayload(st.profiles).find((p) => p.kind === "google")?.url ?? ""]);
        case "elsewhere": {
            const others = profilesForPayload(st.profiles).filter((p) => p.kind !== "google").map((p) => PROFILE_SHORT[p.kind]);
            return others.length ? [others.join(", ")] : [];
        }
        case "sites": return keep(st.additionalSites.map((x) => x.brandName));
        case "services": {
            if (!st.services.length) return [];
            const own = serviceStatuses(st, ctx).filter((x) => x.state === "ready").length;
            return [own ? C.servicesSummary(st.services.length, own) : `${st.services.length} services`];
        }
        case "apart": return st.diffs.length ? [st.diffs.join(" · ")] : [];
        case "customers": return st.customers.length ? [st.customers.join(" · ")] : [];
        case "since": return keep([t(st.established) && `Since ${t(st.established)}`, t(st.license) && `License ${t(st.license)}`]);
        case "people": return keep([st.owner, st.response]);
        case "brands": return st.brands.length ? [st.brands.join(", ")] : [];
        case "certs": return st.certs.length ? [st.certs.join(", ")] : [];
        case "reviews": return keep([
            t(st.rating) && t(st.reviewCount) ? `${t(st.rating)} stars from ${t(st.reviewCount)} reviews` : "",
            t(st.reviewUrl) ? "Review link added" : "",
        ]);
        case "numbers": return Object.entries(st.statValues).filter(([, v]) => t(v)).map(([k, v]) => `${STAT_LABELS[k] ?? k}: ${t(v)}`);
        case "seasons": return (slotsFor(st.trade)?.seasons ?? []).filter((x) => t(st.seasonBodies[x.key] ?? "")).map((x) => `${x.label}: ${t(st.seasonBodies[x.key])}`);
        case "radius": return keep([st.serviceRadiusMiles]);
        case "offer": return keep([st.offerBadge]);
        case "tagline": return keep([st.tagline]);
        case "logo": return keep([st.images.logo ? "Uploaded" : st.logoChoice === "design" ? "We'll design one" : ""]);
        case "photos": return keep([st.images.heroSlides.length ? `${st.images.heroSlides.length} work photos` : "", st.images.aboutFeature ? "Team photo" : ""]);
        case "voice": return st.voice.length ? [st.voice.join(", ")] : [];
        case "setup": return keep([RECEPTIONIST_OPTIONS.find((o) => o.id === st.receptionistMode)?.label ?? ""]);
        case "hours": return keep([st.hours === CUSTOM_HOURS ? st.customHours : st.hours, t(st.agentName) && `Receptionist: ${t(st.agentName)}`]);
        default: return [];
    }
}

/** One row per service, under "details": its status and what was given for it. */
function serviceRows(st: WizardState, ctx: WizardContext): ReviewRow[] {
    const statuses = serviceStatuses(st, ctx);
    return st.services.map((sv, i) => {
        const f = st.serviceFacts[sv.name];
        const facts = f
            ? [
                  f.included.length ? C.dIncluded(f.included.length) : "",
                  f.typicalJobs.length ? C.dJobs(f.typicalJobs.length) : "",
                  f.priceFrom.trim() ? `Starting at ${f.priceFrom.trim()}` : "",
                  f.duration.trim(),
                  f.questions.filter((q) => q.q.trim()).length ? C.dQuestions(f.questions.filter((q) => q.q.trim()).length) : "",
                  f.photos.length ? C.dPhotos(f.photos.length) : "",
              ].filter(Boolean)
            : [];
        const status = statuses[i]?.state ?? "none";
        return {
            id: "details",
            label: sv.name,
            lines: [STATUS_LINE[status], ...(facts.length ? [facts.join(" · ")] : [])],
            skipped: false,
            service: sv.name,
        };
    });
}

/** The cards, in chapter order. Welcome and Review sit outside the chapters and get none. */
export function reviewCards(screens: ScreenDef[], st: WizardState, ctx: WizardContext): ReviewCard[] {
    return CHAPTERS.map((ch, i) => {
        const rows: ReviewRow[] = [];
        let answered = 0;
        let skipped = 0;
        for (const def of screens.filter((x) => x.chapter === i)) {
            if (def.id === "details") {
                rows.push(...serviceRows(st, ctx));
                continue;
            }
            const lines = detailLines(def.id, st, ctx);
            const isSkipped = !isAnswered(def.id, st) && lines.length === 0;
            if (isSkipped) skipped++;
            else answered++;
            rows.push({ id: def.id, label: def.nav, lines, skipped: isSkipped });
        }
        const peek = rows.filter((r) => !r.skipped && r.lines.length).slice(0, 2).map((r) => r.lines[0]);
        return { label: ch.label, rows, answered, skipped, peek };
    });
}
