"use client";

import Image from "next/image";
import { ChartLineUp, Check, Play, Plus, Tray, Users } from "@phosphor-icons/react";
import { DEMO_BUSINESS, DEMO_INBOX, DEMO_LEAD } from "@/app/data/portal-demo";
import { STAGES } from "../crm/stages";
import { COPY, captionFor, type SceneNo, type SceneView } from "./script";
import { SAMPLE } from "./sample";
import s from "./GrowthDemo.module.css";

/**
 * The desktop replica: a 1160 × 650 portal, drawn at its real size and scaled down as a whole
 * when the window is smaller (`GrowthDemo` does the scaling), so it is never re-laid-out into
 * something the product does not look like.
 *
 * Markup follows the GrowthDemo mockup, built from the live portal's own classes and tokens
 * (`portal-rail-link`, `portal-elev`, the CRM's stage colours) so it wears the product's look
 * rather than a copy of it. It is decorative: the whole frame is `aria-hidden`, and the
 * narration a screen reader gets is the takeover's live region.
 */

const WORKING = STAGES.slice(0, 4);

export default function DesktopReplica({ scene, view }: { scene: SceneNo; view: SceneView }) {
    const onCustomers = scene !== 1;
    return (
        <>
            <aside
                className="flex flex-col gap-3 shrink-0"
                style={{ width: 180, padding: "14px 10px", background: "var(--bg)", borderRight: "1px solid var(--rule)" }}
            >
                <div className="flex items-center" style={{ margin: "-14px -10px 0", height: 56, padding: "0 12px", background: "var(--brand-band)" }}>
                    <Image src="/jdd-lockup-portal.png" alt="" width={640} height={192} style={{ width: 120, height: 36 }} />
                </div>
                <div className="min-w-0 pb-3" style={{ borderBottom: "1px solid var(--rule)" }}>
                    <span
                        className="block font-bold leading-tight"
                        style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "var(--tracking-tight)" }}
                    >
                        {DEMO_BUSINESS.name}
                    </span>
                    <span
                        className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full border"
                        style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}
                    >
                        Growth
                    </span>
                </div>
                <nav className="portal-rail-nav">
                    <span className={`portal-rail-link${onCustomers ? "" : " is-active"}`}>
                        <Tray size={16} weight={onCustomers ? "regular" : "fill"} className="shrink-0" />
                        <span>Inbox</span>
                    </span>
                    <span className={`portal-rail-link${onCustomers ? " is-active" : ""}`}>
                        <Users size={16} weight={onCustomers ? "fill" : "regular"} className="shrink-0" />
                        <span>Customers</span>
                    </span>
                    <span className="portal-rail-link">
                        <ChartLineUp size={16} className="shrink-0" />
                        <span>Analytics</span>
                    </span>
                </nav>
            </aside>

            <div className="relative flex-1 min-w-0 flex flex-col gap-3" style={{ padding: "20px 24px" }}>
                {scene === 1 && <InboxScene view={view} />}
                {scene === 2 && <BoardScene view={view} />}
                {(scene === 3 || scene === 4) && <RecordScene scene={scene} view={view} />}
                {view.caption && <Caption scene={scene} side={scene >= 3 ? "right" : "left"} />}
            </div>
        </>
    );
}

function Title({ children }: { children: React.ReactNode }) {
    return (
        <div className="font-extrabold" style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "-0.02em" }}>
            {children}
        </div>
    );
}

const mono = { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" } as const;

/* ── 1: the call lands, opens, and is promoted ─────────────────────────── */

function InboxScene({ view }: { view: SceneView }) {
    const rows = [
        { id: "dave", name: DEMO_LEAD.name, preview: DEMO_LEAD.preview, time: "now", unread: true },
        ...DEMO_INBOX.map((r) => ({ id: r.id, name: r.name, preview: r.preview, time: r.time, unread: Boolean(r.unread) })),
    ];
    return (
        <>
            <Title>Inbox</Title>
            <div className="portal-elev overflow-hidden">
                {rows.map((r, i) => (
                    <div
                        key={r.id}
                        className="flex items-center gap-3 text-[13px]"
                        style={{
                            padding: "12px 14px",
                            borderTop: i === 0 ? undefined : "1px solid var(--rule-weak)",
                            ...(r.id === "dave"
                                ? { background: "color-mix(in srgb, var(--accent) 6%, var(--elev-1))", boxShadow: "inset 3px 0 0 var(--accent)" }
                                : {}),
                        }}
                    >
                        <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: r.unread ? "var(--accent)" : "transparent" }} />
                        <strong className="shrink-0 truncate" style={{ width: 130, color: "var(--fg)" }}>
                            {r.name}
                        </strong>
                        <span className="flex-1 min-w-0 truncate" style={{ color: "var(--fg-2)" }}>
                            {r.preview}
                        </span>
                        <span className="shrink-0" style={mono}>
                            {r.time}
                        </span>
                    </div>
                ))}
            </div>
            {view.drawer && (
                <div
                    className={`absolute top-0 right-0 bottom-0 flex flex-col gap-3 ${s.slideIn}`}
                    style={{
                        width: 420,
                        padding: 20,
                        zIndex: 2,
                        background: "var(--elev-1)",
                        borderLeft: "1px solid var(--rule)",
                        boxShadow: "var(--glass-shadow)",
                    }}
                >
                    <div className="font-extrabold" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                        {DEMO_LEAD.name}
                    </div>
                    <div style={mono}>{SAMPLE.callMeta}</div>
                    <div className="text-[13.5px] leading-normal" style={{ color: "var(--fg-2)" }}>
                        {DEMO_LEAD.preview}
                    </div>
                    <div className="inline-flex items-center gap-1.5" style={mono}>
                        <Play size={11} weight="fill" /> {SAMPLE.playRecording}
                    </div>
                    <div className="flex-1" />
                    <PromoteButton promoted={view.promoted} />
                </div>
            )}
        </>
    );
}

