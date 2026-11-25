/**
 * The marks /lawn-care draws with, exactly as they were in the approved mockup.
 *
 * Its own set rather than /plumbing's: this page needs a mower, which no other page has, and a
 * hand-off arrow that points right rather than down. Server-safe: no hooks, no client code. Every
 * icon sits beside words that say the same thing, so all are aria-hidden.
 */
const STROKE = {
    phone: (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
        </>
    ),
    arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
    arrowDown: <path d="M12 4v15M6 13l6 6 6-6" />,
} as const;

export type LawnIconName = keyof typeof STROKE;

export default function LawnIcon({ name, className = "" }: { name: LawnIconName; className?: string }) {
    return (
        <svg className={`lawn-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {STROKE[name]}
        </svg>
    );
}

/**
 * The walk-behind mower. Filled rather than stroked, and the only drawing on the site that is not
 * on a 24×24 grid, so it is its own component: handle, engine, deck and two wheels.
 */
export function MowerIcon({ className = "", ref }: { className?: string; ref?: React.Ref<SVGSVGElement> }) {
    return (
        <svg className={className} ref={ref} viewBox="0 0 44 31" aria-hidden="true" focusable="false">
            <path d="M2 4h8M6 4l13 15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <rect x="21" y="9" width="13" height="9" rx="2" fill="var(--accent-2)" />
            <path d="M26 9V6h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <rect x="12" y="17" width="30" height="9" rx="3" fill="currentColor" />
            <circle cx="17" cy="26" r="4.6" fill="currentColor" />
            <circle cx="17" cy="26" r="1.6" fill="var(--elev-1)" />
            <circle cx="37.5" cy="26.5" r="4" fill="currentColor" />
            <circle cx="37.5" cy="26.5" r="1.4" fill="var(--elev-1)" />
        </svg>
    );
}

/** A voice, drawn: bars that stand for someone speaking. `live` makes them move. */
export function Voice({ bars = 5, live = false, className = "" }: { bars?: number; live?: boolean; className?: string }) {
    return (
        <span className={`lawn-wave${live ? " lawn-wave-live" : ""} ${className}`} aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
                <i key={i} />
            ))}
        </span>
    );
}
