"use client";

import { useEffect, useRef } from "react";
import LawnIcon, { MowerIcon, Voice } from "./LawnIcon";

/**
 * The hero's picture: a morning's mowing route, with the calls that came in during it.
 *
 * Xander's own design (19 Nov 2026), after two rounds that read wrong. One lawn at a time, the
 * mower runs along the bar and lays the stripes behind it. Part-way along, a grey phone appears
 * where the mower had got to and the line below says "Ringing"; a couple of seconds further on a
 * coral phone appears and the line changes to "Answered by your receptionist". The mower never
 * stops. The point is that the call is answered WHILE the mowing carries on, not between jobs,
 * which is why the phones sit on the lawn at the moment they rang rather than beside it.
 *
 * The loop is driven by one animation frame callback writing a CSS variable, not by React state:
 * three lawns re-rendering sixty times a second would be wasteful and would fight the transitions.
 *
 * At rest the markup already shows every lawn part-mown with its call answered, so the page is
 * complete before any script runs, and for anyone who has asked for less motion it simply stays
 * that way. The streets are examples; no real route exists.
 */
const LEGS = [
    { street: "Alder Ct", ring: 30, got: 62 },
    { street: "Birch Ln", ring: 40, got: 72 },
    { street: "Wren Hollow Rd", ring: 22, got: 54 },
] as const;

/** How long one lawn takes, the pause before the next, and the hold before the loop restarts. */
const MOW = 6200;
const GAP = 450;
const HOLD = 2800;
const LOOP = LEGS.length * (MOW + GAP) + HOLD;

const LABEL = { next: "Up next", mowing: "Mowing", done: "Mowed" } as const;

export default function LawnRoute() {
    const route = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = route.current;
        if (!root || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const legs = Array.from(root.querySelectorAll<HTMLElement>(".lawn-leg"));
        if (!legs.length) return;

        let frame = 0;
        let start: number | null = null;

        const put = (leg: HTMLElement, state: keyof typeof LABEL, p: number) => {
            const plot = leg.querySelector<HTMLElement>(".lawn-plot");
            const mow = leg.querySelector<HTMLElement>(".lawn-leg-state");
            if (!plot || !mow) return;
            if (leg.dataset.state !== state) {
                leg.dataset.state = state;
                mow.textContent = LABEL[state];
            }
            plot.style.setProperty("--p", `${p.toFixed(2)}%`);
            leg.classList.toggle("is-rung", p >= Number(plot.dataset.ring));
            leg.classList.toggle("is-got", p >= Number(plot.dataset.got));
        };

        const tick = (now: number) => {
            if (start === null) start = now;
            const t = (now - start) % LOOP;
            legs.forEach((leg, i) => {
                const local = t - i * (MOW + GAP);
                if (local < 0) put(leg, "next", 0);
                else if (local < MOW) put(leg, "mowing", 4 + (96 * local) / MOW);
                else put(leg, "done", 100);
            });
            frame = window.requestAnimationFrame(tick);
        };

        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
    }, []);

    return (
        <div
            className="lawn-route"
            ref={route}
            role="img"
            aria-label="Example: a morning's mowing route. On each of three lawns the phone rings part-way through the mowing, and a little further on the AI receptionist has answered it, while the mowing carries on"
        >
            <div className="lawn-route-head">
                <b>Today&apos;s route</b>
                <span className="lawn-eg">Thursday</span>
            </div>
            {LEGS.map(({ street, ring, got }) => (
                <div className="lawn-leg is-rung is-got" data-state="mowing" key={street}>
                    <p className="lawn-leg-top">
                        <b>{street}</b>
                        <span className="lawn-leg-state">Mowing</span>
                    </p>
                    <div
                        className="lawn-plot"
                        style={{ "--ring": `${ring}%`, "--got": `${got}%` } as React.CSSProperties}
                        data-ring={ring}
                        data-got={got}
                    >
                        <span className="lawn-mown" />
                        <span className="lawn-pin lawn-pin-rang">
                            <LawnIcon name="phone" />
                        </span>
                        <span className="lawn-pin lawn-pin-got">
                            <LawnIcon name="phone" />
                        </span>
                        <MowerIcon className="lawn-mower" />
                    </div>
                    <div className="lawn-incoming">
                        <p className="lawn-incoming-top">Incoming call</p>
                        <p className="lawn-incoming-state">
                            <span className="lawn-ringing">Ringing&hellip;</span>
                            <span className="lawn-answered">
                                <Voice live />
                                Answered by your receptionist
                            </span>
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
