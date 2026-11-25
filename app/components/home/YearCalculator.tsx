"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import HomeIcon from "./HomeIcon";
import { MISSED_CALLS_ID } from "@/app/data/portal-demo";

/**
 * 7 · "How much are your missed calls worth?" as "the year" (Xander's pick from the homepage
 * mockup, rounds 2-3, 19 Nov 2026).
 *
 * The same three questions and the same sum as before. What changed is how the answer lands: on
 * Calculate, the questions fade away and, in the same box, a year of bars rises from January to
 * December while the two figures count up. Ink is what the missed calls cost; the coral lower half
 * is what comes back. "How we calculate this" still opens the five-step working, unchanged.
 *
 * One box, three views stacked in one grid cell, so the box is as tall as its tallest view and the
 * page never jumps when they swap. The view being left fades out first (250ms); the one asked for
 * then fades in.
 */

// Invoca, Home Services Call Conversion Benchmarks 2025 (60M+ calls).
const LEAD_RATE = 0.37;
const CLOSE_RATE = 0.46;
// Our own assumption, deliberately conservative, and labelled as ours in the working below.
const AI_RECOVERY_RATE = 0.5;

const MISSED_MIN = 1, MISSED_MAX = 50;
const RECOVERY_MIN = 1, RECOVERY_MAX = 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const OUT_MS = 250;
const COUNT_MS = 950;

type View = "sliders" | "results" | "breakdown";

