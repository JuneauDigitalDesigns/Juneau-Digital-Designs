"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { splitConsentText, type SmsConsentCopy } from "@/app/lib/sms-consent-text";
import { textAlertsCards } from "@/app/lib/text-alerts-choice.mjs";
import { typePhone } from "@/app/lib/phone-typing";

/**
 * The owner text-alerts choice: two cards, neither chosen when the page opens. One component for
 * both agreement pages, the self-serve `/agreement` and an order's private link (`/agree/[code]`),
 * so the two can never show different words. Rules: `app/lib/text-alerts-choice.mjs`.
 *
 *  - **Yes** reveals the mobile number field and, directly beside it, the registered unchecked
 *    consent box with the registered words, both exactly as before. The tick is the consent.
 *  - **No** reveals nothing. No number, no consent, no texts.
 *
 * Sits below the binding acceptance, in its own visually distinct block, and is never gated on
 * reading the terms: a consent that unlocks only by working through the service agreement reads
 * as bundled into it, which is exactly what "not a condition of purchase" rules out.
 *
 * `copy` is chosen on the server by the campaign switch (`smsConsentCopy()`); the page sends its
 * `version` back with a ticked box so the record names exactly these words, and the cards follow
 * the same campaign.
 *
 * The Yes panel is in the markup from the start, `hidden` until Yes is chosen, so the registered
 * words are always on the page as served.
 */

export type TextAlertsChoice = "yes" | "no";

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

export const SMS_OPT_IN_PHONE_LABEL = "Mobile number for text alerts";
const PHONE_ID = "mobile-number-for-text-alerts";
const HEADING_ID = "text-alerts-heading";

function cardStyle(selected: boolean): React.CSSProperties {
    return {
        display: "block",
        padding: "14px 16px",
        borderRadius: 10,
        border: selected ? "2px solid var(--accent)" : "1px solid var(--rule)",
        // Keeps the text from shifting by a pixel when the border thickens.
        margin: selected ? 0 : 1,
        background: "var(--surface)",
        cursor: "pointer",
    };
}

export default function SmsOptIn({
    copy,
    choice,
    onChoiceChange,
    phone,
    onPhoneChange,
    checked,
    onCheckedChange,
}: {
    copy: SmsConsentCopy;
    /** Null until a card is chosen. */
    choice: TextAlertsChoice | null;
    onChoiceChange: (v: TextAlertsChoice) => void;
    phone: string;
    onPhoneChange: (v: string) => void;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
}) {
    const cards = textAlertsCards(copy.version);

    // The number formats as it's typed ("(407) 555-0288", Xander 2026-11-16). Reformatting moves
    // the browser's caret to the end, so it's put back beside the digit it was beside, once the
    // parent has the new value. Display only: the pages post normalizeUsPhone() of it, E.164.
    const phoneRef = useRef<HTMLInputElement>(null);
    const pendingCaret = useRef<number | null>(null);
    useLayoutEffect(() => {
        const caret = pendingCaret.current;
        if (caret === null || !phoneRef.current) return;
        pendingCaret.current = null;
        phoneRef.current.setSelectionRange(caret, caret);
    }, [phone]);
    const radio = (value: TextAlertsChoice) => (
        <input
            type="radio"
            name="textAlertsChoice"
            value={value}
            checked={choice === value}
            onChange={() => onChoiceChange(value)}
            style={{ width: 18, height: 18, marginTop: 2, flex: "none", accentColor: "var(--accent)", cursor: "pointer" }}
        />
    );
    const cardHead = (value: TextAlertsChoice) => {
        const card = cards[value];
        return (
            <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
                {radio(value)}
                <span>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--fg)", lineHeight: 1.4 }}>
                        {card.title}
                    </span>
                    <span style={{ display: "block", marginTop: 2, fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.5 }}>
                        {card.line}
                    </span>
                </span>
            </label>
        );
    };

    return (
        <div style={{ marginTop: 16 }}>
            <div id={HEADING_ID} className="kicker" style={{ marginBottom: 10 }}>
                ━ {cards.heading}
            </div>
            <div role="radiogroup" aria-labelledby={HEADING_ID} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={cardStyle(choice === "yes")}>
                    {cardHead("yes")}
                    <div id="text-alerts-yes-panel" hidden={choice !== "yes"} style={{ marginTop: 14 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                            <label htmlFor={PHONE_ID} className="kicker">
                                ━ {SMS_OPT_IN_PHONE_LABEL}
                            </label>
                            <input
                                ref={phoneRef}
                                id={PHONE_ID}
                                type="tel"
                                autoComplete="tel-national"
                                placeholder="(907) 555-0142"
                                value={phone}
                                onChange={(e) => {
                                    const next = typePhone(phone, e.target.value, e.target.selectionStart ?? e.target.value.length);
                                    pendingCaret.current = next.caret;
                                    onPhoneChange(next.value);
                                }}
                                style={fieldStyle}
                            />
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
                </div>
                <div style={cardStyle(choice === "no")}>{cardHead("no")}</div>
            </div>
        </div>
    );
}
