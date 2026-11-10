/**
 * Quick replies for the customer card's composer: the API client and the greeting rule.
 *
 * The routes do not exist yet. They are being built in a separate change against
 * `side-session-notes/inbox-snooze-templates-api-shape.md`, and this is coded to that shape:
 *
 *   GET/POST     /api/portal/reply-templates?site=      → { templates: [{ id, body, builtIn }] }
 *   PATCH/DELETE /api/portal/reply-templates/:id?site=
 *
 * Anything other than that shape — a 404 today, an HTML error page, a payload without
 * `templates` — reads as `unsupported`, and the card draws no quick replies at all. A template
 * only ever fills the composer; sending is still the one `/api/portal/messages` path.
 *
 * Texting, and so quick replies, live on the customer card only: Growth/Enterprise with A2P
 * verified (Xander, 2026-11-09). The Inbox has neither.
 */

export interface ReplyTemplate {
    id: string;
    body: string;
    builtIn: boolean;
}

export type TemplateResult =
    | { ok: true }
    | { ok: false; unsupported?: boolean; error?: string };

const q = (site: string) => `?site=${encodeURIComponent(site)}`;
const base = "/api/portal/reply-templates";

async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    }).catch(() => null);
    const json = res ? ((await res.json().catch(() => ({}))) as Record<string, unknown>) : {};
    return { res, json };
}

/** A route that is not there yet answers 404 (Next) or 405 (a sibling handler exists). */
const missing = (res: Response | null) => res?.status === 404 || res?.status === 405;
const errorOf = (json: Record<string, unknown>) =>
    typeof json.error === "string" ? json.error : undefined;

/** The documented shape, or null for anything else. Malformed entries are dropped. */
export function parseTemplates(json: unknown): ReplyTemplate[] | null {
    const list = (json as { templates?: unknown } | null)?.templates;
    if (!Array.isArray(list)) return null;
    return list.flatMap((t): ReplyTemplate[] => {
        const r = (t ?? {}) as Record<string, unknown>;
        return typeof r.id === "string" && typeof r.body === "string" && r.body.trim()
            ? [{ id: r.id, body: r.body, builtIn: r.builtIn === true }]
            : [];
    });
}

export async function listTemplates(
    site: string,
): Promise<{ ok: true; templates: ReplyTemplate[] } | { ok: false }> {
    const { res, json } = await call(`${base}${q(site)}`, "GET");
    const templates = res?.ok ? parseTemplates(json) : null;
    return templates ? { ok: true, templates } : { ok: false };
}

function result(res: Response | null, json: Record<string, unknown>): TemplateResult {
    return res?.ok ? { ok: true } : { ok: false, unsupported: missing(res), error: errorOf(json) };
}

export async function createTemplate(site: string, body: string): Promise<TemplateResult> {
    const { res, json } = await call(`${base}${q(site)}`, "POST", { body });
    return result(res, json);
}

export async function updateTemplate(site: string, id: string, body: string): Promise<TemplateResult> {
    const { res, json } = await call(`${base}/${encodeURIComponent(id)}${q(site)}`, "PATCH", { body });
    return result(res, json);
}

export async function deleteTemplate(site: string, id: string): Promise<TemplateResult> {
    const { res, json } = await call(`${base}/${encodeURIComponent(id)}${q(site)}`, "DELETE");
    return result(res, json);
}

/* ── the greeting ─────────────────────────────────────────────────────────── */

/**
 * The first name to greet, or null.
 *
 * Null for a customer with no name, and for a "name" that is really a number, which some call
 * logs write into the name column. "Hi (512)," is worse than "Hi,".
 */
export function firstName(name: string | null): string | null {
    const n = name?.trim();
    if (!n || /^[\d(+]/.test(n)) return null;
    return n.split(/\s+/)[0] ?? null;
}

/**
 * A quick reply, greeted: "Hi Dave, " + the body with its first letter lowered so it reads as
 * one sentence. A body that opens with "I" keeps it, because "Hi Dave, i'll" is a typo. The
 * stored body never carries the greeting (the API shape note asks for that).
 */
export function prefillReply(name: string | null, body: string): string {
    const first = firstName(name);
    const text = body.trim();
    const keep = /^I(\b|['’])/.test(text);
    const joined = keep || !text ? text : text.charAt(0).toLowerCase() + text.slice(1);
    return `${first ? `Hi ${first}, ` : "Hi, "}${joined}`;
}
