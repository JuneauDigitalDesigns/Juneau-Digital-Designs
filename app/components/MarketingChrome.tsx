"use client";

import { usePathname } from "next/navigation";
import Navbar from "./navbar/navbar";
import Footer from "./footer/footer";

/**
 * Renders the marketing navbar, footer and grain texture everywhere except the portal
 * product.
 *
 * The root layout mounted `<Navbar/>` and `<Footer/>` unconditionally, so a signed-in
 * client got the full marketing site wrapped around their dashboard: a sticky "View
 * Pricing" bar above the portal header, two theme toggles, and a sitemap footer below the
 * data. The sticky nav (z-50) also overlapped the portal header on scroll.
 *
 * A pathname check rather than a `(marketing)` route group: the group would mean moving
 * every marketing route on disk for the same result.
 *
 * TWO BOUNDARIES, NOT ONE. Chrome and texture are gated differently on purpose:
 *
 *   - Navbar/footer come off for *everything* under `/portal`, onboarding included — the
 *     wizard is a focused flow and always was chrome-less.
 *   - Grain comes off only for the portal *product* (the dashboard and its auth pages),
 *     which has its own cool-neutral design system. `/portal/onboarding` is a sales funnel
 *     that deliberately stays on the agency theme, so it keeps the texture. Gating the
 *     grain on the `/portal` prefix would have quietly stripped it there and left
 *     onboarding in a third state that is neither theme.
 */
export default function MarketingChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");
    const isOnboarding = pathname.startsWith("/portal/onboarding");
    // The routes wrapped in `<PortalScope>`: the dashboard, sign-in and sign-up.
    const isPortalProduct = isPortal && !isOnboarding;

    return (
        <>
            {isPortalProduct && <PortalCanvas />}
            {!isPortalProduct && <GrainOverlay />}
            {isPortal ? (
                children
            ) : (
                <>
                    <Navbar />
                    {children}
                    <Footer />
                </>
            )}
        </>
    );
}

/**
 * Repaints the page canvas for portal routes.
 *
 * `globals.css` sets `body { background: var(--bg) }`, which resolves at `:root` — the
 * agency cream. `.portal-scope` redefines `--bg` but cannot reach its own ancestors, so on
 * portal routes the canvas stayed cream under a grey product surface. Invisible most of the
 * time because the shell covers the viewport, but it shows in the overscroll gutter on
 * rubber-band platforms and during a slow first paint.
 *
 * Emitted as a <style> rather than toggled with a class in an effect, so it is server
 * rendered and there is no cream flash before hydration. Literal hex because at <body>
 * level the scoped token is out of scope — keep it in step with `--bg` in the portal block
 * at the bottom of globals.css.
 */
function PortalCanvas() {
    return <style>{`html,body{background:#f6f7f9}`}</style>;
}

/**
 * Fixed full-viewport texture, non-interactive.
 *
 * z-5, not z-60: at 60 it painted over the sticky navbar (z-50), every portal surface, and
 * Clerk's popovers. Texture belongs behind the UI, not on top.
 *
 * It used to live in the root layout, which meant it painted over the portal as well —
 * `position: fixed` ignores the portal shell entirely. It is mounted here so the pathname
 * check above can keep it off the product.
 */
function GrainOverlay() {
    return (
        <div
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 5,
                pointerEvents: "none",
                opacity: 0.025,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                backgroundRepeat: "repeat",
                backgroundSize: "200px 200px",
            }}
        />
    );
}
