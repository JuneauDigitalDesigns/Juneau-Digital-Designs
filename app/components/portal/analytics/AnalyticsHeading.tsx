import type { ReactNode } from "react";

/**
 * One section of the Analytics page: an anchored `<section>` with its `<h2>`.
 *
 * The id is what the jump bar and the old tabs' redirects (`/portal/performance` →
 * `#speed`) land on. `scroll-margin-top` keeps the heading clear of the sticky jump bar on
 * desktop, which would otherwise sit on top of the very heading a reader jumped to.
 */
export function AnalyticsBlock({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: ReactNode;
}) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="space-y-3" style={{ scrollMarginTop: 88 }}>
            <h2
                id={`${id}-title`}
                className="font-bold"
                style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "20px",
                    lineHeight: 1.2,
                    letterSpacing: "var(--tracking-tight)",
                    color: "var(--fg)",
                    marginTop: 10,
                }}
            >
                {title}
            </h2>
            {children}
        </section>
    );
}

/** Desktop wording with a shorter phone variant, from the approved copy. */
export function Responsive({ desktop, phone }: { desktop: ReactNode; phone: ReactNode }) {
    return (
        <>
            <span className="hidden lg:inline">{desktop}</span>
            <span className="lg:hidden">{phone}</span>
        </>
    );
}
