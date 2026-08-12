import type { CSSProperties, ReactNode } from "react";

const DENSITY = {
    compact: "p-3",
    default: "p-4",
    roomy: "p-5 sm:p-6",
    none: "",
} as const;

export type CardDensity = keyof typeof DENSITY;

/**
 * The portal's one surface.
 *
 * This used to paint `--surface` — `rgba(20,18,12,.04)`, a 4% wash over the page — so a
 * card, the header and a button were all the same value and separated only by a hairline.
 * It now sits on the `--elev-*` scale: opaque white fill, neutral shadow, hairline border.
 * See `.portal-elev` in globals.css.
 *
 * The scale used to include a lit top edge as well. The portal design system turns it off
 * by setting `--elev-highlight: transparent`, which suits a flat product surface; the
 * shadow lists still carry the inset, so it is one token away if it is ever wanted back.
 *
 * `density` replaced a raw `padding: string` prop, which was an unenforced API on the one
 * component that defines what every panel in the product looks like.
 */
export function Card({
    children,
    className = "",
    density = "default",
    elevation = 1,
    interactive = false,
    style,
    as: Tag = "div",
}: {
    children: ReactNode;
    className?: string;
    density?: CardDensity;
    /** 1 = resting card, 2 = the page's lead surface (health strip, primary panel). */
    elevation?: 1 | 2;
    interactive?: boolean;
    style?: CSSProperties;
    as?: "div" | "section" | "article" | "li";
}) {
    const classes = [
        elevation === 2 ? "portal-elev-2" : "portal-elev",
        interactive ? "portal-interactive" : "",
        DENSITY[density],
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Tag className={classes} style={style}>
            {children}
        </Tag>
    );
}

/** Small uppercase mono label — the portal's recurring metadata style. */
export function CardLabel({ children }: { children: ReactNode }) {
    return (
        <p
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
        >
            {children}
        </p>
    );
}

/** Section heading + optional right-aligned meta line. */
export function SectionHeader({
    title,
    meta,
    action,
}: {
    title: string;
    meta?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0">
                <h1
                    className="font-bold"
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--text-3xl)",
                        letterSpacing: "var(--tracking-tight)",
                    }}
                >
                    {title}
                </h1>
                {meta && (
                    <span
                        className="text-xs block mt-1"
                        style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                    >
                        {meta}
                    </span>
                )}
            </div>
            {action}
        </div>
    );
}
