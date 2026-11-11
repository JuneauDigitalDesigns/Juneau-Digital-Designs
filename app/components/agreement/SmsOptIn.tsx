"use client";

import Link from "next/link";
import { SMS_CONSENT_V1, splitConsentText, type SmsConsentCopy } from "@/app/lib/sms-consent-text";

/**
 * The optional owner SMS opt-in: a mobile number field and, beside it, a separate, unchecked
 * consent box. One component for both agreement pages, the self-serve `/agreement` and an order's
 * private link (`/agree/[code]`), so the two can never show different words.
 *
 * Sits below the binding acceptance, in its own visually distinct card, and is never gated on
 * reading the terms: a consent that unlocks only by working through the service agreement reads
 * as bundled into it, which is exactly what "not a condition of purchase" rules out. Nothing here
 * touches the submit button.
 *
 * `copy` is chosen on the server by the campaign switch (`smsConsentCopy()`); the page sends its
 * `version` back with a ticked box so the record names exactly these words.
 */

/** Shown when the box is ticked with no usable number. Same words on both pages. */
export const SMS_OPT_IN_PHONE_ERROR = "Enter a valid mobile number for text alerts, or uncheck the text alerts box.";

const fieldStyle: React.CSSProperties = {
    padding: "11px 14px",
    background: "var(--surface)",
    border: "1px solid var(--rule)",
    borderRadius: 8,
    color: "var(--fg)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
};

/** "Text alerts", not "call alerts", in both modes (Xander, 2026-11-11). */
export const SMS_OPT_IN_KICKER = "OPTIONAL · TEXT ALERTS";
export const SMS_OPT_IN_PHONE_LABEL = "Mobile number for text alerts";
const PHONE_ID = "mobile-number-for-text-alerts";

/**
 * The line under the number field, per campaign (Xander, 2026-11-11): unchanged under v1, whose
 * registered text offers call summaries; "text alerts" under v2.
 */
export function smsOptInPhoneHint(copy: SmsConsentCopy): string {
    return copy.version === SMS_CONSENT_V1.version
        ? "Optional. Used only if you turn on call summary texts below."
        : "Optional. Used only if you turn on text alerts below.";
}

export default function SmsOptIn({
    copy,
    phone,
    onPhoneChange,
    checked,
    onCheckedChange,
}: {
    copy: SmsConsentCopy;
    phone: string;
    onPhoneChange: (v: string) => void;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
}) {
    return (
        <div style={{ marginTop: 16 }}>
            <div className="kicker" style={{ marginBottom: 10 }}>
                ━ {SMS_OPT_IN_KICKER}
            </div>
            <div style={{ marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor={PHONE_ID} className="kicker">
                        ━ {SMS_OPT_IN_PHONE_LABEL}
                    </label>
                    <input
                        id={PHONE_ID}
                        type="tel"
                        placeholder="(907) 555-0142"
                        value={phone}
                        onChange={(e) => onPhoneChange(e.target.value)}
                        style={fieldStyle}
                        aria-describedby={`${PHONE_ID}-hint`}
                    />
                    <p id={`${PHONE_ID}-hint`} style={{ margin: 0, fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}>
                        {smsOptInPhoneHint(copy)}
                    </p>
                </div>
            </div>
            <label
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "16px 18px",
                    background: "transparent",
                    border: "1px dashed var(--rule)",
                    borderRadius: 10,
                    cursor: "pointer",
                }}
            >
                <input
                    type="checkbox"
                    name="smsConsent"
                    checked={checked}
                    onChange={(e) => onCheckedChange(e.target.checked)}
                    style={{
                        marginTop: 2,
                        width: 18,
                        height: 18,
                        accentColor: "var(--accent)",
                        cursor: "pointer",
                    }}
                />
                <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
                    {/*
                        Rendered from the same constant that gets hashed into the consent record,
                        so the words on screen and the words we can prove they saw cannot drift
                        apart.
                    */}
                    {splitConsentText(copy.text).map((seg, i) =>
                        seg.kind === "link" ? (
                            <Link
                                key={i}
                                href={seg.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                // Inside a <label>, a click would otherwise toggle the box on the
                                // way to opening the link.
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: "var(--accent)", textDecoration: "underline" }}
                            >
                                {seg.value}
                            </Link>
                        ) : (
                            <span key={i}>{seg.value}</span>
                        ),
                    )}
                </span>
            </label>
        </div>
    );
}
