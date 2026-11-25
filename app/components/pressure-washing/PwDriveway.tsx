"use client";

import { useEffect, useRef } from "react";
import PwIcon, { Voice } from "./PwIcon";

/**
 * The hero device: a grimy driveway in front of a garage, pressure washed clean, with the call that
 * comes in mid-job. Approved from the mockup, round 2 (Xander, 25 Nov 2026), from his own brief: the
 * garage door up top, the machine parked beside the driveway with the hose running to the wand, and
 * the wand working back and forth, top to bottom.
 *
 * The grime is masked away band by band — a full-width rect for the finished passes, a growing rect
 * for the one under way, both clipped to the driveway — so every pass runs edge to edge and nothing
 * is left behind: when it finishes, the whole driveway is clean and gleams. The wand rides the
 * frontier, nozzle first, flipping with its direction, the hose trailing back to the machine. When
 * the job is done the wand is set down flat on the ground (round 2c: Xander asked for it to be put
 * down, not faded). A timer drives it, so it keeps going in a background tab; with motion turned off
 * the markup's own state stands (half washed, call answered).
 */

const TOP = 112;
const HGT = 173;
const N = 4;
const BH = HGT / N;
const leftX = (y: number) => 100 - (60 * (y - TOP)) / HGT;
const rightX = (y: number) => 340 + (40 * (y - TOP)) / HGT;
/** Where the last pass ends (bottom row, washed right to left): the wand is set down here. */
const END = { tip: leftX(TOP + BH * 3 + BH / 2) - 10, yc: TOP + BH * 3 + BH / 2 };
const LOOP = 12000;