function sliderToJobValue(pos: number): number {
    return Math.round(50 * Math.pow(10000, pos / 100));
}
function jobValueToSlider(val: number): number {
    return (Math.log(val / 50) / Math.log(10000)) * 100;
}
function formatDollars(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
    return `$${Math.round(n).toLocaleString("en-US")}`;
}
function formatJobValue(n: number): string {
    return n >= 1000 ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K` : `$${n.toLocaleString("en-US")}`;
}

/** Counts up to `to` each time `run` changes; lands on the figure straight away with reduced motion. */
function useCountUp(to: number, run: number): number {
    const [shown, setShown] = useState(to);
    useEffect(() => {
        const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : COUNT_MS;
        let raf = 0;
        const t0 = performance.now();
        const step = (t: number) => {
            const k = ms === 0 ? 1 : Math.min(1, (t - t0) / ms);
            setShown(to * (1 - Math.pow(1 - k, 3)));
            if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        // A background tab pauses animation frames: land on the answer regardless.
        const done = window.setTimeout(() => setShown(to), ms + 150);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(done);
        };
    }, [to, run]);
    return shown;
}

export default function YearCalculator() {
    const [missedPerWeek, setMissedPerWeek] = useState(10);
    const [jobSliderPos, setJobSliderPos] = useState(() => jobValueToSlider(800));
    const [currentRecovery, setCurrentRecovery] = useState(20);

    const [view, setView] = useState<View>("sliders");
    const [leaving, setLeaving] = useState<View | null>(null);
    /* Bumped on every Calculate: replays the bars and the count. */
    const [run, setRun] = useState(0);
    const [grown, setGrown] = useState(false);
    const timers = useRef<number[]>([]);
    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    function goTo(next: View) {
        if (next === view || leaving) return;
        setLeaving(view);
        /* A fresh answer starts with the bars flat; they rise once its view is on screen. */
        if (next === "results" && view === "sliders") setGrown(false);
        timers.current.push(
            window.setTimeout(() => {
                setView(next);
                setLeaving(null);
                if (next === "results" && view === "sliders") setRun((r) => r + 1);
            }, OUT_MS),
        );
    }

    useEffect(() => {
        if (run === 0) return;
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setGrown(true));
        });
        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [run]);

    const avgJobValue = sliderToJobValue(jobSliderPos);
    const annualMissed = missedPerWeek * 52;
    const annualLeadCalls = annualMissed * LEAD_RATE;
    const unrecoveredLeads = annualLeadCalls * (1 - currentRecovery / 100);
    const revenueOnTable = unrecoveredLeads * CLOSE_RATE * avgJobValue;
    const recoverableRevenue = revenueOnTable * AI_RECOVERY_RATE;

    const lostShown = useCountUp(revenueOnTable, run);
    const wonShown = useCountUp(recoverableRevenue, run);

    const missedPct = ((missedPerWeek - MISSED_MIN) / (MISSED_MAX - MISSED_MIN)) * 100;
    const recoveryPct = ((currentRecovery - RECOVERY_MIN) / (RECOVERY_MAX - RECOVERY_MIN)) * 100;
    const avgJobValueFormatted = formatJobValue(avgJobValue);
    const recoverableFormatted = formatDollars(recoverableRevenue);

    const visible = leaving ?? view;
    const viewClass = (v: View) => `hp-cview${v !== visible ? " off" : ""}${v === leaving ? " leaving" : ""}`;

    return (
        /* `id` is the anchor other pages and the footer may still point at. */
        <section className="hp-wash" id={MISSED_CALLS_ID}>
            <div className="hp-wrap">
                <div className="home-head">
                    <h2 className="home-display">
                        How much are your <span className="home-em">missed calls</span> worth?
                    </h2>
                </div>

                <div className="hp-cbox">
                    <div className={`${viewClass("sliders")} hp-cstack`} inert={visible !== "sliders"}>
                        <label className="hp-crow">
                            <p>
                                I miss <b>{missedPerWeek}</b> calls a week
                            </p>
                            <input
                                type="range"
                                min={MISSED_MIN}
                                max={MISSED_MAX}
                                step={1}
                                value={missedPerWeek}
                                onChange={(e) => setMissedPerWeek(Number(e.target.value))}
                                style={{ "--pct": `${missedPct}%` } as React.CSSProperties}
                                aria-label="Missed calls per week"
                            />
                            <span className="hp-ends" aria-hidden="true">
                                <span>{MISSED_MIN}</span>
                                <span>{MISSED_MAX}</span>
                            </span>
                        </label>
                        <label className="hp-crow">
                            <p>
                                My average job is worth <b>{avgJobValueFormatted}</b>
                            </p>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={0.1}
                                value={jobSliderPos}
                                onChange={(e) => setJobSliderPos(Number(e.target.value))}
                                style={{ "--pct": `${jobSliderPos}%` } as React.CSSProperties}
                                aria-label="Average job value"
                                aria-valuetext={avgJobValueFormatted}
                            />
                            <span className="hp-ends" aria-hidden="true">
                                <span>{formatJobValue(sliderToJobValue(0))}</span>
                                <span>{formatJobValue(sliderToJobValue(100))}</span>
                            </span>
                        </label>
                        <label className="hp-crow">
                            <p>
                                I win back <b>{currentRecovery}%</b> of those leads
                            </p>
                            <input
                                type="range"
                                min={RECOVERY_MIN}
                                max={RECOVERY_MAX}
                                step={1}
                                value={currentRecovery}
                                onChange={(e) => setCurrentRecovery(Number(e.target.value))}
                                style={{ "--pct": `${recoveryPct}%` } as React.CSSProperties}
                                aria-label="Percent of lead calls you recover today"
                                aria-valuetext={`${currentRecovery}%`}
                            />
                            <span className="hp-ends" aria-hidden="true">
                                <span>{RECOVERY_MIN}%</span>
                                <span>{RECOVERY_MAX}%</span>
                            </span>
                        </label>
                        <div className="hp-cgo">
                            <button type="button" className="btn primary lg" onClick={() => goTo("results")}>
                                Calculate
                            </button>
                        </div>
                    </div>

                    <div className={viewClass("results")} inert={visible !== "results"} aria-live="polite">
                        <button type="button" className="hp-cback" onClick={() => goTo("sliders")}>
                            &larr; Recalculate
                        </button>
                        <div className={`hp-oc${grown ? " grown" : ""}`}>
                            <div>
                                <div className="hp-oc-chart" aria-hidden="true">
                                    {MONTHS.map((m, i) => (
                                        <div key={m} className="hp-mo">
                                            <i style={{ height: `${(((i + 1) / 12) * 100).toFixed(2)}%`, transitionDelay: `${150 + (i + 1) * 55}ms` }} />
                                        </div>
                                    ))}
                                </div>
                                <div className="hp-oc-x" aria-hidden="true">
                                    {MONTHS.map((m) => (
                                        <span key={m}>{m}</span>
                                    ))}
                                </div>
                                <p className="hp-eg hp-oc-cap">Every month adds another {formatDollars(revenueOnTable / 12)}.</p>
                            </div>
                            <div className="hp-oc-figs">
                                <div className="hp-fig">
                                    <p className="kicker">Lost to Missed Calls</p>
                                    <p className="hp-fig-n">{formatDollars(lostShown)}</p>
                                    <p className="kicker">per year</p>
                                </div>
                                <div className="hp-fig won">
                                    <p className="kicker">Won Back With a Receptionist</p>
                                    <p className="hp-fig-n">{formatDollars(wonShown)}</p>
                                    <p className="kicker">per year</p>
                                </div>
                            </div>
                        </div>
                        <p className="hp-remark">
                            {revenueOnTable < 1 ? (
                                <>Nothing on the table at 100%. Almost nobody is at 100%.</>
                            ) : (
                                <>
                                    {recoverableFormatted}{" "}of that comes back when every call gets answered. You don&apos;t work any harder, you just stop missing them.
                                </>
                            )}
                        </p>
                        <div className="hp-cact">
                            <Link href="/contact">Get started &rarr;</Link>
                            <button type="button" onClick={() => goTo("breakdown")}>
                                <HomeIcon name="info" />
                                How we calculate this
                            </button>
                        </div>
                    </div>

                    <div className={`${viewClass("breakdown")} hp-cbreak`} inert={visible !== "breakdown"}>
                        <button type="button" className="hp-cback" onClick={() => goTo("results")}>
                            &larr; Back to results
                        </button>
                        <p className="calc-breakdown-intro">
                            Based on your inputs, published research where it exists, and one assumption of our own. All five steps are shown below.
                        </p>
                        <ol className="calc-breakdown">
                            <li>
                                <strong>{missedPerWeek} calls/week × 52</strong> = {Math.round(annualMissed).toLocaleString()} missed/year
                            </li>
                            <li>
                                × <strong>37% are new-business leads</strong> (Invoca, 2025) = {Math.round(annualLeadCalls).toLocaleString()} lead calls
                            </li>
                            <li>
                                × <strong>{Math.round((1 - currentRecovery / 100) * 100)}% unrecovered</strong> = {Math.round(unrecoveredLeads).toLocaleString()} lost leads
                            </li>
                            <li>
                                × <strong>46% of leads convert on the call</strong> (Invoca, 2025) × avg job value = {formatDollars(revenueOnTable)}
                            </li>
                            <li>
                                × <strong>50% recovered</strong>, our own estimate, deliberately conservative = {formatDollars(recoverableRevenue)}
                            </li>
                        </ol>
                        <p className="calc-fineprint">Illustrative estimates only. Actual results vary by market, business model, and execution.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
