import Link from "next/link";
import { PlayCircle } from "@phosphor-icons/react";
import { SectionHeader } from "../ui/Card";

/**
 * The Calendar on Starter: what Growth adds, and the way to see it.
 *
 * Wording approved from the mockup (2026-11-12). The two buttons are the Customers showcase's
 * own: the demo opens on the Customers page (`?demo=growth`, the contract `StarterShowcase`
 * honours), and plans compare on the pricing page.
 */
export default function CalendarStarter({ siteSlug }: { siteSlug: string }) {
    return (
        <div className="space-y-6">
            <SectionHeader title="Calendar" meta="Not included on Starter" />
            <div
                className="rounded-2xl border p-7 lg:p-8 flex gap-8 flex-wrap items-center"
                style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)", boxShadow: "var(--shadow-1)" }}
            >
                <div className="flex-1 min-w-[280px]">
                    <h2
                        className="font-extrabold"
                        style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "-0.02em" }}
                    >
                        Every job and follow-up on one calendar
                    </h2>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed max-w-[56ch]" style={{ color: "var(--fg-2)" }}>
                        Growth adds a calendar to your portal. Book job visits, estimates and call backs against each
                        customer, and see the follow-ups you set, all in one month view.
                    </p>
                </div>
                <div className="flex flex-col gap-2.5 w-full sm:w-auto sm:min-w-[260px]">
                    <Link
                        href={`/portal/customers?site=${encodeURIComponent(siteSlug)}&demo=growth`}
                        className="w-full rounded-lg px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        <PlayCircle size={16} weight="fill" />
                        Show me what Growth does for me
                    </Link>
                    <Link
                        href="/pricing"
                        className="w-full rounded-lg border px-4 py-3 text-sm font-semibold text-center"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                    >
                        Compare plans
                    </Link>
                </div>
            </div>
        </div>
    );
}
