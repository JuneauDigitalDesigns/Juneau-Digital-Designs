"use client";

import { Check, Play, Plus } from "@phosphor-icons/react";
import { DEMO_LEAD } from "@/app/data/portal-demo";
import { STAGES } from "../crm/stages";
import { COPY, type SceneNo, type SceneView } from "./script";
import { SAMPLE } from "./sample";
import { Bubble, Caption, ReviewButton } from "./DesktopReplica";
import s from "./GrowthDemo.module.css";

/**
 * The phone replica, after the GrowthDemoPhone mockup: the portal as a phone shows it, one
 * column, drawn to fit the screen rather than scaled down from the desktop.
 *
 * Decorative like the desktop one (`aria-hidden` on the screen); the takeover's live region
 * carries the narration.
 */

const WORKING = STAGES.slice(0, 4);
const mono = { fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-3)" } as const;
const HIGHLIGHT = { background: "color-mix(in srgb, var(--accent) 6%, var(--elev-1))", boxShadow: "inset 3px 0 0 var(--accent)" };

/* Clears the caption card, which sits over the bottom of the screen, so it never covers the
   button or message it is describing. */
const CAPTION_ROOM = 176;

export default function PhoneReplica({ scene, view }: { scene: SceneNo; view: SceneView }) {
    return (
        <>
            {scene === 1 && <Inbox view={view} />}
            {scene === 2 && <Board view={view} />}
            {(scene === 3 || scene === 4) && <Record scene={scene} view={view} />}
            {view.caption && <Caption scene={scene} />}
        </>
    );
}

function Head({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="shrink-0 font-extrabold"
            style={{ padding: "12px 14px", fontFamily: "var(--font-display)", fontSize: 18, background: "var(--elev-1)", borderBottom: "1px solid var(--rule)" }}
        >
            {children}
        </div>
    );
}

function Row({ hl, children }: { hl?: boolean; children: React.ReactNode }) {
    return (
        <div
            className="flex flex-col text-[13px]"
            style={{ gap: 2, padding: "12px 14px", background: "var(--elev-1)", borderBottom: "1px solid var(--rule-weak)", ...(hl ? HIGHLIGHT : {}) }}
        >
            {children}
        </div>
    );
}

function Line({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
    return (
        <span className="text-[12.5px]" style={{ color: tone === "warn" ? "var(--chart-warn)" : "var(--fg-2)" }}>
            {children}
        </span>
    );
}

function Inbox({ view }: { view: SceneView }) {
    return (
        <>
            <Head>Inbox</Head>
            <Row hl>
                <strong>{DEMO_LEAD.name} · now</strong>
                <Line>{SAMPLE.phone.leadLine}</Line>
            </Row>
            {view.drawer && (
                <>
                    <div className={`flex flex-col ${s.pop}`} style={{ gap: 6, padding: "12px 14px", background: "var(--elev-1)" }}>
                        <span style={mono}>{SAMPLE.callMeta}</span>
                        <Line>{SAMPLE.phone.leadMore}</Line>
                        <span className="inline-flex items-center gap-1.5" style={mono}>
                            <Play size={10} weight="fill" /> {SAMPLE.playRecording}
                        </span>
                    </div>
                    <div style={{ padding: "12px 14px", background: "var(--elev-1)", borderBottom: "1px solid var(--rule-weak)" }}>
                        {view.promoted ? (
                            <div
                                key="done"
                                className={`flex items-center justify-center gap-2 rounded-lg font-semibold ${s.pop}`}
                                style={{ height: 46, background: "var(--chart-pos)", color: "var(--on-accent)" }}
                            >
                                <Check size={16} weight="bold" /> {COPY.promoted}
                            </div>
                        ) : (
                            <div
                                key="todo"
                                className={`flex items-center justify-center gap-2 rounded-lg font-semibold ${s.pulse}`}
                                style={{ height: 46, background: "var(--accent)", color: "var(--on-accent)" }}
                            >
                                <Plus size={15} weight="bold" /> {COPY.promote}
                            </div>
                        )}
                    </div>
                </>
            )}
            <Row>
                <strong>Carol Ostrander · {SAMPLE.phone.carolTime}</strong>
                <Line>{SAMPLE.phone.carolLine}</Line>
            </Row>
        </>
    );
}

function Board({ view }: { view: SceneView }) {
    const stage = WORKING[view.daveStage];
    return (
        <>
            <Head>Customers</Head>
            <div className="flex overflow-hidden" style={{ gap: 6, padding: "10px 14px" }}>
                {WORKING.map((st, i) => {
                    const on = i === view.daveStage;
                    return (
                        <span
                            key={st.key}
                            className="shrink-0 rounded-full text-xs"
                            style={{
                                padding: "6px 10px",
                                border: `1px solid ${on ? "var(--fg)" : "var(--rule-strong)"}`,
                                background: on ? "var(--fg)" : "var(--elev-1)",
                                color: on ? "var(--elev-1)" : "var(--fg-2)",
                            }}
                        >
                            {st.label}
                        </span>
                    );
                })}
            </div>
            <Row hl>
                <strong>{DEMO_LEAD.name}</strong>
                <Line>{SAMPLE.daveJob}</Line>
                <span key={stage.key} className={s.pop} style={mono}>
                    {SAMPLE.phone.stagePrefix}
                    {stage.label}
                </span>
            </Row>
            <Row>
                <strong>Tammy Reynolds</strong>
                <Line tone="warn">● {SAMPLE.phone.tammyLine}</Line>
            </Row>
        </>
    );
}

function Record({ scene, view }: { scene: 3 | 4; view: SceneView }) {
    const showButton = scene === 4 && (view.dialog || view.reviewSent);
    return (
        <>
            <Head>
                {DEMO_LEAD.name}{" "}
                <span style={{ ...mono, fontWeight: 400 }}>· {view.won ? STAGES[4].label : STAGES[3].label}</span>
            </Head>
            {/* Bottom-anchored like a chat, so on a short phone the newest message is the one in view. */}
            <div className="flex-1 min-h-0 flex flex-col justify-end overflow-hidden" style={{ gap: 8, padding: "12px 12px" }}>
                <Bubble side="in" still max={270}>
                    {SAMPLE.phone.callBubble}
                </Bubble>
                {view.sent && <Bubble side="out" max={270}>{COPY.sms}</Bubble>}
                {view.reply && <Bubble side="in" max={270}>{COPY.reply}</Bubble>}
                {view.reviewSent && <Bubble side="out" max={270}>{COPY.review}</Bubble>}
            </div>
            {showButton && (
                <div className="shrink-0" style={{ padding: "0 14px 12px" }}>
                    <ReviewButton view={view} label={COPY.reviewTitle} height={46} />
                </div>
            )}
            {view.caption && <div className="shrink-0" style={{ height: CAPTION_ROOM }} />}
        </>
    );
}
