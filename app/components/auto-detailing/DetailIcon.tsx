/**
 * The marks /auto-detailing draws with, exactly as they were in the approved mockup.
 *
 * Its own small set rather than another page's: a phone, a magnifier for the searches, and a
 * message bubble for the text the owner gets. Server-safe: no hooks, no client code. Every icon
 * sits beside words that say the same thing, so all are aria-hidden.
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
    msg: (
        <path d="M21 11.5a8.38 8.38 0 0 1-9 8.3 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 3.8 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
    ),
} as const;

export type DetailIconName = keyof typeof STROKE;

export default function DetailIcon({ name, className = "" }: { name: DetailIconName; className?: string }) {
    return (
        <svg className={`detail-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {STROKE[name]}
        </svg>
    );
}

/** A voice, drawn: bars that stand for someone speaking. `live` makes them move. */
export function Voice({ bars = 5, live = false, className = "" }: { bars?: number; live?: boolean; className?: string }) {
    return (
        <span className={`detail-wave${live ? " detail-wave-live" : ""} ${className}`} aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
                <i key={i} />
            ))}
        </span>
    );
}
