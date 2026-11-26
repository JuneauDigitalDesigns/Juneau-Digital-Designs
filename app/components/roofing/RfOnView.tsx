"use client";

import { useEffect, useRef } from "react";

/**
 * A div that adds `go` to itself once it is scrolled into view, and never takes it off. /roofing
 * uses it twice, as the mockup did: the triage fork lights its "Yes" path, and the search shingles
 * lay themselves in. With motion turned off the CSS shows the end state without it.
 */
export default function RfOnView({
    className,
    threshold = 0.4,
    children,
    ...rest
}: { className: string; threshold?: number; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver !== "function") {
            el.classList.add("go");
            return;
        }
        const seen = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        el.classList.add("go");
                        seen.disconnect();
                    }
                });
            },
            { threshold },
        );
        seen.observe(el);
        return () => seen.disconnect();
    }, [threshold]);

    return (
        <div className={className} ref={ref} {...rest}>
            {children}
        </div>
    );
}