export default function PwDriveway() {
    const jobRef = useRef<HTMLDivElement>(null);
    const rowsRef = useRef<SVGRectElement>(null);
    const partRef = useRef<SVGRectElement>(null);
    const wandRef = useRef<SVGGElement>(null);
    const hoseRef = useRef<SVGPathElement>(null);
    const grimeRef = useRef<SVGGElement>(null);
    const shineRef = useRef<SVGGElement>(null);

    useEffect(() => {
        const job = jobRef.current;
        const rows = rowsRef.current;
        const part = partRef.current;
        const wand = wandRef.current;
        const hose = hoseRef.current;
        const grime = grimeRef.current;
        const shine = shineRef.current;
        if (!job || !rows || !part || !wand || !hose || !grime || !shine) return;
        if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const call = (state: number) => {
            job.classList.toggle("is-quiet", state === 0);
            job.classList.toggle("is-ringing", state === 1);
            job.classList.toggle("is-answered", state === 2);
        };
        const wash = (k: number) => {
            const f = Math.min(0.9999, k) * N;
            const i = Math.floor(f);
            const p = f - i;
            rows.setAttribute("height", (BH * i).toFixed(2));
            const yTop = TOP + BH * i;
            const yc = yTop + BH / 2;
            const xl = leftX(yc) - 10;
            const xr = rightX(yc) + 10;
            const dir = i % 2 === 0 ? 1 : -1;
            const tip = dir > 0 ? xl + (xr - xl) * p : xr - (xr - xl) * p;
            part.setAttribute("y", yTop.toFixed(2));
            part.setAttribute("height", BH.toFixed(2));
            if (dir > 0) {
                part.setAttribute("x", "0");
                part.setAttribute("width", Math.max(0, tip).toFixed(2));
            } else {
                part.setAttribute("x", tip.toFixed(2));
                part.setAttribute("width", (440 - tip).toFixed(2));
            }
            wand.setAttribute("transform", `translate(${tip.toFixed(1)} ${yc.toFixed(1)}) scale(${dir},1)`);
            const gx = tip - 38 * dir;
            const gy = yc - 52;
            hose.setAttribute("d", `M 384 248 Q ${((384 + gx) / 2).toFixed(0)} ${(Math.max(248, gy) + 44).toFixed(0)} ${gx.toFixed(1)} ${gy.toFixed(1)}`);
        };
        const allDone = () => {
            rows.setAttribute("height", String(HGT));
            part.setAttribute("width", "0");
        };
        // Lay the wand down on the ground about its nozzle: the nozzle stays put, the lance and
        // handle swing down to rest flat. The hose still runs back to the machine.
        const layWand = (rot: number, drop: number) => {
            const gy = END.yc + drop;
            wand.setAttribute("transform", `translate(${END.tip.toFixed(1)} ${gy.toFixed(1)}) scale(-1,1) rotate(${rot.toFixed(1)})`);
            hose.setAttribute("d", `M 384 248 Q ${((384 + END.tip) / 2).toFixed(0)} ${(Math.max(248, gy) + 30).toFixed(0)} ${END.tip.toFixed(1)} ${gy.toFixed(1)}`);
        };

        const t0 = Date.now();
        const draw = () => {
            const t = (Date.now() - t0) % LOOP;
            let k: number;
            grime.style.opacity = "1";
            shine.style.opacity = "0";
            wand.style.opacity = "1";
            if (t < 700) {
                k = t / 700;
                grime.style.opacity = k.toFixed(2);
                rows.setAttribute("height", "0");
                part.setAttribute("width", "0");
                wand.style.opacity = "0";
            } else if (t < 9100) {
                wash((t - 700) / 8400);
            } else if (t < 9800) {
                k = (t - 9100) / 700;
                const e = k * k * (3 - 2 * k);
                allDone();
                layWand(-58 * e, 7 * e);
            } else if (t < 11300) {
                allDone();
                layWand(-58, 7);
                shine.style.opacity = Math.min(1, (t - 9800) / 500).toFixed(2);
                if (t > 10800) {
                    k = (t - 10800) / 500;
                    shine.style.opacity = (1 - k).toFixed(2);
                    grime.style.opacity = (1 - k).toFixed(2);
                }
            } else {
                rows.setAttribute("height", "0");
                part.setAttribute("width", "0");
                wand.style.opacity = "0";
                grime.style.opacity = "0";
            }
            call(t < 3200 ? 0 : t < 5800 ? 1 : 2);
        };
        draw();
        const id = window.setInterval(draw, 40);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div
            className="pw-job is-answered"
            ref={jobRef}
            role="img"
            aria-label="Example: a grimy driveway in front of a garage being pressure washed clean, pass by pass, with the machine parked beside it and the hose running to the wand. Part-way through, the phone rings, and the AI receptionist answers it while the washing carries on"
        >
            <div className="pw-job-head">
                <b>On the job</b>
                <span className="pw-eg">Example</span>
            </div>
            <svg className="pw-scene" viewBox="0 0 440 300" aria-hidden="true">
                <defs>
                    <clipPath id="pw-drive-clip">
                        <path d="M100 112 L340 112 L380 285 L40 285 Z" />
                    </clipPath>
                    <mask id="pw-washed" maskUnits="userSpaceOnUse" x="0" y="0" width="440" height="300">
                        <rect x="0" y="0" width="440" height="300" fill="#fff" />
                        <rect ref={rowsRef} x="0" y="112" width="440" height="86.5" fill="#000" />
                        <rect ref={partRef} x="0" y="198.5" width="216" height="43.25" fill="#000" />
                    </mask>
                </defs>
                <rect className="yard" x="14" y="110" width="412" height="180" />
                <rect className="wall" x="14" y="12" width="412" height="100" />
                <line className="trim" x1="10" y1="13" x2="430" y2="13" />
                <rect className="pane" x="36" y="38" width="44" height="50" rx="3" />
                <rect className="pane" x="360" y="38" width="44" height="50" rx="3" />
                <rect className="door" x="104" y="24" width="232" height="88" rx="3" />
                <g className="panel">
                    <line x1="106" y1="46" x2="334" y2="46" />
                    <line x1="106" y1="68" x2="334" y2="68" />
                    <line x1="106" y1="90" x2="334" y2="90" />
                </g>
                <rect className="doorhandle" x="212" y="99" width="16" height="5" rx="2.5" />
                <path className="paving" d="M100 112 L340 112 L380 285 L40 285 Z" />
                <g clipPath="url(#pw-drive-clip)">
                    <line className="jointline" x1="220" y1="112" x2="220" y2="285" />
                    <line className="jointline" x1="80" y1="170" x2="353" y2="170" />
                    <line className="jointline" x1="60" y1="228" x2="367" y2="228" />
                </g>
                <g ref={grimeRef} mask="url(#pw-washed)" clipPath="url(#pw-drive-clip)">
                    <rect className="grime-coat" x="20" y="100" width="400" height="195" />
                    <circle className="blotch" cx="120" cy="150" r="26" />
                    <circle className="blotch" cx="290" cy="200" r="30" />
                    <circle className="blotch" cx="200" cy="250" r="24" />
                    <circle className="blotch" cx="330" cy="140" r="18" />
                    <circle className="mossy" cx="70" cy="270" r="26" />
                    <circle className="mossy" cx="360" cy="265" r="22" />
                    <circle className="mossy" cx="100" cy="128" r="14" />
                    <circle className="mossy" cx="250" cy="130" r="12" />
                    <line className="jointline" x1="220" y1="112" x2="220" y2="285" />
                    <line className="jointline" x1="80" y1="170" x2="353" y2="170" />
                    <line className="jointline" x1="60" y1="228" x2="367" y2="228" />
                </g>
                <g ref={shineRef} className="shine" style={{ opacity: 0 }}>
                    <path className="spark" transform="translate(130 160)" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" />
                    <path className="spark" transform="translate(315 190) scale(.72)" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" />
                    <path className="spark" transform="translate(210 255) scale(.6)" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" />
                </g>
                <path className="hose" ref={hoseRef} d="M 384 248 Q 280 292 175.8 168.1" />
                <g className="rig" transform="translate(382 232)">
                    <rect className="rig-motor" x="9" y="-9" width="20" height="10" rx="2" />
                    <rect className="rig-body" x="0" y="0" width="46" height="26" rx="5" />
                    <path className="rig-handle" d="M45 3 L61 -16" />
                    <circle className="rig-wheel" cx="9" cy="30" r="7" />
                    <circle className="rig-hub" cx="9" cy="30" r="2.5" />
                    <circle className="rig-wheel" cx="37" cy="30" r="7" />
                    <circle className="rig-hub" cx="37" cy="30" r="2.5" />
                </g>
                <g className="wand" ref={wandRef} transform="translate(213.8 220.1) scale(1,1)">
                    <ellipse className="splash" cx="8" cy="3" rx="11" ry="4" />
                    <polygon className="fan" points="0,0 30,-12 30,12" />
                    <polygon className="fan-core" points="0,0 20,-5 20,5" />
                    <g className="drops">
                        <circle className="drop" r="2.4" cx="14" cy="-11" style={{ ["--fx" as string]: "8px", ["--fy" as string]: "-7px" }} />
                        <circle className="drop" r="1.8" cx="20" cy="10" style={{ ["--fx" as string]: "9px", ["--fy" as string]: "8px" }} />
                        <circle className="drop" r="2" cx="28" cy="-3" style={{ ["--fx" as string]: "12px", ["--fy" as string]: "-2px" }} />
                        <circle className="drop" r="1.6" cx="10" cy="8" style={{ ["--fx" as string]: "6px", ["--fy" as string]: "10px" }} />
                        <circle className="drop" r="2.2" cx="26" cy="15" style={{ ["--fx" as string]: "10px", ["--fy" as string]: "11px" }} />
                    </g>
                    <line className="wand-lance" x1="0" y1="0" x2="-24" y2="-34" />
                    <line className="wand-grip" x1="-24" y1="-34" x2="-38" y2="-52" />
                    <circle className="wand-tipp" r="4.5" />
                </g>
            </svg>
            <div className="pw-incoming">
                <span className="pw-badge">
                    <PwIcon name="phone" />
                </span>
                <p className="pw-incoming-top">Incoming call</p>
                <p className="pw-state">
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
