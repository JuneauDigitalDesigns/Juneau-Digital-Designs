"use client";

import { useLayoutEffect, useRef } from "react";
import { cursorAt, type SceneNo } from "./script";
import s from "./GrowthDemo.module.css";

/**
 * The cursor that does every click (Xander, 2026-11-12: "a cursor that shows what it's actually
 * interacting with").
 *
 * Driven by the demo's own clock (`cursorAt`), so Pause, Back and Next hold and move it exactly
 * as they do the scene. Its stops are selectors, resolved against the replica on every tick, so
 * it lands on the real element wherever the real layout put it. A stop that is off screen in a
 * scrolling panel is scrolled into view first, as a person would.
 *
 * On a phone it is a tap: a dot that appears where the finger lands, rather than an arrow.
 */

/** Where a desktop selector lives on the phone's layout, when it differs. */
const PHONE_ALIAS: Record<string, string> = {
    'section[aria-label="Contacted column"]': '[data-customer-id="demo-dave"] select',
    'section[aria-label="Quoted column"]': '[data-customer-id="demo-dave"] select',
    'section[aria-label="Scheduled column"]': '[data-customer-id="demo-dave"] select',
};

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

export default function DemoCursor({
    container,
    scene,
    t,
    k = 1,
    tap = false,
}: {
    container: React.RefObject<HTMLElement | null>;
    scene: SceneNo;
    t: number;
    /** The replica's scale, so a measured point maps back into its unscaled coordinates. */
    k?: number;
    tap?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const lastTo = useRef<string | null>(null);
    const c = cursorAt(scene, t);

    useLayoutEffect(() => {
        const box = container.current;
        const el = ref.current;
        if (!box || !el) return;
        const find = (sel: string | null) => {
            if (!sel) return null;
            return box.querySelector<HTMLElement>(sel) ?? (tap && PHONE_ALIAS[sel] ? box.querySelector<HTMLElement>(PHONE_ALIAS[sel]) : null);
        };
        const target = find(c.to);
        // A new stop in a scrolling panel: bring it into view, as a person would scroll to it.
        if (target && c.to !== lastTo.current) target.scrollIntoView({ block: "nearest", inline: "nearest" });
        lastTo.current = c.to;
        const b = box.getBoundingClientRect();
        const point = (n: HTMLElement | null) => {
            if (!n) return null;
            const r = n.getBoundingClientRect();
            return { x: (r.left - b.left + r.width * 0.5) / k, y: (r.top - b.top + r.height * 0.55) / k };
        };
        const to = point(target);
        const from = point(find(c.from)) ?? to;
        if (!to || !from) {
            el.style.opacity = "0";
            return;
        }
        const p = ease(c.p);
        el.style.opacity = "1";
        el.style.left = `${from.x + (to.x - from.x) * p}px`;
        el.style.top = `${from.y + (to.y - from.y) * p}px`;
    });

    return (
        <div ref={ref} className={tap ? s.tap : s.cursor} data-down={c.down || c.pressing} aria-hidden="true">
            {!tap && (
                <svg viewBox="0 0 24 24" width="24" height="24" className={s.cursorArrow}>
                    <path
                        d="M4 2.5 L4 19 L8.6 14.8 L11.6 21.5 L14.4 20.3 L11.5 13.7 L17.8 13.7 Z"
                        fill="#0d1117"
                        stroke="#fff"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                    />
                </svg>
            )}
            {/* Keyed on the click count, so each click replays its ring. */}
            {c.clicks > 0 && <i key={c.clicks} className={s.cursorRing} />}
        </div>
    );
}
