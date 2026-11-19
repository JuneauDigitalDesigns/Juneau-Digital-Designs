/**
 * The homepage's line icons, drawn as the approved mockup draws them (24px grid, 2px stroke,
 * round caps). `.hp-ic` sizes them to the font size and colours them with `currentColor`.
 */

const PATHS = {
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
        </>
    ),
    phone: (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    out: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
    msg: <path d="M21 11.5a8.38 8.38 0 0 1-9 8.3 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 3.8 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />,
    cell: (
        <>
            <rect x="6" y="2" width="12" height="20" rx="2.5" />
            <path d="M11 18h2" />
        </>
    ),
    browser: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01" />
        </>
    ),
    tray: (
        <>
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
        </>
    ),
} as const;

export type HomeIconName = keyof typeof PATHS;

export default function HomeIcon({ name, className = "" }: { name: HomeIconName; className?: string }) {
    return (
        <svg className={`hp-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {PATHS[name]}
        </svg>
    );
}

/** The ringing arcs either side of a phone (a 48×38 drawing), shown while it rings. */
export function RingArcs({ className = "" }: { className?: string }) {
    return (
        <svg className={`hp-ic ${className}`} viewBox="0 0 48 38" aria-hidden="true" focusable="false">
            <path d="M9 11a12 12 0 0 0 0 16M4 7a19 19 0 0 0 0 24M39 11a12 12 0 0 1 0 16M44 7a19 19 0 0 1 0 24" />
        </svg>
    );
}

/** A voice, drawn: bars that stand for someone speaking. `live` makes them speak. */
export function Wave({ bars = 5, live = false }: { bars?: number; live?: boolean }) {
    return (
        <span className={`hp-wave${live ? " live" : ""}`} aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
                <i key={i} />
            ))}
        </span>
    );
}
