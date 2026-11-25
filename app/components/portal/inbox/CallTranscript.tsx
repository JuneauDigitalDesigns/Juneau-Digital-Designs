"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { TranscriptTurn } from "@/app/lib/call-recording";

/**
 * A call's transcript, from Retell (2026-11-19, Xander: "We should have a transcript for each
 * call"). Approved wording: "Transcript", "Receptionist", the caller's first name, and
 * "There’s no transcript for this call." (mockup strings 3, 4 and 16).
 *
 * It is fetched when the lead opens, not when the row is tapped, so the row can say up front
 * whether there is one. The route reads Retell through the recording's own lookup and caches
 * the answer, so this costs Retell at most one request per call per day.
 *
 * Phone: a row under the recording that opens a full screen of chat bubbles, receptionist on
 * the left and the caller on the right, with Back. Desktop: the same bubbles, unfolding in
 * place under the recording, so the pane's layout does not change.
 */
type State = { kind: "loading" } | { kind: "none" } | { kind: "ready"; turns: TranscriptTurn[] };

/**
 * The transcript route for a call, from its recording URL: the same `/api/portal/calls/<id>/…?site=`
 * address with `transcript` for `recording`. Null for anything else (a web form has neither).
 */
export function transcriptUrlFor(recordingUrl: string | null): string | null {
    if (!recordingUrl || !/^\/api\/portal\/calls\/[^/?#]+\/recording(\?|$)/.test(recordingUrl)) return null;
    return recordingUrl.replace("/recording", "/transcript");
}

function useTranscript(url: string): State {
    const [state, setState] = useState<State>({ kind: "loading" });
    useEffect(() => {
        let live = true;
        fetch(url)
            .then(async (res) => {
                if (!live) return;
                if (!res.ok) return setState({ kind: "none" });
                const body = (await res.json()) as { turns?: TranscriptTurn[] };
                setState(body.turns?.length ? { kind: "ready", turns: body.turns } : { kind: "none" });
            })
            .catch(() => live && setState({ kind: "none" }));
        return () => {
            live = false;
        };
    }, [url]);
    return state;
}

export default function CallTranscript({
    url,
    name,
    phoneDisplay,
    subtitle,
    isDesktop,
}: {
    /** From `transcriptUrlFor`. */
    url: string;
    /** The caller's name, when the receptionist took one. */
    name: string | null;
    /** Stands in for the name on a caller who gave none. */
    phoneDisplay: string;
    /** Phone screen's line under the title: number · when · length. */
    subtitle: string;
    isDesktop: boolean;
}) {
    const state = useTranscript(url);
    const [open, setOpen] = useState(false);
    const reduceMotion = useReducedMotion();
    // The caller's bubbles are labelled with their first name, or their number when unnamed.
    const callerLabel = name?.trim().split(/\s+/)[0] || phoneDisplay;

    if (state.kind === "none") {
        return (
            <p className="pt-3 mt-1 border-t text-[15px] lg:text-[13px]" style={{ borderColor: "var(--rule)", color: "var(--fg-3)" }}>
                There’s no transcript for this call.
            </p>
        );
    }

    const row = (
        <button
            type="button"
            disabled={state.kind === "loading"}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="w-full pt-3 mt-1 border-t flex items-center justify-between min-h-11 lg:min-h-0 text-[16px] lg:text-[13px] font-semibold cursor-pointer disabled:cursor-default disabled:opacity-60"
            style={{ borderColor: "var(--rule)", color: "var(--accent)" }}
        >
            Transcript
            {isDesktop ? (
                <CaretDown size={14} weight="bold" style={{ transform: open ? "rotate(180deg)" : undefined }} />
            ) : (
                <CaretRight size={18} weight="bold" />
            )}
        </button>
    );

    const bubbles = state.kind === "ready" && <Bubbles turns={state.turns} callerLabel={callerLabel} />;

    if (isDesktop) {
        return (
            <>
                {row}
                {open && bubbles && <div className="pt-1">{bubbles}</div>}
            </>
        );
    }

    return (
        <>
            {row}
            {open && state.kind === "ready" && (
                <motion.section
                    aria-label="Transcript"
                    initial={reduceMotion ? false : { x: "100%" }}
                    animate={{ x: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}
                    className="fixed inset-0 z-[60] flex flex-col"
                    style={{ background: "var(--bg)" }}
                >
                    <div
                        className="shrink-0 flex items-center px-1.5 border-b"
                        style={{
                            paddingTop: "env(safe-area-inset-top, 0px)",
                            minHeight: "calc(56px + env(safe-area-inset-top, 0px))",
                            background: "var(--elev-1)",
                            borderColor: "var(--rule)",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 h-11 px-2.5 text-[17px] font-semibold cursor-pointer"
                            style={{ color: "var(--accent)" }}
                        >
                            <CaretLeft size={20} weight="bold" /> {name ?? phoneDisplay}
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
                        <h1 className="m-0">Transcript</h1>
                        <p className="mt-1 mb-4 text-[15px]" style={{ color: "var(--fg-3)" }}>
                            {subtitle}
                        </p>
                        {bubbles}
                    </div>
                </motion.section>
            )}
        </>
    );
}

function Bubbles({ turns, callerLabel }: { turns: TranscriptTurn[]; callerLabel: string }) {
    return (
        <ol className="flex flex-col gap-1.5 list-none p-0 m-0">
            {turns.map((t, i) => {
                const mine = t.speaker === "caller";
                const label = i === 0 || turns[i - 1].speaker !== t.speaker;
                return (
                    <li key={i} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                        {label && (
                            <span className="text-[12px] lg:text-[11px] font-semibold mt-2 mb-1 px-1" style={{ color: "var(--fg-3)" }}>
                                {mine ? callerLabel : "Receptionist"}
                            </span>
                        )}
                        <span
                            className="max-w-[82%] px-3.5 py-2.5 rounded-[18px] text-[16px] lg:text-[13.5px] leading-snug"
                            style={
                                mine
                                    ? { background: "var(--accent)", color: "var(--on-accent)", borderBottomRightRadius: 6 }
                                    : { background: "var(--elev-1)", color: "var(--fg)", borderBottomLeftRadius: 6, border: "1px solid var(--rule)" }
                            }
                        >
                            {t.text}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
