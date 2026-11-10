import Link from "next/link";
import { Card } from "../ui/Card";
import { STAGE_COLOR, STAGE_LABEL } from "../crm/stages";
import {
    OPEN_STAGES,
    dollars,
    type PipelineSummary,
    type StageTotal,
} from "@/app/lib/portal-overview-pipeline";
import { BigNumber, ByWidth, CardHead, CardTitle, HeadLink, MonoLabel, PlayIcon } from "./parts";

/**
 * Growth: "Your pipeline" — count and dollars per stage, the stacked bar, and the going-quiet
 * chip. Stage colours are the board's own (`crm/stages.ts`), so a stage reads the same here as
 * on the board it links to.
 *
 * Dollars are Growth-only by Xander's decision, and this card only renders on Growth. A stage
 * with no typed-in values shows "—", as the mockup's Lead column does, not "$0".
 *
 * Contrast: the Won column's figure is --chart-pos on a 4% pos wash over white, ≈5.9:1; the
 * going-quiet chip is --chart-warn on a 10% wash, 5.28:1.
 */
export function PipelineCard({
    summary,
    customersHref,
}: {
    summary: PipelineSummary;
    customersHref: string;
}) {
    const columns: { key: string; label: string; color: string; total: StageTotal; won?: boolean }[] = [
        ...OPEN_STAGES.map((s) => ({
            key: s,
            label: STAGE_LABEL[s],
            color: STAGE_COLOR[s],
            total: summary.open[s],
        })),
        {
            key: "won",
            label: "Won this week",
            color: STAGE_COLOR.won,
            total: summary.wonThisWeek,
            won: true,
        },
    ];
    const quiet = summary.goingQuiet;
    const staleHref = `${customersHref}&stale=1`;

    return (
        <Card density="none" className="overflow-hidden">
            <section aria-labelledby="ov-pipe">
                <CardHead
                    action={
                        <span className="flex gap-3.5 items-center">
                            {quiet > 0 && (
                                <span
                                    className="hidden lg:inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
                                    style={{
                                        fontSize: "11px",
                                        fontWeight: 500,
                                        color: "var(--chart-warn)",
                                        background: "color-mix(in srgb, var(--chart-warn) 10%, transparent)",
                                    }}
                                >
                                    <Dot color="var(--chart-warn)" />
                                    {quiet} going quiet
                                </span>
                            )}
                            <HeadLink href={customersHref}>
                                <ByWidth desktop="Open customers →" phone="Customers →" />
                            </HeadLink>
                        </span>
                    }
                >
                    <CardTitle id="ov-pipe">Your pipeline</CardTitle>
                </CardHead>

                {/* Desktop: five columns and the stacked bar. */}
                <div className="hidden lg:block">
                    <div className="flex">
                        {columns.map((c, i) => (
                            <div
                                key={c.key}
                                className="flex-1 min-w-0 px-4 py-3.5 flex flex-col gap-1.5"
                                style={{
                                    borderLeft: i === 0 ? undefined : "1px solid var(--rule-weak)",
                                    background: c.won
                                        ? "color-mix(in srgb, var(--chart-pos) 4%, transparent)"
                                        : undefined,
                                }}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <Dot color={c.color} />
                                    <MonoLabel>{c.label}</MonoLabel>
                                </span>
                                <BigNumber size={26} color={c.won ? "var(--chart-pos)" : undefined}>
                                    {c.total.count}
                                </BigNumber>
                                <span style={{ fontSize: "12px", color: "var(--fg-3)" }}>
                                    {c.total.value === null ? "—" : dollars(c.total.value)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div
                        aria-hidden="true"
                        className="flex gap-0.5 mx-4 mb-4 overflow-hidden"
                        style={{ height: 8, borderRadius: 999 }}
                    >
                        {columns.map((c, i) =>
                            summary.shares[i] > 0 ? (
                                <span
                                    key={c.key}
                                    style={{ width: `${summary.shares[i] * 100}%`, background: c.color }}
                                />
                            ) : null,
                        )}
                    </div>
                </div>

                {/* Phone: one row per stage, as OverviewPhone.dc.html. */}
                <ul className="lg:hidden">
                    {columns.map((c, i) => (
                        <li
                            key={c.key}
                            className="flex justify-between items-center px-3.5 py-2.5"
                            style={{
                                borderTop: i === 0 ? undefined : "1px solid var(--rule-weak)",
                                fontSize: "13px",
                                color: c.won ? "var(--chart-pos)" : undefined,
                                fontWeight: c.won ? 600 : undefined,
                            }}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <Dot color={c.color} />
                                {c.label}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                                {c.total.count}
                                {c.total.value !== null && ` · ${dollars(c.total.value)}`}
                            </span>
                        </li>
                    ))}
                    {quiet > 0 && (
                        <li
                            className="flex justify-between items-center px-3.5 py-2.5"
                            style={{ borderTop: "1px solid var(--rule-weak)", fontSize: "13px", color: "var(--chart-warn)" }}
                        >
                            <span>
                                {quiet} {quiet === 1 ? "customer" : "customers"} going quiet
                            </span>
                            <Link href={staleHref} style={{ color: "var(--accent)" }}>
                                See who
                            </Link>
                        </li>
                    )}
                </ul>
            </section>
        </Card>
    );
}

function Dot({ color }: { color: string }) {
    return (
        <span
            aria-hidden="true"
            className="inline-block shrink-0"
            style={{ width: 8, height: 8, borderRadius: "50%", background: color }}
        />
    );
}

/**
 * Starter: "What happens after the call" — the locked pipeline, and the way into the demo.
 *
 * Links to `/portal/customers?site=…&demo=growth`, which PR C makes open the Growth demo on
 * arrival. The button label is the existing approved "Show me what Growth does for me".
 * The hatched columns are decoration (`aria-hidden`), echoing the board it unlocks.
 */
export function GrowthLockedPanel({ demoHref }: { demoHref: string }) {
    return (
        <Card density="none" className="p-4 lg:p-[22px] flex flex-col lg:flex-row gap-5 lg:gap-7 lg:items-center">
            <section aria-labelledby="ov-locked" className="flex-1 flex flex-col gap-2">
                <MonoLabel>What happens after the call</MonoLabel>
                <h2
                    id="ov-locked"
                    style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: "22px",
                        letterSpacing: "normal",
                        lineHeight: 1.2,
                        margin: 0,
                    }}
                >
                    Track every job from first call to a Google review
                </h2>
                <p style={{ fontSize: "13.5px", color: "var(--fg-2)", lineHeight: 1.4, margin: 0 }}>
                    Growth adds a pipeline, texting from your business number and one-tap review
                    requests. See it working with sample customers.
                </p>
                <div className="flex gap-2.5 mt-1.5">
                    <Link
                        href={demoHref}
                        className="inline-flex items-center gap-2 h-[42px] px-4 rounded-lg hover:opacity-90"
                        style={{
                            background: "var(--accent)",
                            color: "var(--on-accent)",
                            fontWeight: 600,
                            fontSize: "14px",
                        }}
                    >
                        <PlayIcon />
                        Show me what Growth does for me
                    </Link>
                </div>
            </section>
            <div aria-hidden="true" className="hidden lg:flex gap-2" style={{ width: 420 }}>
                {[0, 1, 2, 3].map((i) => (
                    <span
                        key={i}
                        className="flex-1"
                        style={{
                            height: 120,
                            borderRadius: 8,
                            border: "1.5px dashed var(--rule-strong)",
                            background:
                                "repeating-linear-gradient(135deg, var(--surface) 0 8px, transparent 8px 16px)",
                        }}
                    />
                ))}
            </div>
        </Card>
    );
}
