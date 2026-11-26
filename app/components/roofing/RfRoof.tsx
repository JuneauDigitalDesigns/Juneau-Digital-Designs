"use client";

import { useEffect, useRef } from "react";
import RfIcon, { Voice } from "./RfIcon";

/**
 * The hero device: a house roof shingled course by course from the gutter up, with the call that
 * comes in mid-job. Approved from the mockup (Xander, 25 Nov 2026).
 *
 * Six courses of shingles are drawn once; a mask shows the finished courses (a full-width rect) and
 * the one under way (a growing rect), so the roof goes on from the gutter up. Each course is laid
 * back and forth, the first right to left from the ladder, with the nail gun at the frontier. At the
 * top the ridge cap goes on, the gun is carried down the ladder and set down at its foot (not faded:
 * Xander's note on the pressure washing wand), and the finished roof gleams before the loop starts
 * again. A timer drives it, so it keeps going in a background tab; with motion turned off the
 * markup's own state stands (half shingled, call answered).
 */

const TOP = 56;
const BOT = 180;
const N = 6;
const H = (BOT - TOP) / N;
const LOOP = 12000;
const REST = { x: 352, y: 286, rot: -6 };

type Pose = { x: number; y: number; rot?: number };

const xl = (y: number) => 40 + (BOT - y) * (110 / 124);
const xr = (y: number) => 400 - (BOT - y) * (110 / 124);
const ease = (k: number) => k * k * (3 - 2 * k);

/** Where the nail gun is on course `i`, `p` of the way along it. Even courses run right to left. */
function frontier(i: number, p: number) {
    const yTop = BOT - (i + 1) * H;
    const yc = yTop + H / 2;
    const L = xl(yc) - 6;
    const R = xr(yc) + 6;
    const dir = i % 2 === 0 ? -1 : 1;
    return { x: dir > 0 ? L + (R - L) * p : R - (R - L) * p, y: yTop + H * 0.62, yTop, dir };
}

const START = frontier(0, 0);
const END = frontier(N - 1, 1);

/** The six courses: a band each, staggered slots, and a lap shadow along the bottom edge. */
const COURSES = Array.from({ length: N }, (_, c) => {
    const y0 = BOT - (c + 1) * H;
    const slots: number[] = [];
    for (let x = c % 2 ? 15 : 0; x <= 440; x += 30) slots.push(x);
    return { c, y0, slots };
});

