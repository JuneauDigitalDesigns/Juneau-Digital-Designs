"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, Section } from "@/app/lib/legal/types";

interface Props {
    sections: Section[];
    /** Fires once, when the end of the terms scrolls into view. */
    onComplete: () => void;
    /** Container height in px. */
    height?: number;
}

export default function TermsReader({ sections, onComplete, height = 520 }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0);
    const [done, setDone] = useState(false);

    // Latched in a ref as well as state: onComplete must fire exactly once even
    // if the observer re-triggers while React is still committing the setState.
    const firedRef = useRef(false);

    const finish = useCallback(() => {
        if (firedRef.current) return;
        firedRef.current = true;
        setDone(true);
        setProgress(1);
        onComplete();
    }, [onComplete]);

    // Completion is detected with an IntersectionObserver on a sentinel at the
    // end of the content rather than comparing scrollTop + clientHeight to
    // scrollHeight — that arithmetic is off by fractions of a pixel at non-100%
    // zoom and on fractional device pixel ratios, which makes the gate
    // intermittently impossible to satisfy.
    useEffect(() => {
        const root = scrollRef.current;
        const sentinel = sentinelRef.current;
        if (!root || !sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) finish();
            },
            { root, threshold: 0.9 },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [finish]);

    function handleScroll() {
        const el = scrollRef.current;
        if (!el || done) return;
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max <= 0 ? 1 : Math.min(1, el.scrollTop / max));
    }

    return (
        <div
            style={{
                background: "var(--surface)",
                border: `1px solid ${done ? "var(--accent)" : "var(--rule)"}`,
                borderRadius: 12,
                overflow: "hidden",
                transition: "border-color 200ms ease",
            }}
        >
            {/* Read-progress bar */}
            <div style={{ height: 3, background: "var(--rule)", position: "relative" }}>
                <div
                    style={{
                        height: "100%",
                        width: `${Math.round(progress * 100)}%`,
                        background: "var(--accent)",
                        transition: "width 120ms linear",
                    }}
                />
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                tabIndex={0}
                role="region"
                aria-label="Services Agreement terms"
                style={{
                    height,
                    overflowY: "auto",
                    padding: "26px 30px 0",
                    fontSize: 13,
                    lineHeight: 1.62,
                    color: "var(--fg-2)",
                }}
            >
                {sections.map((section) => (
                    <section key={`${section.num}-${section.heading}`} style={{ marginBottom: 26 }}>
                        <h2
                            style={{
                                fontSize: 13.5,
                                fontWeight: 600,
                                color: "var(--fg)",
                                margin: "0 0 4px",
                                letterSpacing: "0.01em",
                            }}
                        >
                            {section.num === 0 ? section.heading : `${section.num}. ${section.heading}`}
                        </h2>
                        <div
                            style={{
                                height: 1,
                                background: "var(--rule)",
                                margin: "0 0 12px",
                            }}
                        />

                        {section.intro.map((block, i) => (
                            <BlockView key={i} block={block} />
                        ))}

                        {section.subsections.map((sub) => (
                            <div key={sub.num + sub.heading} style={{ marginTop: 14 }}>
                                <h3
                                    style={{
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        color: "var(--fg)",
                                        margin: "0 0 5px",
                                    }}
                                >
                                    {sub.num ? `${sub.num} ${sub.heading}` : sub.heading}
                                </h3>
                                {sub.blocks.map((block, i) => (
                                    <BlockView key={i} block={block} />
                                ))}
                            </div>
                        ))}
                    </section>
                ))}

                <div
                    ref={sentinelRef}
                    style={{
                        paddingBottom: 26,
                        textAlign: "center",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.06em",
                        color: "var(--fg-3)",
                    }}
                >
                    — END OF AGREEMENT —
                </div>
            </div>

            <div
                style={{
                    borderTop: "1px solid var(--rule)",
                    padding: "10px 16px",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.05em",
                    color: done ? "var(--accent)" : "var(--fg-3)",
                }}
                aria-live="polite"
            >
                {done
                    ? "✓ AGREEMENT READ IN FULL"
                    : `SCROLL TO THE END TO CONTINUE — ${Math.round(progress * 100)}%`}
            </div>
        </div>
    );
}

function BlockView({ block }: { block: Block }) {
    switch (block.kind) {
        case "para":
            return <p style={{ margin: "0 0 9px" }}>{block.text}</p>;

        case "bullets":
            return (
                <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
                    {block.items.map((item, i) => (
                        <li key={i} style={{ marginBottom: 5 }}>
                            {item}
                        </li>
                    ))}
                </ul>
            );

        case "table":
            return (
                <div style={{ margin: "0 0 12px" }}>
                    {block.rows.map(([label, value], i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 16,
                                padding: "7px 0",
                                borderBottom: "1px solid var(--rule)",
                            }}
                        >
                            <span>{label}</span>
                            <span style={{ color: "var(--fg)", fontWeight: 500, textAlign: "right" }}>
                                {value}
                            </span>
                        </div>
                    ))}
                </div>
            );

        case "callout":
            return (
                <div
                    style={{
                        margin: "10px 0 12px",
                        padding: "14px 16px",
                        border: "1px solid var(--rule)",
                        borderLeft: "3px solid var(--accent)",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.02)",
                        color: "var(--fg)",
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1.55,
                    }}
                >
                    {block.text}
                </div>
            );

        case "allcaps":
            return (
                <p
                    style={{
                        margin: "0 0 10px",
                        color: "var(--fg)",
                        fontWeight: 600,
                        fontSize: 12,
                        lineHeight: 1.55,
                    }}
                >
                    {block.text}
                </p>
            );
    }
}
