"use client";

import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Phone } from "@phosphor-icons/react";

/**
 * Phone row gestures: swipe right to call, swipe left to mark done.
 *
 * Built on pointer events with `touch-action: pan-y`, which hands every vertical drag to the
 * browser — so scrolling the list is native, momentum and all, and a scroll that begins with
 * a slight sideways wobble is still a scroll. A drag only becomes a swipe once it has moved
 * 10px and more across than down; the browser cancels the pointer on a real scroll, which
 * snaps the row back.
 *
 * Mouse pointers are ignored: on a desktop the row has buttons for both actions. And swipes
 * are never the only way — the lead screen's Call back and Done buttons do the same thing,
 * for anyone who cannot or does not swipe.
 */

const LOCK = 10;
const TRIGGER = 96;
const MAX = 150;

export default function SwipeRow({
    canCall,
    canDone,
    onCall,
    onDone,
    children,
}: {
    canCall: boolean;
    canDone: boolean;
    onCall: () => void;
    onDone: () => void;
    children: React.ReactNode;
}) {
    const reduceMotion = useReducedMotion();
    const [dx, setDx] = useState(0);
    const [dragging, setDragging] = useState(false);
    const start = useRef<{ x: number; y: number; lock: "h" | "v" | null } | null>(null);
    /** Swallows the click a finished swipe would otherwise deliver to the row underneath. */
    const swallowClick = useRef(false);

    const clamp = (v: number) => Math.max(canDone ? -MAX : 0, Math.min(canCall ? MAX : 0, v));

    const end = (commit: boolean) => {
        if (commit && start.current?.lock === "h") {
            if (dx >= TRIGGER && canCall) onCall();
            else if (dx <= -TRIGGER && canDone) onDone();
        }
        start.current = null;
        setDragging(false);
        setDx(0);
    };

    return (
        <div className="relative overflow-hidden" style={{ background: "var(--elev-1)" }}>
            {dx !== 0 && (
                <div aria-hidden="true" className="absolute inset-0 flex text-[13px] font-semibold" style={{ color: "#ffffff" }}>
                    {/* White on --accent 5.17:1, white on --chart-pos 6.27:1. Hex white, not a
                        token: --on-accent is the same value but this is not an accent control. */}
                    {dx > 0 ? (
                        <span className="flex-1 flex items-center gap-1.5 px-[18px]" style={{ background: "var(--accent)" }}>
                            <Phone size={16} weight="bold" /> Call
                        </span>
                    ) : (
                        <span className="flex-1 flex items-center justify-end gap-1.5 px-[18px]" style={{ background: "var(--chart-pos)" }}>
                            Done <Check size={16} weight="bold" />
                        </span>
                    )}
                </div>
            )}
            <div
                className="relative"
                style={{
                    touchAction: "pan-y",
                    transform: dx ? `translateX(${dx}px)` : undefined,
                    transition: dragging || reduceMotion ? "none" : "transform 180ms ease",
                    background: "var(--elev-1)",
                }}
                onPointerDown={(e) => {
                    if (e.pointerType === "mouse") return;
                    start.current = { x: e.clientX, y: e.clientY, lock: null };
                }}
                onPointerMove={(e) => {
                    const s = start.current;
                    if (!s) return;
                    const ddx = e.clientX - s.x;
                    const ddy = e.clientY - s.y;
                    if (s.lock === null) {
                        if (Math.abs(ddx) > LOCK && Math.abs(ddx) > Math.abs(ddy)) {
                            s.lock = "h";
                            setDragging(true);
                            // Keeps the swipe ours if the finger drifts off the row. Throws
                            // for a pointer the browser no longer tracks; the swipe still
                            // works without capture, so that is not worth failing over.
                            try {
                                e.currentTarget.setPointerCapture(e.pointerId);
                            } catch {}
                        } else if (Math.abs(ddy) > LOCK) {
                            s.lock = "v";
                        }
                    }
                    if (s.lock === "h") setDx(clamp(ddx));
                }}
                onPointerUp={() => {
                    if (start.current?.lock === "h") swallowClick.current = true;
                    end(true);
                }}
                onPointerCancel={() => end(false)}
                onClickCapture={(e) => {
                    if (swallowClick.current) {
                        swallowClick.current = false;
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }}
            >
                {children}
            </div>
        </div>
    );
}
