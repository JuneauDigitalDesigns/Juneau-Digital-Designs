"use client";

import { useEffect, useRef, useState } from "react";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, lostPerYear } from "@/app/data/missed-calls";

/**
 * "A missed call is a roof someone else gets." — the missed-call sum as two roofs on one scale,
 * shingled up to the money: the roof the missed calls hand to someone else, and the part a
 * receptionist wins back. Approved from the mockup, round 1b (Xander, 25 Nov 2026: the rain barrels
 * of round 1 had nothing to do with roofing).
 *
 * Same sourced rates as the homepage and the other trade pages (`app/data/missed-calls.ts`): a
 * missed call is counted as one job. The two starting numbers are examples the visitor types over;
 * $450 is the roofing job already in the portal demo (the emergency leak repair).
 *
 * A full roof is $150K a year: six courses of $25K. The roofs are bare until Calculate, then both
 * shingle up from the gutter. Past $150K a roof is topped out (ridge cap on, a badge says so) and
 * the figures stay exact.
 */

const MAX = 150000;
const VB = 150;
const VT = 34;
const VN = 6;
const VH = (VB - VT) / VN;
const vxl = (y: number) => 20 + (VB - y) * (65 / 116);
const vxr = (y: number) => 250 - (VB - y) * (65 / 116);
const whole = (n: number) => Math.round(n).toLocaleString("en-US");

const COURSES = Array.from({ length: VN }, (_, c) => {
    const y0 = VB - (c + 1) * VH;
    const slots: number[] = [];
    for (let x = c % 2 ? 12 : 0; x <= 290; x += 24) slots.push(x);
    return { c, y0, slots };
});

type Which = "lost" | "won";
type Answer = { lost: string; won: string; lostOf: string; wonOf: string };

function fit(value: string): string {
    return `${Math.max(2.4, value.length + 0.4)}ch`;
}

