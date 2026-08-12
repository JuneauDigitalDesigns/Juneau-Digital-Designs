import "server-only";

/**
 * Is the client's site actually answering right now?
 *
 * Mirrors `jdd-ops/console/src/lib/probe.ts`. This is the one number on the Overview that
 * is measured at the moment the page loads rather than read from a cache of someone else's
 * cache — it's what makes the health strip mean "up", not "was up".
 */

const TIMEOUT_MS = 4000;

export interface ProbeResult {
    ok: boolean;
    status: number | null;
    ms: number | null;
}

export async function probeUrl(url: string): Promise<ProbeResult> {
    const started = Date.now();

    // HEAD first — a full GET on a Next.js page pulls the whole document for a number we
    // throw away. Some hosts reject HEAD with 405, so fall back rather than report down.
    for (const method of ["HEAD", "GET"] as const) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(url, {
                method,
                redirect: "follow",
                signal: controller.signal,
                headers: { "user-agent": "jdd-portal-healthcheck" },
                next: { revalidate: 0 },
            });

            if (method === "HEAD" && (res.status === 405 || res.status === 501)) continue;

            return { ok: res.ok, status: res.status, ms: Date.now() - started };
        } catch {
            if (method === "GET") return { ok: false, status: null, ms: null };
        } finally {
            clearTimeout(timer);
        }
    }

    return { ok: false, status: null, ms: null };
}