export default function RfRoof() {
    const jobRef = useRef<HTMLDivElement>(null);
    const doneRef = useRef<SVGRectElement>(null);
    const partRef = useRef<SVGRectElement>(null);
    const gunRef = useRef<SVGGElement>(null);
    const ridgeRef = useRef<SVGRectElement>(null);
    const shineRef = useRef<SVGGElement>(null);
    const shinglesRef = useRef<SVGGElement>(null);

    useEffect(() => {
        const job = jobRef.current;
        const done = doneRef.current;
        const part = partRef.current;
        const gun = gunRef.current;
        const ridge = ridgeRef.current;
        const shine = shineRef.current;
        const shingles = shinglesRef.current;
        if (!job || !done || !part || !gun || !ridge || !shine || !shingles) return;
        if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const call = (state: number) => {
            job.classList.toggle("is-quiet", state === 0);
            job.classList.toggle("is-ringing", state === 1);
            job.classList.toggle("is-answered", state === 2);
        };
        const pose = (x: number, y: number, rot: number) => {
            gun.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})`);
        };
        const lay = (k: number) => {
            const f = Math.min(0.9999, k) * N;
            const i = Math.floor(f);
            const fr = frontier(i, f - i);
            done.setAttribute("y", (BOT - i * H).toFixed(2));
            done.setAttribute("height", (i * H).toFixed(2));
            part.setAttribute("y", fr.yTop.toFixed(2));
            part.setAttribute("height", H.toFixed(2));
            if (fr.dir > 0) {
                part.setAttribute("x", "0");
                part.setAttribute("width", Math.max(0, fr.x).toFixed(2));
            } else {
                part.setAttribute("x", fr.x.toFixed(2));
                part.setAttribute("width", (440 - fr.x).toFixed(2));
            }
            pose(fr.x, fr.y, 0);
        };
        const allLaid = () => {
            done.setAttribute("y", String(TOP));
            done.setAttribute("height", String(BOT - TOP));
            part.setAttribute("width", "0");
        };
        const none = () => {
            done.setAttribute("height", "0");
            part.setAttribute("width", "0");
        };
        // Carried from one spot to another along a little arc, turning as it goes.
        const between = (a: Pose, b: Pose, k: number) => {
            const e = ease(k);
            pose(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * 14, (a.rot ?? 0) + ((b.rot ?? 0) - (a.rot ?? 0)) * e);
        };

        const t0 = Date.now();
        const draw = () => {
            const t = (Date.now() - t0) % LOOP;
            let k: number;
            shingles.style.opacity = "1";
            ridge.style.opacity = "0";
            shine.style.opacity = "0";
            gun.classList.remove("firing");
            if (t < 600) {
                none();
                between(REST, START, t / 600);
            } else if (t < 8400) {
                gun.classList.add("firing");
                lay((t - 600) / 7800);
            } else if (t < 9100) {
                k = (t - 8400) / 700;
                allLaid();
                ridge.style.opacity = Math.min(1, k * 2).toFixed(2);
                between(END, REST, k);
            } else if (t < 10700) {
                allLaid();
                ridge.style.opacity = "1";
                pose(REST.x, REST.y, REST.rot);
                shine.style.opacity = Math.min(1, (t - 9100) / 500).toFixed(2);
                if (t > 10200) shine.style.opacity = (1 - (t - 10200) / 500).toFixed(2);
            } else if (t < 11400) {
                k = (t - 10700) / 700;
                allLaid();
                ridge.style.opacity = (1 - k).toFixed(2);
                shingles.style.opacity = (1 - k).toFixed(2);
                pose(REST.x, REST.y, REST.rot);
            } else {
                none();
                pose(REST.x, REST.y, REST.rot);
            }
            call(t < 2600 ? 0 : t < 5200 ? 1 : 2);
        };
        draw();
        const id = window.setInterval(draw, 40);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div
            className="rf-job is-answered"
            ref={jobRef}
            role="img"
            aria-label="Example: a roof being shingled course by course, from the gutter up to the ridge, with a nail gun working along each course. Part-way up, the phone rings, and the AI receptionist answers it while the work carries on"
        >
            <div className="rf-job-head">
                <b>On the job</b>
                <span className="rf-eg">Example</span>
            </div>
            <svg className="rf-scene" viewBox="0 0 440 300" aria-hidden="true">
                <defs>
                    <clipPath id="rf-roof-clip">
                        <path d="M40 180 L400 180 L290 56 L150 56 Z" />
                    </clipPath>
                    <mask id="rf-laid" maskUnits="userSpaceOnUse" x="0" y="0" width="440" height="300">
                        <rect ref={doneRef} x="0" y="118" width="440" height="62" fill="#fff" />
                        <rect ref={partRef} x="0" y="97.33" width="220" height="20.67" fill="#fff" />
                    </mask>
                </defs>
                <line className="ground" x1="6" y1="286.5" x2="434" y2="286.5" />
                <rect className="wall" x="70" y="180" width="300" height="106" />
                <rect className="pane" x="98" y="204" width="54" height="42" rx="2" />
                <line className="mull" x1="125" y1="204" x2="125" y2="246" />
                <rect className="pane" x="288" y="204" width="54" height="42" rx="2" />
                <line className="mull" x1="315" y1="204" x2="315" y2="246" />
                <rect className="door" x="204" y="226" width="32" height="60" rx="2" />
                <circle className="knob" cx="229" cy="258" r="2.4" />
                <path className="felt" d="M40 180 L400 180 L290 56 L150 56 Z" />
                <g clipPath="url(#rf-roof-clip)">
                    <line className="feltline" x1="0" y1="159.3" x2="440" y2="159.3" />
                    <line className="feltline" x1="0" y1="138.7" x2="440" y2="138.7" />
                    <line className="feltline" x1="0" y1="118" x2="440" y2="118" />
                    <line className="feltline" x1="0" y1="97.3" x2="440" y2="97.3" />
                    <line className="feltline" x1="0" y1="76.7" x2="440" y2="76.7" />
                </g>
                <g ref={shinglesRef} clipPath="url(#rf-roof-clip)">
                    <g mask="url(#rf-laid)">
                        {COURSES.map(({ c, y0, slots }) => (
                            <g key={c}>
                                <rect className={c % 2 ? "course alt" : "course"} x="0" y={y0.toFixed(2)} width="440" height={H.toFixed(2)} />
                                {slots.map((x) => (
                                    <line key={x} className="slot" x1={x} x2={x} y1={(y0 + H * 0.38).toFixed(2)} y2={(y0 + H).toFixed(2)} />
                                ))}
                                <line className="lap" x1="0" x2="440" y1={(y0 + H - 1).toFixed(2)} y2={(y0 + H - 1).toFixed(2)} />
                            </g>
                        ))}
                    </g>
                </g>
                <rect className="ridge" ref={ridgeRef} x="146" y="50" width="148" height="9" rx="3" style={{ opacity: 0 }} />
                <line className="gutter" x1="36" y1="182" x2="404" y2="182" />
                <g className="ladder">
                    <line className="rail" x1="384" y1="286" x2="398" y2="168" />
                    <line className="rail" x1="404" y1="286" x2="418" y2="168" />
                    <line className="rung" x1="386" y1="266" x2="406" y2="266" />
                    <line className="rung" x1="388.5" y1="244" x2="408.5" y2="244" />
                    <line className="rung" x1="391" y1="222" x2="411" y2="222" />
                    <line className="rung" x1="393.5" y1="200" x2="413.5" y2="200" />
                    <line className="rung" x1="396" y1="178" x2="416" y2="178" />
                </g>
                <g ref={shineRef} style={{ opacity: 0 }}>
                    <path className="spark" transform="translate(196 92)" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" />
                    <path className="spark" transform="translate(300 140) scale(.72)" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" />
                    <path className="spark" transform="translate(120 160) scale(.6)" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" />
                </g>
                <g className="gun firing" ref={gunRef} transform="translate(220 110.1)">
                    <rect className="gun-dark" x="14" y="-41" width="7" height="17" rx="3" transform="rotate(12 17 -32)" />
                    <rect className="gun-body" x="-8" y="-26" width="30" height="14" rx="4" />
                    <rect className="gun-dark" x="-6" y="-12" width="22" height="5" rx="2" />
                    <rect className="gun-dark" x="-2" y="-7" width="5" height="7" rx="1" />
                    <path className="thunk" transform="translate(0.5 2)" d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" />
                </g>
            </svg>
            <div className="rf-incoming">
                <span className="rf-badge">
                    <RfIcon name="phone" />
                </span>
                <p className="rf-incoming-top">Incoming call</p>
                <p className="rf-state">
                    <span className="waiting">Not yet</span>
                    <span className="ringing">Ringing&hellip;</span>
                    <span className="answered">
                        <Voice live />
                        Answered by your receptionist
                    </span>
                </p>
            </div>
        </div>
    );
}
