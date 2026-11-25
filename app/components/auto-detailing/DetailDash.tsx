"use client";

import { useState } from "react";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, lostPerYear } from "@/app/data/missed-calls";

/**
 * "A missed call drives to the next shop." — the missed-call sum, on a dashboard, with two
 * odometers that roll to the figures. Approved from the mockup (Xander, 25 Nov 2026).
 *
 * Same sourced rates as the homepage, /hvac and /plumbing (`app/data/missed-calls.ts`): a missed
 * call is counted as one job, not a season (that is lawn care's). The two starting numbers are
 * examples the visitor types over; $300 is a round figure for a detail. The totals read "$0" until
 * Calculate is pressed, then the wheels roll up; change a number and they roll again.
 */

/** The seven odometer wheels, with commas fixed at the thousands and millions. */
const WHEELS = 7;
const whole = (n: number) => Math.round(n).toLocaleString("en-US");

/** Width of a typed figure in `ch`, so the coral rule under it hugs what was typed. */
function fit(value: string): string {
    return `${Math.max(2.4, value.length + 0.4)}ch`;
}

function Odometer({ value, trip }: { value: number | null; trip?: boolean }) {
    // The digits of the value, right-aligned across the wheels; everything to the left of the
    // first significant digit is a dim "lead" zero.
    const v = value === null ? 0 : Math.max(0, Math.min(9999999, Math.round(value)));
    const s = String(v).padStart(WHEELS, "0");
    const firstSig = value === null || v === 0 ? WHEELS : WHEELS - String(v).length;
    return (
        <span
            className={`detail-odo${trip ? " trip" : ""}`}
            role="img"
            aria-label={value === null ? "Not worked out yet" : `$${v.toLocaleString("en-US")}`}
        >
            <span className="cur">$</span>
            {Array.from({ length: WHEELS }, (_, i) => {
                const lead = v === 0 || i < firstSig;
                return (
                    <span className="sep-wrap" key={i}>
                        {(i === 1 || i === 4) && <span className="sep">,</span>}
                        <span className={`detail-wheel${lead ? " lead" : ""}`} style={{ ["--i" as string]: WHEELS - 1 - i }}>
                            <span style={{ ["--d" as string]: Number(s.charAt(i)) }}>
                                {Array.from({ length: 10 }, (_, d) => (
                                    <b key={d}>{d}</b>
                                ))}
                            </span>
                        </span>
                    </span>
                );
            })}
        </span>
    );
}

export default function DetailDash() {
    const [missed, setMissed] = useState("10");
    const [job, setJob] = useState("300");
    const [answer, setAnswer] = useState<{ lost: number; won: number; lostOf: string; wonOf: string } | null>(null);

    function calculate(e: React.FormEvent) {
        e.preventDefault();
        const m = Number(missed);
        const j = Number(job);
        if (missed.trim() === "" || job.trim() === "" || !(m >= 0) || !(j >= 0)) {
            setAnswer(null);
            return;
        }
        const jobs = m * 52 * LEAD_RATE * CLOSE_RATE;
        const lost = lostPerYear(m, j);
        setAnswer({
            lost,
            won: lost * AI_RECOVERY_RATE,
            lostOf: `About ${whole(jobs)} jobs × $${whole(j)} each`,
            wonOf: `Half of them: about ${whole(jobs * AI_RECOVERY_RATE)} jobs`,
        });
    }

    return (
        <form className="detail-dash" onSubmit={calculate} aria-label="Work out what your missed calls cost in a year">
            <div className="detail-dials">
                <label className="detail-dial" htmlFor="detail-missed">
                    <span className="detail-dial-lbl">Calls you miss a week</span>
                    <span className="detail-blank">
                        <input
                            id="detail-missed"
                            className="detail-blank-in"
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
                <label className="detail-dial" htmlFor="detail-job">
                    <span className="detail-dial-lbl">Your average job</span>
                    <span className="detail-blank">
                        <span>$</span>
                        <input
                            id="detail-job"
                            className="detail-blank-in"
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
            <p className="detail-eg detail-chain">&times; 52 weeks &times; 37% are new-business leads &times; 46% convert on the call</p>
            <button className="btn primary lg" type="submit">
                Calculate
            </button>
            <div className="detail-meters" aria-live="polite">
                <div className="detail-meter">
                    <span className="detail-meter-lbl">Lost to missed calls, a year</span>
                    <Odometer value={answer ? answer.lost : null} />
                    <span className="detail-of">{answer ? answer.lostOf : "Jobs lost × your average job"}</span>
                </div>
                <div className="detail-meter">
                    <span className="detail-meter-lbl">Won back with a receptionist</span>
                    <Odometer value={answer ? answer.won : null} trip />
                    <span className="detail-of">{answer ? answer.wonOf : "Half of them"}</span>
                </div>
            </div>
        </form>
    );
}
