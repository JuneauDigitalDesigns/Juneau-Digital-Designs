"use client";

import { useEffect, useRef, useState } from "react";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, formatDollars, lostPerYear } from "@/app/data/missed-calls";
import { MowerIcon } from "./LawnIcon";
import { MEADOW_SHORT, MEADOW_TALL, drawBlades } from "./blades";

/**
 * "A missed call is a whole season." — the missed-call sum, drawn as a lawn.
 *
 * Same sourced rates as the homepage, /hvac and /plumbing (`app/data/missed-calls.ts`). What
 * differs is what a won call is worth: in lawn care a customer is not one job but a season of
 * visits, because whoever answers the phone gets every visit after that. Xander approved counting
 * it that way, knowing it makes the totals much larger than the other pages'.
 *
 * The picture is two figures side by side to ONE scale, not one figure cut in half, which is the
 * distinction that took several rounds to get right: the tall grass IS the money lost, and the
 * mown strip beside it IS the money won back, so it is half as long and the mower stops a third of
 * the way across. The lawn runs the full width whatever the numbers; what changes with the numbers
 * are the figures above it. The ratio is fixed at 2:1 because "won back" is our own estimate of
 * half, and a picture whose split moved would misstate the sum.
 *
 * The totals stay "$?" until Calculate is pressed, as on the other two pages. The three starting
 * numbers are examples the visitor types over; $45 a visit is the example price in the lawn care
 * design, not a figure any real company has given us.
 */

/** Of the whole lawn, how much the mower takes: won / (won + lost), which is a third. */
const MOWN_SHARE = AI_RECOVERY_RATE / (1 + AI_RECOVERY_RATE);

/** The mower waits, then crosses. Milliseconds. */
const WAIT = 950;
const MOW = 2000;

/** What the server draws the lawn to. Replaced by the real size once it can be measured. */
const ASSUMED_WIDTH = 860;
const ASSUMED_HEIGHT = 132;

/** Width of a typed figure in `ch`, so the coral rule under it hugs what was typed. */
function fit(value: string): string {
    return `${Math.max(2.4, value.length + 0.4)}ch`;
}

const whole = (n: number) => Math.round(n).toLocaleString("en-US");

