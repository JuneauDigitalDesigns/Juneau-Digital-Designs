"use client";

import Image from "next/image";
import Link from "next/link";
import {
    ArrowCounterClockwise,
    ArrowSquareOut,
    CaretRight,
    Gear,
    Lifebuoy,
    Lock,
    PlayCircle,
    Star,
    TrendUp,
} from "@phosphor-icons/react";
import {
    MOBILE_MORE_TABS,
    PORTAL_TABS,
    tabAvailability,
    tabHref,
    type PortalTabId,
} from "@/app/portal/types";
import { usePortalChrome } from "./PortalChromeContext";
import PortalUserButton from "./PortalUserButton";
import { launchTour } from "./tour/TourController";
import { HELP_MENU } from "./tour/steps";

/**
 * The phone's More screen (approved mockup, 2026-11-19).
 *
 * Grouped like a phone's own Settings app: the three sections behind More, then the site and
 * the tours, then the signed-in account, with the JDD lockup on its cream chip at the foot.
 * It replaced the More bottom sheet, which held the same items.
 *
 * The lockup stays on cream in dark mode as well: the art is near-black and has no
 * light-on-dark cut, which is also why the chip exists at all (see PORTAL-DESIGN.md).
 *
 * Desktop never links here (the rail lists everything), but the page works there too.
 */
const ICON: Partial<Record<PortalTabId, { Icon: typeof Gear; tint: string }>> = {
    analytics: { Icon: TrendUp, tint: "#7c3aed" },
    settings: { Icon: Gear, tint: "#64748b" },
    support: { Icon: Lifebuoy, tint: "#0891b2" },
};

export default function MoreScreen() {
    const { selected, accountEmail, host } = usePortalChrome();

    return (
        <div className="portal-more">
            <h1>More</h1>

            <nav className="portal-group" aria-label="More sections">
                {MOBILE_MORE_TABS.map((id) => {
                    const tab = PORTAL_TABS.find((t) => t.id === id)!;
                    const locked = tabAvailability(tab.feature, selected.features)?.state === "not-on-plan";
                    const { Icon, tint } = ICON[id]!;
                    return (
                        <Link key={id} href={tabHref(tab.href, selected.slug)} className="portal-cell" data-tour={`more-${id}`}>
                            <span className="portal-tile" style={{ background: tint }}>
                                <Icon size={19} weight="bold" />
                            </span>
                            <span className="portal-cell-main">{tab.label}</span>
                            {locked && (
                                <>
                                    <Lock size={13} weight="fill" style={{ color: "var(--fg-3)" }} />
                                    <span className="sr-only">(not included in your plan)</span>
                                </>
                            )}
                            <CaretRight size={16} className="portal-cell-chev" />
                        </Link>
                    );
                })}
            </nav>

            {/* Growth and Enterprise: the text the one-tap Review button sends (2026-11-19). Gated on
                `messaging` being on the plan, not `crm`, which Starter + AI has too (v1.47.0).
                "Review message" is DRAFT wording, awaiting Xander's approval. */}
            {selected.features.messaging.state !== "not-on-plan" && (
                <div className="portal-group">
                    <Link href={tabHref("more/review", selected.slug)} className="portal-cell" data-tour="more-review">
                        <span className="portal-tile" style={{ background: "#f5a623", color: "#1c1405" }}>
                            <Star size={19} weight="fill" />
                        </span>
                        <span className="portal-cell-main">Review message</span>
                        <CaretRight size={16} className="portal-cell-chev" />
                    </Link>
                </div>
            )}

            {/* `more-help`, not `portal-help`: the rail's Help & tour button holds that hook and sits
                earlier in the DOM, hidden on a phone. */}
            <div className="portal-group" data-tour="more-help">
                {host && (
                    <a
                        href={selected.canonical ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="portal-cell"
                    >
                        <span className="portal-tile" style={{ background: "#2563eb" }}>
                            <ArrowSquareOut size={18} weight="bold" />
                        </span>
                        <span className="portal-cell-main">Open {host}</span>
                    </a>
                )}
                <button type="button" className="portal-cell" onClick={() => launchTour("page")}>
                    <span className="portal-tile" style={{ background: "#15803d" }}>
                        <PlayCircle size={19} weight="bold" />
                    </span>
                    <span className="portal-cell-main">{HELP_MENU.page}</span>
                </button>
                <button type="button" className="portal-cell" onClick={() => launchTour("all")}>
                    <span className="portal-tile" style={{ background: "#c2410c" }}>
                        <ArrowCounterClockwise size={19} weight="bold" />
                    </span>
                    <span className="portal-cell-main">{HELP_MENU.all}</span>
                </button>
            </div>

            <div className="portal-group">
                <div className="portal-cell">
                    <PortalUserButton siteSlug={selected.slug} />
                    <span className="portal-cell-main truncate" style={{ color: "var(--fg-2)" }} title={accountEmail}>
                        {accountEmail}
                    </span>
                </div>
            </div>

            <a
                href="https://juneaudigitaldesigns.com"
                target="_blank"
                rel="noopener noreferrer"
                className="portal-more-brand"
                aria-label="Juneau Digital Designs, agency home (opens in a new tab)"
            >
                <span className="portal-more-chip">
                    <Image src="/jdd-lockup-portal.png" alt="" width={640} height={192} />
                </span>
                <span>Client Portal</span>
            </a>
        </div>
    );
}
