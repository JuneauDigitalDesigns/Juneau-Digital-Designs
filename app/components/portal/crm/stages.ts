/**
 * Pipeline vocabulary shared by the board, the table, and the record drawer.
 *
 * Colours are the portal's own chart tokens rather than new values — `--chart-neutral`,
 * `--accent`, `--chart-series-2`, `--chart-warn`, `--chart-pos`, `--chart-neg`. The CRM gets no
 * palette of its own.
 */

export const STAGES = [
    { key: "lead", label: "Lead", color: "var(--chart-neutral)" },
    { key: "contacted", label: "Contacted", color: "var(--accent)" },
    { key: "quoted", label: "Quoted", color: "var(--chart-series-2)" },
    { key: "scheduled", label: "Scheduled", color: "var(--chart-warn)" },
    { key: "won", label: "Won", color: "var(--chart-pos)" },
    { key: "lost", label: "Lost", color: "var(--chart-neg)" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

/** Terminal stages collapse to a narrow summary column so the working stages get the width. */
export const COLLAPSED_BY_DEFAULT: readonly StageKey[] = ["won", "lost"];

export const STAGE_LABEL = Object.fromEntries(
    STAGES.map((s) => [s.key, s.label]),
) as Record<StageKey, string>;

export const STAGE_COLOR = Object.fromEntries(
    STAGES.map((s) => [s.key, s.color]),
) as Record<StageKey, string>;

/* ── shared client-side shapes, mirroring /api/portal/customers ───────────── */

export interface CustomerRow {
    customerId: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    stage: StageKey;
    value: number | null;
    tags: string[];
    note: string | null;
    archived: boolean;
    source: "call" | "web-form" | "manual";
    createdAt: string;
    /** When they first got in touch. Absent on records written before it was carried over. */
    firstContactAt?: string | null;
    lastContactAt: string | null;
    reviewSent: { sentAt: string; deliveryStatus: string; optedOut: boolean } | null;
    stale: boolean;
    unread: boolean;
    openTasks: number;
    overdueTasks: number;
}

export interface TimelineEvent {
    id: string;
    kind:
        | "call"
        | "web-form"
        | "sms-out"
        | "sms-in"
        | "review-request"
        | "stage-change"
        | "note"
        | "task"
        | "file";
    at: string;
    summary: string;
    actor: "customer" | "client" | "system";
    meta?: Record<string, unknown>;
}

export interface TaskRow {
    taskId: string;
    customerId: string;
    title: string;
    dueAt: string | null;
    done: boolean;
}

export function formatPhone(e164: string | null): string {
    if (!e164) return "No number";
    const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
    return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function formatMoney(value: number | null): string | null {
    if (value === null) return null;
    return `$${value.toLocaleString("en-US")}`;
}

/** Short relative time — "2 hours", "Yesterday", "Oct 22". */
export function shortAgo(iso: string | null): string {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const mins = Math.floor((Date.now() - t) / 60_000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days`;
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Day bucket label for timeline grouping. */
export function dayLabel(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date();
    const isSame = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    if (isSame(d, today)) return "Today";
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    if (isSame(d, yest)) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
