"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import type { PortalClientProps } from "@/app/portal/page";
import CallsSection from "./CallsSection";
import PerformanceSection from "./PerformanceSection";
import TrafficSection from "./TrafficSection";
import SiteSelector from "./SiteSelector";

type Tab = "performance" | "calls" | "traffic";

export default function DashboardShell(props: PortalClientProps) {
    const { name, plan, hasCallData, hasTraffic, isEnterprise, sites } = props;

    const tabs: { id: Tab; label: string; available: boolean }[] = [
        { id: "performance", label: "Performance", available: true },
        { id: "calls", label: "Call Log", available: hasCallData },
        { id: "traffic", label: "Traffic", available: hasTraffic },
    ];

    const firstAvailable = tabs.find((t) => t.available)?.id ?? "performance";
    const [activeTab, setActiveTab] = useState<Tab>(firstAvailable);
    const [selectedSite, setSelectedSite] = useState<string | null>(
        isEnterprise && sites?.length ? sites[0].slug : null
    );

    // Enterprise accounts span multiple sites — show the selected site's brand
    // name in the header; otherwise the single account/brand name.
    const headerName =
        (isEnterprise && selectedSite && sites?.find((s) => s.slug === selectedSite)?.name) || name;

    const planLabel: Record<typeof plan, string> = {
        starter: "Starter",
        growth: "Growth",
        enterprise: "Enterprise",
    };

    return (
        <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
            {/* Header */}
            <header
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: "var(--rule)", background: "rgba(255,255,255,0.03)" }}
            >
                <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                        {headerName}
                    </span>
                    <span
                        className="text-xs px-2 py-0.5 rounded-full border"
                        style={{
                            borderColor: "var(--rule-strong)",
                            color: "var(--fg-2)",
                            fontFamily: "var(--font-mono)",
                        }}
                    >
                        {planLabel[plan]}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    {isEnterprise && sites && sites.length > 1 && (
                        <SiteSelector
                            sites={sites}
                            selected={selectedSite}
                            onChange={setSelectedSite}
                        />
                    )}
                    <UserButton />
                </div>
            </header>

            {/* Tab nav */}
            <nav className="flex gap-1 px-6 pt-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => tab.available && setActiveTab(tab.id)}
                        disabled={!tab.available}
                        className={`px-4 py-2 text-sm rounded-t transition-colors ${
                            activeTab === tab.id
                                ? "border-b-2 font-medium"
                                : "opacity-50 cursor-not-allowed"
                        }`}
                        style={
                            activeTab === tab.id
                                ? {
                                      borderBottomColor: "var(--accent)",
                                      color: "var(--accent)",
                                      background: "rgba(245,237,214,0.06)",
                                  }
                                : { color: "var(--fg-3)" }
                        }
                        title={!tab.available ? "Not available on your plan" : undefined}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
            <hr style={{ borderColor: "var(--rule)" }} />

            {/* Tab content */}
            <main className="px-6 py-8 max-w-6xl mx-auto">
                {activeTab === "performance" && (
                    <PerformanceSection selectedSite={selectedSite} />
                )}
                {activeTab === "calls" && hasCallData && (
                    <CallsSection selectedSite={selectedSite} isEnterprise={isEnterprise} />
                )}
                {activeTab === "traffic" && hasTraffic && (
                    <TrafficSection selectedSite={selectedSite} />
                )}
            </main>
        </div>
    );
}
