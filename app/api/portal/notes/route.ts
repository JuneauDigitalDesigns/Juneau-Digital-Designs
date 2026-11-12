import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { getCustomer, updateCustomer } from "@/app/lib/portal-crm";
import { LEGACY_NOTE_ID, parseNoteBody } from "@/app/lib/crm-jobs";
import { createNote, deleteNote, updateNote } from "@/app/lib/portal-jobs";

export const runtime = "nodejs";

/**
 * A customer's notes: write, edit, delete. Growth and Enterprise only.
 *
 * Read through the customer record's GET, which also folds them into the timeline.
 *
 * **The old single note.** Before this, a customer had one free-text `note`. It is shown as the
 * oldest note under the id `LEGACY_NOTE_ID` and only rewritten when the client touches it:
 * editing it makes it a real note (keeping the customer's date) and clears the old field;
 * deleting it clears the old field. Both need the `customerId`, since that note has no record of
 * its own.
 */
async function open(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return { ok: false as const, response: ctx.response };
    if (siteFeature(ctx.site, "crm").state !== "ready") {
        return {
            ok: false as const,
            response: NextResponse.json({ error: "Not available on this site." }, { status: 403 }),
        };
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return {
            ok: false as const,
            response: NextResponse.json({ error: "Invalid request body" }, { status: 400 }),
        };
    }
    const b = (body ?? {}) as Record<string, unknown>;
    return {
        ok: true as const,
        userId: ctx.userId,
        acct: accountScope(ctx.account.email),
        slug: ctx.site.slug,
        b,
        str: (k: string) => (typeof b[k] === "string" ? (b[k] as string) : null),
    };
}

const missing = () => NextResponse.json({ error: "No such note" }, { status: 404 });
const empty = () => NextResponse.json({ error: "A note needs some words." }, { status: 400 });

export async function POST(request: Request) {
    const o = await open(request);
    if (!o.ok) return o.response;
    const customerId = o.str("customerId");
    const body = parseNoteBody(o.b.body);
    if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    if (!body) return empty();
    const note = await createNote(o.acct, o.slug, customerId, body);
    if (!note) return NextResponse.json({ error: "No such customer" }, { status: 404 });
    return NextResponse.json({ ok: true, note }, { status: 201 });
}

export async function PATCH(request: Request) {
    const o = await open(request);
    if (!o.ok) return o.response;
    const noteId = o.str("noteId");
    const body = parseNoteBody(o.b.body);
    if (!noteId) return NextResponse.json({ error: "noteId is required" }, { status: 400 });
    if (!body) return empty();

    if (noteId === LEGACY_NOTE_ID) {
        const customer = await getCustomer(o.acct, o.slug, o.str("customerId") ?? "");
        if (!customer?.note) return missing();
        const note = await createNote(o.acct, o.slug, customer.customerId, body, customer.createdAt);
        await updateCustomer(o.acct, o.slug, customer.customerId, { note: null }, o.userId);
        return NextResponse.json({ ok: true, note });
    }

    const note = await updateNote(o.acct, o.slug, noteId, body);
    if (!note) return missing();
    return NextResponse.json({ ok: true, note });
}

export async function DELETE(request: Request) {
    const o = await open(request);
    if (!o.ok) return o.response;
    const noteId = o.str("noteId");
    if (!noteId) return NextResponse.json({ error: "noteId is required" }, { status: 400 });

    if (noteId === LEGACY_NOTE_ID) {
        const customer = await getCustomer(o.acct, o.slug, o.str("customerId") ?? "");
        if (!customer?.note) return missing();
        await updateCustomer(o.acct, o.slug, customer.customerId, { note: null }, o.userId);
        return NextResponse.json({ ok: true });
    }

    if (!(await deleteNote(o.acct, o.slug, noteId))) return missing();
    return NextResponse.json({ ok: true });
}
