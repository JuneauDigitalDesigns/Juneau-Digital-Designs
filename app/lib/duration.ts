/**
 * The one way a call duration is written, for both halves of the app.
 *
 * Deliberately not `server-only` and deliberately in `lib/` rather than beside the portal's
 * other formatters: the billing cron writes this string onto a Stripe invoice while the portal
 * renders it in a tile, and those two must never disagree about what "4m 44s" means. The client
 * formatter in `app/components/portal/ui/format.ts` re-exports this rather than keeping a
 * second copy.
 *
 * Minutes floor and seconds carry the remainder, so nothing is rounded away. That matters
 * because the same seconds figure is what gets billed.
 */
export function duration(seconds: number | null | undefined): string | null {
    if (seconds === null || seconds === undefined) return null;
    const whole = Math.max(0, Math.floor(seconds));
    if (whole < 60) return `${whole}s`;
    return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}

/** `4m 44s` for a figure that is always present, e.g. a zeroed counter. */
export function durationOrZero(seconds: number | null | undefined): string {
    return duration(seconds ?? 0) ?? "0s";
}