export default function LawnSeason() {
    const [missed, setMissed] = useState("10");
    const [visit, setVisit] = useState("45");
    const [visits, setVisits] = useState("30");
    const [answer, setAnswer] = useState<{ lost: string; won: string; lostOf: string; wonOf: string } | null>(null);

    const meadow = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: ASSUMED_WIDTH, height: ASSUMED_HEIGHT });

    useEffect(() => {
        const el = meadow.current;
        if (!el) return;
        const measure = () => {
            const grass = el.querySelector<SVGElement>(".lawn-meadow-short");
            if (!grass) return;
            const box = grass.getBoundingClientRect();
            const width = Math.round(box.width);
            const height = Math.round(box.height);
            if (width && height) setSize((was) => (was.width === width && was.height === height ? was : { width, height }));
        };
        measure();
        if (!window.ResizeObserver) {
            window.addEventListener("resize", measure);
            return () => window.removeEventListener("resize", measure);
        }
        const watch = new ResizeObserver(measure);
        watch.observe(el);
        return () => watch.disconnect();
    }, []);

    /**
     * The mower crosses a third of the lawn, uncovering the mown row as it goes. Written straight
     * to a CSS variable rather than through state: this runs every frame, and the clip paths it
     * drives are the only thing on the page that changes.
     *
     * Some viewers hold animation frames back — a background tab, an embedded preview — so if none
     * arrives the finished lawn is drawn instead of being left unmown.
     */
    const run = useRef(0);
    function mow() {
        const el = meadow.current;
        if (!el) return;
        const id = ++run.current;
        const target = MOWN_SHARE * 100;
        const land = () => {
            el.style.setProperty("--m", `${target.toFixed(2)}%`);
            el.classList.add("is-mown");
        };
        if (!window.requestAnimationFrame || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
            land();
            return;
        }
        el.style.setProperty("--m", "0%");
        el.classList.remove("is-mown");
        let started = false;
        let begun: number | null = null;
        window.setTimeout(() => {
            if (started || id !== run.current) return;
            run.current++;
            land();
        }, 600);
        const step = (now: number) => {
            if (id !== run.current) return;
            started = true;
            if (begun === null) begun = now;
            const k = Math.max(0, Math.min(1, (now - begun - WAIT) / MOW));
            const eased = 1 - Math.pow(1 - k, 3);
            el.style.setProperty("--m", `${(target * eased).toFixed(2)}%`);
            if (k > 0.05) el.classList.add("is-mown");
            if (k < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }

    function calculate(e: React.FormEvent) {
        e.preventDefault();
        const m = Number(missed);
        const v = Number(visit);
        const n = Number(visits);
        if (missed.trim() === "" || visit.trim() === "" || visits.trim() === "" || !(m >= 0) || !(v >= 0) || !(n >= 1)) {
            setAnswer(null);
            return;
        }
        const customer = v * n;
        const lost = lostPerYear(m, customer);
        const customers = m * 52 * LEAD_RATE * CLOSE_RATE;
        setAnswer({
            lost: formatDollars(lost),
            won: formatDollars(lost * AI_RECOVERY_RATE),
            lostOf: `About ${whole(customers)} customers × $${whole(customer)} each`,
            wonOf: `Half of them: about ${whole(customers * AI_RECOVERY_RATE)} customers`,
        });
        mow();
    }

    const perSeason = Number(visit) * Number(visits);
    const tall = drawBlades({ ...MEADOW_TALL, width: size.width, height: size.height, min: size.height * 0.45, max: size.height * 1.02 });
    const short = drawBlades({ ...MEADOW_SHORT, width: size.width, height: size.height });

    return (
        <form className="lawn-season" onSubmit={calculate} aria-label="Work out what your missed calls cost in a year">
            <p className="lawn-fill">
                You miss{" "}
                <label className="lawn-blank">
                    <input
                        id="lawn-missed"
                        className="lawn-blank-in"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={500}
                        value={missed}
                        style={{ width: fit(missed) }}
                        onChange={(e) => setMissed(e.target.value)}
                        aria-label="Calls you miss a week"
                    />
                </label>{" "}
                calls a week.
                <br /> A customer pays{" "}
                <label className="lawn-blank">
                    <span>$</span>
                    <input
                        id="lawn-visit"
                        className="lawn-blank-in"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={5000}
                        value={visit}
                        style={{ width: fit(visit) }}
                        onChange={(e) => setVisit(e.target.value)}
                        aria-label="What a customer pays a visit, in dollars"
                    />
                </label>{" "}
                a visit,
                <br />{" "}
                <label className="lawn-blank">
                    <input
                        id="lawn-visits"
                        className="lawn-blank-in"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={60}
                        value={visits}
                        style={{ width: fit(visits) }}
                        onChange={(e) => setVisits(e.target.value)}
                        aria-label="Visits a season"
                    />
                </label>{" "}
                visits a season.
            </p>
            <button className="btn primary lg" type="submit">
                Calculate
            </button>

            <div className="lawn-sumpic">
                <p className="lawn-one">
                    <span className="lawn-one-each">
                        One customer, one season: {visits || "0"} visits at ${visit || "0"}
                    </span>
                    <b>${Number.isFinite(perSeason) ? whole(perSeason) : "0"}</b>
                </p>
                <div className="lawn-halves" aria-live="polite">
                    <div>
                        <span className="lawn-halves-lbl">
                            <i className="lawn-key lawn-key-short" aria-hidden="true" />
                            Won back with a receptionist
                        </span>
                        <span className="lawn-amt">{answer ? answer.won : "$?"}</span>
                        <span className="lawn-of">{answer ? answer.wonOf : "Half of them"}</span>
                    </div>
                    <div>
                        <span className="lawn-halves-lbl">
                            <i className="lawn-key lawn-key-long" aria-hidden="true" />
                            Lost to missed calls, a year
                        </span>
                        <span className="lawn-amt">{answer ? answer.lost : "$?"}</span>
                        <span className="lawn-of">{answer ? answer.lostOf : "Customers lost × what each pays in a season"}</span>
                    </div>
                </div>
                <div
                    className="lawn-meadow"
                    ref={meadow}
                    role="img"
                    aria-label="A lawn the full width of the section. The tall grass stands for the money lost to missed calls and is marked with a bracket. The mown strip beside it, half as long, stands for the money a receptionist wins back"
                >
                    <svg className="lawn-meadow-g lawn-meadow-short" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
                        {short.blades.map((b, i) => (
                            <path key={i} className={b.shade} d={b.d} />
                        ))}
                    </svg>
                    <svg className="lawn-meadow-g lawn-meadow-tall" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
                        {tall.blades.map((b, i) => (
                            <path key={i} className={b.shade} d={b.d} />
                        ))}
                    </svg>
                    <span className="lawn-bracket" aria-hidden="true">
                        <span>Lost to missed calls</span>
                    </span>
                    <MowerIcon className="lawn-meadow-mower" />
                    <span className="lawn-under" aria-hidden="true">
                        <span>Won back</span>
                    </span>
                </div>
            </div>
        </form>
    );
}