function PromoteButton({ promoted }: { promoted: boolean }) {
    return promoted ? (
        <div
            key="done"
            className={`flex items-center justify-center gap-2 rounded-lg font-semibold text-sm ${s.pop}`}
            style={{ height: 42, background: "var(--chart-pos)", color: "var(--on-accent)" }}
        >
            <Check size={16} weight="bold" /> {COPY.promoted}
        </div>
    ) : (
        <div
            key="todo"
            className={`flex items-center justify-center gap-2 rounded-lg font-semibold text-sm ${s.pulse}`}
            style={{ height: 42, background: "var(--accent)", color: "var(--on-accent)" }}
        >
            <Plus size={15} weight="bold" /> {COPY.promote}
        </div>
    );
}

/* ── 2: the card moves down the board ──────────────────────────────────── */

function BoardScene({ view }: { view: SceneView }) {
    return (
        <>
            <Title>Customers</Title>
            <div className="flex items-start" style={{ gap: 10 }}>
                {WORKING.map((st, ci) => (
                    <section
                        key={st.key}
                        className="flex-1 min-w-0 flex flex-col"
                        style={{
                            gap: 7,
                            padding: 8,
                            minHeight: 300,
                            borderRadius: 10,
                            background: "var(--surface)",
                            border: "1px solid var(--rule-weak)",
                        }}
                    >
                        <div className="flex items-center font-bold" style={{ gap: 7, padding: "2px 4px", fontFamily: "var(--font-display)", fontSize: 14 }}>
                            <span className="rounded-full" style={{ width: 8, height: 8, background: st.color }} />
                            {st.label}
                        </div>
                        {view.daveStage === ci && (
                            <BoardCard key={`dave-${ci}`} name={DEMO_LEAD.name} job={SAMPLE.daveJob} me />
                        )}
                        {SAMPLE.board
                            .filter((c) => c.col === ci)
                            .map((c) => (
                                <BoardCard key={c.name} name={c.name} job={c.job} stale={c.stale} />
                            ))}
                    </section>
                ))}
            </div>
        </>
    );
}

function BoardCard({ name, job, stale, me }: { name: string; job: string; stale?: boolean; me?: boolean }) {
    return (
        <div
            className={`flex flex-col text-xs ${me ? s.pop : ""}`}
            style={{
                gap: 3,
                padding: "9px 11px",
                borderRadius: 8,
                color: "var(--fg-2)",
                background: "var(--elev-1)",
                border: `1px solid ${me ? "var(--accent)" : "var(--elev-border)"}`,
                boxShadow: me ? "0 0 0 3px var(--accent-glow)" : "var(--shadow-1)",
            }}
        >
            <strong className="text-[13px]" style={{ color: "var(--fg)" }}>
                {name}
            </strong>
            <span>{job}</span>
            {stale && (
                <span className="inline-flex items-center text-[11.5px]" style={{ gap: 5, color: "var(--chart-warn)" }}>
                    <span className="rounded-full" style={{ width: 7, height: 7, background: "var(--chart-warn)" }} />
                    {SAMPLE.goingQuiet}
                </span>
            )}
        </div>
    );
}

/* ── 3 and 4: the record, a text, then the review request ──────────────── */

