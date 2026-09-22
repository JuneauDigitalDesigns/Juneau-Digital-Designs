import "server-only";

/**
 * Turn a stored `canonical` / `siteUrl` value into something safe to hand to a screenshot
 * API. These values come from `PortalSite.canonical` (see `jdd-schema`'s `attachSiteToPortal`
 * / `buildPortalSiteEntries`), which can be:
 *  - schemeless (some call sites store/compare it without `https://`, e.g. `portal-infra.ts`),
 *  - absent entirely (the key is omitted when neither the site's own domain nor its Vercel
 *    host could be resolved).
 *
 * Returns null for both cases — callers must skip capture rather than pass an empty or
 * malformed URL to an external service.
 */
export function resolveShotUrl(raw: string | null | undefined): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const parsed = new URL(withScheme);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

export interface CapturedScreenshot {
    bytes: Buffer;
    contentType: string;
}

/**
 * Capture a screenshot of a live URL via Microlink's free API (no API key, no Chromium to
 * host). Subject to Microlink's free-tier rate limits and occasional failures, so every
 * caller wraps this in try/catch and treats a thrown error as "no image yet" — never a hard
 * failure of the opt-in or publish flow it's part of.
 */
export async function captureScreenshot(url: string): Promise<CapturedScreenshot> {
    const api = new URL("https://api.microlink.io/");
    api.searchParams.set("url", url);
    api.searchParams.set("screenshot", "true");
    api.searchParams.set("meta", "false");
    api.searchParams.set("viewport.width", "1280");
    api.searchParams.set("viewport.height", "800");

    const res = await fetch(api.toString());
    if (!res.ok) {
        throw new Error(`Microlink request failed (${res.status})`);
    }

    const data = (await res.json()) as {
        status?: string;
        data?: { screenshot?: { url?: string } };
        message?: string;
    };
    const shotUrl = data?.data?.screenshot?.url;
    if (data.status !== "success" || !shotUrl) {
        throw new Error(data?.message || "Microlink returned no screenshot");
    }

    const imgRes = await fetch(shotUrl);
    if (!imgRes.ok) {
        throw new Error(`Screenshot image fetch failed (${imgRes.status})`);
    }
    const contentType = imgRes.headers.get("content-type") || "image/png";
    const bytes = Buffer.from(await imgRes.arrayBuffer());
    return { bytes, contentType };
}
