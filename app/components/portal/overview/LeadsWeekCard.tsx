import { Card } from "../ui/Card";
import type { LeadWeek } from "@/app/lib/portal-overview-leads";
import { BigNumber, ByWidth, MonoLabel } from "./parts";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * "New leads this week": one count, its change on last week, a bar per day, and the split.
 *
 * The per-day bars are on the Growth desktop board only — the Starter and phone boards leave
 * them out — so they render on Growth at desktop width. Days still to come draw no bar;
 * today's is lighter, because it is still counting.
 */
export function LeadsWeekCard({
    week,
    todayIndex,
    chart,
}: {
    week: LeadWeek;
    todayIndex: number;
    chart: boolean;
}) {
    const more = week.total - week.previousTotal;
    const max = Math.max(1, ...week.perDay);

    return (
        <Card as="section" density="none" className="p-3.5 lg:p-[18px]" style={{ minWidth: 0 }}>
            <MonoLabel id="ov-week">New leads this week</MonoLabel>

            <div className="flex items-baseline gap-2.5 lg:gap-3 mt-2 mb-2.5 lg:mt-2.5 lg:mb-1">
                <span className="lg:hidden">
                    <BigNumber size={44}>{week.total}</BigNumber>
                </span>
                <span className="hidden lg:inline">
                    <BigNumber size={52}>{week.total}</BigNumber>
                </span>
                {/* Approved for a rise only. A fall or a flat week renders nothing until wording
                    for it is approved — TODO(wording), listed in the PR. --chart-pos on white
                    is 6.27:1. */}
                {more > 0 && (
                    <span style={{ color: "var(--chart-pos)", fontSize: "12px", fontWeight: 600 }}>
                        <ByWidth desktop={`▲ ${more} more than last week`} phone={`▲ ${more} more`} />
                    </span>
                )}
            </div>

            {chart && <div className="hidden lg:block">
                <svg
                    width="100%"
                    height="56"
                    viewBox="0 0 280 56"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`Leads per day this week: ${week.perDay.slice(0, todayIndex + 1).join(", ")}`}
                >
                    {week.perDay.map((n, i) => {
                        if (i > todayIndex || n === 0) return null;
                        const h = Math.max(6, Math.round((n / max) * 48));
                        return (
                            <rect
                                key={i}
                                x={4 + i * 40}
                                y={56 - h}
                                width="30"
                                height={h}
                                rx="3"
                                fill="var(--accent)"
                                opacity={i === todayIndex ? 0.45 : 1}
                            />
                        );
                    })}
                </svg>
                <div
                    aria-hidden="true"
                    className="grid grid-cols-7 text-center mb-2"
                    // --chart-neutral on white: 5.44:1, at 10px mono.
                    style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--chart-neutral)" }}
                >
                    {DAY_LETTERS.map((d, i) => (
                        <span key={i}>{d}</span>
                    ))}
                </div>
            </div>}

            <Split
                label={<ByWidth desktop="Calls your receptionist answered" phone="Answered by your receptionist" />}
                value={week.calls}
            />
            <Split label="Web enquiries" value={week.web} />
            {/* Hidden, not zeroed, while the client's hours are unknown. See `isAfterHours`. */}
            {week.afterHours !== null && <Split label="Came in after hours" value={week.afterHours} />}
        </Card>
    );
}

function Split({ label, value }: { label: React.ReactNode; value: number }) {
    return (
        <div
            className="flex justify-between items-center py-[9px]"
            style={{ borderTop: "1px solid var(--rule-weak)", fontSize: "13px" }}
        >
            <span>{label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{value}</span>
        </div>
    );
}
