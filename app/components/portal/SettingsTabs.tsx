"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SETTINGS_TABS, settingsTabFor, tabHref } from "@/app/portal/types";

/**
 * Settings' two parts: Account, and Plan & billing.
 *
 * Links, not a client-side tab switch: each part is its own route, so the selection is in the
 * URL, Back works, and `/portal/billing` can redirect straight to its half. Desktop shows an
 * underlined tab row as in the approved mockup; a phone gets the segmented control instead, a
 * larger target that reads as a switch between two views of one page.
 *
 * Both are rendered and one is hidden per breakpoint. `display: none` takes the hidden one out
 * of the accessibility tree, so a screen reader only ever meets one of them.
 */
export default function SettingsTabs() {
    const pathname = usePathname();
    const params = useSearchParams();
    const slug = params.get("site") ?? "";
    const current = settingsTabFor(pathname) ?? "account";

    const href = (path: string) => (slug ? tabHref(path, slug) : `/portal/${path}`);

    return (
        <>
            <nav
                aria-label="Settings sections"
                className="hidden lg:flex gap-6 border-b"
                style={{ borderColor: "var(--rule)" }}
            >
                {SETTINGS_TABS.map((t) => {
                    const on = t.id === current;
                    return (
                        <Link
                            key={t.id}
                            href={href(t.href)}
                            aria-current={on ? "page" : undefined}
                            className="pt-2.5 pb-3 text-sm"
                            style={{
                                color: on ? "var(--fg)" : "var(--fg-2)",
                                fontWeight: on ? 600 : 500,
                                boxShadow: on ? "inset 0 -2px 0 var(--accent)" : undefined,
                            }}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </nav>

            <nav
                aria-label="Settings sections"
                className="lg:hidden grid grid-cols-2 rounded-lg p-[3px]"
                style={{ background: "var(--surface)" }}
            >
                {SETTINGS_TABS.map((t) => {
                    const on = t.id === current;
                    return (
                        <Link
                            key={t.id}
                            href={href(t.href)}
                            aria-current={on ? "page" : undefined}
                            className="flex items-center justify-center rounded-md text-[13.5px]"
                            style={{
                                minHeight: 40,
                                // --fg-2 on the --surface wash is 6.85:1; --fg on white is 18.9:1.
                                background: on ? "var(--elev-1)" : "transparent",
                                color: on ? "var(--fg)" : "var(--fg-2)",
                                fontWeight: on ? 600 : 400,
                                boxShadow: on ? "var(--shadow-1)" : undefined,
                            }}
                        >
                            {t.label}
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
