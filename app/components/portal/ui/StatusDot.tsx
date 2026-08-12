/**
 * The portal's single source of status colour.
 *
 * Colour in the portal is information, never decoration — a dot is green because something
 * is genuinely up, and nothing else in the UI is allowed to borrow the same green.
 */
export type Status = "ok" | "warn" | "down" | "pending";

export const STATUS_COLOR: Record<Status, string> = {
    ok: "var(--online)",
    warn: "var(--chart-warn)",
    down: "var(--chart-neg)",
    pending: "var(--fg-3)",
};

export function StatusDot({
    status,
    size = 8,
    pulse = false,
}: {
    status: Status;
    size?: number;
    /** Only for genuinely live state — a pulsing dot that isn't live is a lie. */
    pulse?: boolean;
}) {
    const color = STATUS_COLOR[status];
    return (
        <span
            aria-hidden="true"
            className={`portal-dot shrink-0${pulse ? " portal-dot-pulse" : ""}`}
            style={{
                width: size,
                height: size,
                background: color,
                // A tinted halo instead of a hard edge, so the dot reads as lit rather
                // than printed. Scales with the dot so it never overwhelms it.
                boxShadow: `0 0 0 ${Math.max(2, size / 2.5)}px color-mix(in srgb, ${color} 18%, transparent)`,
            }}
        />
    );
}
