"use client";

import Link from "next/link";
import { Check } from "@phosphor-icons/react";
import { SectionHeader } from "../ui/Card";
import { STAGES } from "./stages";

/**
 * What a website-plan client sees on Customers — mockup M6a.
 *
 * Since schema v1.47.0 (2026-11-25) only the website plan reaches this page: Starter + AI
 * Receptionist has the Customers board itself, so the offer here is Starter + AI, in the words of
 * copy batch G8 (approved word for word). The website plan gets no demo (D5), so the Growth demo
 * that used to open from here moved to the board (`GrowthDemoOnArrival`), where Starter + AI
 * arrives with `?demo=growth`.
 *
 * The tab is never hidden. That follows the existing rule in `PortalChrome`: a locked tab is the
 * upsell, and hiding it means they never learn the feature exists.
 *
 * It leads with the offer rather than the lock, framed off what they already have ("you already
 * see every web inquiry in your Inbox").
 */
export default function StarterShowcase() {
    return (
        <div className="space-y-6">
            <SectionHeader title="Customers" meta="Not included on your plan" />

            <div
                className="rounded-2xl border p-7 lg:p-8 flex gap-8 flex-wrap items-center"
                style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)", boxShadow: "var(--shadow-1)" }}
            >
                <div className="flex-1 min-w-[320px]">
                    <h2
                        className="font-extrabold"
                        style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "-0.02em" }}
                    >
                        Turn the people who contact you into repeat customers
                    </h2>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed max-w-[56ch]" style={{ color: "var(--fg-2)" }}>
                        {/* Copy batch G8, approved word for word (2026-11-25). */}
                        You already see every web inquiry in your Inbox. Starter + AI Receptionist adds the next step: a place to track each one until the job is won, with an AI receptionist answering the calls you miss.
                    </p>
                    <ul className="mt-4 space-y-2.5 list-none p-0">
                        {[
                            ["A simple pipeline", "move each customer from Lead to Won so nothing gets forgotten."],
                            ["Follow-ups", "set a reminder on any customer so nobody waits on you."],
                            ["An AI receptionist", "answers the calls you miss, 24/7."],
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

                <div className="flex flex-col gap-2.5 w-full sm:w-auto sm:min-w-[260px]">
                    {/* The website plan gets no demo (D5): its one upsell is the receptionist. */}
                    <Link
                        href="/pricing"
                        className="w-full rounded-lg border px-4 py-3 text-sm font-semibold text-center"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                    >
                        Compare plans
                    </Link>
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
                    Customers board looks like on Starter + AI Receptionist. <b>None of it is your data.</b>
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

        </div>
    );
}
