"use client";

import { useState } from "react";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, formatDollars, lostPerYear } from "@/app/data/missed-calls";

/**
 * "A burst pipe won't wait for a callback." — the homepage calculator's sum, written as a
 * plumber's work order.
 *
 * Same arithmetic as the homepage and /hvac (`app/data/missed-calls.ts`): calls missed a week ×
 * 52 × the two Invoca rates × the average job, and the second answer is the half we estimate a
 * receptionist wins back. Only the presentation differs, which is what Xander approved: a torn
 * docket with the figures as line items, two of them typed in.
 *
 * The answers stay "$?" until Calculate is pressed, as on the other two pages: the figure is an
 * answer to a question the owner asked, not a number that twitches while they type. 10 calls and
 * $800 are the homepage's own starting values, not a plumbing figure — no real one exists.
 */
const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** Width of a typed figure in `ch`, so the coral rule under it hugs what was typed. */
function fit(value: string, min: number): string {
    return `${Math.max(min, value.length + 0.3)}ch`;
}

export default function PlumbingWorkOrder() {
    const [missed, setMissed] = useState("10");
    const [job, setJob] = useState("800");
    const [answer, setAnswer] = useState<{ lost: string; won: string } | null>(null);

    function calculate(e: React.FormEvent) {
        e.preventDefault();
        const m = Number(missed);
        const j = Number(job);
        if (missed.trim() === "" || job.trim() === "" || !(m >= 0) || !(j >= 0)) {
            setAnswer(null);
            return;
        }
        const lost = lostPerYear(m, j);
        setAnswer({ lost: formatDollars(lost), won: formatDollars(lost * AI_RECOVERY_RATE) });
    }

    return (
        <div className="plumb-wo-wrap">
            <form className="plumb-wo" onSubmit={calculate} aria-label="Work out what your missed calls cost in a year">
                <div className="plumb-wo-head">
                    <b>Work order</b>
                    <span className="plumb-eg">Missed calls &middot; one year</span>
                </div>

                <label className="plumb-wo-line" htmlFor="plumb-wo-missed">
                    <span className="plumb-wo-op" aria-hidden="true" />
                    <span className="plumb-wo-what">
                        Calls you miss a week
                        <span className="plumb-eg">Type your number</span>
                    </span>
                    <span className="plumb-wo-val plumb-wo-field">
                        <input
                            id="plumb-wo-missed"
                            className="plumb-wo-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={500}
                            step={1}
                            value={missed}
                            onChange={(e) => setMissed(e.target.value)}
                            style={{ width: fit(missed, 2.4) }}
                        />
                    </span>
                </label>

                <div className="plumb-wo-line">
                    <span className="plumb-wo-op" aria-hidden="true">&times;</span>
                    <span className="plumb-wo-what">Weeks in a year</span>
                    <span className="plumb-wo-val">52</span>
                </div>
                <div className="plumb-wo-line">
                    <span className="plumb-wo-op" aria-hidden="true">&times;</span>
                    <span className="plumb-wo-what">Are new-business leads</span>
                    <span className="plumb-wo-val">{pct(LEAD_RATE)}</span>
                </div>
                <div className="plumb-wo-line">
                    <span className="plumb-wo-op" aria-hidden="true">&times;</span>
                    <span className="plumb-wo-what">Of leads convert on the call</span>
                    <span className="plumb-wo-val">{pct(CLOSE_RATE)}</span>
                </div>

                <label className="plumb-wo-line" htmlFor="plumb-wo-job">
                    <span className="plumb-wo-op" aria-hidden="true">&times;</span>
                    <span className="plumb-wo-what">
                        Your average job
                        <span className="plumb-eg">Type your number</span>
                    </span>
                    <span className="plumb-wo-val plumb-wo-field">
                        <span>$</span>
                        <input
                            id="plumb-wo-job"
                            className="plumb-wo-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={500000}
                            step={1}
                            value={job}
                            onChange={(e) => setJob(e.target.value)}
                            style={{ width: fit(job, 3.6) }}
                        />
                    </span>
                </label>

                <div className="plumb-wo-go">
                    <span className="plumb-eg">Both percentages: Invoca, 2025</span>
                    <button className="btn primary lg" type="submit">
                        Calculate
                    </button>
                </div>

                <div className="plumb-wo-total" aria-live="polite">
                    <div className="plumb-wo-row">
                        <span className="plumb-wo-lbl">Lost to missed calls, a year</span>
                        <span className="plumb-wo-amt">{answer?.lost ?? "$?"}</span>
                    </div>
                    <div className="plumb-wo-row">
                        <span className="plumb-wo-lbl">Won back with a receptionist</span>
                        <span className="plumb-wo-amt">{answer?.won ?? "$?"}</span>
                    </div>
                </div>
            </form>
        </div>
    );
}
