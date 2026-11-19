"use client";

import { useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, Clock, Phone } from "@phosphor-icons/react";

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
 *
 * 2026-11-19 (Xander, mobile app rework, Q6): a long swipe left, past `FAR`, turns Done into
 * Remind me and opens the existing Remind me sheet on release. Call is green (calling someone is
 * green throughout the app now), Done is slate, Remind me is blue.
 */

const LOCK = 10;
const TRIGGER = 96;
/** Past this, a left swipe means Remind me rather than Done. */
const FAR = 190;
const MAX = 150;
const MAX_LEFT = 260;

export default function SwipeRow({
    canCall,
    canDone,
    canRemind = false,
    onCall,
    onDone,
    onRemind,
    children,
}: {
    canCall: boolean;
    canDone: boolean;
    canRemind?: boolean;
    onCall: () => void;
    onDone: () => void;
    onRemind?: () => void;
    children: React.ReactNode;
}) {
    const reduceMotion = useReducedMotion();
    const [dx, setDx] = useState(0);
    const [dragging, setDragging] = useState(false);
    const start = useRef<{ x: number; y: number; lock: "h" | "v" | null } | null>(null);
    /** Swallows the click a finished swipe would otherwise deliver to the row underneath. */
    const swallowClick = useRef(false);

    const remindable = canRemind && Boolean(onRemind);
    const leftMax = remindable ? MAX_LEFT : canDone ? MAX : 0;
    const clamp = (v: number) => Math.max(-leftMax, Math.min(canCall ? MAX : 0, v));
    const far = remindable && dx <= -FAR;

    const end = (commit: boolean) => {
        if (commit && start.current?.lock === "h") {
            if (dx >= TRIGGER && canCall) onCall();
            else if (far) onRemind?.();
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
                    {/* White on --call #15803d 5.0:1, on #5b6576 5.9:1, on #2563eb 5.2:1. These
                        fills are the same in both themes, so the label stays white. */}
                    {dx > 0 ? (
                        <span className="flex-1 flex items-center gap-1.5 px-[20px] text-[14.5px]" style={{ background: "var(--call)" }}>
                            <Phone size={19} weight="bold" /> Call
                        </span>
                    ) : far ? (
                        <span className="flex-1 flex items-center justify-end gap-1.5 px-[20px] text-[14.5px]" style={{ background: "#2563eb" }}>
                            Remind me <Clock size={19} weight="bold" />
                        </span>
                    ) : (
                        <span className="flex-1 flex items-center justify-end gap-1.5 px-[20px] text-[14.5px]" style={{ background: "#5b6576" }}>
                            Done <Check size={19} weight="bold" />
                        </span>
                    )}
                </div>
            )}
            <div
                className="relative"
                style={{
                    touchAction: "pan-y",
                    transform: dx ? `translateX(${dx}px)` : undefined,
                    // A little overshoot on release, so the row springs back like a native list.
                    transition: dragging || reduceMotion ? "none" : "transform 260ms cubic-bezier(0.3, 1.35, 0.5, 1)",
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
