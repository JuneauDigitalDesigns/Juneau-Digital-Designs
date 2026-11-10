import { promotionInput, type InboxItem } from "@/app/lib/crm-contacts";

/**
 * Every request the Inbox makes, in one place.
 *
 * "Remind me" talks to a route that does not exist yet: it is being built in a separate change
 * against `side-session-notes/inbox-snooze-templates-api-shape.md`, and this module is coded
 * to that shape so the UI can land first:
 *
 *   POST/DELETE /api/portal/inbox/remind?site=     { ids, at } / { ids }
 *
 * Until it lands, a 404 (or 405) comes back as `unsupported`, and the component hides the
 * control instead of showing an error — "hidden, not broken".
 *
 * Nothing here texts anyone. Texting lives on the customer card only (Growth/Enterprise, A2P
 * verified), not in the Inbox.
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

/** Web enquiries only: a call is a row in the client's own Airtable log. */
export async function deleteLead(site: string, id: string): Promise<Result> {
    const { res, json } = await send(`/api/portal/inbox/delete${q(site)}`, "POST", { id });
    return res?.ok
        ? { ok: true }
        : { ok: false, error: errorOf(json) ?? "We couldn't delete that. Please try again." };
}
