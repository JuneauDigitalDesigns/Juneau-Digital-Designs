"use client";

import { useEffect, useState } from "react";

/**
 * The portal's only viewport hook.
 *
 * Layout responsiveness is CSS — `.portal-shell` and friends in globals.css do all of it
 * with media queries, and that is deliberate: CSS has no hydration problem and no first-paint
 * flash. This exists for the narrow case CSS cannot cover, which is JavaScript that has to
 * *know* the breakpoint rather than merely respond to it. Today that is `Drawer`, which must
 * pick a slide axis before framer-motion can animate it.
 *
 * **Do not reach for this to hide or restyle things.** A `useIsMobile() && <X/>` renders
 * nothing on the server and then pops X in after hydration; `hidden md:block` does not.
 *
 * SSR returns `false` and the real value lands in an effect after mount. That is safe for
 * the current caller because a drawer only ever mounts in response to a tap, long after
 * hydration. A component that renders during SSR and branches on this will flash the desktop
 * variant first, so if you add one, gate it on a `mounted` flag or use CSS instead.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(query);
        setMatches(mql.matches);

        const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, [query]);

    return matches;
}

/**
 * Matches Tailwind's `md` breakpoint, which is where the portal's own table/card swaps
 * happen (`hidden md:block` in CallsSection and DataTable). Keep the two in step: a drawer
 * that becomes a sheet at a different width than the table becomes cards is a bug nobody
 * will think to look for.
 */
export function useIsMobile(): boolean {
    return useMediaQuery("(max-width: 767px)");
}
