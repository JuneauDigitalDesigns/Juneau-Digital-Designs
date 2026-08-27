"use client";

import { useState } from "react";
import Image from "next/image";
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
    DotsThree,
    CaretLeft,
    CaretRight,
    ArrowSquareOut,
    Lock,
} from "@phosphor-icons/react";
import PortalBrand from "./PortalBrand";
import SiteSelector from "./SiteSelector";
import { PortalDataProvider } from "./PortalDataProvider";
import { StatusDot } from "./ui/StatusDot";
import Drawer from "./ui/Drawer";
import {
    PORTAL_TABS,
    MOBILE_BAR_TABS,
    MOBILE_MORE_TABS,
    selectSite,
    tabHref,
    type PortalSiteProps,
    type PortalTabId,
} from "@/app/portal/types";

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
 * The authenticated portal's chrome. Two shapes, one component.
 *
 * **Desktop (≥1024px)** is the rail and stage this has always been, now collapsible to a
 * 64px icon strip.
 *
 * **Mobile** is a slim sticky topbar plus a fixed bottom tab bar. It used to be the rail
 * stacked on top of the content: brand band, label, site name, host, plan chip, a
 * sideways-scrolling six-item nav and the account row, together about 280px of an 812px
 * phone, none of it sticky. So a third of the screen was spent before the first number, and
 * scrolling a call log put navigation out of reach. The split recovers roughly 230px and
 * keeps nav under the thumb.
 *
 * Three older decisions that still hold and should not be undone:
 *
 * 1. **Every tab is a link, and every link is clickable.** Tabs used to be `<button>`s that
 *    were `disabled` whenever a feature wasn't ready, which left a client staring at a
 *    greyed control with no way to find out why. The tab always navigates and the panel
 *    explains itself. That is also why locked tabs keep their place in the mobile bar.
 *
 * 2. **The site is in the URL**, so a filtered call log or a specific tab can be linked and
 *    survives a refresh.
 *
 * 3. **Rail and stage share one grid**, so the site name and the first stat tile sit on the
 *    same left edge.
 */
