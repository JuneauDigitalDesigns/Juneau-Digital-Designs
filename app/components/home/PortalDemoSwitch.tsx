"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";

/**
 * The portal section's demo: the desktop film on a wide screen, the portal's mobile view on a
 * phone (Xander, 2026-11-18).
 *
 * Decided by **viewport width**, not pointer type: what decides which portal a visitor would see
 * is the width the portal lays itself out for, and a touch laptop or an iPad in landscape gets the
 * desktop portal too. The cut is 768px (Tailwind's `md`, where the portal's own tables turn into
 * cards): a phone, including a large one in portrait, gets the mobile demo.
 *
 * **Only one version loads.** Each is its own dynamic chunk, imported only once the width is known
 * in the browser; the server renders the reserved space and neither demo. Crossing the breakpoint
 * (a rotation, a window drag) swaps to the other version, starting it fresh, and unmounts the one
 * it leaves, which cancels its clock.
 */
const PortalDemo = dynamic(() => import("./PortalDemo"), { ssr: false });
const PortalDemoMobile = dynamic(() => import("./PortalDemoMobile"), { ssr: false });

export const MOBILE_DEMO_QUERY = "(max-width: 767px)";

function subscribe(on: () => void) {
    const mql = window.matchMedia(MOBILE_DEMO_QUERY);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
}

export default function PortalDemoSwitch() {
    // "unknown" on the server and through hydration, so neither demo is in the server HTML and
    // the browser picks exactly one; then it follows the width live.
    const width = useSyncExternalStore(
        subscribe,
        () => (window.matchMedia(MOBILE_DEMO_QUERY).matches ? "mobile" : "desktop"),
        () => "unknown",
    );

    // The demo's own height is reserved until the width is known, so nothing below it jumps.
    if (width === "unknown") return <div className="portal-demo-slot" aria-hidden="true" />;
    return width === "mobile" ? <PortalDemoMobile /> : <PortalDemo />;
}
