import { Fragment, type CSSProperties, type ReactNode } from "react";

/**
 * 2 · "Every piece feeds the next." The short version of what we do, straight after the hero, in
 * place of the paragraph the hero used to carry. Approved by Xander from three rounds of a mockup on
 * 26 Nov 2026 (https://claude.ai/artifact/Hviy8YQTmrbpbZ4o5XsKTu, version 4): "Approve, build it".
 * `test/homepage.test.mjs` pins every line; nothing here may be reworded without a fresh approval.
 *
 * It is the loop from his cold-email flyer, with its four drawings as drawn there: the website, the
 * receptionist, the customers you win, the reviews they leave, and "More people find you" back to
 * the start. Two changes from the flyer, both approved: the site speaks as "we", not "I"; and the
 * review step names Growth, the plan that sends review requests.
 *
 * One list, two layouts (CSS only). Above 980px the four steps sit in a row and the way back is a
 * line underneath, broken by its words, never drawn behind them (Xander). At 980px and under they
 * sit in the flyer's square loop ("the square loop is perfect"), the arrows turned to follow it.
 * The arrows, then the words on the way back, light up one after another so the eye goes round;
 * with reduced motion everything rests at full strength. Styles are `.hp-loop*` in globals.css.
 */

/* The flyer's star, used by two of the drawings. */
function Stars({ x, y, size, gap }: { x: number; y: number; size: number; gap: number }) {
    return (
        <g fill="#d2542f">
            {[0, 1, 2, 3, 4].map((i) => (
                <svg key={i} x={x + i * gap} y={y} width={size} height={size} viewBox="0 0 24 24">
                    <path d="M12 2.2l2.95 6.1 6.7.85-4.95 4.6 1.3 6.65L12 17.15l-6 3.25 1.3-6.65-4.95-4.6 6.7-.85z" />
                </svg>
            ))}
        </g>
    );
}

const WEBSITE = (
    <>
        <rect x="2" y="2" width="146" height="104" rx="9" fill="#fbf5e6" stroke="#14120c" strokeWidth="3" />
        <line x1="2" y1="22" x2="148" y2="22" stroke="#14120c" strokeWidth="2" />
        <circle cx="14" cy="12" r="3.6" fill="#d2542f" />
        <circle cx="25" cy="12" r="3.6" fill="#c9bb98" />
        <circle cx="36" cy="12" r="3.6" fill="#c9bb98" />
        <rect x="14" y="33" width="64" height="12" rx="2" fill="#14120c" />
        <rect x="14" y="52" width="108" height="6" rx="3" fill="#d6c8a6" />
        <rect x="14" y="63" width="84" height="6" rx="3" fill="#d6c8a6" />
        <rect x="14" y="79" width="66" height="18" rx="9" fill="#d2542f" />
        <path
            d="M33.5 84.2c.4-.4 1-.4 1.4 0l1.3 1.3c.4.4.4 1 0 1.4l-.7.7c.7 1.3 1.6 2.2 2.9 2.9l.7-.7c.4-.4 1-.4 1.4 0l1.3 1.3c.4.4.4 1 0 1.4l-.9.9c-.6.6-1.5.7-2.2.3-2.4-1.3-4.3-3.2-5.6-5.6-.4-.7-.3-1.6.3-2.2z"
            fill="#fbf5e6"
        />
        <rect x="45" y="86" width="26" height="4" rx="2" fill="#fbf5e6" />
        <Stars x={86} y={80} size={10} gap={11} />
    </>
);

const RECEPTIONIST = (
    <>
        <rect x="2" y="2" width="80" height="136" rx="15" fill="#14120c" />
        <rect x="8" y="14" width="68" height="112" rx="7" fill="#2b271c" />
        <rect x="32" y="6.5" width="20" height="3" rx="1.5" fill="#4d4836" />
        <circle cx="42" cy="32" r="5" fill="#3f8f5c" />
        <circle cx="42" cy="32" r="9" fill="none" stroke="#3f8f5c" strokeWidth="1.5" opacity=".5" />
        <g fill="#d2542f">
            <rect x="16" y="73" width="5" height="14" rx="2.5" />
            <rect x="24" y="65" width="5" height="30" rx="2.5" />
            <rect x="32" y="57" width="5" height="46" rx="2.5" />
            <rect x="40" y="52" width="5" height="56" rx="2.5" />
            <rect x="48" y="60" width="5" height="40" rx="2.5" />
            <rect x="56" y="67" width="5" height="26" rx="2.5" />
            <rect x="64" y="74" width="5" height="12" rx="2.5" />
        </g>
        <rect x="27" y="111" width="30" height="8" rx="4" fill="#3f8f5c" />
    </>
);

