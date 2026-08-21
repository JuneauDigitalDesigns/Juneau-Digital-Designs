import Link from "next/link";
import type { AddPlanBlock, PortalAccount } from "@jdd/schema";
import { growthSitesForConsolidation } from "@jdd/schema";
import { getSchedule } from "@/app/lib/legal/schedules";
import type { PlanSlug } from "@/app/lib/agreement-types";

/**
 * Shown at `/start` when the account has hit a ceiling.
 *
 * The Growth case is the interesting one, and it is a genuine offer rather than a refusal
 * dressed up as one. A client with two Growth sites reaching for a third is being stopped
 * from buying something worse than what we would rather sell them.
 *
 * The argument is **pooling**, not price. Enterprise is more per month than two Growth
 * subscriptions, so leading with cost loses. What Growth cannot do at any price is let a
 * busy location borrow minutes from a quiet one: each Growth site has its own sealed
 * allowance and overruns on its own, which is exactly the problem a multi-site operator
 * already feels by the time they are buying their third.
 *
 * Every number is read from Schedule A rather than written here, so this page cannot promise
 * something different from the agreement the client is about to sign.
 */
export default function UpsellEnterprise({
    account,
    requestedPlan,
    reason,
}: {
    account: PortalAccount;
    requestedPlan: PlanSlug;
    reason: AddPlanBlock;
}) {
    if (reason === "enterprise-cap-reached") {
        return <AlreadyEnterprise />;
    }

    const growth = getSchedule("growth");
    const enterprise = getSchedule("enterprise");
    const existing = growthSitesForConsolidation(account);

    const currentMonthly = existing.length * growth.monthlyPrice;
    const currentMinutes = growth.callMinutes ?? 0;
    const pooled = enterprise.callMinutes ?? 0;
    const overageRate = growth.overagePerMinute;

    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
            <div className="max-w-2xl">
                <span className="eyebrow">Enterprise</span>

                <h1 className="mt-6" style={{ fontSize: "var(--text-2xl)" }}>
                    A third site belongs on Enterprise
                </h1>

                <p
                    className="mt-4"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}
                >
                    You already run {existing.length} sites on {growth.name}
                    {existing.length > 0 && (
                        <> — {existing.map((s) => s.name ?? s.slug).join(" and ")}</>
                    )}
                    . Adding a third {requestedPlan === "growth" ? growth.name : requestedPlan} plan
                    would work, but it would cost you more than it should and give you less than
                    Enterprise does.
                </p>

                <div
                    className="mt-8 rounded-2xl border p-6"
                    style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                >
                    <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                        Why the minutes matter
                    </p>
                    <p
                        className="mt-3"
                        style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 15 }}
                    >
                        Each {growth.name} site gets its own {currentMinutes.toLocaleString()} call
                        minutes, and they don&rsquo;t mix. A busy location runs into overage
                        {overageRate !== null && <> at ${overageRate.toFixed(2)}/min</>} while a
                        quiet one leaves half its allowance unused, every month.
                    </p>
                    <p
                        className="mt-3"
                        style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 15 }}
                    >
                        Enterprise covers {enterprise.siteLabel} on a single pool of{" "}
                        <strong style={{ color: "var(--fg)" }}>
                            {pooled.toLocaleString()} minutes
                        </strong>
                        . Your quiet sites cover your busy ones, and you stop paying overage on a
                        month you were never actually over.
                    </p>
                </div>

                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Figure
                        label={`${existing.length} × ${growth.name} today`}
                        value={`$${currentMonthly.toLocaleString()}/mo`}
                        note={`${existing.length} separate pools of ${currentMinutes.toLocaleString()} min`}
                    />
                    <Figure
                        label={`${enterprise.name}, up to ${enterprise.maxSites} sites`}
                        value={`$${enterprise.monthlyPrice.toLocaleString()}/mo`}
                        note={`one shared pool of ${pooled.toLocaleString()} min`}
                        emphasis
                    />
                </dl>

                <p
                    className="mt-6"
                    style={{ color: "var(--fg-3)", lineHeight: "var(--leading-relaxed)", fontSize: 14 }}
                >
                    Moving over cancels your {growth.name} subscriptions and credits the unused
                    part of each, so you only pay the difference for the rest of this period.
                    Nothing changes on your live sites.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                    <Link href="/start?plan=enterprise" className="btn primary">
                        Move to Enterprise
                    </Link>
                    <Link
                        href="/portal"
                        className="text-sm underline underline-offset-4"
                        style={{ color: "var(--fg-2)" }}
                    >
                        Back to your portal
                    </Link>
                </div>
            </div>
        </main>
    );
}

function Figure({
    label,
    value,
    note,
    emphasis = false,
}: {
    label: string;
    value: string;
    note: string;
    emphasis?: boolean;
}) {
    return (
        <div
            className="rounded-2xl border p-5"
            style={{
                borderColor: emphasis ? "var(--accent)" : "var(--rule)",
                background: "var(--surface)",
            }}
        >
            <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--fg-3)" }}>
                {label}
            </dt>
            <dd className="mt-2" style={{ fontSize: "var(--text-xl)", color: "var(--fg)" }}>
                {value}
            </dd>
            <p className="mt-1" style={{ fontSize: 13, color: "var(--fg-3)" }}>
                {note}
            </p>
        </div>
    );
}

/**
 * Enterprise is the top of the self-serve ladder, so there is nothing to sell here — only a
 * conversation to start. Said plainly rather than shown as an error, because a client asking
 * for a fourth site is the best kind of problem to have.
 */
function AlreadyEnterprise() {
    const enterprise = getSchedule("enterprise");
    return (
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
            <div className="max-w-lg text-center">
                <span className="eyebrow">Enterprise</span>

                <h1 className="mt-6" style={{ fontSize: "var(--text-2xl)" }}>
                    Let&rsquo;s talk about the next one
                </h1>

                <p
                    className="mt-4"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}
                >
                    You&rsquo;re already on Enterprise, which covers {enterprise.siteLabel}. Going
                    beyond that isn&rsquo;t something to buy from a page — tell us what you need
                    and we&rsquo;ll price it properly.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                    <a
                        href="mailto:hello@juneaudigitaldesigns.com?subject=Adding%20another%20site"
                        className="btn primary"
                    >
                        Get in touch
                    </a>
                    <Link
                        href="/portal"
                        className="text-sm underline underline-offset-4"
                        style={{ color: "var(--fg-2)" }}
                    >
                        Back to your portal
                    </Link>
                </div>
            </div>
        </main>
    );
}
