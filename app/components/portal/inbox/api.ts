import { promotionInput, type InboxItem } from "@/app/lib/crm-contacts";

/**
 * Every request the Inbox makes, in one place.
 *
 * Two of these talk to routes that do not exist yet. "Remind me" and quick replies are being
 * built in a separate change against `side-session-notes/inbox-snooze-templates-api-shape.md`,
 * and this module is coded to that shape so the UI can land first:
 *
 *   POST/DELETE /api/portal/inbox/remind?site=     { ids, at } / { ids }
 *   GET/POST    /api/portal/reply-templates?site=  → { templates: [{ id, body, builtIn }] }
 *   PATCH/DELETE /api/portal/reply-templates/:id?site=
 *
 * Until they land, a 404 (or 405) comes back as `unsupported`, and the component hides the
 * control instead of showing an error — "hidden, not broken". Nothing else in the Inbox needs
 * to know whether the backend is there.
 */

export type Result<T = undefined> =
    | ({ ok: true } & (T extends undefined ? object : { value: T }))
    | { ok: false; unsupported?: boolean; error?: string };

const q = (site: string) => `?site=${encodeURIComponent(site)}`;

async function send(
    url: string,
    method: string,
    body?: unknown,
): Promise<{ res: Response | null; json: Record<string, unknown> }> {
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

/* ── Done (stored as `archived`) ──────────────────────────────────────────── */

export async function setDone(site: string, ids: string[], done: boolean): Promise<boolean> {
    const { res } = await send(`/api/portal/inbox/archive${q(site)}`, "POST", { ids, archived: done });
    return Boolean(res?.ok);
}

/* ── Remind me ────────────────────────────────────────────────────────────── */

export async function remind(site: string, ids: string[], at: Date): Promise<Result> {
    const { res, json } = await send(`/api/portal/inbox/remind${q(site)}`, "POST", {
        ids,
        at: at.toISOString(),
    });
    if (res?.ok) return { ok: true };
    return { ok: false, unsupported: missing(res), error: errorOf(json) };
}

/** What Undo calls. */
export async function cancelRemind(site: string, ids: string[]): Promise<Result> {
    const { res, json } = await send(`/api/portal/inbox/remind${q(site)}`, "DELETE", { ids });
    if (res?.ok) return { ok: true };
    return { ok: false, unsupported: missing(res), error: errorOf(json) };
}

/* ── Quick replies ────────────────────────────────────────────────────────── */

export interface ReplyTemplate {
    id: string;
    body: string;
    builtIn: boolean;
}

function asTemplates(json: Record<string, unknown>): ReplyTemplate[] | null {
    if (!Array.isArray(json.templates)) return null;
    return json.templates.flatMap((t): ReplyTemplate[] => {
        const r = (t ?? {}) as Record<string, unknown>;
        return typeof r.id === "string" && typeof r.body === "string"
            ? [{ id: r.id, body: r.body, builtIn: r.builtIn === true }]
            : [];
    });
}

/**
 * `unsupported` covers anything that is not the documented shape, not only a 404: an HTML
 * error page or a payload without `templates` means the feature is not usable, and the right
 * response to that is the same — no chips.
 */
export async function listTemplates(site: string): Promise<Result<ReplyTemplate[]>> {
    const { res, json } = await send(`/api/portal/reply-templates${q(site)}`, "GET");
    const templates = res?.ok ? asTemplates(json) : null;
    if (templates) return { ok: true, value: templates };
    return { ok: false, unsupported: missing(res) || Boolean(res?.ok), error: errorOf(json) };
}

export async function createTemplate(site: string, body: string): Promise<Result> {
    const { res, json } = await send(`/api/portal/reply-templates${q(site)}`, "POST", { body });
    return res?.ok ? { ok: true } : { ok: false, unsupported: missing(res), error: errorOf(json) };
}

export async function updateTemplate(site: string, id: string, body: string): Promise<Result> {
    const { res, json } = await send(
        `/api/portal/reply-templates/${encodeURIComponent(id)}${q(site)}`,
        "PATCH",
        { body },
    );
    return res?.ok ? { ok: true } : { ok: false, unsupported: missing(res), error: errorOf(json) };
}

export async function deleteTemplate(site: string, id: string): Promise<Result> {
    const { res, json } = await send(
        `/api/portal/reply-templates/${encodeURIComponent(id)}${q(site)}`,
        "DELETE",
    );
    return res?.ok ? { ok: true } : { ok: false, unsupported: missing(res), error: errorOf(json) };
}

/* ── existing routes ──────────────────────────────────────────────────────── */

/**
 * Make the lead a customer. Idempotent on the number: `createCustomer` returns the customer who
 * already holds it (and still marks this item promoted) rather than making a second one.
 */
export async function promote(site: string, item: InboxItem): Promise<Result<string>> {
    const { res, json } = await send(`/api/portal/customers${q(site)}`, "POST", promotionInput(item));
    const customer = (json.customer ?? {}) as { customerId?: unknown };
    if (res?.ok && typeof customer.customerId === "string") {
        return { ok: true, value: customer.customerId };
    }
    return { ok: false, error: errorOf(json) ?? "We couldn't add that customer. Please try again." };
}

/**
 * Text a lead from the business number.
 *
 * `/api/portal/messages` only ever texts a *customer record* — that is its compliance rule
 * ("the recipient must already be a customer with a number, i.e. someone who reached out"),
 * and it is also the only place a sent message is kept. So a text from the Inbox promotes the
 * lead first (a no-op when their number is already a customer) and then sends to that record.
 * Every refusal the route makes — opted out, said no on the call, not yet asked — comes back
 * as its own message and is shown as is.
 */
export async function textLead(site: string, item: InboxItem, body: string): Promise<Result> {
    const promoted = await promote(site, item);
    if (!promoted.ok) return promoted;
    const { res, json } = await send(`/api/portal/messages${q(site)}`, "POST", {
        customerId: promoted.value,
        body,
    });
    if (res?.ok) return { ok: true };
    return { ok: false, error: errorOf(json) ?? "We couldn't send that just now. Please try again in a moment." };
}

/** Web enquiries only: a call is a row in the client's own Airtable log. */
export async function deleteLead(site: string, id: string): Promise<Result> {
    const { res, json } = await send(`/api/portal/inbox/delete${q(site)}`, "POST", { id });
    return res?.ok
        ? { ok: true }
        : { ok: false, error: errorOf(json) ?? "We couldn't delete that. Please try again." };
}
