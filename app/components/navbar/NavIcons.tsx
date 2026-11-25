/**
 * The two glyphs in the nav bar's right-hand actions.
 *
 * Drawn here rather than pulled from the icon package the portal uses: these two sit in the
 * marketing chrome on every page, and two inline paths cost nothing next to shipping an icon
 * library to visitors who never see the portal.
 *
 * Both are `aria-hidden`: each sits beside its own word, so a screen reader that announced them
 * would read "Portal Portal".
 */

/** A phone handset, on the call button. */
export function PhoneGlyph({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M6.6 2.5h3l1.5 4-2.1 1.4a12 12 0 0 0 5.1 5.1l1.4-2.1 4 1.5v3A2.5 2.5 0 0 1 17 18 14.5 14.5 0 0 1 4 5a2.5 2.5 0 0 1 2.6-2.5Z"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/**
 * A door with an arrow going into it, on the Portal button (Xander, 19 Nov 2026: "an icon or
 * something that's indicative of a portal, or like a door"). The arrow is what makes it read as
 * a way in rather than a filing cabinet.
 */
export function DoorGlyph({ size = 15 }: { size?: number }) {
    return (
        <svg width={size} height={(size * 22) / 20} viewBox="0 0 20 22" fill="none" aria-hidden="true">
            <path d="M4 2.6h8.5v16.8H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path
                d="M12.5 11h5m0 0-2.2-2.3M17.5 11l-2.2 2.3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="9.6" cy="11" r="1" fill="currentColor" />
        </svg>
    );
}
