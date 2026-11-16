"use client";

import { useEffect, useRef } from "react";
import type { SmsSkipNoticeCopy } from "@/app/lib/sms-skip-notice.mjs";

/**
 * "Continue without text alerts?": shown on the first press of Agree with the optional text-alerts
 * box unticked, on both agreement pages. Rules and approved words: `app/lib/sms-skip-notice.mjs`.
 *
 * One button, and it only goes back: it never ticks the box and never agrees. Closing by Escape
 * or by the backdrop does the same. The page then lets a second press agree, still unticked.
 */

/** The opt-in's number field (`SmsOptIn`), which the client is taken back to. */
const OPT_IN_FIELD_ID = "mobile-number-for-text-alerts";

export default function SmsSkipNotice({ copy, onBack }: { copy: SmsSkipNoticeCopy; onBack: () => void }) {
    const button = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        button.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onBack();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onBack]);

    return (
        <div
            onClick={(e) => e.target === e.currentTarget && onBack()}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(0, 0, 0, 0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="sms-skip-notice-title"
                aria-describedby="sms-skip-notice-body"
                style={{
                    width: "100%",
                    maxWidth: 460,
                    background: "var(--bg)",
                    color: "var(--fg)",
                    border: "1px solid var(--rule)",
                    borderRadius: 14,
                    padding: "24px 22px",
                    boxShadow: "0 18px 60px rgba(0, 0, 0, 0.35)",
                }}
            >
                <h2 id="sms-skip-notice-title" style={{ margin: "0 0 10px", fontSize: 20, lineHeight: 1.3 }}>
                    {copy.title}
                </h2>
                <p id="sms-skip-notice-body" style={{ margin: "0 0 20px", fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-2)" }}>
                    {copy.body}
                </p>
                <button
                    ref={button}
                    type="button"
                    onClick={onBack}
                    style={{
                        width: "100%",
                        padding: "12px 18px",
                        borderRadius: 10,
                        border: 0,
                        fontWeight: 700,
                        fontSize: 15,
                        background: "var(--fg)",
                        color: "var(--bg)",
                        cursor: "pointer",
                    }}
                >
                    {copy.button}
                </button>
            </div>
        </div>
    );
}

/** Takes the client back to the opt-in, so the choice is in front of them. Ticks nothing. */
export function returnToOptIn() {
    const field = document.getElementById(OPT_IN_FIELD_ID);
    if (!field) return;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
}
