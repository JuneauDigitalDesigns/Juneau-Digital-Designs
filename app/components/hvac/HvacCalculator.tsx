"use client";

import { useState } from "react";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, formatDollars, lostPerYear } from "@/app/data/missed-calls";

/**
 * "The call you miss calls someone else." — the homepage calculator's sum, written out as a sum.
 *
 * Xander's ask (19 Nov 2026): the same calculator, presented as figures you type into. Two blanks
 * (calls missed a week, average job), the three fixed figures between them, then Calculate. It
 * leaves out the homepage's third input, calls already won back, so it assumes none.
 *
 * The answers stay "$?" until Calculate is pressed, as on the homepage: the figure is an answer
 * to a question the owner asked, not a number that twitches while they type. 10 calls and $800
 * are the homepage's own starting values.
 *
 * Every figure sits in the same top-aligned box (`.hvac-num`), so the five share one line however
 * their labels wrap. On a phone the sum is written down the page, one figure to a line.
 */
const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** Width of a typed figure in `ch`, so the coral underline hugs what was typed. */
function fit(value: string, min: number): string {
    return `${Math.max(min, value.length + 0.3)}ch`;
}

export default function HvacCalculator() {
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
        <>
            <form id="hvac-calc" className="hvac-sum" onSubmit={calculate} aria-label="Work out what your missed calls cost in a year">
                <label className="hvac-term" htmlFor="hvac-calc-missed">
                    <span className="hvac-num hvac-field">
                        <input
                            id="hvac-calc-missed"
                            className="hvac-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={500}
                            step={1}
                            value={missed}
                            onChange={(e) => setMissed(e.target.value)}
                            style={{ width: fit(missed, 2.3) }}
                        />
                    </span>
                    <span className="hvac-term-l">Calls you miss a week</span>
                </label>
                <div className="hvac-pair">
                    <span className="hvac-op" aria-hidden="true">&times;</span>
                    <div className="hvac-term">
                        <span className="hvac-num">52</span>
                        <span className="hvac-term-l">Weeks</span>
                    </div>
                </div>
                <div className="hvac-pair">
                    <span className="hvac-op" aria-hidden="true">&times;</span>
                    <div className="hvac-term">
                        <span className="hvac-num">{pct(LEAD_RATE)}</span>
                        <span className="hvac-term-l">Are new-business leads</span>
                    </div>
                </div>
                <div className="hvac-pair">
                    <span className="hvac-op" aria-hidden="true">&times;</span>
                    <div className="hvac-term">
                        <span className="hvac-num">{pct(CLOSE_RATE)}</span>
                        <span className="hvac-term-l">Of leads convert on the call</span>
                    </div>
                </div>
                <div className="hvac-pair">
                    <span className="hvac-op" aria-hidden="true">&times;</span>
                    <label className="hvac-term" htmlFor="hvac-calc-job">
                        <span className="hvac-num hvac-field">
                            <span className="hvac-cur">$</span>
                            <input
                                id="hvac-calc-job"
                                className="hvac-input"
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
                        <span className="hvac-term-l">Your average job</span>
                    </label>
                </div>
            </form>
            <div className="hvac-calc-go">
                <p className="hvac-eg">Type your own two numbers over the coral ones</p>
                <button className="btn primary lg" type="submit" form="hvac-calc">
                    Calculate
                </button>
            </div>
            <div className="hvac-result" aria-live="polite">
                <div className="hvac-result-half">
                    <span className="hvac-big">{answer?.lost ?? "$?"}</span>
                    <span className="hvac-eg">Lost to missed calls, a year</span>
                </div>
                <div className="hvac-vr" aria-hidden="true" />
                <div className="hvac-result-half">
                    <span className="hvac-big hvac-coral">{answer?.won ?? "$?"}</span>
                    <span className="hvac-eg">Won back with a receptionist</span>
                </div>
            </div>
        </>
    );
}
