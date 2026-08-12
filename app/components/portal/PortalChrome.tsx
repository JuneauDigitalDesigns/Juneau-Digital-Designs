"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
    ChartPieSlice,
    PhoneCall,
    TrendUp,
    Gauge,
    CreditCard,
    Gear,
    ArrowSquareOut,
    Lock,
} from "@phosphor-icons/react";
import PortalBrand from "./PortalBrand";
import SiteSelector from "./SiteSelector";
import { PortalDataProvider } from "./PortalDataProvider";
import { StatusDot } from "./ui/StatusDot";
import { PORTAL_TABS, selectSite, tabHref, type PortalSiteProps } from "@/app/portal/types";

const planLabel: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
};

const TAB_ICON = {
    overview: ChartPieSlice,
    calls: PhoneCall,
    traffic: TrendUp,
    performance: Gauge,
    billing: CreditCard,
    settings: Gear,
} as const;

/**
 * Rail + stage shell for the authenticated portal.
 *
 * Three deliberate departures from what this replaced:
 *
 * 1. **A left rail, not a tab strip.** The old header, tab bar and content sat on three
 *    different left edges — the first two were full-bleed `px-6` while `<main>` was
 *    `max-w-6xl mx-auto`, so on a wide display the site name and the first stat tile were
 *    360px apart. Rail and stage now share one grid.
 *
 * 2. **Every tab is a link, and every link is clickable.** Tabs used to be `<button>`s that
 *    were `disabled` whenever a feature wasn't ready, which left a client staring at a
 *    greyed control with no way to find out why. The tab always navigates and the panel
 *    explains itself.
 *
 * 3. **The site is in the URL**, so a filtered call log or a specific tab can be linked and
 *    survives a refresh.
 */
export default function PortalChrome({
    sites,
    accountEmail,
    children,
}: {
    sites: PortalSiteProps[];
    accountEmail: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const params = useSearchParams();

    // Same selection rule the pages use, so the rail and the panel can never disagree
    // about which site is being shown.
    const selected = selectSite(sites, params.get("site")) ?? sites[0];

    // "/portal" → overview; "/portal/calls" → calls.
    const segment = pathname.replace(/^\/portal\/?/, "").split("/")[0] ?? "";
    const activeId = PORTAL_TABS.find((t) => t.href === segment)?.id ?? "overview";

    const host = hostOf(selected.canonical);

    return (
        <div
            className="portal-shell"
            style={{ background: "var(--bg)", color: "var(--fg)" }}
        >
            <aside className="portal-rail">
                <PortalBrand />
                <div className="portal-brand-label">Client Portal</div>

                <div className="portal-rail-head">
                    <div className="flex items-start gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                            <span
                                className="block truncate font-bold"
                                style={{
                                    fontFamily: "var(--font-display)",
                                    fontSize: "20px",
                                    lineHeight: 1.15,
                                    letterSpacing: "var(--tracking-tight)",
                                }}
                                title={selected.name}
                            >
                                {selected.name}
                            </span>

                            {host ? (
                                <a
                                    href={selected.canonical ?? undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-0.5 inline-flex items-center gap-1 text-xs truncate max-w-full hover:underline underline-offset-2"
                                    style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                                    title={`Open ${host} in a new tab`}
                                >
                                    <span className="truncate">{host}</span>
                                    <ArrowSquareOut size={11} weight="bold" className="shrink-0" />
                                </a>
                            ) : (
                                <span
                                    className="mt-0.5 block text-xs"
                                    style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                                >
                                    {selected.slug}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                        <span
                            className="text-xs px-2 py-0.5 rounded-full border shrink-0"
                            style={{
                                borderColor: "var(--rule-strong)",
                                color: "var(--fg-2)",
                                fontFamily: "var(--font-mono)",
                            }}
                        >
                            {planLabel[selected.plan] ?? selected.plan}
                        </span>
                        {selected.status === "building" && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full shrink-0 inline-flex items-center gap-1.5"
                                style={{
                                    background: "color-mix(in srgb, var(--accent-2) 16%, transparent)",
                                    color: "var(--accent-2)",
                                    fontFamily: "var(--font-mono)",
                                }}
                            >
                                <StatusDot status="warn" size={6} />
                                In progress
                            </span>
                        )}
                    </div>

                    {/* Any client with more than one site gets the switcher — not just enterprise. */}
                    {sites.length > 1 && (
                        <div className="mt-3">
                            <SiteSelector
                                sites={sites}
                                selected={selected.slug}
                                activeTab={segment}
                            />
                        </div>
                    )}
                </div>

                <nav className="portal-rail-nav" aria-label="Portal sections">
                    {PORTAL_TABS.map((tab) => {
                        const isActive = tab.id === activeId;
                        const availability = tab.feature ? selected.features[tab.feature] : null;
                        const isReady = !availability || availability.state === "ready";
                        // "Locked" and "not wired up yet" are different promises. A Starter
                        // client's Call Log is never arriving; a Growth client's is. They were
                        // sharing one pending dot, which told the first group to wait for
                        // something that will not come.
                        const isLocked = availability?.state === "not-on-plan";
                        const Icon = TAB_ICON[tab.id];

                        return (
                            <Link
                                key={tab.id}
                                href={tabHref(tab.href, selected.slug)}
                                aria-current={isActive ? "page" : undefined}
                                className={`portal-rail-link${isActive ? " is-active" : ""}`}
                            >
                                <Icon
                                    size={17}
                                    weight={isActive ? "fill" : "regular"}
                                    className="shrink-0"
                                />
                                <span className="truncate">{tab.label}</span>
                                {/* A marker, not a disabled state: the tab still works, it just
                                    has something to tell you when you get there.

                                    A glyph rather than another dot colour — see StatusDot, where
                                    colour is reserved for health. Locked is not a health state. */}
                                {isLocked ? (
                                    <>
                                        <Lock
                                            size={12}
                                            weight="fill"
                                            className="shrink-0 ml-auto"
                                            style={{ color: "var(--fg-3)" }}
                                        />
                                        <span className="sr-only">(not included in your plan)</span>
                                    </>
                                ) : !isReady ? (
                                    <>
                                        <StatusDot status="pending" size={6} />
                                        <span className="sr-only">(not yet available)</span>
                                    </>
                                ) : null}
                            </Link>
                        );
                    })}
                </nav>

                {/* No theme toggle: the portal is light-only, so the control had nothing
                    to switch. The signed-in address takes its place — it was already being
                    passed down and never shown, which meant a client with two logins had no
                    way to tell which one they were in. */}
                <div className="portal-rail-foot">
                    <UserButton />
                    <span
                        className="truncate min-w-0"
                        style={{ color: "var(--fg-3)", fontSize: "var(--text-sm)" }}
                        title={accountEmail}
                    >
                        {accountEmail}
                    </span>
                </div>
            </aside>

            {/* Inside the layout, so the cache survives tab navigation; the sections it
                serves are all below it in `children`. */}
            <main className="portal-stage">
                <PortalDataProvider>{children}</PortalDataProvider>
            </main>
        </div>
    );
}

/** Bare host for display — the scheme and any `www.` are noise in a 200px rail. */
function hostOf(canonical: string | null): string | null {
    if (!canonical) return null;
    try {
        return new URL(canonical).hostname.replace(/^www\./, "") || null;
    } catch {
        return canonical.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "") || null;
    }
}