const CUSTOMERS = (
    <>
        <g fill="#43402c">
            <circle cx="40" cy="40" r="15" />
            <path d="M12 104c0-19 12.5-34 28-34s28 15 28 34z" />
            <circle cx="110" cy="40" r="15" />
            <path d="M82 104c0-19 12.5-34 28-34s28 15 28 34z" />
        </g>
        <g fill="#14120c" stroke="#f4ecd8" strokeWidth="4">
            <circle cx="75" cy="32" r="19" />
            <path d="M38 106c0-24 16.5-42 37-42s37 18 37 42z" />
        </g>
        <circle cx="130" cy="20" r="17" fill="#d2542f" />
        <path d="M130 11v18M121 20h18" stroke="#fbf5e6" strokeWidth="4" strokeLinecap="round" />
    </>
);

const REVIEWS = (
    <>
        <rect x="2" y="16" width="156" height="78" rx="10" fill="#fbf5e6" stroke="#14120c" strokeWidth="3" />
        <path d="M34 92l-6 15 20-13z" fill="#fbf5e6" stroke="#14120c" strokeWidth="3" strokeLinejoin="round" />
        <rect x="20" y="88" width="40" height="5" fill="#fbf5e6" />
        <Stars x={14} y={30} size={26} gap={27} />
        <rect x="18" y="66" width="112" height="6" rx="3" fill="#d6c8a6" />
        <rect x="18" y="77" width="78" height="6" rx="3" fill="#d6c8a6" />
    </>
);

const STEPS: { art: ReactNode; w: number; h: number; heading: string; body: string }[] = [
    { art: WEBSITE, w: 150, h: 108, heading: "We build your website", body: "Look the part. Easy to call." },
    { art: RECEPTIONIST, w: 84, h: 140, heading: "Our AI receptionist answers", body: "Picks up the calls you miss." },
    { art: CUSTOMERS, w: 150, h: 108, heading: "You win more customers", body: "From calls you used to lose." },
    { art: REVIEWS, w: 160, h: 108, heading: "More customers, more reviews", body: "On Growth, ask every happy customer for one in a tap." },
];

/* One arrow, drawn pointing right; CSS turns the second and third to follow the square loop. */
function Arrow({ n }: { n: number }) {
    return (
        <div className={`hp-loop-arr hp-loop-arr${n}`} aria-hidden="true">
            <svg viewBox="0 0 46 24" width="46" height="24">
                <path d="M2 12h38M30 3l10 9-10 9" />
            </svg>
        </div>
    );
}

export default function TheLoop() {
    return (
        <section aria-labelledby="hp-loop-h">
            <div className="hp-wrap hp-loop-wrap">
                <div className="home-head">
                    <h2 id="hp-loop-h" className="home-display">
                        Every piece <span className="home-em">feeds the next.</span>
                    </h2>
                </div>
                <div className="hp-loop">
                    {STEPS.map((s, i) => (
                        <Fragment key={s.heading}>
                            <div className={`hp-loop-step hp-loop-step${i + 1}`}>
                                <div className="hp-loop-art" aria-hidden="true">
                                    <svg viewBox={`0 0 ${s.w} ${s.h}`} style={{ "--w": s.w, "--h": s.h } as CSSProperties}>
                                        {s.art}
                                    </svg>
                                </div>
                                <h3>{s.heading}</h3>
                                <p>{s.body}</p>
                            </div>
                            {i < 3 && <Arrow n={i + 1} />}
                        </Fragment>
                    ))}
                    {/* The way back. A row, it is a line under the four with its words as a break in it;
                        in the square loop, an arrow up from the reviews to the website. */}
                    <div className="hp-loop-back">
                        <span className="hp-loop-seg hp-loop-seg-l" aria-hidden="true" />
                        <svg className="hp-loop-up" viewBox="0 0 22 44" aria-hidden="true">
                            <path d="M11 42V4M2 13l9-10 9 10" />
                        </svg>
                        <span className="hp-loop-back-words">More people find you</span>
                        <span className="hp-loop-seg hp-loop-seg-r" aria-hidden="true" />
                    </div>
                </div>
                <div className="hp-loop-cue">
                    <p>Keep scrolling to find out exactly how we make this happen.</p>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 4v15M5 12l7 7 7-7" />
                    </svg>
                </div>
            </div>
        </section>
    );
}
