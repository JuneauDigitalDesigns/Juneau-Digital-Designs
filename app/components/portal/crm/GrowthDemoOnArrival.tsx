"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PortalSiteProps } from "@/app/portal/types";
import { upgradeHref } from "@/app/portal/types";
import GrowthDemo from "../growth-demo/GrowthDemo";

/** `/portal/customers?site=…&demo=growth` opens the demo on arrival. */
export const DEMO_PARAM = "demo";
export const DEMO_GROWTH = "growth";

/**
 * The Growth demo, opened by a link (`?demo=growth`) on a Customers board that is the client's own.
 *
 * Since schema v1.47.0 Starter + AI Receptionist has the real Customers board, so the page that
 * used to hold the demo (`StarterShowcase`) is the website plan's alone, and that plan gets no demo
 * (D5). Home's Growth panel and the locked Calendar still link Starter + AI here with
 * `?demo=growth`, so the board mounts this to honour that contract.
 *
 * Open on arrival, then drop the parameter, so a refresh or a shared link from here does not replay
 * it, and Back does not land on a URL that reopens it. `history.replaceState` rather than
 * `router.replace`: Next keeps `useSearchParams` in step with it, and it skips a server round trip
 * for a page that has nothing new to render.
 *
 * Renders nothing unless Growth's own features are off this site's plan and it is not web-only: a
 * Growth client has the real thing, and a website client is offered the receptionist instead.
 */
export default function GrowthDemoOnArrival({ site }: { site: PortalSiteProps }) {
    const params = useSearchParams();
    const [running, setRunning] = useState(false);
    const stop = useCallback(() => setRunning(false), []);
    const eligible = !site.webOnly && site.features.calendar.state === "not-on-plan";

    const autoOpen = params.get(DEMO_PARAM) === DEMO_GROWTH;
    useEffect(() => {
        if (!autoOpen || !eligible) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- opening on arrival is the point
        setRunning(true);
        const url = new URL(window.location.href);
        url.searchParams.delete(DEMO_PARAM);
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, [autoOpen, eligible]);

    if (!running || !eligible) return null;
    return <GrowthDemo upgradeUrl={upgradeHref(site.slug, site)} onClose={stop} trade={site.sampleTrade} />;
}
