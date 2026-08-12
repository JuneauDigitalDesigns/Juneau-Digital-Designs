"use client";

import { useRouter } from "next/navigation";
import { tabHref } from "@/app/portal/types";

interface Site {
    slug: string;
    name: string;
}

/**
 * Site switcher.
 *
 * Navigates rather than lifting state: the selected site lives in `?site=`, so switching
 * keeps you on the tab you were reading and leaves a URL you can share or bookmark.
 */
export default function SiteSelector({
    sites,
    selected,
    activeTab,
}: {
    sites: Site[];
    selected: string;
    /** Path segment of the current tab ("" for overview), so switching stays put. */
    activeTab: string;
}) {
    const router = useRouter();

    return (
        <label className="flex items-center gap-2">
            <span className="sr-only">Select site</span>
            <select
                value={selected}
                onChange={(e) => router.push(tabHref(activeTab, e.target.value))}
                className="portal-site-select text-sm px-2.5 py-1.5 rounded-md border w-full max-w-[14rem] truncate"
                style={{
                    background: "var(--elev-2)",
                    borderColor: "var(--rule)",
                    color: "var(--fg)",
                }}
            >
                {sites.map((s) => (
                    <option key={s.slug} value={s.slug}>
                        {s.name}
                    </option>
                ))}
            </select>
        </label>
    );
}
