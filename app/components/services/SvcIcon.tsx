/**
 * The line icons the service pages draw, one set, stroked in the current colour (`.svc-ic`).
 * Decorative: every icon sits beside words that say the same thing, so each is aria-hidden.
 */
const PATHS = {
    phone: (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    ),
    cell: (
        <>
            <rect x="6" y="2" width="12" height="20" rx="2.5" />
            <path d="M11 18h2" />
        </>
    ),
    user: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
        </>
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    msg: <path d="M21 11.5a8.38 8.38 0 0 1-9 8.3 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 3.8 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />,
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
    box: (
        <>
            <path d="M21 8 12 3 3 8v8l9 5 9-5V8z" />
            <path d="m3 8 9 5 9-5M12 13v8" />
        </>
    ),
    file: (
        <>
            <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
            <path d="M14 3v5h5" />
        </>
    ),
    globe: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </>
    ),
    kanban: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16M15 4v16" />
        </>
    ),
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />,
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    gauge: (
        <>
            <path d="M12 14l4-4" />
            <path d="M3.3 17a9 9 0 1 1 17.4 0" />
        </>
    ),
    card: (
        <>
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
        </>
    ),
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
    shield: (
        <>
            <path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z" />
            <path d="m8.5 12 2.5 2.5L15.5 10" />
        </>
    ),
} as const;

export type SvcIconName = keyof typeof PATHS;

export default function SvcIcon({ name, className = "" }: { name: SvcIconName; className?: string }) {
    return (
        <svg className={`svc-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true">
            {PATHS[name]}
        </svg>
    );
}

/** A voice, drawn as bars. `live` makes them speak (only the receptionist's voice does). */
export function Wave({ bars = 7, live = false }: { bars?: number; live?: boolean }) {
    return (
        <span className={`svc-wave${live ? " live" : ""}`} aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
                <i key={i} />
            ))}
        </span>
    );
}
