/**
 * Spoke proposals from Search Console demand (L12, Phase 3). Pure: rows in, proposals out.
 *
 * Xander's starting thresholds, 2026-11-12 (local-seo-architecture-decisions.md):
 *   - A spoke (service S, town T): over the last 90 days of final data, queries naming T and
 *     matching S reach 30+ impressions across 2+ different queries, or 2+ clicks.
 *   - At most 3 proposals per client per month.
 *   - A spoke live 180 days with under 20 impressions is proposed for merging back into its hub.
 * And from the plan he approved (section 4): T is never the main city (L4); T has a town page or
 * qualifies for one (L6); no page already targets (S, T); the spoke cap holds (L14, 15). Fewer
 * than 2 facts shared by S and T makes it "ask the client" rather than "approve". A town without
 * enough facts for a page of its own, but with 50+ impressions on queries naming it, gets a
 * proposal that is the questions to ask. Call-log and lead towns are a signal shown as counts,
 * never a threshold (L13).
 *
 * Nothing here publishes anything. A proposal is a suggestion the operator approves or declines
 * in the console; approving only adds a draft spoke, which still needs facts, copy and review.
 *
 * Google reports the searcher's country only, never their city, so the town comes from the query
 * text alone. Rare queries are hidden by Google, so small towns look emptier than they are.
 */

export interface SearchProfile {
    v: 1;
    siteSlug: string;
    property: string | null;
    verifiedAt: string | null;
    mainCity: string;
    caps: { area: number; spoke: number };
    towns: Array<{ name: string; slug: string; hub: boolean; qualifies: boolean; facts: number }>;
    services: Array<{ slug: string; name: string; terms: string[]; page: boolean }>;
    sharedFacts: Record<string, number>;
    spokes: Array<{ town: string; service: string; since: string }>;
    updatedAt: string;
}

export interface QueryRow {
    date: string; // YYYY-MM-DD
    query: string;
    page: string;
    clicks: number;
    impressions: number;
    position: number;
}

/** Page-only totals: they include queries Google hides, so a page's real reach shows. */
export interface PageRow {
    date: string;
    page: string;
    clicks: number;
    impressions: number;
}

export type ProposalKind = "spoke" | "ask-client" | "town-facts" | "fold";
export type ProposalStatus = "open" | "approved" | "declined" | "asked";

export interface ProposalEvidence {
    windowDays: number;
    impressions: number;
    clicks: number;
    /** The top queries behind it, most impressions first (at most 10). */
    queries: Array<{ query: string; impressions: number; clicks: number; position: number }>;
    /** L13: calls and web leads that mention the town. Counts only, never shown on a page. */
    signal?: { calls: number; leads: number };
}

export interface SeoProposal {
    id: string; // "spoke:<town-slug>:<service>", "town:<town-slug>", "fold:<town-slug>:<service>"
    kind: ProposalKind;
    town: string;
    service?: string;
    status: ProposalStatus;
    createdAt: string;
    decidedAt?: string;
    /** For "ask-client": what is still missing before it could be approved. */
    missing?: Array<"shared-facts" | "service-page">;
    evidence: ProposalEvidence;
}

export interface ProposalState {
    /** Ids of proposals still waiting for a decision. */
    open: string[];
    /** Proposals already decided, with when. */
    decided: Array<{ id: string; status: ProposalStatus; decidedAt: string }>;
    /** How many proposals this site already got this calendar month. */
    proposedThisMonth: number;
}

export type TownSignals = Record<string, { calls: number; leads: number }>;

export const WINDOW_DAYS = 90;
export const SPOKE_MIN_IMPRESSIONS = 30;
export const SPOKE_MIN_QUERIES = 2;
export const SPOKE_MIN_CLICKS = 2;
export const TOWN_MIN_IMPRESSIONS = 50;
export const FOLD_AFTER_DAYS = 180;
export const FOLD_MAX_IMPRESSIONS = 20;
export const PER_MONTH = 3;
export const SHARED_FACTS_MIN = 2;
/** A declined proposal, or one sent to the client, comes back no sooner than this. */
export const COOLDOWN_DAYS = 90;

