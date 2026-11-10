"use client";

import { useCallback, useEffect, useState } from "react";
import { listTemplates, type ReplyTemplate } from "./replyTemplates";

/**
 * The site's quick replies, or nothing.
 *
 * `ready` only when the route answered with the documented shape. Until the backend lands
 * this stays `unsupported` and the card draws no quick replies — hidden, not broken. A
 * transient failure hides them too: the composer works without them, and an error banner over
 * a convenience would be louder than the convenience.
 *
 * Plain fetch rather than the portal cache: the list is small and edited from the same card,
 * so a stale cached copy after an edit is the one thing worth avoiding.
 */
export function useReplyTemplates(site: string) {
    const [state, setState] = useState<"loading" | "ready" | "unsupported">("loading");
    const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        void listTemplates(site).then((r) => {
            if (cancelled) return;
            if (r.ok) {
                setTemplates(r.templates);
                setState("ready");
            } else {
                setState("unsupported");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [site, tick]);

    const reload = useCallback(() => setTick((t) => t + 1), []);
    return { state, templates, reload } as const;
}
