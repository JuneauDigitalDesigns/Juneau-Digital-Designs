"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, PlayCircle } from "@phosphor-icons/react";
import type { PortalSiteProps } from "@/app/portal/types";
import { upgradeHref } from "@/app/portal/types";
import { SectionHeader } from "../ui/Card";
import { STAGES } from "./stages";
import GrowthDemo from "../growth-demo/GrowthDemo";

/** `/portal/customers?site=…&demo=growth` opens the demo on arrival (the Overview links here). */
const DEMO_PARAM = "demo";
const DEMO_GROWTH = "growth";

/**
 * What a Starter client sees on Customers — mockup M6a.
 *
 * The tab is never hidden. That follows the existing rule in `PortalChrome`: a locked tab is the
 * upsell, and hiding it means they never learn the feature exists.
 *
 * It leads with the offer rather than the lock, framed off what they already have ("you already
 * see every call in your Inbox"), and the primary action is a guided walkthrough rather than a
 * pricing page — someone who has seen the loop work is a far better-qualified upgrade than
 * someone who read a feature list.
 *
 * That walkthrough is the Growth demo (`growth-demo/GrowthDemo.tsx`), a full-screen takeover
 * that plays the loop on sample data. It replaced a driver.js popover tour over the ghost board
 * below, which could only describe the loop in words.
 */
export default function StarterShowcase({ site }: { site: PortalSiteProps }) {
    const params = useSearchParams();
    const [running, setRunning] = useState(false);
    const launcher = useRef<HTMLButtonElement>(null);
    const stop = useCallback(() => setRunning(false), []);

    /*
     * The Overview's Starter panel links to `?demo=growth`. Open on arrival, then drop the
     * parameter, so a refresh or a shared link from here does not replay it, and Back does not
     * land on a URL that reopens it. `history.replaceState` rather than `router.replace`: Next
     * keeps `useSearchParams` in step with it, and it skips a server round trip for a page
     * that has nothing new to render.
     */
    const autoOpen = params.get(DEMO_PARAM) === DEMO_GROWTH;
    useEffect(() => {
        if (!autoOpen) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- opening on arrival is the point
        setRunning(true);
        const url = new URL(window.location.href);
        url.searchParams.delete(DEMO_PARAM);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, [autoOpen]);

    return (
        <div className="space-y-6">
            <SectionHeader title="Customers" meta="Not included on Starter" />

            <div
                className="rounded-2xl border p-7 lg:p-8 flex gap-8 flex-wrap items-center"
                style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)", boxShadow: "var(--shadow-1)" }}
            >
                <div className="flex-1 min-w-[320px]">
                    <h2
                        className="font-extrabold"
                        style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "-0.02em" }}
                    >
                        Turn the people who call you into repeat customers
                    </h2>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed max-w-[56ch]" style={{ color: "var(--fg-2)" }}>
                        You already see every call and web enquiry in your Inbox. Growth adds the next
                        step — a place to track each one until the job is won, text them straight from
                        the portal, and ask happy customers for a Google review.
                    </p>
                    <ul className="mt-4 space-y-2.5 list-none p-0">
                        {[
                            ["A simple pipeline", "move each customer from Lead to Won so nothing gets forgotten."],
                            ["Text your customers", "from your own business number, without giving out your mobile."],
                            ["Ask for Google reviews", "in one tap — more reviews means more people calling you."],
                        ].map(([strong, rest]) => (
                            <li key={strong} className="flex gap-2.5 items-start text-[13.5px]" style={{ color: "var(--fg-2)" }}>
                                <span
                                    className="shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center mt-0.5"
                                    style={{ background: "rgba(22,163,74,0.12)", color: "var(--chart-pos)" }}
                                >
                                    <Check size={10} weight="bold" />
                                </span>
                                <span>
                                    <b style={{ color: "var(--fg)" }}>{strong}</b> — {rest}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex flex-col gap-2.5 min-w-[260px]">
                    <button
                        ref={launcher}
                        type="button"
                        onClick={() => setRunning(true)}
                        aria-haspopup="dialog"
                        className="w-full rounded-lg px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        <PlayCircle size={16} weight="fill" />
                        Show me what Growth does for me
                    </button>
                    <Link
                        href="/pricing"
                        className="w-full rounded-lg border px-4 py-3 text-sm font-semibold text-center"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                    >
                        Compare plans
                    </Link>
                    <p className="text-[11.5px] text-center leading-relaxed" style={{ color: "var(--fg-3)" }}>
                        A one-minute demo with sample customers. Nothing changes on your account.
                    </p>
                </div>
            </div>

            {/* The ghost board. Follows the GhostPreview rules: no numerals anywhere, a dashed
                hatch that appears nowhere else in the product, and inert to assistive tech. */}
            <div
                className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm"
                style={{
                    background: "rgba(37,99,235,0.11)",
                    borderColor: "rgba(37,99,235,0.38)",
                    color: "var(--fg)",
                }}
            >
                <span aria-hidden="true" style={{ color: "var(--accent)" }}>
                    ▲
                </span>
                <span>
                    <b style={{ color: "var(--accent)" }}>Example only.</b> This is a preview of what the
                    Customers board looks like on Growth. <b>None of it is your data.</b>
                </span>
            </div>

            <p className="sr-only">
                A preview of the Growth customer board: six columns from Lead through to Won and Lost,
                each holding customer cards.
            </p>

            <div className="portal-ghost p-4" aria-hidden="true">
                <div className="flex gap-3 items-start overflow-hidden">
                    {STAGES.map((s) => (
                        <div key={s.key} className="flex-1 min-w-[150px]">
                            <div className="flex items-center gap-2 px-1.5 pb-2.5">
                                <span className="rounded-full" style={{ width: 8, height: 8, background: s.color }} />
                                <span className="font-bold text-[14px]" style={{ fontFamily: "var(--font-display)" }}>
                                    {s.label}
                                </span>
                                <span className="ml-auto text-[10.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                    —
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {(s.key === "lead" ? [0, 1] : [0]).map((i) => (
                                    <div
                                        key={i}
                                        className="rounded-xl border p-3"
                                        style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)" }}
                                    >
                                        <div className="font-semibold text-[13.5px]" style={{ color: "var(--fg-3)" }}>
                                            ————————
                                        </div>
                                        <div className="text-[11.5px] mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                            ——— ——— ————
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {running && <GrowthDemo upgradeUrl={upgradeHref(site.slug)} onClose={stop} returnFocusTo={launcher} />}
        </div>
    );
}
