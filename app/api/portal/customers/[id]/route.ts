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

    const [stored, messages, allTasks] = await Promise.all([
        listActivity(acct, slug, id),
        listMessages(acct, slug, id),
        listTasks(acct, slug),
    ]);

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
                const digits = customer.phone.replace(/\D/g, "").slice(-10);
                for (const call of res.calls) {
                    const callDigits = (call.callerNumber ?? "").replace(/\D/g, "").slice(-10);
                    if (!callDigits || callDigits !== digits) continue;
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

    const timeline = [...stored, ...callActivity, ...messageActivity].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    // Reading the record clears its unread badge.
    await markThreadRead(acct, slug, id);

    return NextResponse.json({
        state: "ready",
        customer,
        timeline,
        messages,
        tasks: allTasks.filter((t) => t.customerId === id),
        messagingState: siteFeature(ctx.site, "messaging").state,
    });
}
