import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { growthSitesForConsolidation } from "@jdd/schema";
import { resolveAccountForUser } from "@/app/lib/portal-account";
import { planConsolidation } from "@/app/lib/consolidation";
import { getSchedule } from "@/app/lib/legal";
import {
    consolidationParagraph,
    consolidationRefusal,
    perPeriod,
    poolLine,
} from "@/app/lib/plan-change-copy";
import PortalScope from "@/app/components/portal/PortalScope";

export const dynamic = "force-dynamic";

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * The confirmation step before a Growth → Enterprise consolidation.
 *
 * Deliberately its own page rather than a modal on the upsell. What follows upgrades one
 * subscription the client is being served by and cancels the others, so the sites involved are
 * named back to them and the billing consequence is stated in full before they accept anything.
 *
 * Everything that could refuse the move (sites on different periods or Stripe customers, a site
 * set to cancel, billing that can't be read) is checked HERE, before the client is offered the
 * agreement. It used to be checked only after they had accepted it and been emailed a copy.
 *
 * Acceptance happens on `/agreement`; `?consolidate=1` sends the accepted agreement to
 * `/api/portal/consolidate` instead of checkout. Wording approved word for word by Xander on
 * 2026-11-04 (`plan-change-copy.ts`).
 */
export default async function ConsolidatePage() {
    const { userId } = await auth();
    if (!userId) redirect("/portal/sign-in?redirect_url=%2Fportal%2Fconsolidate");

    const account = await resolveAccountForUser(userId);
    if (!account) redirect("/portal");

    const absorbing = growthSitesForConsolidation(account);
    // Nothing to absorb makes this an ordinary Enterprise purchase, which /start owns.
    if (absorbing.length === 0) redirect("/start?plan=enterprise");

    const move = await planConsolidation(account);
    const interval = move.ok ? move.interval : "month";

    const growth = getSchedule("growth");
    const enterprise = getSchedule("enterprise");
    const priceOf = (s: { monthlyPrice: number; annualPrice: number }) =>
        interval === "year" ? s.annualPrice : s.monthlyPrice;
    const sites = move.ok ? [move.host, ...move.others].map(({ site }) => site) : absorbing;

    return (
        <PortalScope>
            <main className="min-h-screen px-6 py-24" style={{ background: "var(--bg)" }}>
                <div className="mx-auto max-w-2xl">
                    <span className="eyebrow">Move to Enterprise</span>
                    <h1 className="mt-6" style={{ fontSize: "var(--text-2xl)" }}>
                        Here&rsquo;s exactly what will change
                    </h1>

                    <div
                        className="mt-8 rounded-2xl border p-6"
                        style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                    >
                        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                            {sites.length === 1
                                ? "This site moves onto Enterprise"
                                : `These ${sites.length} sites move onto one plan`}
                        </p>
                        <ul className="mt-3 flex flex-col gap-2">
                            {sites.map((s) => (
                                <li key={s.slug} style={{ color: "var(--fg-2)", fontSize: 15 }}>
                                    {s.name ?? s.slug}
                                </li>
                            ))}
                        </ul>
                        <p
                            className="mt-4"
                            style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 15 }}
                        >
                            Nothing goes offline. Your sites, phone numbers and receptionists keep
                            running exactly as they are. Only the billing changes, and you keep
                            room for {enterprise.maxSites - sites.length} more{" "}
                            {enterprise.maxSites - sites.length === 1 ? "site" : "sites"}.
                        </p>
                    </div>

                    <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div
                            className="rounded-2xl border p-5"
                            style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                        >
                            <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--fg-3)" }}>
                                You pay now
                            </dt>
                            <dd className="mt-2" style={{ fontSize: "var(--text-xl)", color: "var(--fg)" }}>
                                {perPeriod(sites.length * priceOf(growth), interval)}
                            </dd>
                            <p className="mt-1" style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                {poolLine({ pools: sites.length, minutes: growth.callMinutes ?? 0, shared: false })}
                            </p>
                        </div>
                        <div
                            className="rounded-2xl border p-5"
                            style={{ borderColor: "var(--accent)", background: "var(--surface)" }}
                        >
                            <dt className="text-xs uppercase tracking-wide" style={{ color: "var(--fg-3)" }}>
                                You&rsquo;ll pay
                            </dt>
                            <dd className="mt-2" style={{ fontSize: "var(--text-xl)", color: "var(--fg)" }}>
                                {perPeriod(priceOf(enterprise), interval)}
                            </dd>
                            <p className="mt-1" style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                {poolLine({ pools: 1, minutes: enterprise.callMinutes ?? 0, shared: true })}
                            </p>
                        </div>
                    </dl>

                    <p
                        className="mt-6"
                        style={{ color: "var(--fg-3)", lineHeight: "var(--leading-relaxed)", fontSize: 14 }}
                    >
                        {move.ok
                            ? consolidationParagraph({
                                  hostName: move.host.site.name ?? move.host.site.slug,
                                  interval: move.interval,
                                  periodEnd: formatDate(move.periodEnd),
                                  others: move.others.length,
                              })
                            : consolidationRefusal(move.code, move.cancelAt ? formatDate(move.cancelAt) : undefined)}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                        {move.ok && (
                            <Link href="/agreement?plan=enterprise&consolidate=1" className="btn primary">
                                Review and accept
                            </Link>
                        )}
                        <Link
                            href="/portal"
                            className="text-sm underline underline-offset-4"
                            style={{ color: "var(--fg-2)" }}
                        >
                            Not now
                        </Link>
                    </div>
                </div>
            </main>
        </PortalScope>
    );
}