/** Identical to normalizeTerm in jdd-ops lib/search-profile.js, which built the terms. */
export function normalizeTerm(s: string): string {
    return String(s ?? "")
        .trim()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

const padded = (s: string) => ` ${normalizeTerm(s)} `;

/** The client's towns a query names, as whole words. */
export function matchTowns(query: string, profile: SearchProfile): string[] {
    const q = padded(query);
    return profile.towns.filter((t) => q.includes(padded(t.name))).map((t) => t.name);
}

/** The services a query means: every word of one of a service's terms, in any order. */
export function matchServices(query: string, profile: SearchProfile): string[] {
    const words = new Set(normalizeTerm(query).split(" ").filter(Boolean));
    return profile.services
        .filter((s) => s.terms.some((term) => term.split(" ").every((w) => words.has(w))))
        .map((s) => s.slug);
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysBefore = (now: Date, n: number) => isoDay(new Date(now.getTime() - n * 86_400_000));
const same = (a: string, b: string) => normalizeTerm(a) === normalizeTerm(b);

function summarize(rows: QueryRow[], windowDays: number): ProposalEvidence {
    const byQuery = new Map<string, { impressions: number; clicks: number; posSum: number }>();
    for (const r of rows) {
        const e = byQuery.get(r.query) ?? { impressions: 0, clicks: 0, posSum: 0 };
        e.impressions += r.impressions;
        e.clicks += r.clicks;
        e.posSum += r.position * r.impressions;
        byQuery.set(r.query, e);
    }
    const queries = [...byQuery.entries()]
        .map(([query, e]) => ({
            query,
            impressions: e.impressions,
            clicks: e.clicks,
            position: e.impressions ? Math.round((e.posSum / e.impressions) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
    return {
        windowDays,
        impressions: queries.reduce((n, q) => n + q.impressions, 0),
        clicks: queries.reduce((n, q) => n + q.clicks, 0),
        queries: queries.slice(0, 10),
    };
}

function pathOf(url: string): string {
    try {
        return new URL(url).pathname.replace(/\/+$/, "") || "/";
    } catch {
        return url;
    }
}

/**
 * The proposals to create now, strongest first, already limited to this month's allowance.
 * Idempotent: a proposal that is open, approved, or declined/asked within the cooldown is never
 * produced again, and ids are stable for the same (service, town).
 */
export function evaluateProposals({
    profile,
    rows,
    pageRows,
    state,
    signals,
    now,
}: {
    profile: SearchProfile;
    rows: QueryRow[];
    pageRows: PageRow[];
    state: ProposalState;
    signals: TownSignals;
    now: Date;
}): SeoProposal[] {
    const from = daysBefore(now, WINDOW_DAYS);
    const recent = rows.filter((r) => r.date >= from && r.impressions + r.clicks > 0);
    const createdAt = now.toISOString();
    const townSlug = new Map(profile.towns.map((t) => [t.name, t.slug]));

    const blocked = new Set(state.open);
    for (const d of state.decided) {
        if (d.status === "approved") blocked.add(d.id);
        else if (d.status === "declined" || d.status === "asked") {
            if (d.decidedAt >= daysBefore(now, COOLDOWN_DAYS)) blocked.add(d.id);
        }
    }

    const signalFor = (town: string) => {
        const s = signals[town];
        return s ? { calls: s.calls, leads: s.leads } : undefined;
    };

    // Group the window's rows by the (town, service) pairs and towns they name.
    const pairRows = new Map<string, QueryRow[]>();
    const townRows = new Map<string, QueryRow[]>();
    for (const r of recent) {
        const towns = matchTowns(r.query, profile).filter((t) => !same(t, profile.mainCity));
        if (!towns.length) continue;
        const services = matchServices(r.query, profile);
        for (const t of towns) {
            townRows.set(t, [...(townRows.get(t) ?? []), r]);
            for (const s of services) {
                const k = `${t}|${s}`;
                pairRows.set(k, [...(pairRows.get(k) ?? []), r]);
            }
        }
    }

    const liveSpokes = new Set(profile.spokes.map((s) => `${normalizeTerm(s.town)}|${s.service}`));
    let spokeSlots = profile.caps.spoke - profile.spokes.length - state.open.filter((id) => id.startsWith("spoke:")).length;

    const candidates: SeoProposal[] = [];

    for (const [key, group] of pairRows) {
        const [town, service] = key.split("|");
        const t = profile.towns.find((x) => x.name === town);
        const s = profile.services.find((x) => x.slug === service);
        if (!t || !s || !(t.hub || t.qualifies)) continue;
        if (liveSpokes.has(`${normalizeTerm(town)}|${service}`)) continue;
        const id = `spoke:${t.slug}:${service}`;
        if (blocked.has(id)) continue;
        const evidence = summarize(group, WINDOW_DAYS);
        const distinct = evidence.queries.filter((q) => q.impressions > 0).length;
        const strong =
            (evidence.impressions >= SPOKE_MIN_IMPRESSIONS && distinct >= SPOKE_MIN_QUERIES) || evidence.clicks >= SPOKE_MIN_CLICKS;
        if (!strong) continue;
        const missing: SeoProposal["missing"] = [];
        if ((profile.sharedFacts[key] ?? 0) < SHARED_FACTS_MIN) missing.push("shared-facts");
        if (!s.page) missing.push("service-page");
        const signal = signalFor(town);
        candidates.push({
            id,
            kind: missing.length ? "ask-client" : "spoke",
            town,
            service,
            status: "open",
            createdAt,
            ...(missing.length ? { missing } : {}),
            evidence: signal ? { ...evidence, signal } : evidence,
        });
    }

    for (const [town, group] of townRows) {
        const t = profile.towns.find((x) => x.name === town);
        if (!t || t.hub || t.qualifies) continue;
        const id = `town:${t.slug}`;
        if (blocked.has(id)) continue;
        const evidence = summarize(group, WINDOW_DAYS);
        if (evidence.impressions < TOWN_MIN_IMPRESSIONS) continue;
        const signal = signalFor(town);
        candidates.push({ id, kind: "town-facts", town, status: "open", createdAt, evidence: signal ? { ...evidence, signal } : evidence });
    }

    const foldFrom = daysBefore(now, FOLD_AFTER_DAYS);
    for (const sp of profile.spokes) {
        if (sp.since.slice(0, 10) > foldFrom) continue;
        const slug = townSlug.get(sp.town);
        if (!slug) continue;
        const id = `fold:${slug}:${sp.service}`;
        if (blocked.has(id)) continue;
        const path = `/areas/${slug}/${sp.service}`;
        const hits = pageRows.filter((p) => p.date >= foldFrom && pathOf(p.page) === path);
        const impressions = hits.reduce((n, p) => n + p.impressions, 0);
        if (impressions >= FOLD_MAX_IMPRESSIONS) continue;
        candidates.push({
            id,
            kind: "fold",
            town: sp.town,
            service: sp.service,
            status: "open",
            createdAt,
            evidence: { windowDays: FOLD_AFTER_DAYS, impressions, clicks: hits.reduce((n, p) => n + p.clicks, 0), queries: [] },
        });
    }

    const rank: Record<ProposalKind, number> = { spoke: 0, "ask-client": 0, "town-facts": 1, fold: 2 };
    candidates.sort(
        (a, b) =>
            rank[a.kind] - rank[b.kind] ||
            b.evidence.clicks - a.evidence.clicks ||
            b.evidence.impressions - a.evidence.impressions ||
            (b.evidence.signal ? b.evidence.signal.calls + b.evidence.signal.leads : 0) -
                (a.evidence.signal ? a.evidence.signal.calls + a.evidence.signal.leads : 0) ||
            a.id.localeCompare(b.id),
    );

    const out: SeoProposal[] = [];
    let allowance = Math.max(0, PER_MONTH - state.proposedThisMonth);
    for (const p of candidates) {
        if (allowance <= 0) break;
        if (p.id.startsWith("spoke:")) {
            if (spokeSlots <= 0) continue;
            spokeSlots--;
        }
        out.push(p);
        allowance--;
    }
    return out;
}
