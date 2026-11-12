import Link from "next/link";
import { Card } from "../ui/Card";
import {
    REASON_LABEL,
    type NeedsReason,
    type NeedsYou,
    type NeedsYouRow,
} from "@/app/lib/portal-overview-leads";
import { msOf, whenLabel } from "@/app/lib/portal-overview-time";
import { ByWidth, CardHead, CardTitle, HeadLink, PhoneIcon } from "./parts";

/**
 * Chip colours, as `.w-cb` / `.w-web` / `.w-miss` in the mockup, from tokens.
 *
 * Contrast, text on its own wash over the white card (computed, WCAG relative luminance):
 *   callback  --chart-warn #9a4d04 on 10% wash  5.28:1
 *   web       --accent     #2563eb on 8% wash   4.63:1
 *   hung-up   --chart-neg  #c01c1c on 8% wash   5.39:1
 * All clear 4.5:1 for the 11.5px semibold chip text.
 */
const CHIP: Record<NeedsReason, { color: string; wash: string }> = {
    callback: { color: "var(--chart-warn)", wash: "10%" },
    web: { color: "var(--accent)", wash: "8%" },
    "hung-up": { color: "var(--chart-neg)", wash: "8%" },
};

/**
 * The mockup's preview for a call that left nothing ("Called and hung up before leaving
 * details."), used only when the row has no words of its own.
 */
const HUNG_UP_PREVIEW = "Called and hung up before leaving details.";

/**
 * "Needs you": the Inbox's worklist, its five newest rows, each with a Call back button.
 *
 * See `needsYou` for which leads count and why the order is newest first. The empty state is
 * the Inbox's approved "All caught up" wording, so clearing the list in either place reads
 * the same.
 */
export function NeedsYouCard({
    data,
    handledThisWeek,
    inboxHref,
    nowMs,
    timeZone,
}: {
    data: NeedsYou;
    handledThisWeek: number;
    inboxHref: string;
    nowMs: number;
    timeZone: string;
}) {
    return (
        <Card density="none" className="overflow-hidden" style={{ minWidth: 0 }}>
            <section aria-labelledby="ov-needs" data-tour="ov-needs">
                <CardHead
                    action={
                        <HeadLink href={inboxHref}>
                            <ByWidth desktop="Open inbox →" phone="Inbox →" />
                        </HeadLink>
                    }
                >
                    <CardTitle id="ov-needs">
                        Needs you
                        {data.total > 0 && (
                            <span
                                className="rounded-full px-2 py-px"
                                style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    // White on --accent: 5.17:1.
                                    background: "var(--accent)",
                                    color: "var(--on-accent)",
                                }}
                            >
                                {data.total}
                            </span>
                        )}
                    </CardTitle>
                </CardHead>

                {data.rows.length === 0 ? (
                    <CaughtUp handled={handledThisWeek} inboxHref={inboxHref} />
                ) : (
                    <ul>
                        {data.rows.map((row, i) => (
                            <li
                                key={row.id}
                                style={i === 0 ? undefined : { borderTop: "1px solid var(--rule-weak)" }}
                            >
                                <Row row={row} nowMs={nowMs} timeZone={timeZone} />
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </Card>
    );
}

function Row({ row, nowMs, timeZone }: { row: NeedsYouRow; nowMs: number; timeZone: string }) {
    const t = msOf(row.at);
    const when = t === null ? null : whenLabel(t, nowMs, timeZone, "long");
    const chip = CHIP[row.reason];
    const preview = row.preview ?? (row.reason === "hung-up" ? HUNG_UP_PREVIEW : null);
    const who = row.name ?? row.phoneDisplay;

    return (
        <div className="flex flex-col gap-1.5 px-3.5 py-3 lg:flex-row lg:items-center lg:gap-3.5 lg:px-[18px] lg:py-[13px]">
            <span
                aria-hidden="true"
                className="hidden lg:flex items-center justify-center shrink-0"
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--surface)",
                    color: "var(--fg-2)",
                    fontWeight: 600,
                    fontSize: 13,
                }}
            >
                {row.initials}
            </span>

            <div className="flex-1 min-w-0 flex flex-col gap-1 lg:gap-[3px]">
                <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                    <strong className="truncate" style={{ color: "var(--fg)" }}>
                        {who}
                    </strong>
                    {/* On a phone the chip drops to its own line under the name, as the phone
                        board draws it; the wrapper takes the line so the chip keeps its width. */}
                    <span className="order-last lg:order-none basis-full lg:basis-auto flex">
                        <span
                            className="inline-flex items-center rounded-full px-2 py-0.5"
                            style={{
                                fontSize: "11.5px",
                                fontWeight: 600,
                                color: chip.color,
                                background: `color-mix(in srgb, ${chip.color} ${chip.wash}, transparent)`,
                            }}
                        >
                            {REASON_LABEL[row.reason]}
                        </span>
                    </span>
                    {when && (
                        <span className="ml-auto lg:ml-0" style={{ color: "var(--fg-3)", fontSize: "var(--text-sm)" }}>
                            {when}
                            {/* Never rendered today: `afterHours` is null until a client's hours
                                are stored. See `isAfterHours`. */}
                            {row.afterHours === true && " · after hours"}
                        </span>
                    )}
                </div>
                {preview && (
                    <p
                        className="lg:truncate line-clamp-2 lg:line-clamp-none"
                        style={{ fontSize: "13px", color: "var(--fg-2)", lineHeight: 1.4, margin: 0 }}
                    >
                        {preview}
                    </p>
                )}
            </div>

            {row.dialNumber && (
                <a
                    href={`tel:${row.dialNumber}`}
                    className="inline-flex items-center justify-center gap-2 shrink-0 w-full h-11 rounded-lg text-sm lg:w-auto lg:h-9 lg:px-3.5 lg:rounded-md lg:text-[13px] hover:opacity-90"
                    style={{
                        background: "var(--accent)",
                        color: "var(--on-accent)",
                        fontWeight: 600,
                        border: "1px solid var(--accent)",
                    }}
                    aria-label={`Call back ${who}`}
                >
                    <PhoneIcon />
                    Call back
                </a>
            )}
        </div>
    );
}

/** The Inbox's approved empty state (copy draft, batch 2, "Empty state"). */
function CaughtUp({ handled, inboxHref }: { handled: number; inboxHref: string }) {
    return (
        <div className="px-[18px] py-8 text-center flex flex-col items-center gap-1.5">
            <p style={{ fontWeight: 600, color: "var(--fg)", margin: 0 }}>All caught up</p>
            <p style={{ color: "var(--fg-3)", fontSize: "13px", margin: 0 }}>
                {handled} {handled === 1 ? "lead" : "leads"} handled this week. New ones will show up here.
            </p>
            <Link
                href={`${inboxHref}&f=all`}
                className="text-[13px] mt-1 hover:underline"
                style={{ color: "var(--accent)" }}
            >
                See everything
            </Link>
        </div>
    );
}
