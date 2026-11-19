"use client";

import { useEffect, useRef, useState } from "react";
import HomeIcon, { Wave } from "./HomeIcon";
import {
    ASKED_FIRST,
    ASKED_HOLDS,
    ASKED_NEXT,
    SEARCHES_FIRST,
    SEARCHES_NEXT,
    SEARCH_HOLDS,
    type FoundLine,
} from "@/app/data/home-find-out";

/**
 * 2 · "What your customers are trying to find out." Approved from the homepage mockup, rounds 1-3
 * (19 Nov 2026). Reused from /hvac with a different treatment: searches from every trade scatter
 * across the width and fade out and back in with the next one; the spoken questions sit under them,
 * their coral bar flashing as each one arrives. No monthly counts on the homepage (Xander).
 *
 * Each slot keeps its own clock (the holds differ, so they never change together). A slot the
 * layout hides, as a phone hides the last two searches, sits out. With reduced motion nothing
 * changes: the first lines simply stay.
 */

const FADE_MS = 540;

type Slot = { line: FoundLine; out: boolean; lit: number };

function useRotation(first: FoundLine[], next: FoundLine[], holds: number[], startMs: number, gapMs: number) {
    const [slots, setSlots] = useState<Slot[]>(() => first.map((line) => ({ line, out: false, lit: 0 })));
    const refs = useRef<(HTMLElement | null)[]>([]);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        let cursor = 0;
        const timers: number[] = [];
        const set = (i: number, patch: (s: Slot) => Slot) =>
            setSlots((all) => all.map((s, k) => (k === i ? patch(s) : s)));

        first.forEach((_, i) => {
            const tick = () => {
                const el = refs.current[i];
                if (el && el.offsetParent !== null) {
                    set(i, (s) => ({ ...s, out: true }));
                    timers.push(
                        window.setTimeout(() => {
                            const line = next[cursor % next.length];
                            cursor++;
                            set(i, (s) => ({ line, out: false, lit: s.lit + 1 }));
                        }, FADE_MS),
                    );
                }
                timers.push(window.setTimeout(tick, holds[i % holds.length]));
            };
            timers.push(window.setTimeout(tick, startMs + i * gapMs));
        });
        return () => timers.forEach(clearTimeout);
    }, [first, next, holds, startMs, gapMs]);

    return { slots, refs };
}

export default function FindOut() {
    const searches = useRotation(SEARCHES_FIRST, SEARCHES_NEXT, SEARCH_HOLDS, 1800, 760);
    const asked = useRotation(ASKED_FIRST, ASKED_NEXT, ASKED_HOLDS, 2600, 1500);

    return (
        <section className="hp-wash">
            <div className="hp-wrap">
                <div className="home-head">
                    <h2 className="home-display">
                        What your customers are trying to <span className="home-em">find out.</span>
                    </h2>
                    <div className="home-head-copy">
                        <p className="home-lede">
                            Someone who needs a job done isn&apos;t browsing. They have a short list of questions, and they
                            call the company that answers them.
                        </p>
                    </div>
                </div>

                <div className="hp-band">
                    <h3 className="hp-group-h">
                        <HomeIcon name="search" />
                        What they&apos;re searching for
                    </h3>
                    <ul className="hp-sky" aria-label="Examples of what customers search for, changing every few seconds">
                        {searches.slots.map((s, i) => (
                            <li key={i}>
                                <div
                                    ref={(el) => {
                                        searches.refs.current[i] = el;
                                    }}
                                    className={`hp-slot${s.out ? " out" : ""}`}
                                >
                                    <p className="hp-q">
                                        <HomeIcon name="search" />
                                        <span>{s.line.text}</span>
                                    </p>
                                    <span className="hp-tag">{s.line.trade}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="hp-beat">
                        <p className="hp-beat-lead">Your site is built to be found for searches like these.</p>
                        <p className="hp-m-cut">
                            Your services and your towns get their own pages, and your customers&apos; questions get
                            straight answers, all written from what you tell us.
                        </p>
                    </div>
                </div>

                <div className="hp-band">
                    <h3 className="hp-group-h">
                        <Wave live />
                        What they&apos;re asking on calls
                    </h3>
                    <ul className="hp-said" aria-label="Examples of what customers ask on calls, changing every few seconds">
                        {asked.slots.map((s, i) => (
                            <li key={i}>
                                <div
                                    ref={(el) => {
                                        asked.refs.current[i] = el;
                                    }}
                                    className={`hp-slot${s.out ? " out" : ""}${s.lit > 0 ? " lit" : ""}`}
                                >
                                    {/* Keyed by how many lines this slot has shown, so the bar's flash
                                        replays on each new one while the slot itself fades back in. */}
                                    <p key={s.lit} className="hp-sq">
                                        &ldquo;{s.line.text}&rdquo;
                                    </p>
                                    <span className="hp-tag">{s.line.trade}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="hp-beat">
                        <p className="hp-beat-lead">
                            Your receptionist is built to answer the questions you&apos;d normally answer yourself.
                        </p>
                        <p className="hp-m-cut">Then it takes their details and leaves the money and the job to you.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
