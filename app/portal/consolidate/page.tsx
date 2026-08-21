import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { growthSitesForConsolidation } from "@jdd/schema";
import { resolveAccountForUser } from "@/app/lib/portal-account";
import { getConsolidation } from "@/app/lib/consolidation";
import { getSchedule } from "@/app/lib/legal";
import PortalScope from "@/app/components/portal/PortalScope";

export const dynamic = "force-dynamic";

/**
 * The confirmation step before a Growth → Enterprise consolidation.
 *
 * Deliberately its own page rather than a modal on the upsell. What follows cancels
 * subscriptions the client is currently being served by, so the sites involved are named
 * back to them and the billing consequence is stated in full before they sign anything.
 *
 * Signing happens on `/agreement`; this page only sets it up. The `?consolidate=1` flag
 * tells the signing form to post the resulting agreement to `/api/portal/consolidate`
 * instead of `/api/checkout`, exactly as `?upgrade=` already does for in-place tier changes.
 */
export default async function ConsolidatePage() {
    const { userId } = await auth();
    if (!userId) redirect("/portal/sign-in?redirect_url=%2Fportal%2Fconsolidate");

    const account = await resolveAccountForUser(userId);
    if (!account) redirect("/portal");

    const absorbing = growthSitesForConsolidation(account);
    // Nothing to absorb makes this an ordinary Enterprise purchase, which /start owns.
    if (absorbing.length === 0) redirect("/start?plan=enterprise");

    // A consolidation past `awaiting-payment` has money attached and must not be restarted
    // from the UI. Send them to the portal, where the outcome will appear.
    const inFlight = await getConsolidation(account.email);
    if (inFlight && inFlight.status !== "awaiting-payment" && inFlight.status !== "stalled") {
        redirect("/portal?consolidating=1");
    }

    const growth = getSchedule("growth");
    const enterprise = getSchedule("enterprise");
    const currentMonthly = absorbing.length * growth.monthlyPrice;

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
                            These {absorbing.length} sites move onto one plan
                        </p>
                        <ul className="mt-3 flex flex-col gap-2">
                            {absorbing.map((s) => (
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
                            running exactly as they are — only the billing changes, and you keep
                            room for {enterprise.maxSites - absorbing.length} more{" "}
                            {enterprise.maxSites - absorbing.length === 1 ? "site" : "sites"}.
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
                                ${currentMonthly.toLocaleString()}/mo
                            </dd>
                            <p className="mt-1" style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                {absorbing.length} separate pools of{" "}
                                {(growth.callMinutes ?? 0).toLocaleString()} min
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
                                ${enterprise.monthlyPrice.toLocaleString()}/mo
                            </dd>
                            <p className="mt-1" style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                one shared pool of {(enterprise.callMinutes ?? 0).toLocaleString()} min
                            </p>
                        </div>
                    </dl>

                    <p
                        className="mt-6"
                        style={{ color: "var(--fg-3)", lineHeight: "var(--leading-relaxed)", fontSize: 14 }}
                    >
                        {/*
                          * Stated plainly because it is the question anyone sensible asks, and
                          * because the cancellations are prorated — the unused part of each
                          * Growth period is credited against the Enterprise invoice, so nobody
                          * pays twice for the overlap.
                          */}
                        Your {growth.name} subscriptions are cancelled once the new plan is paid
                        for, and the unused part of each is credited back to you. You&rsquo;ll sign
                        a short addendum on the next screen before anything is charged.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                        <Link href="/agreement?plan=enterprise&consolidate=1" className="btn primary">
                            Review and sign
                        </Link>
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
