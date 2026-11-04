import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { SCHEDULES } from "@/app/lib/legal";

export const runtime = "nodejs";

/**
 * Plan prices for the console's Order step, read from Schedule A.
 *
 * The console shows "Due today / Then" before an order exists. It must not keep its own copy of
 * the prices: this answer is the same schedule the terms, the read-aloud script and the welcome
 * email quote, so the screen a client watches can't disagree with what they're charged.
 */
export async function GET(request: Request) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const prices = Object.fromEntries(
        Object.values(SCHEDULES).map((s) => [
            s.slug,
            { name: s.name, monthly: s.monthlyPrice, annual: s.annualPrice, onboardingFee: s.onboardingFee },
        ]),
    );
    return NextResponse.json({ ok: true, prices });
}
