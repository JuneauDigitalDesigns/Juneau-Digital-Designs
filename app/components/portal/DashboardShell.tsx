"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import type { PortalClientProps } from "@/app/portal/page";
import CallsSection from "./CallsSection";
import PerformanceSection from "./PerformanceSection";
import TrafficSection from "./TrafficSection";
import SiteSelector from "./SiteSelector";

type Tab = "performance" | "calls" | "traffic";

const planLabel: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
};

export default function DashboardShell({ sites }: PortalClientProps) {
    const [selectedSlug, setSelectedSlug] = useState<string>(sites[0]?.slug ?? "");

    // Everything below is scoped to the selected site: its plan drives which tabs exist,
    // and its status decides whether we show data or the "building" holding panel.
    const site = sites.find((s) => s.slug === selectedSlug) ?? sites[0];

    const tabs: { id: Tab; label: string; available: boolean }[] = [
        { id: "performance", label: "Performance", available: true },
        { id: "calls", label: "Call Log", available: site.hasCallData },
        { id: "traffic", label: "Traffic", available: site.hasTraffic },
    ];

    const firstAvailable = tabs.find((t) => t.available)?.id ?? "performance";
    const [activeTab, setActiveTab] = useState<Tab>(firstAvailable);

    // If the selected site doesn't offer the active tab, fall back to an available one.
    const effectiveTab = tabs.find((t) => t.id === activeTab && t.available)?.id ?? firstAvailable;
    const isBuilding = site.status === "building";

    return (
        <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
            {/* Header */}
            <header
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: "var(--rule)", background: "rgba(255,255,255,0.03)" }}
            >
                <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                        {site.name}
                    </span>
                    <span
                        className="text-xs px-2 py-0.5 rounded-full border"
                        style={{
                            borderColor: "var(--rule-strong)",
                            color: "var(--fg-2)",
                            fontFamily: "var(--font-mono)",
                        }}
                    >
                        {planLabel[site.plan] ?? site.plan}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    {/* Any client with more than one site gets the switcher — not just enterprise. */}
                    {sites.length > 1 && (
                        <SiteSelector
                            sites={sites}
                            selected={site.slug}
                            onChange={setSelectedSlug}
                        />
                    )}
                    <UserButton />
                </div>
            </header>

            {isBuilding ? (
                /* This site isn't provisioned yet — the client's other sites still work. */
                <main className="px-6 py-24 max-w-2xl mx-auto text-center">
                    <span className="eyebrow">Setup in progress</span>
                    <h1 className="mt-6" style={{ fontSize: "var(--text-3xl)" }}>
                        We&apos;re building your site
                    </h1>
                    <p
                        className="mt-4"
                        style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}
                    >
                        {site.name} is being put together now. Once it&apos;s live, this tab will fill
                        in with its performance
                        {site.plan === "starter" ? "" : ", call logs,"} and traffic.
                    </p>
                    <p className="mt-8" style={{ color: "var(--fg-3)", fontSize: 14 }}>
                        We&apos;ll email you the moment it&apos;s ready.
                    </p>
                </main>
            ) : (
                <>
                    {/* Tab nav */}
                    <nav className="flex gap-1 px-6 pt-4">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => tab.available && setActiveTab(tab.id)}
                                disabled={!tab.available}
                                className={`px-4 py-2 text-sm rounded-t transition-colors ${
                                    effectiveTab === tab.id
                                        ? "border-b-2 font-medium"
                                        : "opacity-50 cursor-not-allowed"
                                }`}
                                style={
                                    effectiveTab === tab.id
                                        ? {
                                              borderBottomColor: "var(--accent)",
                                              color: "var(--accent)",
                                              background: "rgba(245,237,214,0.06)",
                                          }
                                        : { color: "var(--fg-3)" }
                                }
                                title={!tab.available ? "Not available on this site's plan" : undefined}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                    <hr style={{ borderColor: "var(--rule)" }} />

                    {/* Tab content — keyed by slug so switching sites remounts with fresh data */}
                    <main className="px-6 py-8 max-w-6xl mx-auto">
                        {effectiveTab === "performance" && (
                            <PerformanceSection key={site.slug} selectedSite={site.slug} />
                        )}
                        {effectiveTab === "calls" && site.hasCallData && (
                            <CallsSection key={site.slug} selectedSite={site.slug} />
                        )}
                        {effectiveTab === "traffic" && site.hasTraffic && (
                            <TrafficSection key={site.slug} selectedSite={site.slug} />
                        )}
                    </main>
                </>
            )}
        </div>
    );
}
