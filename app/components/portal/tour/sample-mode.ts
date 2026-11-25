import type { SampleTrade } from "@/app/data/trade-samples";
import {
    TOUR_LEAD_ID,
    sampleCalendar,
    sampleCustomers,
    sampleInbox,
    sampleRecord,
    sampleTranscript,
} from "./sample-data";

/**
 * Sample mode: the portal shows the trade's sample data while the tour runs (Xander, 19 Nov 2026).
 *
 * The Inbox, Customers, the customer record and the Calendar each fetch their own data from
 * `/api/portal/*` in the browser, from many call sites. Rather than teach every one of them about
 * the tour, sample mode answers those requests here, in the shapes the routes themselves return,
 * for exactly as long as the tour runs. The Home page renders on the server, so it reads the same
 * samples there (`?tour=1`, see `app/portal/(dash)/page.tsx`).
 *
 * Two rules keep it safe:
 *
 * 1. **Nothing the tour shows is saved.** Every write to the portal's lead and customer routes is
 *    answered here and never reaches the server, so a tap on a sample customer (Done, a stage
 *    change, Review) can't touch the client's real records, send a text or ask for a review.
 * 2. **Everything else is the real thing.** Routes it does not know (settings, billing, analytics,
 *    support, the review message, the tour's own progress) pass straight through.
 *
 * `sampleAnswer` is the whole decision, pure, so it is tested directly
 * (`test/portal-tour-sample-mode.test.mjs`).
 */

export interface SampleAnswer {
    status: number;
    body: unknown;
}

/** The portal routes whose data the tour replaces. Writes to these never leave the browser. */
const SAMPLE_ROUTES = /^\/api\/portal\/(inbox|customers|tasks|jobs|notes|appointments|messages|review-request|calls)(\/|$)/;

export function sampleAnswer(
    pathname: string,
    method: string,
    opts: { trade: SampleTrade; now: Date; growth: boolean; webOnly?: boolean },
): SampleAnswer | null {
    if (!SAMPLE_ROUTES.test(pathname)) return null;
    const { trade, now, growth, webOnly = false } = opts;
    const m = method.toUpperCase();

    if (m !== "GET") {
        // Promotion answers with the customer it made; everything else just succeeds.
        if (pathname === "/api/portal/customers" && m === "POST") return { status: 200, body: { ok: true, customer: { customerId: TOUR_LEAD_ID } } };
        return { status: 200, body: { ok: true } };
    }

    if (pathname === "/api/portal/inbox") {
        const items = sampleInbox(trade, now, { webOnly });
        return { status: 200, body: { state: "ready", items, canPromote: growth, truncated: false } };
    }
    if (pathname === "/api/portal/customers") {
        return {
            status: 200,
            body: { state: "ready", customers: sampleCustomers(trade, now), messagingReady: true, messagingState: "ready", reviewLinkConfigured: true },
        };
    }
    const record = pathname.match(/^\/api\/portal\/customers\/([^/]+)$/);
    if (record) {
        const data = sampleRecord(trade, decodeURIComponent(record[1]), now);
        return data ? { status: 200, body: data } : { status: 404, body: { error: "No such customer" } };
    }
    if (pathname === "/api/portal/appointments") return { status: 200, body: sampleCalendar(trade, now) };
    const transcript = pathname.match(/^\/api\/portal\/calls\/([^/]+)\/transcript$/);
    if (transcript && decodeURIComponent(transcript[1]) === TOUR_LEAD_ID) return { status: 200, body: { turns: sampleTranscript(trade) } };
    // A sample call has no recording or transcript on Retell: answer as the route does.
    if (pathname.startsWith("/api/portal/calls/")) return { status: 404, body: { error: "Not found" } };
    // Any other read of a sample route (tasks, jobs, notes, messages): nothing extra to show.
    return { status: 200, body: { state: "ready", items: [] } };
}

let realFetch: typeof fetch | null = null;

/** Start answering the portal's lead and customer requests with the trade's sample data. */
export function startSampleMode(opts: { trade: SampleTrade; growth: boolean; webOnly?: boolean; now?: Date }): void {
    if (typeof window === "undefined" || realFetch) return;
    const real = window.fetch.bind(window);
    realFetch = real;
    const now = opts.now ?? new Date();
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return real(input, init);
        const method = init?.method ?? (input instanceof Request ? input.method : "GET");
        const answer = sampleAnswer(url.pathname, method, { trade: opts.trade, now, growth: opts.growth, webOnly: opts.webOnly });
        if (!answer) return real(input, init);
        return Promise.resolve(
            new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "Content-Type": "application/json" } }),
        );
    };
}

/** Back to the real portal. */
export function stopSampleMode(): void {
    if (typeof window === "undefined" || !realFetch) return;
    window.fetch = realFetch;
    realFetch = null;
}

export function sampleModeOn(): boolean {
    return realFetch !== null;
}