export default function PortalChrome({
    sites,
    accountEmail,
    railCollapsed,
    children,
}: {
    sites: PortalSiteProps[];
    accountEmail: string;
    /** Server-read cookie. See `(dash)/layout.tsx` — holding this client-side would flash. */
    railCollapsed: boolean;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const params = useSearchParams();
    const [collapsed, setCollapsed] = useState(railCollapsed);
    const [moreOpen, setMoreOpen] = useState(false);

    // Same selection rule the pages use, so the chrome and the panel can never disagree
    // about which site is being shown.
    const selected = selectSite(sites, params.get("site")) ?? sites[0];

    // "/portal" → overview; "/portal/calls" → calls.
    const segment = pathname.replace(/^\/portal\/?/, "").split("/")[0] ?? "";
    const activeId = PORTAL_TABS.find((t) => t.href === segment)?.id ?? "overview";

    const host = hostOf(selected.canonical);
    // `readonly ["performance","settings"]` narrows `.includes()` to its own members, so it
    // rejects any other tab id at compile time. Widening the receiver, not the value.
    const isInMore = (MOBILE_MORE_TABS as readonly PortalTabId[]).includes(activeId);

    function toggleRail() {
        const next = !collapsed;
        setCollapsed(next);
        // A year, path-scoped to the portal. Not httpOnly on purpose: this is a display
        // preference, and the layout only ever reads it to pick a grid width.
        document.cookie = `portal_rail=${next ? "collapsed" : "expanded"}; path=/portal; max-age=31536000; samesite=lax`;
    }

    /** Availability for a tab, and what that means for how it is marked. */
    function tabState(id: PortalTabId) {
        const tab = PORTAL_TABS.find((t) => t.id === id)!;
        const availability = tab.feature ? selected.features[tab.feature] : null;
        return {
            tab,
            // "Locked" and "not wired up yet" are different promises. A Starter client's Call
            // Log is never arriving; a Growth client's is. They were sharing one pending dot,
            // which told the first group to wait for something that will not come.
            isLocked: availability?.state === "not-on-plan",
            isReady: !availability || availability.state === "ready",
        };
    }

    return (
        <div className="portal-shell" data-rail={collapsed ? "collapsed" : "expanded"}>
            {/* ── Mobile: slim topbar ──────────────────────────────────────────── */}
            <header className="portal-topbar">
                <a
                    href="https://juneaudigitaldesigns.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portal-mark"
                    aria-label="Juneau Digital Designs, agency home (opens in a new tab)"
                >
                    <Image
                        src="/jdd-lockup-portal.png"
                        alt=""
                        width={640}
                        height={192}
                        priority
                    />
                </a>

                <div className="portal-topbar-site">
                    <div className="portal-topbar-name" title={selected.name}>
                        {selected.name}
                    </div>
                    {host ? (
                        <a
                            href={selected.canonical ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="portal-topbar-host hover:underline underline-offset-2"
                        >
                            {host}
                        </a>
                    ) : (
                        <div className="portal-topbar-host">{selected.slug}</div>
                    )}
                </div>

                {sites.length > 1 && (
                    <SiteSelector sites={sites} selected={selected.slug} activeTab={segment} />
                )}
                <UserButton />
            </header>

            {/* ── Desktop: the rail ────────────────────────────────────────────── */}
            <aside className="portal-rail">
                <PortalBrand />
                <div className="portal-brand-label">Client Portal</div>

                <button
                    type="button"
                    onClick={toggleRail}
                    className="portal-rail-toggle"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? (
                        <CaretRight size={11} weight="bold" />
                    ) : (
                        <CaretLeft size={11} weight="bold" />
                    )}
                </button>

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
                        const { isLocked, isReady } = tabState(tab.id);
                        const isActive = tab.id === activeId;
                        const Icon = TAB_ICON[tab.id];

                        return (
                            <Link
                                key={tab.id}
                                href={tabHref(tab.href, selected.slug)}
                                aria-current={isActive ? "page" : undefined}
                                title={tab.label}
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
                                            className="portal-rail-marker shrink-0 ml-auto"
                                            style={{ color: "var(--fg-3)" }}
                                        />
                                        <span className="sr-only">(not included in your plan)</span>
                                    </>
                                ) : !isReady ? (
                                    <>
                                        <span className="portal-rail-marker ml-auto inline-flex">
                                            <StatusDot status="pending" size={6} />
                                        </span>
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

            {/* ── Mobile: bottom tab bar ───────────────────────────────────────── */}
            <nav className="portal-tabbar" aria-label="Portal sections">
                {MOBILE_BAR_TABS.map((id) => {
                    const { tab, isLocked, isReady } = tabState(id);
                    const isActive = tab.id === activeId;
                    const Icon = TAB_ICON[tab.id];

                    return (
                        <Link
                            key={tab.id}
                            href={tabHref(tab.href, selected.slug)}
                            aria-current={isActive ? "page" : undefined}
                            className={`portal-tab${isActive ? " is-active" : ""}`}
                        >
                            <Icon size={21} weight={isActive ? "fill" : "regular"} />
                            <span>{tab.shortLabel}</span>
                            {isLocked ? (
                                <>
                                    <Lock size={9} weight="fill" className="portal-tab-lock" />
                                    <span className="sr-only">(not included in your plan)</span>
                                </>
                            ) : !isReady ? (
                                <>
                                    <span className="portal-tab-lock">
                                        <StatusDot status="pending" size={5} />
                                    </span>
                                    <span className="sr-only">(not yet available)</span>
                                </>
                            ) : null}
                        </Link>
                    );
                })}

                <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className={`portal-tab${isInMore ? " is-active" : ""}`}
                    aria-haspopup="dialog"
                    aria-expanded={moreOpen}
                >
                    <DotsThree size={21} weight="bold" />
                    <span>More</span>
                </button>
            </nav>

            <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
                <nav className="flex flex-col gap-1" aria-label="More sections">
                    {MOBILE_MORE_TABS.map((id) => {
                        const { tab, isLocked, isReady } = tabState(id);
                        const Icon = TAB_ICON[tab.id];

                        return (
                            <Link
                                key={tab.id}
                                href={tabHref(tab.href, selected.slug)}
                                onClick={() => setMoreOpen(false)}
                                aria-current={tab.id === activeId ? "page" : undefined}
                                className={`portal-rail-link${tab.id === activeId ? " is-active" : ""}`}
                                style={{ minHeight: 44 }}
                            >
                                <Icon
                                    size={18}
                                    weight={tab.id === activeId ? "fill" : "regular"}
                                    className="shrink-0"
                                />
                                <span>{tab.label}</span>
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
                                        <span className="ml-auto inline-flex">
                                            <StatusDot status="pending" size={6} />
                                        </span>
                                        <span className="sr-only">(not yet available)</span>
                                    </>
                                ) : null}
                            </Link>
                        );
                    })}

                    {host && (
                        <a
                            href={selected.canonical ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="portal-rail-link"
                            style={{ minHeight: 44 }}
                        >
                            <ArrowSquareOut size={18} className="shrink-0" />
                            <span>Open {host}</span>
                        </a>
                    )}
                </nav>

                <div
                    className="mt-4 pt-4 flex items-center gap-2.5"
                    style={{ borderTop: "1px solid var(--rule-weak)" }}
                >
                    <UserButton />
                    <span
                        className="truncate min-w-0"
                        style={{ color: "var(--fg-3)", fontSize: "var(--text-sm)" }}
                    >
                        {accountEmail}
                    </span>
                </div>
            </Drawer>
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
