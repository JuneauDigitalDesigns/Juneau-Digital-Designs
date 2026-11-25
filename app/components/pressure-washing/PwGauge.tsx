"use client";

import { useEffect, useRef, useState } from "react";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, lostPerYear } from "@/app/data/missed-calls";

/**
 * "A missed call is money down the drain." — the missed-call sum, on a pressure gauge, with two
 * needles on one scale so "half" is visible at a glance. Approved from the mockup (Xander, 25 Nov
 * 2026).
 *
 * Same sourced rates as the homepage, /hvac, /plumbing and /auto-detailing (`app/data/missed-calls.ts`):
 * a missed call is counted as one job, not a season (that is lawn care's). The two starting numbers
 * are examples the visitor types over; $450 is the pressure washing sample job already in the portal
 * demo (the deck mildew wash). The needles rest at $0 until Calculate, then both sweep up.
 */

const MAX = 150000;
const CX = 260;
const CY = 240;
const NS = "http://www.w3.org/2000/svg";
const whole = (n: number) => Math.round(n).toLocaleString("en-US");

function fit(value: string): string {
    return `${Math.max(2.4, value.length + 0.4)}ch`;
}

export default function PwGauge() {
    const [missed, setMissed] = useState("10");
    const [job, setJob] = useState("450");
    const [answer, setAnswer] = useState<{ lost: string; won: string; lostOf: string; wonOf: string } | null>(null);

    const ticksRef = useRef<SVGGElement>(null);
    const zoneRef = useRef<SVGPathElement>(null);
    const lostRef = useRef<SVGLineElement>(null);
    const wonRef = useRef<SVGLineElement>(null);
    const gaugeRef = useRef<SVGSVGElement>(null);

    // Build the gauge face once: ticks every $12.5K, labels at the $50K majors, and the coral zone
    // near the top of the scale.
    useEffect(() => {
        const ticks = ticksRef.current;
        const zone = zoneRef.current;
        if (!ticks || !zone) return;
        ticks.replaceChildren();
        for (let v = 0; v <= MAX; v += 12500) {
            const major = v % 50000 === 0;
            const a = Math.PI + (v / MAX) * Math.PI;
            const r1 = 196;
            const r2 = major ? 176 : 186;
            const tick = document.createElementNS(NS, "line");
            tick.setAttribute("class", "tick" + (major ? "" : " minor"));
            tick.setAttribute("x1", (CX + r1 * Math.cos(a)).toFixed(1));
            tick.setAttribute("y1", (CY + r1 * Math.sin(a)).toFixed(1));
            tick.setAttribute("x2", (CX + r2 * Math.cos(a)).toFixed(1));
            tick.setAttribute("y2", (CY + r2 * Math.sin(a)).toFixed(1));
            ticks.appendChild(tick);
            if (major) {
                const lab = document.createElementNS(NS, "text");
                lab.setAttribute("class", "tlabel");
                lab.setAttribute("x", (CX + 150 * Math.cos(a)).toFixed(1));
                lab.setAttribute("y", (CY + 150 * Math.sin(a) - 4).toFixed(1));
                lab.textContent = v === 0 ? "0" : "$" + v / 1000 + "K";
                ticks.appendChild(lab);
            }
        }
        const za = Math.PI + (100000 / MAX) * Math.PI;
        const zb = Math.PI + (146000 / MAX) * Math.PI;
        zone.setAttribute(
            "d",
            `M ${(CX + 201 * Math.cos(za)).toFixed(1)} ${(CY + 201 * Math.sin(za)).toFixed(1)} A 201 201 0 0 1 ${(CX + 201 * Math.cos(zb)).toFixed(1)} ${(CY + 201 * Math.sin(zb)).toFixed(1)}`,
        );
    }, []);

    const sweep = (el: SVGLineElement | null, v: number) => {
        if (el) el.style.transform = `rotate(${(180 * Math.min(1, v / MAX)).toFixed(2)}deg)`;
    };

    function calculate(e: React.FormEvent) {
        e.preventDefault();
        const m = Number(missed);
        const j = Number(job);
        if (missed.trim() === "" || job.trim() === "" || !(m >= 0) || !(j >= 0)) {
            setAnswer(null);
            sweep(lostRef.current, 0);
            sweep(wonRef.current, 0);
            return;
        }
        const jobs = m * 52 * LEAD_RATE * CLOSE_RATE;
        const lost = lostPerYear(m, j);
        const won = lost * AI_RECOVERY_RATE;
        sweep(lostRef.current, lost);
        sweep(wonRef.current, won);
        if (gaugeRef.current) {
            gaugeRef.current.setAttribute(
                "aria-label",
                `A pressure gauge: $${whole(lost)} lost to missed calls a year, $${whole(won)} won back with a receptionist`,
            );
        }
        setAnswer({
            lost: `$${whole(lost)}`,
            won: `$${whole(won)}`,
            lostOf: `About ${whole(jobs)} jobs × $${whole(j)} each`,
            wonOf: `Half of them: about ${whole(jobs * AI_RECOVERY_RATE)} jobs`,
        });
    }

    return (
        <form className="pw-sum" onSubmit={calculate} aria-label="Work out what your missed calls cost in a year">
            <div className="pw-dials">
                <label className="pw-dial" htmlFor="pw-missed">
                    <span className="pw-dial-lbl">Calls you miss a week</span>
                    <span className="pw-blank">
                        <input
                            id="pw-missed"
                            className="pw-blank-in"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={500}
                            value={missed}
                            style={{ width: fit(missed) }}
                            onChange={(e) => setMissed(e.target.value)}
                        />
                    </span>
                </label>
                <label className="pw-dial" htmlFor="pw-job">
                    <span className="pw-dial-lbl">Your average job</span>
                    <span className="pw-blank">
                        <span>$</span>
                        <input
                            id="pw-job"
                            className="pw-blank-in"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={50000}
                            value={job}
                            style={{ width: fit(job) }}
                            onChange={(e) => setJob(e.target.value)}
                        />
                    </span>
                </label>
            </div>
            <p className="pw-eg pw-chain">&times; 52 weeks &times; 37% are new-business leads &times; 46% convert on the call</p>
            <button className="btn primary lg" type="submit">
                Calculate
            </button>
            <div className="pw-gaugewrap" aria-live="polite">
                <svg className="pw-gauge" ref={gaugeRef} viewBox="0 0 520 290" role="img" aria-label="A pressure gauge. Not worked out yet">
                    <path className="face" d="M 50 240 A 210 210 0 0 1 470 240 L 448 240 A 188 188 0 0 0 72 240 Z" fill="none" />
                    <path className="face" d="M 50 240 A 210 210 0 0 1 470 240 Z" />
                    <g ref={ticksRef} />
                    <path className="zone" ref={zoneRef} d="" />
                    <text className="unit" x="260" y="212">
                        Dollars a year
                    </text>
                    <line className="needle won" ref={wonRef} x1="260" y1="240" x2="118" y2="240" />
                    <line className="needle lost" ref={lostRef} x1="260" y1="240" x2="92" y2="240" />
                    <circle className="hub" cx="260" cy="240" r="12" />
                </svg>
                <p className="pw-gauge-key">
                    <span className="k-lost">
                        <i aria-hidden="true" />
                        Lost to missed calls
                    </span>
                    <span className="k-won">
                        <i aria-hidden="true" />
                        Won back with a receptionist
                    </span>
                </p>
            </div>
            <div className="pw-reads">
                <div className="pw-readout">
                    <span className="pw-read-lbl">Lost to missed calls, a year</span>
                    <span className="pw-amt">{answer ? answer.lost : "$?"}</span>
                    <span className="pw-of">{answer ? answer.lostOf : "Jobs lost × your average job"}</span>
                </div>
                <div className="pw-readout won">
                    <span className="pw-read-lbl">Won back with a receptionist</span>
                    <span className="pw-amt">{answer ? answer.won : "$?"}</span>
                    <span className="pw-of">{answer ? answer.wonOf : "Half of them"}</span>
                </div>
            </div>
        </form>
    );
}