function RecordScene({ scene, view }: { scene: 3 | 4; view: SceneView }) {
    const stage = view.won ? STAGES[4] : STAGES[3];
    return (
        /* One column, so the caption has the right-hand side to itself and never sits on the
           composer or the dialog it is talking about. */
        <div className="flex flex-col gap-3 flex-1 min-h-0" style={{ maxWidth: 560 }}>
            <div className="flex items-center gap-3">
                <span
                    className="flex items-center justify-center font-semibold shrink-0"
                    style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)" }}
                >
                    {DEMO_LEAD.initials}
                </span>
                <div className="min-w-0">
                    <div className="font-extrabold" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                        {DEMO_LEAD.name}
                    </div>
                    <div style={mono}>
                        {DEMO_LEAD.phone} · {SAMPLE.town}
                    </div>
                </div>
                <span
                    className="ml-auto inline-flex items-center rounded-full text-xs"
                    style={{ gap: 6, padding: "4px 10px", background: "var(--surface)", color: "var(--fg-2)" }}
                >
                    <span className="rounded-full" style={{ width: 8, height: 8, background: stage.color }} />
                    {stage.label}
                </span>
            </div>

            <div className="portal-elev flex-1 min-h-0 flex flex-col overflow-hidden" style={{ padding: 14, gap: 10 }}>
                <div className="self-center" style={mono}>
                    {SAMPLE.today}
                </div>
                <Bubble side="in" still>
                    {SAMPLE.callBubble}
                </Bubble>
                {view.sent && <Bubble side="out">{COPY.sms}</Bubble>}
                {view.reply && <Bubble side="in">{COPY.reply}</Bubble>}
                {scene === 4 && (
                    <div className="self-center" style={mono}>
                        {SAMPLE.wonDay}
                    </div>
                )}
                {view.reviewSent && <Bubble side="out">{COPY.review}</Bubble>}
            </div>

            {scene === 3 && (
                <>
                    <div
                        className="flex items-center gap-2 text-[13px]"
                        style={{ minHeight: 28, padding: "8px 8px 8px 12px", borderRadius: 10, background: "var(--elev-1)", border: "1px solid var(--rule-strong)" }}
                    >
                        <span className="flex-1 min-w-0">
                            {view.typed}
                            <span className={s.caret} />
                        </span>
                        <span
                            className="inline-flex items-center rounded-lg font-semibold text-[13px]"
                            style={{ height: 34, padding: "0 14px", background: "var(--accent)", color: "var(--on-accent)" }}
                        >
                            {SAMPLE.send}
                        </span>
                    </div>
                    <div style={mono}>{SAMPLE.fromNumber}</div>
                </>
            )}

            {scene === 4 && view.dialog && (
                <div
                    className={`absolute flex flex-col gap-3 ${s.pop}`}
                    style={{
                        left: 24 + 280 - 220,
                        top: "50%",
                        width: 440,
                        marginTop: -150,
                        padding: 20,
                        zIndex: 2,
                        borderRadius: 12,
                        background: "var(--elev-1)",
                        boxShadow: "0 24px 60px -16px rgba(13,17,23,0.4)",
                    }}
                >
                    <div className="font-extrabold" style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
                        {COPY.reviewTitle}
                    </div>
                    <div
                        className="text-[13px] leading-normal"
                        style={{ padding: 12, borderRadius: 8, color: "var(--fg-2)", background: "var(--bg)", border: "1px solid var(--rule)" }}
                    >
                        {COPY.review}
                    </div>
                    <ReviewButton view={view} />
                </div>
            )}
        </div>
    );
}

export function ReviewButton({ view, label = COPY.reviewSend, height = 42 }: { view: SceneView; label?: string; height?: number }) {
    return view.reviewSent ? (
        <div
            key="done"
            className={`flex items-center justify-center gap-2 rounded-lg font-semibold text-sm ${s.pop}`}
            style={{ height, background: "var(--chart-pos)", color: "var(--on-accent)" }}
        >
            <Check size={16} weight="bold" /> {COPY.reviewSent}
        </div>
    ) : (
        <div
            key="todo"
            className={`flex items-center justify-center gap-2 rounded-lg font-semibold text-sm ${view.armed ? s.pulse : ""}`}
            style={{ height, background: "var(--accent)", color: "var(--on-accent)" }}
        >
            {label}
        </div>
    );
}

export function Bubble({ side, still, max = 420, children }: { side: "in" | "out"; still?: boolean; max?: number; children: React.ReactNode }) {
    const out = side === "out";
    return (
        <div
            className={`text-[13px] ${still ? "" : s.pop}`}
            style={{
                maxWidth: max,
                padding: "10px 12px",
                lineHeight: 1.4,
                borderRadius: 12,
                alignSelf: out ? "flex-end" : "flex-start",
                ...(out
                    ? { background: "var(--accent)", color: "var(--on-accent)", borderBottomRightRadius: 4 }
                    : { background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--rule)", borderBottomLeftRadius: 4 }),
            }}
        >
            {children}
        </div>
    );
}

export function Caption({ scene, side }: { scene: SceneNo; side?: "left" | "right" }) {
    const cap = captionFor(scene);
    return (
        <div className={s.caption} data-side={side}>
            <span style={mono}>{cap.step}</span>
            <strong className="text-[15px]" style={{ color: "var(--fg)" }}>
                {cap.title}
            </strong>
            <p className="m-0 text-[13.5px] leading-snug" style={{ color: "var(--fg-2)" }}>
                {cap.text}
            </p>
            {cap.gate && (
                <p className="m-0 text-xs leading-snug" style={{ color: "var(--fg-3)" }}>
                    {cap.gate}
                </p>
            )}
        </div>
    );
}
