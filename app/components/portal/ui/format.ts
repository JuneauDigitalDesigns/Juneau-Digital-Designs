/**
 * Display formatting shared across portal panels.
 *
 * Call rows used to render `new Date(c.date).toLocaleString()` — "8/8/2026, 2:34:11 PM" at
 * 12px in a mono column, with seconds nobody needs and a width that changed every row.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now" · "14m ago" · "3h ago" · "2d ago" · "Aug 8" for anything older than a week. */
export function relativeTime(input: string | number | Date | null): string {
    if (input === null) return "—";
    const t = input instanceof Date ? input.getTime() : new Date(input).getTime();
    if (Number.isNaN(t)) return "—";

    const diff = Date.now() - t;
    if (diff < 0) return shortDate(t);
    if (diff < MINUTE) return "just now";
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
    if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
    if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
    return shortDate(t);
}

/** "Aug 8" — same year — or "Aug 8, 2025" when it isn't. */
export function shortDate(input: string | number | Date | null): string {
    if (input === null) return "—";
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return "—";

    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });
}

/** "Aug 8, 2:34 PM" — the absolute time that sits beside the relative one. */
export function shortDateTime(input: string | number | Date | null): string {
    if (input === null) return "—";
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return "—";

    return `${shortDate(d)}, ${d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    })}`;
}

/** "45s" · "3m 12s" */
// Re-exported rather than reimplemented: the billing cron writes this same string onto Stripe
// invoices, so a second copy here would be a second thing to drift. See app/lib/duration.ts.
export { duration, durationOrZero } from "@/app/lib/duration";

/**
 * Append a quiet freshness note to a section's meta line.
 *
 * Panels can now serve cached data, so the client should be able to see how current it is
 * without having to ask. Deliberately just a time — no refresh button, since background
 * revalidation already handles staleness and a button would let clients bypass every cache
 * behind this.
 */
export function freshness(label: string | undefined, fetchedAt: number | null): string | undefined {
    if (!fetchedAt) return label;
    const time = new Date(fetchedAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });
    return label ? `${label} · as of ${time}` : `as of ${time}`;
}

/** "$149" — whole dollars when the cents are zero, which they always are on our plans. */
export function money(cents: number | null, currency = "usd"): string | null {
    if (cents === null) return null;
    const value = cents / 100;
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(value);
}
