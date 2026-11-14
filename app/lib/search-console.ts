import "server-only";

/**
 * JDD's Google Search Console read access, for the nightly job (L11/L12).
 *
 * One JDD Workspace account verifies every client site (the organization blocks service-account
 * keys). The local console holds that account's OAuth client and refresh token in files; this
 * deployment holds its own copy in env:
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN
 * The token can act as owner on every client property, so it never reaches a response, a log or
 * the client. Only Search Analytics is read here; verifying and leaving properties is the
 * console's job (jdd-ops lib/search-console.js).
 */

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const WM = "https://www.googleapis.com/webmasters/v3";
/** Google's per-request maximum. */
export const ROW_LIMIT = 25_000;

export function searchConsoleConfigured(): boolean {
    return Boolean(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
            process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
            process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN,
    );
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
    if (cached && cached.exp > Date.now() + 60_000) return cached.token;
    const r = await fetch(TOKEN_URI, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN ?? "",
            client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
            client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
        }),
    });
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    // The error code only: nothing from the request (which carried the token) is echoed.
    if (!r.ok || !j.access_token) throw new Error(`Google token refresh failed (${r.status}${j.error ? `: ${j.error}` : ""})`);
    cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return cached.token;
}

/** For tests: forget the cached access token. */
export function resetSearchConsoleToken(): void {
    cached = null;
}

export interface AnalyticsRow {
    keys: string[];
    clicks: number;
    impressions: number;
    position: number;
}

/**
 * Every row for the range, paging until Google returns a short page. `dataState: "final"` is
 * Google's default and is stated anyway: fresh data changes, and stored days must not.
 */
export async function querySearchAnalytics(
    property: string,
    { startDate, endDate, dimensions }: { startDate: string; endDate: string; dimensions: string[] },
    { pauseMs = 200 }: { pauseMs?: number } = {},
): Promise<AnalyticsRow[]> {
    const out: AnalyticsRow[] = [];
    for (let startRow = 0; ; startRow += ROW_LIMIT) {
        const r = await fetch(`${WM}/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
            method: "POST",
            headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
            body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: ROW_LIMIT, startRow, dataState: "final" }),
        });
        const j = (await r.json().catch(() => ({}))) as { rows?: AnalyticsRow[]; error?: { message?: string } };
        if (!r.ok) throw new Error(`Search Analytics ${r.status}${j.error?.message ? `: ${j.error.message}` : ""}`);
        const rows = j.rows ?? [];
        out.push(...rows);
        if (rows.length < ROW_LIMIT) return out;
        if (pauseMs) await new Promise((res) => setTimeout(res, pauseMs));
    }
}
