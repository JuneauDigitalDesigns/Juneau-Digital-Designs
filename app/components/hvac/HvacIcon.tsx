/**
 * The line icons /hvac draws with, exactly as they were in the approved mockup.
 *
 * Plain inline SVG rather than a Phosphor icon: the attic, the ringing arcs and the
 * thermometer were drawn for this page, and the others keep the same stroke so the set reads as
 * one. Every icon is decoration beside words that say the same thing, so all are aria-hidden.
 * Server-safe: no hooks, no client code.
 */
const PATHS = {
    phone: (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    onCall: (
        <>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
        </>
    ),
    attic: (
        <>
            <path d="M2 20 12 4l10 16z" />
            <path d="M12 4v16M7 12l5 8 5-8" />
        </>
    ),
    moon: (
        <>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            <path d="M17 3v3M15.5 4.5h3" />
        </>
    ),
    cell: (
        <>
            <rect x="6" y="2" width="12" height="20" rx="2.5" />
            <path d="M11 18h2" />
        </>
    ),
    temp: (
        <>
            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            <path d="M18 5h3M18 9h2" />
        </>
    ),
    flame: <path d="M12 2c.6 3.4 5 5.6 5 11a5 5 0 0 1-10 0c0-2 .8-3.3 2-4.6.3 1.6 1 2.4 2 2.8C10.6 7.8 11 5 12 2z" />,
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
    drop: <path d="m12 2.69 5.66 5.66a8 8 0 1 1-11.31 0z" />,
    heart: (
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
        </>
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
} as const;

export type HvacIconName = keyof typeof PATHS;

export default function HvacIcon({ name, className = "" }: { name: HvacIconName; className?: string }) {
    return (
        <svg className={`hvac-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {PATHS[name]}
        </svg>
    );
}

/** The ringing arcs either side of a phone. Their own box, wider than the phone they sit around. */
export function RingArcs({ className = "" }: { className?: string }) {
    return (
        <svg className={`hvac-ic ${className}`} viewBox="0 0 48 38" aria-hidden="true" focusable="false">
            <path d="M9 11a12 12 0 0 0 0 16M4 7a19 19 0 0 0 0 24M39 11a12 12 0 0 1 0 16M44 7a19 19 0 0 1 0 24" />
        </svg>
    );
}

/** A voice, drawn: bars that stand for someone speaking. `live` makes them move. */
export function Voice({ bars = 5, live = false, className = "" }: { bars?: number; live?: boolean; className?: string }) {
    return (
        <span className={`hvac-wave${live ? " hvac-wave-live" : ""} ${className}`} aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
                <i key={i} />
            ))}
        </span>
    );
}
