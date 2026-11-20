"use client";

import { useEffect, useRef, useState } from "react";
import { Voice } from "./LawnIcon";
import { SIGN_BACK, SIGN_FRONT, drawBlades } from "./blades";

/**
 * "What they ask on calls": three questions on yard signs, staked into grass.
 *
 * The signs are the lawn care trade's own piece of furniture, and the grass is the one place on
 * the page that is green; everything else stays in the site's sand and coral. A tall row of blades
 * stands behind the signs and a short one in front of the stakes, so the signs sit IN the lawn
 * rather than on top of a green stripe.
 *
 * The blades are drawn to the real width of the box, so they are redrawn when it changes; the
 * dark line under them is measured from the outermost blade rather than being the box's own
 * border, which used to stop short of the grass at both ends.
 *
 * The first two questions come from the lawn care sample lead already in the portal tour. All
 * three are examples: no lawn care client exists yet.
 */
const ASKED = ["Do you mow in my neighbourhood?", "Could those brown patches be grubs?", "Can you start this week?"];

/** What the server draws to. Replaced by the real width as soon as the box can be measured. */
const ASSUMED_WIDTH = 560;

export default function LawnSigns() {
    const box = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(ASSUMED_WIDTH);

    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const measure = () => {
            const w = Math.round(el.getBoundingClientRect().width);
            if (w) setWidth(w);
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

    const back = drawBlades({ ...SIGN_BACK, width });
    const front = drawBlades({ ...SIGN_FRONT, width });
    const ground = {
        "--lawn-gl": `${Math.min(back.from, front.from).toFixed(1)}px`,
        "--lawn-gr": `${(width - Math.max(back.to, front.to)).toFixed(1)}px`,
    } as React.CSSProperties;

    return (
        <div className="lawn-signs" ref={box} style={ground}>
            <svg className="lawn-grass lawn-grass-back" viewBox={`0 0 ${width} ${SIGN_BACK.height}`} aria-hidden="true">
                {back.blades.map((b, i) => (
                    <path key={i} className={b.shade} d={b.d} />
                ))}
            </svg>
            {ASKED.map((q, i) => (
                <div className={`lawn-sign${i === 2 ? " lawn-m-cut" : ""}`} key={q}>
                    <div className="lawn-sign-face">
                        <p className="lawn-sign-meta">
                            <Voice />
                            Asked on a call
                        </p>
                        <q>{q}</q>
                    </div>
                </div>
            ))}
            <svg className="lawn-grass lawn-grass-front" viewBox={`0 0 ${width} ${SIGN_FRONT.height}`} aria-hidden="true">
                {front.blades.map((b, i) => (
                    <path key={i} className={b.shade} d={b.d} />
                ))}
            </svg>
        </div>
    );
}
