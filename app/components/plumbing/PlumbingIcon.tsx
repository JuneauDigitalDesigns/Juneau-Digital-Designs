/**
 * The line icons /plumbing draws with, exactly as they were in the approved mockup.
 *
 * Its own set rather than /hvac's: this page needs only five marks, two of them (the play
 * triangle and the hand-off arrow) are not on the HVAC page at all, and the voice bars are sized
 * differently here. Server-safe: no hooks, no client code. Every icon sits beside words that say
 * the same thing, so all are aria-hidden.
 */
const STROKE = {
    phone: (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    drop: <path d="m12 2.69 5.66 5.66a8 8 0 1 1-11.31 0z" />,
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
        </>
    ),
    arrowDown: <path d="M12 4v15M6 13l6 6 6-6" />,
} as const;

export type PlumbingIconName = keyof typeof STROKE;

export default function PlumbingIcon({ name, className = "" }: { name: PlumbingIconName; className?: string }) {
    return (
        <svg className={`plumb-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {STROKE[name]}
        </svg>
    );
}

/** The play triangle on a recorded call. Filled, not stroked, so it needs its own component. */
export function PlayIcon({ className = "" }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M7 4.5v15l13-7.5z" />
        </svg>
    );
}

/** A voice, drawn: bars that stand for someone speaking. `live` makes them move. */
export function Voice({ bars = 5, live = false, className = "" }: { bars?: number; live?: boolean; className?: string }) {
    return (
        <span className={`plumb-wave${live ? " plumb-wave-live" : ""} ${className}`} aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
                <i key={i} />
            ))}
        </span>
    );
}
