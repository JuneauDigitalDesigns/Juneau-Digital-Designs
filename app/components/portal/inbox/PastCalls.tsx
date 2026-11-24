"use client";

import { useState } from "react";
import type { InboxItem } from "@/app/lib/crm-contacts";
import CallPlayer from "./CallPlayer";
import CallTranscript, { transcriptUrlFor } from "./CallTranscript";
import { fullWhen } from "./model";

/**
 * Past calls: the calls a site answered before it moved down to the website plan (B4, 24 Nov 2026,
 * Xander: "Keep them viewable"). Read-only on purpose: there is no Done, archive, delete, promote
 * or reminder, and nothing here writes. It also has no live-call features: no recording status, no
 * minutes, no callbacks. The calls come from the base the downgrade kept (`callHistory`).
 *
 * Words are the approved C8 lines: the chip ("Past calls"), the line at the top of a call, and the
 * line where a recording has aged out. Everything else is the Inbox's own labels.
 */

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Retell keeps a recording for a year; after that the player would only 404. */
function recordingExpired(item: InboxItem, nowMs: number): boolean {
    const at = item.at ? Date.parse(item.at) : NaN;
    return Number.isFinite(at) && nowMs - at > YEAR_MS;
}

export default function PastCalls({
    items,
    now,
    isDesktop,
}: {
    items: InboxItem[];
    now: Date;
    isDesktop: boolean;
}) {
    const [openId, setOpenId] = useState<string | null>(null);

    if (items.length === 0) {
        return (
            <div className="portal-elev p-6 text-sm text-center" style={{ color: "var(--fg-2)" }}>
                <p>Nothing yet</p>
            </div>
        );
    }

    return (
        <div className="portal-elev overflow-hidden" data-testid="past-calls">
            <ul>
                {items.map((item, i) => {
                    const open = openId === item.id;
                    const name = item.name ?? item.phoneDisplay;
                    const when = fullWhen(item.at, now);
                    const transcriptUrl = transcriptUrlFor(item.recordingUrl);
                    return (
                        <li key={item.id} style={{ borderTop: i === 0 ? undefined : "1px solid var(--rule-weak)" }}>
                            <button
                                type="button"
                                aria-expanded={open}
                                onClick={() => setOpenId(open ? null : item.id)}
                                className="w-full text-left px-4 py-3 flex flex-col gap-0.5 cursor-pointer"
                            >
                                <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                                    {name}
                                </span>
                                <span className="text-xs" style={{ color: "var(--fg-3)" }}>
                                    {item.phoneDisplay} · {when}
                                </span>
                            </button>
                            {open && (
                                <div className="px-4 pb-4 flex flex-col gap-3">
                                    <p
                                        className="text-[13px] rounded-lg px-3 py-2"
                                        style={{ background: "var(--surface)", color: "var(--fg-2)" }}
                                    >
                                        From when you had the AI receptionist. This call is read-only.
                                    </p>
                                    <p className="text-sm leading-relaxed" style={{ color: item.preview ? "var(--fg)" : "var(--fg-3)" }}>
                                        {item.preview ?? "No message"}
                                    </p>
                                    {item.recordingUrl &&
                                        (recordingExpired(item, now.getTime()) ? (
                                            <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
                                                Recordings are deleted a year after the call.
                                            </p>
                                        ) : (
                                            <>
                                                {isDesktop ? (
                                                    <audio controls preload="none" src={item.recordingUrl} className="w-full" />
                                                ) : (
                                                    <CallPlayer src={item.recordingUrl} label={`recording of ${name}`} />
                                                )}
                                                {transcriptUrl && (
                                                    <CallTranscript
                                                        url={transcriptUrl}
                                                        name={item.name}
                                                        phoneDisplay={item.phoneDisplay}
                                                        subtitle={`${item.phoneDisplay} · ${when}`}
                                                        isDesktop={isDesktop}
                                                    />
                                                )}
                                            </>
                                        ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
