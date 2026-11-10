import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { BigNumber, ByWidth, MonoLabel } from "./parts";

/**
 * The row of small figures under the lead cards.
 *
 * Every tile is optional, and a tile with nothing true to say is left out rather than shown
 * as "—" or 0: Callback speed with no callbacks this week, Caught after hours while the
 * client's hours are unknown, Longest wait with nothing waiting. The grid takes however many
 * remain. Labels and sub-lines are the approved copy; where the phone board words them
 * differently, `ByWidth` carries both.
 */

export interface TileSpec {
    key: string;
    label: ReactNode;
    value: ReactNode;
    sub?: ReactNode;
}

const LG_COLS: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
};

export function OverviewTiles({ tiles }: { tiles: TileSpec[] }) {
    if (tiles.length === 0) return null;
    return (
        <div className={`grid grid-cols-2 gap-2.5 lg:gap-3 ${LG_COLS[tiles.length] ?? "lg:grid-cols-4"}`}>
            {tiles.map((t) => (
                <Card key={t.key} density="none" className="p-3.5 lg:px-[18px] lg:py-4 flex flex-col gap-1.5 lg:gap-2 min-w-0">
                    <MonoLabel>{t.label}</MonoLabel>
                    <span className="lg:hidden">
                        <BigNumber size={24}>{t.value}</BigNumber>
                    </span>
                    <span className="hidden lg:inline">
                        <BigNumber size={30}>{t.value}</BigNumber>
                    </span>
                    {t.sub && (
                        // --fg-3 on white, 12px: 5.38:1.
                        <span style={{ fontSize: "12px", color: "var(--fg-3)", lineHeight: 1.4 }}>{t.sub}</span>
                    )}
                </Card>
            ))}
        </div>
    );
}

/* ── the approved tiles ───────────────────────────────────────────────────── */

export function callbackSpeedTile(value: string): TileSpec {
    return {
        key: "speed",
        label: "Callback speed",
        value,
        sub: (
            <ByWidth
                desktop="Average time for your receptionist to call a web lead back."
                phone="Web leads, on average"
            />
        ),
    };
}

export function afterHoursTile(count: number): TileSpec {
    return {
        key: "after-hours",
        label: <ByWidth desktop="Caught after hours" phone="After hours" />,
        value: count,
        sub: (
            <ByWidth
                desktop="Calls outside your opening hours that still got answered."
                phone="Calls still answered"
            />
        ),
    };
}

export function followUpsTile({
    count,
    first,
    firstHref,
    allHref,
}: {
    count: number;
    first: string | null;
    firstHref: string | null;
    allHref: string;
}): TileSpec {
    const link = { color: "var(--accent)" } as const;
    return {
        key: "follow-ups",
        label: <ByWidth desktop="Follow-ups due today" phone="Follow-ups today" />,
        value: count,
        sub:
            count === 0 || !first || !firstHref ? undefined : (
                <ByWidth
                    desktop={
                        <>
                            <Link href={firstHref} className="hover:underline" style={link}>
                                {first}
                            </Link>
                            {count > 1 && ` and ${count - 1} more`}
                        </>
                    }
                    phone={
                        <Link href={allHref} className="hover:underline" style={link}>
                            See them
                        </Link>
                    }
                />
            ),
    };
}

/**
 * "Reviews asked for". The approved sub-line is "This week. 2 left a review." — the second
 * sentence is dropped, because nothing records whether a review was left (Google does not
 * report it back). The phone board's sub-line was only that second half, so it has none.
 */
export function reviewsTile(count: number): TileSpec {
    return {
        key: "reviews",
        label: <ByWidth desktop="Reviews asked for" phone="Reviews asked" />,
        value: count,
        sub: <span className="hidden lg:inline">This week.</span>,
    };
}

export function handledTile(handled: number, total: number): TileSpec {
    return {
        key: "handled",
        label: "Handled this week",
        value: `${handled} of ${total}`,
        sub: "Leads you’ve called back or marked done.",
    };
}

export function longestWaitTile(value: string, who: string, since: string): TileSpec {
    return {
        key: "longest-wait",
        label: "Longest wait",
        value,
        sub: `${who} has been waiting since ${since}.`,
    };
}
