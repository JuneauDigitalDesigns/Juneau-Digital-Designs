"use client";

import { useEffect, useRef } from "react";
import DetailIcon, { Voice } from "./DetailIcon";

/**
 * The hero device: a car being machine polished, with the call that comes in mid-detail.
 *
 * Approved from the mockup, round 2 (Xander, 25 Nov 2026), after round 1's foam wash read as "white
 * circles". The car comes in dull — hazy paint, swirl marks, grime on the sills — and a polisher
 * works along it from the back to the front, leaving glossy paint behind it. The phone rings
 * part-way along and is answered while the polishing carries on, then the car shines and the loop
 * starts again. A timer drives it, so it keeps going in a background tab or a preview that holds
 * frames back; with motion turned off the markup's own state stands (half polished, call answered).
 *
 * The swirl marks are scattered inside the car's own outline by a seeded shuffle, so it is the same
 * car every visit. `#done` is a mask whose soft right edge is the polisher's wake: moving its rect
 * reveals the clean car up to that point.
 */

/** A small seeded RNG, so the swirl marks fall the same way every render. */
function rand(seed: number) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const NS = "http://www.w3.org/2000/svg";
const LOOP = 12000;
const X0 = 34;
const X1 = 414;

export default function DetailBay() {
    const bayRef = useRef<HTMLDivElement>(null);
    const carRef = useRef<SVGSVGElement>(null);
    const shapeRef = useRef<SVGPathElement>(null);
    const swirlsRef = useRef<SVGGElement>(null);
    const doneRef = useRef<SVGRectElement>(null);
    const cleanRef = useRef<SVGGElement>(null);
    const toolRef = useRef<SVGGElement>(null);
    const shineRef = useRef<SVGGElement>(null);

    useEffect(() => {
        const bay = bayRef.current;
        const svg = carRef.current;
        const shape = shapeRef.current;
        const swirls = swirlsRef.current;
        const done = doneRef.current;
        const clean = cleanRef.current;
        const tool = toolRef.current;
        const shine = shineRef.current;
        if (!bay || !svg || !shape || !swirls || !done || !clean || !tool || !shine) return;

        // The swirl marks, scattered inside the paint. Cleared first, so a re-run never doubles them.
        swirls.replaceChildren();
        const r = rand(7);
        const pt = svg.createSVGPoint();
        let made = 0;
        let tries = 0;
        while (made < 64 && tries < 2400) {
            tries++;
            pt.x = 22 + r() * 398;
            pt.y = 46 + r() * 86;
            if (shape.isPointInFill && !shape.isPointInFill(pt)) continue;
            const rad = 4 + r() * 9;
            const a0 = r() * Math.PI * 2;
            const a1 = a0 + Math.PI * (0.8 + r() * 0.7);
            const p = document.createElementNS(NS, "path");
            p.setAttribute(
                "d",
                `M${(pt.x + rad * Math.cos(a0)).toFixed(1)} ${(pt.y + rad * Math.sin(a0)).toFixed(1)} A${rad.toFixed(1)} ${rad.toFixed(1)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${(pt.x + rad * Math.cos(a1)).toFixed(1)} ${(pt.y + rad * Math.sin(a1)).toFixed(1)}`,
            );
            swirls.appendChild(p);
            made++;
        }

        const call = (state: number) => {
            bay.classList.toggle("is-quiet", state === 0);
            bay.classList.toggle("is-ringing", state === 1);
            bay.classList.toggle("is-answered", state === 2);
        };
        // How high the pad may reach at this point along the car: the roof over the cabin, the
        // shoulder line over the hood and the trunk.
        const high = (x: number) => (x < 96 ? 100 : x < 140 ? 100 - (38 * (x - 96)) / 44 : x < 290 ? 62 : x < 336 ? 62 + (38 * (x - 290)) / 46 : 100);
        const edge = (x: number) => done.setAttribute("x", (x - 960).toFixed(1));
        const place = (x: number, k: number, lift: number, alpha: number) => {
            const hi = high(x);
            const lo = 124;
            const y = (hi + lo) / 2 + ((lo - hi) / 2) * Math.sin(k * Math.PI * 2 * 6.5);
            tool.setAttribute("transform", `translate(${x.toFixed(1)} ${(y - lift).toFixed(1)})`);
            tool.style.opacity = String(alpha);
        };

        if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        const t0 = Date.now();
        const draw = () => {
            const t = (Date.now() - t0) % LOOP;
            let k: number;
            clean.style.opacity = "1";
            shine.style.opacity = "0";
            if (t < 700) {
                edge(0);
                place(X0, 0, 10, 0);
            } else if (t < 1100) {
                k = (t - 700) / 400;
                edge(0);
                place(X0, 0, 10 * (1 - k), k);
            } else if (t < 8300) {
                k = (t - 1100) / 7200;
                const x = X0 + (X1 - X0) * k;
                edge(x + 6);
                place(x, k, 0, 1);
            } else if (t < 8700) {
                k = (t - 8300) / 400;
                edge(X1 + 6 + 80 * k);
                place(X1, 1, 14 * k, 1 - k);
            } else {
                edge(520);
                place(X1, 1, 14, 0);
                shine.style.opacity = Math.min(1, (t - 8700) / 500).toFixed(2);
                if (t > 11500) {
                    k = (t - 11500) / 500;
                    clean.style.opacity = (1 - k).toFixed(2);
                    shine.style.opacity = (1 - k).toFixed(2);
                }
            }
            call(t < 3000 ? 0 : t < 5600 ? 1 : 2);
        };
        draw();
        const id = window.setInterval(draw, 40);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div
            className="detail-bay is-answered"
            ref={bayRef}
            role="img"
            aria-label="Example: a car being machine polished. The paint behind the polisher is glossy and the paint ahead of it is still dull. Part-way along, the phone rings, and the AI receptionist answers it while the polishing carries on"
        >
            <div className="detail-bay-head">
                <b>In the bay</b>
                <span className="detail-eg">Example</span>
            </div>
            <svg className="detail-car" ref={carRef} viewBox="0 0 440 190" aria-hidden="true">
                <defs>
                    <clipPath id="detail-car-body">
                        <path d="M22 138 L22 118 Q22 100 40 96 L96 88 Q128 52 178 46 L250 46 Q296 50 332 88 L392 98 Q418 102 420 122 L420 132 Q420 140 412 140 L30 140 Q22 140 22 132 Z" />
                    </clipPath>
                    <clipPath id="detail-car-glass">
                        <path d="M132 86 Q152 60 182 56 L214 56 L214 86 Z" />
                        <path d="M224 56 L250 56 Q286 60 314 86 L224 86 Z" />
                    </clipPath>
                    <linearGradient id="detail-edge" x1="0" x2="1">
                        <stop offset="0" stopColor="#fff" />
                        <stop offset=".964" stopColor="#fff" />
                        <stop offset="1" stopColor="#000" />
                    </linearGradient>
                    <mask id="detail-done" maskUnits="userSpaceOnUse" x="0" y="0" width="440" height="190">
                        <rect ref={doneRef} x="-724" y="0" width="960" height="190" fill="url(#detail-edge)" />
                    </mask>
                    <linearGradient id="detail-grime" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#4a3c22" stopOpacity="0" />
                        <stop offset="1" stopColor="#4a3c22" stopOpacity=".62" />
                    </linearGradient>
                    <linearGradient id="detail-sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#fff" stopOpacity=".34" />
                        <stop offset="1" stopColor="#fff" stopOpacity=".1" />
                    </linearGradient>
                </defs>
                <ellipse className="shade" cx="221" cy="161" rx="206" ry="5" />
                {/* The car as it came in: flat, hazy paint, swirl marks, road grime along the sills. */}
                <g className="dull">
                    <path
                        className="b"
                        ref={shapeRef}
                        d="M22 138 L22 118 Q22 100 40 96 L96 88 Q128 52 178 46 L250 46 Q296 50 332 88 L392 98 Q418 102 420 122 L420 132 Q420 140 412 140 L30 140 Q22 140 22 132 Z"
                    />
                    <path className="g" d="M132 86 Q152 60 182 56 L214 56 L214 86 Z" />
                    <path className="g" d="M224 56 L250 56 Q286 60 314 86 L224 86 Z" />
                    <g clipPath="url(#detail-car-body)">
                        <rect x="0" y="100" width="440" height="40" fill="url(#detail-grime)" />
                        <g className="swirls" ref={swirlsRef} />
                    </g>
                </g>
                {/* The same car polished, shown only behind the polisher. */}
                <g className="clean" ref={cleanRef} mask="url(#detail-done)">
                    <path className="b" d="M22 138 L22 118 Q22 100 40 96 L96 88 Q128 52 178 46 L250 46 Q296 50 332 88 L392 98 Q418 102 420 122 L420 132 Q420 140 412 140 L30 140 Q22 140 22 132 Z" />
                    <g clipPath="url(#detail-car-body)">
                        <path d="M0 40 H440 V106 Q330 96 220 100 Q110 104 0 100 Z" fill="url(#detail-sky)" />
                        <path className="low" d="M0 124 Q220 116 440 124 V150 H0 Z" />
                    </g>
                    <path className="g" d="M132 86 Q152 60 182 56 L214 56 L214 86 Z" />
                    <path className="g" d="M224 56 L250 56 Q286 60 314 86 L224 86 Z" />
                    <g clipPath="url(#detail-car-glass)">
                        <path className="glint" d="M168 40 L190 40 L162 96 L140 96 Z" />
                        <path className="glint" d="M198 40 L205 40 L177 96 L170 96 Z" />
                        <path className="glint" d="M262 40 L284 40 L256 96 L234 96 Z" />
                        <path className="glint" d="M292 40 L299 40 L271 96 L264 96 Z" />
                    </g>
                    <path className="gleam" d="M142 58 Q160 50 182 49.5 L246 49.5" />
                    <path className="gleam" d="M344 93.5 L388 100.5" />
                    <path className="gleam" d="M44 99 L92 92" />
                </g>
                {/* What both share: seams, handles, lamps, the mirror, the wheels. */}
                <path className="seam" d="M219 86 V127" />
                <path className="seam" d="M150 88 Q146 110 156 126" />
                <path className="seam" d="M318 90 Q322 108 316 127" />
                <path className="seam" d="M34 112 Q220 104 408 114" />
                <rect className="handle" x="158" y="95" width="17" height="4.5" rx="2.25" />
                <rect className="handle" x="229" y="95" width="17" height="4.5" rx="2.25" />
                <path className="mirror" d="M312 78 Q324 74 327 82 Q327 88 317 88 Z" />
                <path className="lamp" d="M398 103 Q412 104 417 112 L404 113 Q399 110 398 103 Z" />
                <rect className="tail" x="22" y="103" width="7" height="13" rx="2.5" />
                <circle className="arch" cx="118" cy="133" r="33" />
                <circle className="arch" cx="330" cy="133" r="33" />
                <g className="whl" transform="translate(118 133)">
                    <circle className="tyre" r="27" />
                    <circle className="rim" r="17" />
                    <path className="spoke" d="M0 -15 V15 M-14.3 -4.6 L14.3 4.6 M-14.3 4.6 L14.3 -4.6 M-8.8 -12.1 L8.8 12.1 M-8.8 12.1 L8.8 -12.1" />
                    <circle className="cap" r="4.5" />
                </g>
                <g className="whl" transform="translate(330 133)">
                    <circle className="tyre" r="27" />
                    <circle className="rim" r="17" />
                    <path className="spoke" d="M0 -15 V15 M-14.3 -4.6 L14.3 4.6 M-14.3 4.6 L14.3 -4.6 M-8.8 -12.1 L8.8 12.1 M-8.8 12.1 L8.8 -12.1" />
                    <circle className="cap" r="4.5" />
                </g>
                <line className="ground" x1="6" y1="160.5" x2="434" y2="160.5" />
                <g className="shine" ref={shineRef} style={{ opacity: 0 }}>
                    <path className="spark" transform="translate(300 60)" d="M0 -11 L2.6 -2.6 L11 0 L2.6 2.6 L0 11 L-2.6 2.6 L-11 0 L-2.6 -2.6 Z" />
                    <path className="spark" transform="translate(384 96) scale(.7)" d="M0 -11 L2.6 -2.6 L11 0 L2.6 2.6 L0 11 L-2.6 2.6 L-11 0 L-2.6 -2.6 Z" />
                    <path className="spark" transform="translate(70 86) scale(.62)" d="M0 -11 L2.6 -2.6 L11 0 L2.6 2.6 L0 11 L-2.6 2.6 L-11 0 L-2.6 -2.6 Z" />
                    <path className="spark" transform="translate(196 44) scale(.5)" d="M0 -11 L2.6 -2.6 L11 0 L2.6 2.6 L0 11 L-2.6 2.6 L-11 0 L-2.6 -2.6 Z" />
                </g>
                {/* The polisher: a foam pad on the paint, the machine behind it. */}
                <g className="detail-tool" ref={toolRef} transform="translate(230 96)">
                    <g transform="rotate(-58)">
                        <rect className="grip" x="-4.5" y="-40" width="9" height="34" rx="4.5" />
                    </g>
                    <g transform="rotate(30)">
                        <rect className="grip" x="-8.5" y="-64" width="17" height="60" rx="8" />
                        <rect className="band" x="-8.5" y="-34" width="17" height="6" />
                        <rect className="trigger" x="-3" y="-56" width="6" height="14" rx="3" />
                    </g>
                    <circle className="pad" r="20" />
                    <g className="spin">
                        <path d="M0 -15 A15 15 0 0 1 13 -7.5" />
                        <path d="M13 7.5 A15 15 0 0 1 0 15" />
                        <path d="M-13 7.5 A15 15 0 0 1 -13 -7.5" />
                    </g>
                    <circle className="head" r="9" />
                </g>
            </svg>
            <div className="detail-incoming">
                <span className="detail-badge">
                    <DetailIcon name="phone" />
                </span>
                <p className="detail-incoming-top">Incoming call</p>
                <p className="detail-state">
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
