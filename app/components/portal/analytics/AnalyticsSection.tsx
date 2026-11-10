"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PortalSiteProps } from "@/app/portal/types";
import { SectionHeader } from "../ui/Card";
import { useCachedFetch, CLIENT_TTL } from "../PortalDataProvider";
import TrafficSections, { trafficLayout, type TrafficData } from "../TrafficSection";
import SpeedSection from "../PerformanceSection";
import { AnalyticsBlock, Responsive } from "./AnalyticsHeading";
import {
    ANALYTICS_RANGES,
    parseRange,
    type AnalyticsRange,
    type EnquirySummary,
} from "@/app/lib/portal-analytics";

/** Jump bar entries, with the phone's shorter names from the approved mockup. */
const SECTIONS = [
    { id: "visitors", label: "Visitors", short: "Visitors" },
    { id: "sources", label: "Where they came from", short: "Sources" },
    { id: "pages", label: "Pages & devices", short: "Pages" },
    { id: "speed", label: "Speed", short: "Speed" },
    { id: "health", label: "Site health", short: "Health" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * Analytics: Traffic and Performance on one page, plus site health and enquiries.
 *
 * One page with a jump bar rather than tabs inside a tab, because the questions run in order:
 * are people coming, where from, what do they read, does the site load fast, is it up. A
 * client scrolling top to bottom gets the whole story; one who came for speed jumps there.
 *
 * The date range lives in `?range=`, like the site does in `?site=`, so a view can be linked
 * and survives a refresh. It drives the traffic request and the enquiry figures. Speed and
 * health are not windowed: a speed score is today's test, and health is now.
 *
 * Each half keeps its own gate. A site with traffic but no speed score (or the reverse) still
 * gets the half that works, and the other half explains itself with its own FeatureState.
 */
export default function AnalyticsSection({
    site,
    enquiries,
    health,
}: {
    site: PortalSiteProps;
    /** Web-form enquiries for every range, from the server. Null when they could not be read. */
    enquiries: EnquirySummary | null;
    /** The Site health card, streamed from the server. */
    health: ReactNode;
}) {
    const params = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const range = parseRange(params.get("range"));

    const traffic = useCachedFetch<TrafficData>(
        `traffic:${site.slug}:${range}`,
        `/api/portal/traffic?site=${encodeURIComponent(site.slug)}&days=${range}`,
        CLIENT_TTL.traffic,
        site.features.traffic.state === "ready",
    );

    const layout = trafficLayout(site, traffic);
    const sections = SECTIONS.filter((s) => layout === "full" || (s.id !== "sources" && s.id !== "pages"));
    const active = useActiveSection(sections.map((s) => s.id));

    function setRange(next: AnalyticsRange) {
        const qs = new URLSearchParams(params.toString());
        qs.set("range", String(next));
        // Replace, not push: flipping 7 / 30 / 90 is looking, not going somewhere, and Back
        // should leave the page rather than step through every range tried.
        router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    }

    return (
        <div className="space-y-5">
            <SectionHeader
                title="Analytics"
                meta={
                    <Responsive
                        desktop="How your website is doing: who visits, where they come from, and how fast it loads."
                        phone="Who visits your website and how fast it loads."
                    />
                }
                action={<RangeControl value={range} onChange={setRange} />}
            />

            {/* Desktop: one sticky bar, so the sections stay a click away while scrolling. */}
            <nav
                aria-label="Jump to section"
                className="hidden lg:flex sticky top-0 z-10 gap-1 p-1.5 rounded-lg border"
                style={{ background: "var(--elev-1)", borderColor: "var(--rule)" }}
            >
                {sections.map((s) => {
                    const on = s.id === active;
                    return (
                        <a
                            key={s.id}
                            href={`#${s.id}`}
                            aria-current={on ? "location" : undefined}
                            className="px-3 py-[7px] rounded-md text-[13px]"
                            style={{
                                // Accent on its own 8% wash over the white bar: 4.63:1.
                                background: on
                                    ? "color-mix(in srgb, var(--accent) 8%, var(--elev-1))"
                                    : "transparent",
                                color: on ? "var(--accent)" : "var(--fg-2)",
                                fontWeight: on ? 600 : 400,
                            }}
                        >
                            {s.label}
                        </a>
                    );
                })}
            </nav>

            {/* Phone: a scrolling chip row, not sticky. The topbar is already sticky, and a
                second sticky band would take a sixth of the screen from the numbers. */}
            <nav aria-label="Jump to section" className="lg:hidden flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                {sections.map((s) => (
                    <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="shrink-0 rounded-full border px-3 py-2 text-[12.5px]"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                    >
                        {s.short}
                    </a>
                ))}
            </nav>

            <TrafficSections
                site={site}
                range={range}
                traffic={traffic}
                enquiries={enquiries ? enquiries[range] : null}
            />

            <SpeedSection site={site} />

            <AnalyticsBlock id="health" title="Site health">
                {health}
            </AnalyticsBlock>
        </div>
    );
}

/** 7 / 30 / 90 days, as a segmented control. */
function RangeControl({ value, onChange }: { value: AnalyticsRange; onChange: (r: AnalyticsRange) => void }) {
    return (
        <div
            role="group"
            aria-label="Date range"
            className="inline-flex rounded-md border overflow-hidden"
            style={{ borderColor: "var(--rule-strong)", background: "var(--elev-1)" }}
        >
            {ANALYTICS_RANGES.map((r) => {
                const on = r === value;
                return (
                    <button
                        key={r}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange(r)}
                        className="px-3 py-[7px] text-[12.5px] cursor-pointer"
                        style={{
                            // White on --fg is 18.9:1; --fg-2 on white is 8.1:1.
                            background: on ? "var(--fg)" : "transparent",
                            color: on ? "var(--elev-1)" : "var(--fg-2)",
                            fontWeight: on ? 600 : 400,
                        }}
                    >
                        {r} days
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Which section the reader is in, for the jump bar's highlight: the last one whose top has
 * passed just under the sticky bar.
 *
 * A scroll listener that looks the sections up by id each time, rather than an
 * IntersectionObserver. Each section swaps its element when it moves from skeleton to data,
 * and an observer would keep watching the detached skeleton.
 */
function useActiveSection(ids: SectionId[]): SectionId {
    const [active, setActive] = useState<SectionId>(ids[0] ?? "visitors");
    const frame = useRef<number | null>(null);
    const key = ids.join(",");

    useEffect(() => {
        const order = key.split(",") as SectionId[];

        function measure() {
            frame.current = null;
            let current = order[0];
            for (const id of order) {
                const el = document.getElementById(id);
                if (el && el.getBoundingClientRect().top <= 100) current = id;
            }
            // At the very bottom the last sections can never reach the top, so the last one
            // wins once there is nowhere left to scroll.
            const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
            setActive(atBottom ? order[order.length - 1] : current);
        }
        function onScroll() {
            if (frame.current === null) frame.current = requestAnimationFrame(measure);
        }

        measure();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, [key]);

    return active;
}
