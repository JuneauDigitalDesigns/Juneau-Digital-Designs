/**
 * Which tab tours a person has had (tours v2, 2026-11-12).
 *
 * Each tab's tour plays once per person, the first time they open the tab. The list lives in
 * Clerk `publicMetadata.tour.seen` beside the welcome tour's `completed`, written only by
 * `/api/portal/tour`. "Replay all tours" clears it so every tab teaches again.
 */

/** The tab tours a person can have seen. Anything else is dropped, so the list stays bounded. */
export const TAB_TOURS: ReadonlySet<string> = new Set([
    "overview",
    "inbox",
    "customers",
    "customer",
    "contact",
    "jobs",
    "notes",
    "calendar",
    "customers-locked",
    "calendar-locked",
    "analytics",
    "account",
    "billing",
    "support",
]);

/** The seen list after a write: cleared on reset, then the new tour added if it is a real one. */
export function nextSeen(prev: unknown, add: unknown, reset: boolean): string[] {
    const list = reset
        ? []
        : Array.isArray(prev)
          ? prev.filter((x): x is string => typeof x === "string" && TAB_TOURS.has(x))
          : [];
    if (typeof add === "string" && TAB_TOURS.has(add) && !list.includes(add)) list.push(add);
    return list;
}

/** The seen list as stored, cleaned, for the layout to hand the tour controller. */
export function readSeen(meta: unknown): string[] {
    return nextSeen((meta as { seen?: unknown } | null)?.seen, undefined, false);
}
