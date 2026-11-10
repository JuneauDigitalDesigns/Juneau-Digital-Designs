import type { InboxItem } from "@/app/lib/crm-contacts";
import { duration } from "@/app/lib/duration";
import { REASON_LABEL, reasonFor, remindChip, type InboxRow } from "./model";

/**
 * The small labels on a row and in the pane.
 *
 * Every wash is mixed into `--elev-1` rather than laid over whatever is underneath, so the
 * chip is the same colour on a plain row, a hovered row and the selected row's accent tint.
 * Text on the resulting fill, worst case (measured on that opaque mix):
 *   --chart-warn on a 10% warn mix   5.28:1
 *   --accent     on an 8% accent mix 4.65:1  (4.28 if the wash were translucent over the
 *                                             selected row — the reason it is opaque)
 *   --chart-neg  on an 8% neg mix    5.37:1
 *   --chart-pos  on an 8% pos mix    5.57:1
 *   --chart-series-2 on an 8% mix    5.06:1
 */
type Tone = "warn" | "accent" | "neg" | "pos" | "violet";

const TONE: Record<Tone, { color: string; mix: number }> = {
    warn: { color: "var(--chart-warn)", mix: 10 },
    accent: { color: "var(--accent)", mix: 8 },
    neg: { color: "var(--chart-neg)", mix: 8 },
    pos: { color: "var(--chart-pos)", mix: 8 },
    violet: { color: "var(--chart-series-2)", mix: 8 },
};

export function Chip({
    tone,
    children,
    size = "sm",
}: {
    tone: Tone;
    children: React.ReactNode;
    size?: "sm" | "md";
}) {
    const t = TONE[tone];
    return (
        <span
            className={`inline-flex items-center shrink-0 rounded-full font-semibold whitespace-nowrap ${
                size === "md" ? "text-xs px-2.5 py-0.5" : "text-[11px] px-[7px] py-px"
            }`}
            style={{
                color: t.color,
                background: `color-mix(in srgb, ${t.color} ${t.mix}%, var(--elev-1))`,
            }}
        >
            {children}
        </span>
    );
}

/** The one status chip a row carries: why it is waiting, or where it went. */
export function StatusChip({
    row,
    item,
    now,
    size,
}: {
    row: Pick<InboxRow, "status">;
    item: InboxItem;
    now: Date;
    size?: "sm" | "md";
}) {
    if (row.status === "done") return <Chip tone="pos" size={size}>Done</Chip>;
    if (row.status === "promoted") return <Chip tone="pos" size={size}>✓ Promoted</Chip>;
    if (row.status === "reminded" && item.remindAt) {
        return (
            <Chip tone="violet" size={size}>
                {remindChip(item.remindAt, now)}
            </Chip>
        );
    }
    const reason = reasonFor(item);
    return (
        <Chip tone={reason === "callback" ? "warn" : reason === "web" ? "accent" : "neg"} size={size}>
            {REASON_LABEL[reason]}
        </Chip>
    );
}

/** Mono outline chip: the kind of lead, the recording length, the run size. */
export function Mini({ children }: { children: React.ReactNode }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full border px-[7px] py-px text-[10.5px] whitespace-nowrap"
            style={{
                fontFamily: "var(--font-mono)",
                color: "var(--fg-2)",
                borderColor: "var(--rule-strong)",
            }}
        >
            {children}
        </span>
    );
}

export function kindLabel(item: InboxItem): string {
    return item.source === "web-form" ? "Web form" : "Call";
}

/** "▶ 1m 58s" when there is something to play; the length is `duration()`, as everywhere. */
export function recordingLength(item: InboxItem): string | null {
    if (!item.recordingUrl) return null;
    return duration(item.durationSeconds);
}
