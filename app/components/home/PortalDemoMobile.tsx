"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowCounterClockwise, ArrowDown, Pause, Play } from "@phosphor-icons/react";
import { CARRIER_LINE, DEMO_CLOSING, DEMO_STEPS } from "@/app/data/portal-demo";
import PhoneReplica from "../portal/growth-demo/PhoneReplica";
import DemoCursor from "../portal/growth-demo/DemoCursor";
import { sceneView, type SceneNo } from "../portal/growth-demo/script";
import { demoNow } from "../portal/growth-demo/sample";
import { createDemoClock, type DemoClock } from "./demo-clock";
import s from "./PortalDemo.module.css";

/**
 * The homepage portal demo on a phone (Xander, 2026-11-18: "on mobile, the whole demo plays in the
 * portal's mobile view"). `PortalDemoSwitch` picks this or the desktop `PortalDemo`, never both.
 *
 * The same five steps, captions and closing as the desktop demo (`DEMO_STEPS`, `DEMO_CLOSING`),
 * played on the portal's real components at a phone's width: the Growth demo's phone replica
 * (`growth-demo/PhoneReplica`), which draws the live Inbox, board, customer file and review window
 * on sample data, so this cannot drift from the product either. Taps, not a cursor. A click on the
 * phone pauses it and the next carries on from exactly there; the step rail jumps between steps.
 * Reduced motion shows each step's finished frame and waits for the rail.
 */

/** Which part of which replica scene each of the homepage's steps plays, in ms of that scene. */
const STEPS: { scene: SceneNo; from: number; to: number }[] = [
    { scene: 1, from: 0, to: 5600 }, // Inbox: the list, a tap on Dave, his lead opens
    { scene: 1, from: 4400, to: 9800 }, // Promote
    { scene: 2, from: 800, to: 9600 }, // Pipeline: Lead → Contacted → Quoted → Scheduled
    { scene: 4, from: 800, to: 12500 }, // Message: typed, sent, answered
    { scene: 5, from: 800, to: 12500 }, // Review
];
const TICK_MS = 100;

type Run = "idle" | "playing" | "done";

export default function PortalDemoMobile() {
    const reduce = !!useReducedMotion();
    const [run, setRun] = useState<Run>("idle");
    const [step, setStep] = useState(0);
    const [t, setT] = useState(STEPS[0].from);
    const [paused, setPaused] = useState(false);
    const [runId, setRunId] = useState(0);
    const clockRef = useRef<DemoClock | null>(null);
    const screenRef = useRef<HTMLDivElement>(null);
    const now = useMemo(() => demoNow(), []);

    useEffect(() => () => clockRef.current?.cancel(), []);

    /** Play from step `i` to the end, each step on its own slice of the pausable clock. */
    const play = useCallback(
        async (i: number) => {
            clockRef.current?.cancel();
            const clock = createDemoClock();
            clockRef.current = clock;
            setPaused(false);
            setRunId((n) => n + 1);
            setRun("playing");
            try {
                for (let k = i; k < STEPS.length; k++) {
                    const seg = STEPS[k];
                    setStep(k);
                    const start = clock.elapsed();
                    setT(seg.from);
                    while (clock.elapsed() - start < seg.to - seg.from) {
                        await clock.wait(TICK_MS);
                        setT(Math.min(seg.to, seg.from + clock.elapsed() - start));
                    }
                }
                setRun("done");
            } catch {
                // Cancelled by a newer run or an unmount.
            }
        },
        [],
    );

    function start(i: number) {
        if (reduce) {
            clockRef.current?.cancel();
            setStep(i);
            setT(STEPS[i].to);
            setRun(i === STEPS.length - 1 ? "done" : "playing");
            return;
        }
        void play(i);
    }

    function togglePause() {
        const clock = clockRef.current;
        if (!clock || clock.cancelled || run !== "playing") return;
        if (clock.paused) clock.resume();
        else clock.pause();
        setPaused(clock.paused);
    }

    const seg = STEPS[step];
    const view = { ...sceneView(seg.scene, t), caption: false };
    const idle = run === "idle";
    const closing = run === "done" && !reduce;
    const pausable = !reduce && run === "playing";
    const cap = DEMO_STEPS[step];

    return (
        <div className={`${s.demo} ${reduce ? s.reduced : ""} ${paused ? s.paused : ""}`}>
            <div className={s.frame} data-pausable={pausable || undefined} style={{ display: "flex", justifyContent: "center" }}>
                <div className={`${s.window} ${s.phoneWindow}`} aria-hidden="true">
                    <div ref={screenRef} className={`portal-scope ${s.phoneScreen}`} style={{ minHeight: 0 }} inert>
                        <PhoneReplica scene={seg.scene} view={view} now={now} />
                        {!idle && !reduce && <DemoCursor container={screenRef} scene={seg.scene} t={t} tap />}
                    </div>
                </div>
                {pausable && (
                    <button
                        type="button"
                        className={s.toggle}
                        onClick={togglePause}
                        aria-label={paused ? "Play" : "Pause"}
                        aria-pressed={paused}
                        title={paused ? "Play" : "Pause"}
                    >
                        <span className={s.toggleIcon} aria-hidden="true">
                            {paused ? <Play size={18} weight="fill" /> : <Pause size={18} weight="fill" />}
                        </span>
                    </button>
                )}
                {closing && (
                    <div className={s.endGate} role="status">
                        <div className={s.endPanel}>
                            <p className={s.endTitle}>
                                {DEMO_CLOSING.title} <span className={s.endAccent}>{DEMO_CLOSING.accent}</span>
                            </p>
                            <div className={s.endActions}>
                                <a href={DEMO_CLOSING.next.href} className={`btn primary ${s.endBtn}`}>
                                    {DEMO_CLOSING.next.label}
                                    <ArrowDown size={16} weight="bold" aria-hidden="true" />
                                </a>
                                <button type="button" className={`btn ghost ${s.endBtn}`} onClick={() => start(0)}>
                                    <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
                                    {DEMO_CLOSING.replay}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {idle && (
                    <div className={s.startGate}>
                        <button type="button" className={s.startBtn} onClick={() => start(0)} aria-label="Play the demo" title="Play the demo">
                            <Play size={30} weight="fill" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>

            {/* The step's caption, under the phone rather than over it, so it never covers what
                it describes. The same words as the desktop demo's tour cards. */}
            <div className={s.phoneCaption} aria-live="polite">
                {!idle && (
                    <>
                        <p className={s.popTitle}>{cap.short}</p>
                        <p className={s.popBody}>{cap.caption}</p>
                        {cap.gated && <p className={s.popGate}>{CARRIER_LINE}</p>}
                    </>
                )}
            </div>

            <div className={s.controls}>
                <div className={s.steps} role="group" aria-label="Demo steps">
                    {DEMO_STEPS.map((st, i) => {
                        const state = idle ? "empty" : i < step ? "done" : i > step ? "empty" : run === "playing" && !reduce ? "running" : "full";
                        return (
                            <button
                                key={st.key}
                                type="button"
                                className={s.step}
                                aria-current={!idle && i === step ? "step" : undefined}
                                aria-label={`Step ${i + 1}: ${st.short}`}
                                onClick={() => start(i)}
                            >
                                <b>{i + 1}</b>
                                <span className={s.stepName}>{st.short}</span>
                                <i
                                    key={`${i}-${state}-${runId}`}
                                    className={s.bar}
                                    data-state={state}
                                    style={state === "running" ? { animationDuration: `${STEPS[i].to - STEPS[i].from}ms` } : undefined}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
