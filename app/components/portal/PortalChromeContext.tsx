"use client";

import { createContext, useContext } from "react";
import type { PortalSiteProps } from "@/app/portal/types";

/**
 * What the chrome already knows, for the few pages that need it rather than refetching it.
 *
 * The mobile More screen (`/portal/more`) is the reason this exists: it lists the account,
 * the selected site's host and the site switcher's choice, all of which `PortalChrome` has
 * resolved from the layout and `?site=` before any page renders.
 */
export interface PortalChromeValue {
    sites: PortalSiteProps[];
    selected: PortalSiteProps;
    accountEmail: string;
    /** The selected site's bare host, or null before it has a domain. */
    host: string | null;
}

export const PortalChromeContext = createContext<PortalChromeValue | null>(null);

export function usePortalChrome(): PortalChromeValue {
    const value = useContext(PortalChromeContext);
    if (!value) throw new Error("usePortalChrome must be used inside PortalChrome");
    return value;
}
