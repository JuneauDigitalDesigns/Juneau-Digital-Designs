"use client";

import { useId, useState } from "react";
import { Info } from "@phosphor-icons/react";

/**
 * A short explanation attached to a label.
 *
 * Built rather than pulled in: the portal's only existing tooltip is recharts', which is for
 * chart hover and cannot be reused here. This is the minimum that behaves correctly.
 *
 * Opens on hover **and on keyboard focus**. Hover-only would make the explanation unreachable
 * by keyboard and on touch, and the one thing it explains is why a number looks wrong, which
 * is exactly when someone needs it most.
 *
 * The trigger is a real `<button type="button">` so it is tabbable and does not submit
 * anything, and it is wired with `aria-describedby` so a screen reader announces the text with
 * the label rather than as a stray paragraph.
 */
export function InfoTip({ text, label = "More information" }: { text: string; label?: string }) {
    const id = useId();
    const [open, setOpen] = useState(false);

    return (
        <span className="relative inline-flex items-center">
            <button
                type="button"
                aria-label={label}
                aria-describedby={open ? id : undefined}
                aria-expanded={open}
                className="inline-flex items-center cursor-help"
                style={{ color: "var(--fg-3)" }}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                // Touch has no hover; a tap toggles instead of doing nothing.
                onClick={() => setOpen((v) => !v)}
            >
                <Info size={13} weight="bold" />
            </button>

            {open && (
                <span
                    id={id}
                    role="tooltip"
                    className="absolute z-30 left-0 top-full mt-1.5 w-60 rounded-md px-3 py-2 text-xs normal-case"
                    style={{
                        background: "var(--fg)",
                        color: "var(--bg)",
                        lineHeight: 1.5,
                        letterSpacing: "normal",
                        fontFamily: "var(--font-sans)",
                        boxShadow: "var(--shadow-2)",
                    }}
                >
                    {text}
                </span>
            )}
        </span>
    );
}