export default function RfRoofs() {
    const [missed, setMissed] = useState("10");
    const [job, setJob] = useState("450");
    const [answer, setAnswer] = useState<Answer | null>(null);

    const roots = useRef<Record<Which, HTMLDivElement | null>>({ lost: null, won: null });
    const svgs = useRef<Record<Which, SVGSVGElement | null>>({ lost: null, won: null });
    const dones = useRef<Record<Which, SVGRectElement | null>>({ lost: null, won: null });
    const parts = useRef<Record<Which, SVGRectElement | null>>({ lost: null, won: null });
    const timers = useRef<Record<Which, number | undefined>>({ lost: undefined, won: undefined });

    useEffect(() => {
        const t = timers.current;
        return () => {
            window.clearInterval(t.lost);
            window.clearInterval(t.won);
        };
    }, []);

    /** Shingle roof `w` to `cv` courses (0–6, fractions allowed). */
    function apply(w: Which, cv: number) {
        const root = roots.current[w];
        const dn = dones.current[w];
        const pt = parts.current[w];
        if (!root || !dn || !pt) return;
        const full = Math.floor(Math.min(cv, VN));
        const frac = cv - full;
        dn.setAttribute("y", (VB - full * VH).toFixed(2));
        dn.setAttribute("height", (full * VH).toFixed(2));
        if (full < VN) {
            const yTop = VB - (full + 1) * VH;
            const yc = yTop + VH / 2;
            const L = vxl(yc) - 4;
            const R = vxr(yc) + 4;
            pt.setAttribute("x", L.toFixed(2));
            pt.setAttribute("y", yTop.toFixed(2));
            pt.setAttribute("height", VH.toFixed(2));
            pt.setAttribute("width", Math.max(0, frac * (R - L)).toFixed(2));
        } else {
            pt.setAttribute("width", "0");
        }
        root.classList.toggle("full", cv >= VN);
    }

    function shingleTo(w: Which, v: number, label: string | null) {
        const target = Math.min(VN, v / (MAX / VN));
        roots.current[w]?.classList.toggle("over-max", v > MAX);
        svgs.current[w]?.setAttribute("aria-label", label === null ? "A roof. Not worked out yet" : `A roof shingled up to $${whole(v)} ${label}`);
        window.clearInterval(timers.current[w]);
        const still = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (still || label === null) {
            apply(w, target);
            return;
        }
        const t0 = Date.now();
        const D = 1300;
        timers.current[w] = window.setInterval(() => {
            const k = Math.min(1, (Date.now() - t0) / D);
            apply(w, target * (1 - Math.pow(1 - k, 3)));
            if (k >= 1) window.clearInterval(timers.current[w]);
        }, 30);
    }

    function calculate(e: React.FormEvent) {
        e.preventDefault();
        const m = Number(missed);
        const j = Number(job);
        if (missed.trim() === "" || job.trim() === "" || !(m >= 0) || !(j >= 0)) {
            setAnswer(null);
            shingleTo("lost", 0, null);
            shingleTo("won", 0, null);
            return;
        }
        const jobs = m * 52 * LEAD_RATE * CLOSE_RATE;
        const lost = lostPerYear(m, j);
        const won = lost * AI_RECOVERY_RATE;
        shingleTo("lost", lost, "lost to missed calls a year");
        shingleTo("won", won, "won back with a receptionist");
        setAnswer({
            lost: `$${whole(lost)}`,
            won: `$${whole(won)}`,
            lostOf: `About ${whole(jobs)} jobs × $${whole(j)} each`,
            wonOf: `Half of them: about ${whole(jobs * AI_RECOVERY_RATE)} jobs`,
        });
    }

    const roof = (w: Which) => (
        <svg
            className={w === "won" ? "rf-rsvg won" : "rf-rsvg"}
            ref={(el) => {
                svgs.current[w] = el;
            }}
            viewBox="0 0 290 190"
            role="img"
            aria-label="A roof. Not worked out yet"
        >
            <defs>
                <clipPath id={`rf-vc-${w}`}>
                    <path d="M20 150 L250 150 L185 34 L85 34 Z" />
                </clipPath>
                <mask id={`rf-vm-${w}`} maskUnits="userSpaceOnUse" x="0" y="0" width="290" height="190">
                    <rect
                        ref={(el) => {
                            dones.current[w] = el;
                        }}
                        x="0"
                        y="150"
                        width="290"
                        height="0"
                        fill="#fff"
                    />
                    <rect
                        ref={(el) => {
                            parts.current[w] = el;
                        }}
                        x="0"
                        y="0"
                        width="0"
                        height="0"
                        fill="#fff"
                    />
                </mask>
            </defs>
            <rect className="wall" x="45" y="152" width="180" height="34" />
            <path className="felt" d="M20 150 L250 150 L185 34 L85 34 Z" />
            <g clipPath={`url(#rf-vc-${w})`}>
                <line className="feltline" x1="0" y1="111.3" x2="290" y2="111.3" />
                <line className="feltline" x1="0" y1="72.7" x2="290" y2="72.7" />
                <g mask={`url(#rf-vm-${w})`}>
                    {COURSES.map(({ c, y0, slots }) => (
                        <g key={c}>
                            <rect className={c % 2 ? "course alt" : "course"} x="0" y={y0.toFixed(2)} width="290" height={VH.toFixed(2)} />
                            {slots.map((x) => (
                                <line key={x} className="slot" x1={x} x2={x} y1={(y0 + VH * 0.38).toFixed(2)} y2={(y0 + VH).toFixed(2)} />
                            ))}
                            <line className="lap" x1="0" x2="290" y1={(y0 + VH - 1).toFixed(2)} y2={(y0 + VH - 1).toFixed(2)} />
                        </g>
                    ))}
                </g>
            </g>
            <rect className="ridge" x="81" y="28" width="108" height="8" rx="3" />
            <line className="gutter" x1="16" y1="151" x2="254" y2="151" />
            <line className="tick" x1="232" y1="111.3" x2="240" y2="111.3" />
            <text className="tlabel" x="243" y="115.3">
                $50K
            </text>
            <line className="tick" x1="210.7" y1="72.7" x2="218.7" y2="72.7" />
            <text className="tlabel" x="221.7" y="76.7">
                $100K
            </text>
            <line className="tick" x1="189" y1="34" x2="197" y2="34" />
            <text className="tlabel" x="200" y="38">
                $150K
            </text>
        </svg>
    );

    return (
        <form className="rf-sum" onSubmit={calculate} aria-label="Work out what your missed calls cost in a year">
            <div className="rf-dials">
                <label className="rf-dial" htmlFor="rf-missed">
                    <span className="rf-dial-lbl">Calls you miss a week</span>
                    <span className="rf-blank">
                        <input
                            id="rf-missed"
                            className="rf-blank-in"
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
                <label className="rf-dial" htmlFor="rf-job">
                    <span className="rf-dial-lbl">Your average job</span>
                    <span className="rf-blank">
                        <span>$</span>
                        <input
                            id="rf-job"
                            className="rf-blank-in"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100000}
                            value={job}
                            style={{ width: fit(job) }}
                            onChange={(e) => setJob(e.target.value)}
                        />
                    </span>
                </label>
            </div>
            <p className="rf-eg rf-chain">&times; 52 weeks &times; 37% are new-business leads &times; 46% convert on the call</p>
            <button className="btn primary lg" type="submit">
                Calculate
            </button>
            <div className="rf-vroofs" aria-live="polite">
                <div
                    className="rf-vroof lost"
                    ref={(el) => {
                        roots.current.lost = el;
                    }}
                >
                    <span className="rf-over">Topped out: over $150K</span>
                    {roof("lost")}
                    <span className="rf-vroof-lbl">Lost to missed calls, a year</span>
                    <span className="rf-amt">{answer ? answer.lost : "$?"}</span>
                    <span className="rf-of">{answer ? answer.lostOf : "Jobs lost × your average job"}</span>
                </div>
                <div
                    className="rf-vroof won"
                    ref={(el) => {
                        roots.current.won = el;
                    }}
                >
                    <span className="rf-over">Topped out: over $150K</span>
                    {roof("won")}
                    <span className="rf-vroof-lbl">Won back with a receptionist</span>
                    <span className="rf-amt">{answer ? answer.won : "$?"}</span>
                    <span className="rf-of">{answer ? answer.wonOf : "Half of them"}</span>
                </div>
            </div>
            <p className="rf-eg rf-scale-note">A full roof is $150K a year: six courses of $25K. Past that it&apos;s topped out, and the figures stay exact.</p>
        </form>
    );
}
