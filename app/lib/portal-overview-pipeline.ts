import { inWindow, msOf, type WeekBounds } from "./portal-overview-time";

/**
 * The Growth Overview's pipeline, follow-ups and review counts, from CRM v2 records.
 *
 * Structural input types rather than `portal-crm`'s own, because that module is `server-only`
 * and these are pure: the loader computes `stale` with `isStale` (the board's own rule) and
 * hands the records over. Same reason `crm-contacts.ts` gives for `TimelineLike`.
 */

export interface PipelineCustomer {
    customerId: string;
    name: string | null;
    phone: string | null;
    stage: "lead" | "contacted" | "quoted" | "scheduled" | "won" | "lost";
    /** Whole dollars, or null when the client never typed one in. */
    value: number | null;
    archived: boolean;
    stageChangedAt: string;
    reviewSent: { sentAt: string } | null;
    /** From `isStale` — the board's "going cold" flag, computed by the caller. */
    stale: boolean;
}

export interface PipelineTask {
    taskId: string;
    customerId: string;
    title: string;
    dueAt: string | null;
    done: boolean;
}

export type OpenStage = "lead" | "contacted" | "quoted" | "scheduled";
export const OPEN_STAGES: readonly OpenStage[] = ["lead", "contacted", "quoted", "scheduled"];

export interface StageTotal {
    count: number;
    /** Sum of the values the client entered, or null when none of them has one. */
    value: number | null;
}

export interface PipelineSummary {
    open: Record<OpenStage, StageTotal>;
    wonThisWeek: StageTotal;
    goingQuiet: number;
    /**
     * Each column's share of the stacked bar, in the order lead → won-this-week, summing to 1
     * (or all zero on an empty board). By dollars when any dollars exist, which is what the
     * mockup draws; by count otherwise, so a board nobody prices still shows its shape.
     */
    shares: number[];
}

function addValue(t: StageTotal, value: number | null): StageTotal {
    return {
        count: t.count + 1,
        value: value === null ? t.value : (t.value ?? 0) + value,
    };
}

/**
 * Count and dollars per stage.
 *
 * Open stages are where every live customer sits *now*. "Won this week" is customers whose
 * stage moved to Won since Monday — `stageChangedAt` resets only on a real stage move (see
 * `updateCustomer`), so an edited note on a March job does not make it this week's win.
 * Archived customers are off the board, so they are off this card too; Lost is not shown.
 */
export function pipelineSummary(customers: PipelineCustomer[], week: WeekBounds): PipelineSummary {
    const zero: StageTotal = { count: 0, value: null };
    const open: Record<OpenStage, StageTotal> = {
        lead: zero,
        contacted: zero,
        quoted: zero,
        scheduled: zero,
    };
    let wonThisWeek = zero;
    let goingQuiet = 0;

    for (const c of customers) {
        if (c.archived) continue;
        if (c.stale) goingQuiet += 1;
        if (c.stage === "won") {
            if (inWindow(msOf(c.stageChangedAt), week.startMs, week.nowMs + 1)) {
                wonThisWeek = addValue(wonThisWeek, c.value);
            }
            continue;
        }
        if (c.stage === "lost") continue;
        open[c.stage] = addValue(open[c.stage], c.value);
    }

    const columns = [...OPEN_STAGES.map((s) => open[s]), wonThisWeek];
    const dollars = columns.reduce((s, c) => s + (c.value ?? 0), 0);
    const heads = columns.reduce((s, c) => s + c.count, 0);
    const shares = columns.map((c) =>
        dollars > 0 ? (c.value ?? 0) / dollars : heads > 0 ? c.count / heads : 0,
    );

    return { open, wonThisWeek, goingQuiet, shares };
}

export interface FollowUps {
    count: number;
    /** The most overdue one — the tile's link. */
    first: { title: string; customerId: string } | null;
}

/**
 * Open tasks due by the end of today, overdue ones included — "Follow-ups due today".
 *
 * Overdue counts because it is still due: a quote promised for Friday that nobody sent is more
 * urgent on Monday, not less. Tasks with no due date are not "due today". A task whose customer
 * is gone or archived is skipped, since the link would open nothing.
 *
 * Earliest due first, so the link is the one that has waited longest.
 */
export function followUpsDue(
    tasks: PipelineTask[],
    customers: PipelineCustomer[],
    todayEndMs: number,
): FollowUps {
    const live = new Set(customers.filter((c) => !c.archived).map((c) => c.customerId));
    const due = tasks
        .filter((t) => !t.done && live.has(t.customerId))
        .map((t) => ({ t, at: msOf(t.dueAt) }))
        .filter((x): x is { t: PipelineTask; at: number } => x.at !== null && x.at < todayEndMs)
        .sort((a, b) => a.at - b.at || (a.t.taskId < b.t.taskId ? -1 : 1));

    return {
        count: due.length,
        first: due[0] ? { title: due[0].t.title, customerId: due[0].t.customerId } : null,
    };
}

/**
 * Review requests sent since Monday.
 *
 * Read off `reviewSent`, the one-per-number lock record. Whether anyone *left* a review is not
 * something any store here knows — Google does not tell us — so the approved "2 left a review"
 * sub-line has nothing honest to say and is not rendered.
 */
export function reviewsAskedThisWeek(customers: PipelineCustomer[], week: WeekBounds): number {
    return customers.filter((c) =>
        inWindow(msOf(c.reviewSent?.sentAt), week.startMs, week.nowMs + 1),
    ).length;
}

/** "$11,200". Growth only — Xander's decision that dollar values never show on Starter. */
export function dollars(value: number): string {
    return `$${Math.round(value).toLocaleString("en-US")}`;
}
