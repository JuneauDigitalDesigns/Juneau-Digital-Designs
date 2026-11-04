import { NextResponse } from "next/server";
import { ORDER_STATUSES, type OperatorOrder, type OrderStatus } from "@jdd/schema";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getAccount } from "@/app/lib/account-store";
import {
    claimSlug,
    getOrderByLead,
    listOrders,
    newOrderId,
    releaseSlug,
    saveOrder,
} from "@/app/lib/operator-orders";
import { accountFacts, parseOrderFields, termsView } from "@/app/lib/operator-order-input";

export const runtime = "nodejs";

/**
 * Operator orders: a client closed on a sales call. Called only by the ops console's server.
 *
 * POST creates the order for a lead, or updates it while it is still a draft — the console's
 * Order step saves through here, so "Save draft" and "Continue" are the same call. Once terms
 * are accepted the order is frozen: a change of plan or price means cancelling and starting a
 * new one, so the agreement on file always matches what was charged.
 */
export async function POST(request: Request) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const parsed = parseOrderFields(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const fields = parsed.fields;

    const existing = await getOrderByLead(fields.leadId);
    if (existing && existing.status !== "draft" && existing.status !== "cancelled") {
        return NextResponse.json(
            { error: "This lead already has an order past the draft stage. Resume it instead.", order: existing },
            { status: 409 },
        );
    }
    const prior = existing?.status === "draft" ? existing : null;

    const account = await getAccount(fields.client.email);
    const facts = accountFacts(account, fields);
    if (facts.block) {
        return NextResponse.json({ error: blockMessage(facts.block), code: facts.block }, { status: 409 });
    }
    if (facts.slugOnAccount) {
        return NextResponse.json({ error: "That Site ID is already one of this client's sites.", code: "slug-taken" }, { status: 409 });
    }

    const id = prior?.id ?? newOrderId();
    if (!(await claimSlug(fields.siteSlug, id))) {
        return NextResponse.json({ error: "That Site ID is taken by another order.", code: "slug-taken" }, { status: 409 });
    }
    // A draft whose Site ID was edited gives up the old one.
    if (prior && prior.siteSlug !== fields.siteSlug) await releaseSlug(prior.siteSlug, prior.id);

    const now = Date.now();
    const order: OperatorOrder = {
        ...(prior ?? {
            id,
            version: 1 as const,
            source: "operator-call" as const,
            status: "draft" as const,
            pricing: { kind: "standard" as const },
            events: [{ at: now, kind: "created", text: `Order created, Site ID ${fields.siteSlug} claimed` }],
            createdAt: now,
        }),
        ...fields,
        agreementKind: facts.agreementKind,
        updatedAt: now,
    };
    const saved = await saveOrder(order, prior);

    return NextResponse.json({
        ok: true,
        order: saved,
        account: facts.account,
        agreementKind: facts.agreementKind,
        ...termsView(saved, facts.agreementKind),
    });
}

/**
 * GET ?leadId=…                      the lead's order, or null
 * GET ?status=paid,fulfilled&unconverted=1   paid orders the console hasn't turned into clients
 */
export async function GET(request: Request) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId")?.trim();
    if (leadId) {
        return NextResponse.json({ ok: true, order: await getOrderByLead(leadId) });
    }

    const statuses = (url.searchParams.get("status") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s));
    const orders = await listOrders({
        ...(statuses.length ? { status: statuses } : {}),
        unconverted: url.searchParams.get("unconverted") === "1",
    });
    return NextResponse.json({ ok: true, orders });
}

function blockMessage(block: string): string {
    return block === "growth-cap-reached"
        ? "This client already has the most Growth sites one account can hold. Enterprise is the next step."
        : "This client is already on Enterprise.";
}
