/**
 * The arithmetic behind the Analytics tab, kept free of React and of server-only imports so the
 * page, the client sections and the tests all read one definition.
 *
 * Days are UTC `YYYYMMDD` strings throughout, because that is how the traffic payload buckets
 * its visits (`portal-traffic.ts` slices Vercel's ISO timestamps). Bucketing enquiries any other
 * way would put a 9pm enquiry on a different day from the visit that sent it.
 */

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export const DEFAULT_RANGE: AnalyticsRange = 30;

/** `?range=` as a supported window, falling back to 30 days for anything else. */
export function parseRange(raw: string | null | undefined): AnalyticsRange {
    const n = Number(raw);
    return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRange) : DEFAULT_RANGE;
}

const DAY_MS = 86_400_000;

/** UTC `YYYYMMDD` for an instant. */
export function utcDayKey(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}

export interface EnquiryWindow {
    /** Form enquiries in the window. */
    count: number;
    /** Form enquiries in the window of the same length just before it. */
    previous: number;
    /** The days in the window on which at least one enquiry arrived, for the chart markers. */
    days: string[];
}

export type EnquirySummary = Record<AnalyticsRange, EnquiryWindow>;

/**
 * Web-form enquiries per range, current and previous window.
 *
 * Every range is computed at once from one read of the leads, so switching 7/30/90 days on the
 * page costs no request. The window starts on the same UTC day the traffic query's `since`
 * does (`today − N days`), so "enquiries" and "visits" describe the same days.
 */
export function summarizeEnquiries(createdAt: string[], nowMs: number): EnquirySummary {
    const dayKeys = createdAt
        .map((iso) => new Date(iso).getTime())
        .filter((t) => !Number.isNaN(t) && t <= nowMs)
        .map(utcDayKey);

    const out = {} as EnquirySummary;
    for (const range of ANALYTICS_RANGES) {
        const since = utcDayKey(nowMs - range * DAY_MS);
        const prevSince = utcDayKey(nowMs - 2 * range * DAY_MS);
        const current = dayKeys.filter((d) => d >= since);
        out[range] = {
            count: current.length,
            previous: dayKeys.filter((d) => d >= prevSince && d < since).length,
            days: [...new Set(current)].sort(),
        };
    }
    return out;
}

/**
 * Visits → enquiries as a percentage and as "1 in N".
 *
 * Null when there were no visits, since a rate over nothing is not a fact. `oneIn` is null when
 * there were no enquiries: "1 in ∞" is not something to print either.
 */
export function enquiryRate(
    enquiries: number,
    visits: number,
): { pct: number; oneIn: number | null } | null {
    if (visits <= 0) return null;
    return {
        pct: (enquiries / visits) * 100,
        oneIn: enquiries > 0 ? Math.round(visits / enquiries) : null,
    };
}

/** "1.7%" — one decimal under 10%, whole numbers above, never "0.0%". */
export function formatRate(pct: number): string {
    if (pct === 0) return "0%";
    if (pct < 10) return `${pct.toFixed(1)}%`;
    return `${Math.round(pct)}%`;
}

/**
 * A referrer hostname as a client would name it.
 *
 * The names come from the approved Analytics mockup. Anything unrecognised keeps its hostname,
 * minus `www.`, which is honest and still readable.
 */
export function sourceLabel(channel: string): string {
    const host = channel.trim().toLowerCase().replace(/^www\./, "");
    if (!host || host === "direct") return "Typed it in / direct";
    if (host.startsWith("maps.google.") || host === "maps.app.goo.gl") return "Google Maps";
    if (/^(?:[a-z]+\.)?google\.[a-z.]+$/.test(host)) return "Google search";
    if (/(^|\.)facebook\.com$/.test(host) || host === "fb.com" || host === "fb.me") return "Facebook";
    return host;
}

export interface SourceRow {
    label: string;
    sessions: number;
    /** Share of all visits in the window, 0–100. */
    pct: number;
}

/**
 * Referrer rows merged by display name, largest first, plus "Everything else".
 *
 * Merging matters because Vercel reports `google.com` and `www.google.com` as different hosts,
 * which would print "Google search" twice. "Everything else" is the visits the top-N rows do
 * not account for, so the shares add up to the whole window rather than to the rows shown.
 */
export function sourceRows(
    sources: Array<{ channel: string; sessions: number }>,
    totalSessions: number,
): SourceRow[] {
    const merged = new Map<string, number>();
    for (const s of sources) {
        const label = sourceLabel(s.channel);
        merged.set(label, (merged.get(label) ?? 0) + s.sessions);
    }

    const rows = [...merged.entries()]
        .map(([label, sessions]) => ({ label, sessions }))
        .filter((r) => r.sessions > 0)
        .sort((a, b) => b.sessions - a.sessions);

    const listed = rows.reduce((n, r) => n + r.sessions, 0);
    const total = Math.max(totalSessions, listed);
    const rest = total - listed;
    if (rest > 0) rows.push({ label: "Everything else", sessions: rest });

    return rows.map((r) => ({ ...r, pct: total > 0 ? (r.sessions / total) * 100 : 0 }));
}

/** Vercel's device types, named the way the mockup names them. */
export function deviceLabel(device: string): string {
    const d = device.trim().toLowerCase();
    if (d === "desktop") return "Computer";
    if (d === "mobile") return "Phone";
    if (d === "tablet") return "Tablet";
    return device;
}

/**
 * A breakdown as whole-number shares that add up to 100, largest first.
 *
 * Largest-remainder rounding, so the parts always add up to 100. Rounding each share on its own
 * prints 33 / 33 / 33 for three equal devices, which a client will add up.
 */
export function shares(rows: Array<{ key: string; value: number }>): Array<{ key: string; pct: number }> {
    const total = rows.reduce((n, r) => n + r.value, 0);
    if (total <= 0) return [];
    const sorted = [...rows].filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
    const exact = sorted.map((r) => (r.value / total) * 100);
    const floors = exact.map(Math.floor);
    let left = 100 - floors.reduce((n, f) => n + f, 0);
    const order = exact
        .map((e, i) => ({ i, frac: e - floors[i] }))
        .sort((a, b) => b.frac - a.frac);
    for (const { i } of order) {
        if (left <= 0) break;
        floors[i] += 1;
        left -= 1;
    }
    return sorted.map((r, i) => ({ key: r.key, pct: floors[i] }));
}

/**
 * Top browsers as "Safari 48% · Chrome 41% · Other 11%": the two largest, then the rest.
 */
export function topBrowsers(rows: Array<{ browser: string; sessions: number }>): string | null {
    const split = shares(rows.map((r) => ({ key: r.browser, value: r.sessions })));
    if (split.length === 0) return null;
    const top = split.slice(0, 2);
    const other = split.slice(2).reduce((n, r) => n + r.pct, 0);
    const parts = top.map((r) => `${r.key} ${r.pct}%`);
    if (other > 0) parts.push(`Other ${other}%`);
    return parts.join(" · ");
}
