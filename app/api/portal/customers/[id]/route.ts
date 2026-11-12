import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { fetchCalls } from "@/app/lib/airtable-calls";
import {
    getCustomer,
    listActivity,
    listMessages,
    listTasks,
    markThreadRead,
    type Activity,
} from "@/app/lib/portal-crm";
import { duration } from "@/app/lib/duration";
import { callTouchesPhone, markOrigin } from "@/app/lib/crm-contacts";
import { notesAsTimeline, withLegacyNote } from "@/app/lib/crm-jobs";
import { listJobs, listNotes } from "@/app/lib/portal-jobs";

export const runtime = "nodejs";

/**
 * One customer's full record: stored activity, their calls, their message thread, their tasks.
 *
 * Calls are **not** copied into the activity log at promotion time — they live in Airtable and
 * are folded in here on read. Copying them would mean a call summary edited upstream silently
 * disagreeing with the timeline, and would double the storage for data we do not own.
 *
 * Opening a record marks its thread read; that is a deliberate side effect of a GET, matching
 * how every mail client behaves.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    if (siteFeature(ctx.site, "crm").state !== "ready") {
        return NextResponse.json({ error: "Not available on this site." }, { status: 403 });
    }

    const { id } = await context.params;
    const acct = accountScope(ctx.account.email);
    const slug = ctx.site.slug;

    const customer = await getCustomer(acct, slug, id);
    if (!customer) return NextResponse.json({ error: "No such customer" }, { status: 404 });

    const [stored, messages, allTasks, jobs, storedNotes] = await Promise.all([
        listActivity(acct, slug, id),
        listMessages(acct, slug, id),
        listTasks(acct, slug),
        listJobs(acct, slug, id),
        listNotes(acct, slug, id),
    ]);
    // The Notes tab's list, the old single note last. Also folded into the timeline below, on
    // read like calls, so an edited note reads as edited and a deleted one is gone.
    const notes = withLegacyNote(storedNotes, customer);

    // Their calls, folded in from the call log.
    const callActivity: Activity[] = [];
    if (customer.phone && siteFeature(ctx.site, "calls").state === "ready") {
        const apiKey = process.env.AIRTABLE_API_KEY;
        if (apiKey) {
            const baseId = ctx.site.airtableBaseId as string;
            const scopeToSite = ctx.account.sites.some(
                (s) => s.slug !== slug && s.airtableBaseId === baseId,
            );
            const res = await fetchCalls({
                baseId,
                apiKey,
                siteSlug: slug,
                scopeToSite,
                acctScope: acct,
            });
            if (res.ok) {
                for (const call of res.calls) {
                    if (!callTouchesPhone(call, customer.phone)) continue;
                    callActivity.push({
                        id: `call:${call.id}`,
                        kind: "call",
                        at: call.date ?? customer.createdAt,
                        summary: `${customer.name ?? "They"} called${
                            call.durationSeconds ? ` — ${duration(call.durationSeconds)}` : ""
                        }`,
                        actor: "customer",
                        meta: {
                            detail: call.summary,
                            recordingUrl: call.recordingUrl,
                            durationSeconds: call.durationSeconds,
                        },
                    });
                }
            }
        }
    }

    // Messages become timeline entries too, so the story reads in one column.
    const messageActivity: Activity[] = messages.map((m) => ({
        id: `msg:${m.id}`,
        kind: m.direction === "in" ? "sms-in" : "sms-out",
        at: m.at,
        summary:
            m.direction === "in"
                ? `${customer.name ?? "They"} texted you`
                : "You texted them",
        actor: m.direction === "in" ? "customer" : "client",
        meta: { body: m.body, status: m.status },
    }));

    const timeline = markOrigin(
        [...stored, ...callActivity, ...messageActivity, ...notesAsTimeline(notes)].sort(
            (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        ),
        customer.sourceRef,
    );

    /**
     * The customer came from a call we can no longer show them.
     *
     * `fetchCalls` reads at most `MAX_RECORDS` rows, and a row can be deleted upstream, so a
     * long-standing customer's originating call eventually falls out of the window. The record
     * then has a `sourceRef` pointing at nothing. Saying so is better than a timeline that
     * quietly begins after the thing that started it — the client knows there was a call, and
     * silence reads as data loss.
     */
    const fromCall = Boolean(customer.sourceRef) && !customer.sourceRef!.startsWith("lead:");
    if (fromCall && !timeline.some((e) => e.meta?.origin)) {
        timeline.push({
            id: `origin-missing:${customer.sourceRef}`,
            kind: "call",
            at: customer.firstContactAt ?? customer.createdAt,
            summary: "The call this customer came from is no longer in your call log",
            actor: "system",
            meta: { origin: true, unavailable: true },
        });
    }

    // Reading the record clears its unread badge.
    await markThreadRead(acct, slug, id);

    return NextResponse.json({
        state: "ready",
        customer,
        timeline,
        messages,
        tasks: allTasks.filter((t) => t.customerId === id),
        jobs,
        notes,
        messagingState: siteFeature(ctx.site, "messaging").state,
    });
}
