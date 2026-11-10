"use client";

import { useCallback, useEffect, useState } from "react";
import { listTemplates, type ReplyTemplate } from "./api";

/**
 * The site's quick replies, or a clear "not available".
 *
 * `unsupported` is the state the UI hides on: the route is not there yet, or answered with
 * something other than the documented shape. A transient failure on a route that *is* there
 * also hides the chips for now — the composer still works without them, and an error banner
 * over a convenience would be louder than the convenience.
 *
 * Plain fetch rather than the portal cache: the list is small, Growth-only, and edited from
 * this same screen, so a stale cached copy after an edit would be the one thing worth avoiding.
 */
export function useReplyTemplates(site: string, enabled: boolean) {
    const [state, setState] = useState<"loading" | "ready" | "unsupported">("loading");
    const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        void listTemplates(site).then((r) => {
            if (cancelled) return;
            if (r.ok) {
                setTemplates(r.value);
                setState("ready");
            } else {
                setState("unsupported");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [site, enabled, tick]);

    const reload = useCallback(() => setTick((t) => t + 1), []);

    return { state: enabled ? state : "unsupported", templates, reload } as const;
}
