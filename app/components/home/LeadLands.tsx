"use client";

import { useEffect, useRef, useState } from "react";
import HomeIcon from "./HomeIcon";
import { DEMO_LEAD } from "@/app/data/portal-demo";
import { TRADE_SAMPLES, type SampleTrade } from "@/app/data/trade-samples";

/**
 * 6 · "And nothing slips." Replaces the homepage portal demo (Xander, 19 Nov 2026: show the
 * outcome, not a walkthrough). Approved from the homepage mockup, rounds 1-3.
 *
 * One inbox, drawn the way the portal draws a row, turning through the six trades every few
 * seconds; a click on a trade holds it. Its leads are the portal tour's sample leads
 * (`trade-samples.ts`), so a plumber sees plumbing leads. Beside it, "Your phone": the top of a
 * handset with the text the owner gets, which buzzes each time a lead lands. The text is the first
 * two lines of the real post-call text (`callBriefBodyV2`), cut off as a phone cuts a preview;
 * `test/homepage.test.mjs` holds it to that builder, so it can never read nicer than the real one.
 */

export const TEXT_PREVIEW = { title: "New call lead in your portal", line: `Name: ${DEMO_LEAD.name}` };

const TRADES: { id: SampleTrade; label: string }[] = [
    { id: "hvac", label: "HVAC" },
    { id: "plumbing", label: "Plumbing" },
    { id: "roofing", label: "Roofing" },
    { id: "lawn-care", label: "Lawn care" },
    { id: "pressure-washing", label: "Pressure washing" },
    { id: "car-detailing", label: "Detailing" },
];

const TURN_MS = 4800;
const SWAP_MS = 360;

export default function LeadLands() {
    const [picked, setPicked] = useState(0);
    const [shown, setShown] = useState(0);
    const [swapping, setSwapping] = useState(false);
    /* Bumped each time a lead lands: it re-keys the first row and the phone, which replays the
       row's arrival flash and the phone's buzz. 0 on load, so the phone starts still. */
    const [landed, setLanded] = useState(0);
    const auto = useRef(true);
    const swapTimer = useRef(0);

    /* The inbox fades out, takes the new trade's leads, and fades back in as the lead lands. */
    function pick(i: number) {
        setPicked(i);
        setSwapping(true);
        clearTimeout(swapTimer.current);
        swapTimer.current = window.setTimeout(() => {
            setShown(i);
            setSwapping(false);
            setLanded((n) => n + 1);
        }, SWAP_MS);
    }

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) auto.current = false;
        return () => clearTimeout(swapTimer.current);
    }, []);

    /* Turns to the next trade every few seconds, until someone picks one. */
    useEffect(() => {
        if (!auto.current) return;
        const t = window.setTimeout(() => {
            if (auto.current) pick((picked + 1) % TRADES.length);
        }, TURN_MS);
        return () => clearTimeout(t);
    }, [picked]);

    const sample = TRADE_SAMPLES[TRADES[shown].id];
    const [carol, jim] = sample.inbox;

    return (
        <section>
            <div className="hp-wrap">
                <div className="home-head">
                    <h2 className="home-display">
                        And <span className="home-em">nothing slips.</span>
                    </h2>
                    <div className="home-head-copy">
                        <p className="home-lede">
                            Every call and web inquiry lands in your portal, and you get a text the moment a new one arrives.
                        </p>
                    </div>
                </div>

                <div className="hp-tabs" role="group" aria-label="Show the inbox for a trade">
                    {TRADES.map((t, i) => (
                        <button
                            key={t.id}
                            type="button"
                            aria-pressed={picked === i}
                            onClick={() => {
                                auto.current = false;
                                if (i !== picked) pick(i);
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="hp-land">
                    <div className="hp-inbox" role="img" aria-label="Example: three leads in the portal inbox, for the trade selected above">
                        <div className="hp-inbox-top">
                            <b>Inbox</b>
                            <span className="hp-inbox-biz">{sample.business.name}</span>
                            <span className="hp-inbox-needs">Needs you</span>
                        </div>
                        <div className="hp-inbox-day">TODAY</div>
                        <div className={`hp-inbox-body${swapping ? " swap" : ""}`}>
                            <div key={landed} className="hp-irow unread fresh">
                                <span className="hp-dot" />
                                <div>
                                    <div className="hp-r1">
                                        <strong>{sample.lead.name}</strong>
                                        <span className="hp-st cb">Wants a callback</span>
                                        <time>2:13 AM</time>
                                    </div>
                                    <p className="hp-pv">{sample.lead.preview}</p>
                                    <span className="hp-mini">Call · {sample.lead.duration}</span>
                                </div>
                            </div>
                            <div className="hp-irow unread">
                                <span className="hp-dot" />
                                <div>
                                    <div className="hp-r1">
                                        <strong>{carol.name}</strong>
                                        <span className="hp-st web">Web inquiry</span>
                                        <time>{carol.time}</time>
                                    </div>
                                    <p className="hp-pv">{carol.preview}</p>
                                    <span className="hp-mini">{carol.tag}</span>
                                </div>
                            </div>
                            <div className="hp-irow hp-m-cut">
                                <span className="hp-dot" />
                                <div>
                                    <div className="hp-r1">
                                        <strong>{jim.name}</strong>
                                        <span className="hp-st cb">Wants a callback</span>
                                        <time>{jim.time}</time>
                                    </div>
                                    <p className="hp-pv">{jim.preview}</p>
                                    <span className="hp-mini">{jim.count} calls</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div key={landed} className={`hp-fone${landed > 0 ? " buzz" : ""}`} role="img" aria-label="Example: the text you get, shown on your phone">
                        <p className="hp-fone-lbl">Your phone</p>
                        <i className="hp-arc l" />
                        <i className="hp-arc l2" />
                        <i className="hp-arc r" />
                        <i className="hp-arc r2" />
                        <div className="hp-fone-body">
                            <div className="hp-fone-top" aria-hidden="true">
                                <span>2:13</span>
                                <i />
                                <span className="hp-fone-sig">
                                    <b />
                                    <b />
                                    <b />
                                </span>
                            </div>
                            <div className="hp-sms">
                                <span className="hp-sms-app">
                                    <HomeIcon name="msg" />
                                </span>
                                <p className="hp-sms-l1">
                                    <span>Messages</span>
                                    <span>now</span>
                                </p>
                                <p className="hp-sms-l2">
                                    <b>{TEXT_PREVIEW.title}</b>
                                    {TEXT_PREVIEW.line}…
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <p className="hp-eg hp-land-cap">Example leads. Example text.</p>
                <p className="hp-plans-line">
                    Every plan gets the inbox. <strong>Growth adds the pipeline, the texting and the reviews: the part a team would do.</strong>
                </p>
            </div>
        </section>
    );
}
