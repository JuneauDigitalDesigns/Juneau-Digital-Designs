"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, CaretLeft, PhoneCall } from "@phosphor-icons/react";
import { fullWhen } from "../inbox/model";
import QuickReplies from "./QuickReplies";
import { formatPhone, type CustomerRow, type TimelineEvent } from "./stages";

/**
 * The phone's texting screen for one customer (2026-11-19, Xander: "text on a customer record
 * should open a screen for messaging right from the portal. This should resemble the typical
 * texting UI").
 *
 * Built like the phone's own Messages app: your texts in blue on the right, theirs in grey on the
 * left, a time between groups, and "Delivered" under your latest once the carrier says so. Quick
 * replies sit above the text box. Sending is the record's own `sendMessage`, from the business
 * number, exactly as the Timeline's text box sends; every text still lands on the Timeline.
 *
 * Approved wording (mockup strings 14, 15): "Texts go out from your business number, {number}."
 * and "Delivered". "Sending…", "Text {name}…" and "Quick replies" are existing portal copy.
 */
export default function TextThread({
    customer,
    siteSlug,
    events,
    businessNumber,
    draft,
    setDraft,
    sending,
    onSend,
    onClose,
}: {
    customer: CustomerRow;
    siteSlug: string;
    events: TimelineEvent[];
    businessNumber: string | null;
    draft: string;
    setDraft: (v: string) => void;
    sending: boolean;
    onSend: () => void;
    onClose: () => void;
}) {
    const reduceMotion = useReducedMotion();
    const end = useRef<HTMLDivElement>(null);
    const now = useMemo(() => new Date(), []);

    const texts = useMemo(
        () =>
            events
                .filter((e) => e.kind === "sms-in" || e.kind === "sms-out")
                .map((e) => ({
                    id: e.id,
                    out: e.kind === "sms-out",
                    at: e.at,
                    body: typeof e.meta?.body === "string" ? e.meta.body : e.summary,
                    status: typeof e.meta?.status === "string" ? e.meta.status : null,
                }))
                .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
        [events],
    );
    const lastOut = [...texts].reverse().find((t) => t.out) ?? null;

    // Open at the newest text, as a messaging app does, and follow new ones.
    useEffect(() => {
        end.current?.scrollIntoView({ block: "end" });
    }, [texts.length]);

    // Esc closes, like every other layer in the portal.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const name = customer.name ?? "them";
    const words = (customer.name ?? "").trim().split(/\s+/).filter(Boolean);
    const initials = words.length ? ((words[0][0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() : "?";

    return (
        <motion.section
            aria-label={`Texts with ${customer.name ?? formatPhone(customer.phone)}`}
            initial={reduceMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}
            className="fixed inset-0 z-[70] flex flex-col"
            style={{ background: "var(--bg)" }}
        >
            <header
                className="shrink-0 relative flex items-center justify-between px-1.5 border-b"
                style={{
                    paddingTop: "env(safe-area-inset-top, 0px)",
                    minHeight: "calc(66px + env(safe-area-inset-top, 0px))",
                    background: "color-mix(in srgb, var(--elev-1) 92%, transparent)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    borderColor: "var(--rule-strong)",
                }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 h-11 px-2.5 text-[17px] font-semibold cursor-pointer z-[1]"
                    style={{ color: "var(--accent)" }}
                >
                    <CaretLeft size={20} weight="bold" /> {words[0] ?? formatPhone(customer.phone)}
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5" style={{ bottom: 6 }}>
                    <span
                        aria-hidden="true"
                        className="w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold"
                        style={{ background: "color-mix(in srgb, var(--accent) 14%, var(--elev-1))", color: "var(--accent)" }}
                    >
                        {initials}
                    </span>
                    <span className="text-[13px] font-semibold max-w-[50vw] truncate" style={{ color: "var(--fg)" }}>
                        {customer.name ?? formatPhone(customer.phone)}
                    </span>
                </div>
                {customer.phone && (
                    <a
                        href={`tel:${customer.phone}`}
                        aria-label={`Call ${customer.name ?? ""}`.trim()}
                        className="w-11 h-11 rounded-full grid place-items-center z-[1]"
                        style={{ color: "var(--accent)" }}
                    >
                        <PhoneCall size={22} />
                    </a>
                )}
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 pt-3 pb-4">
                {businessNumber && (
                    <p className="text-center text-[12.5px] mx-6 mb-2" style={{ color: "var(--fg-3)" }}>
                        Texts go out from your business number, {formatPhone(businessNumber)}.
                    </p>
                )}
                {texts.map((t, i) => {
                    const prev = texts[i - 1];
                    const next = texts[i + 1];
                    const stamp = !prev || Date.parse(t.at) - Date.parse(prev.at) > 60 * 60 * 1000;
                    const lastOfRun = !next || next.out !== t.out || Date.parse(next.at) - Date.parse(t.at) > 60 * 60 * 1000;
                    return (
                        <div key={t.id}>
                            {stamp && (
                                <p className="text-center text-[12.5px] font-semibold mt-4 mb-2" style={{ color: "var(--fg-3)" }}>
                                    {fullWhen(t.at, now)}
                                </p>
                            )}
                            <div className={`flex ${t.out ? "justify-end" : "justify-start"} ${lastOfRun ? "mb-2.5" : "mb-[3px]"}`}>
                                <p
                                    className="m-0 max-w-[76%] px-3.5 py-2 text-[16.5px] leading-[1.36] whitespace-pre-wrap break-words"
                                    style={
                                        t.out
                                            ? {
                                                  background: "#2563eb",
                                                  color: "#ffffff",
                                                  borderRadius: lastOfRun ? "19px 19px 5px 19px" : 19,
                                              }
                                            : {
                                                  background: "var(--elev-2)",
                                                  color: "var(--fg)",
                                                  border: "1px solid var(--rule)",
                                                  borderRadius: lastOfRun ? "19px 19px 19px 5px" : 19,
                                              }
                                    }
                                >
                                    {t.body}
                                </p>
                            </div>
                            {t === lastOut && (sending || t.status === "delivered") && (
                                <p className="text-right text-[12px] font-medium -mt-1.5 mb-2 mr-1" style={{ color: "var(--fg-3)" }}>
                                    {sending ? "Sending…" : "Delivered"}
                                </p>
                            )}
                        </div>
                    );
                })}
                <div ref={end} />
            </div>

            <div
                className="shrink-0 px-3 pt-2 border-t"
                style={{
                    paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
                    background: "color-mix(in srgb, var(--elev-1) 94%, transparent)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    borderColor: "var(--rule-strong)",
                }}
            >
                {customer.phone && <QuickReplies siteSlug={siteSlug} name={customer.name} onPick={setDraft} />}
                <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSend();
                    }}
                >
                    <label htmlFor="crm-thread-input" className="sr-only">
                        Text {name}
                    </label>
                    <textarea
                        id="crm-thread-input"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={1}
                        placeholder={`Text ${name}…`}
                        disabled={!customer.phone}
                        className="flex-1 min-w-0 max-h-32 rounded-[20px] border px-4 py-2.5 text-[16px] outline-none resize-none disabled:opacity-50"
                        style={{ background: "var(--elev-2)", borderColor: "var(--rule-strong)", color: "var(--fg)", fieldSizing: "content" } as React.CSSProperties}
                    />
                    <button
                        type="submit"
                        aria-label={sending ? "Sending…" : "Send"}
                        disabled={sending || !draft.trim() || !customer.phone}
                        className="shrink-0 w-10 h-10 rounded-full grid place-items-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: "#2563eb", color: "#ffffff" }}
                    >
                        <ArrowUp size={20} weight="bold" />
                    </button>
                </form>
            </div>
        </motion.section>
    );
}
