import Link from "next/link";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import { Card } from "@/app/components/portal/ui/Card";
import { siteNotices } from "@/app/lib/page-additions-store";

/**
 * Page additions on the Overview (Xander, 2026-11-14; W60–W112, approved word for word).
 *
 * One card per page the weekly Search Console job proposed for this site, in whatever stage it
 * is. Read-only, except "We need your help", which opens the facts wizard. Rendered on the server:
 * rendering a notice is the client seeing it, which starts the 7 days a final notice stays.
 * Renders nothing when there is nothing to say, which is most visits. Every plan, web-only included.
 */
const TONE: Record<string, { color: string; bg: string }> = {
    blue: { color: "var(--accent)", bg: "color-mix(in srgb, var(--accent) 10%, transparent)" },
    green: { color: "var(--chart-pos)", bg: "color-mix(in srgb, var(--chart-pos) 11%, transparent)" },
    amber: { color: "var(--chart-warn)", bg: "color-mix(in srgb, var(--chart-warn) 14%, transparent)" },
    grey: { color: "var(--fg-3)", bg: "var(--surface)" },
};

export async function PageAdditionNotices({ account, site }: { account: PortalAccount; site: PortalSite }) {
    const notices = await siteNotices(account, site).catch(() => []);
    if (notices.length === 0) return null;
    return (
        <div className="flex flex-col gap-3">
            {notices.map((n) => {
                const tone = TONE[n.tone];
                const wizard = `/portal/page-addition?site=${encodeURIComponent(site.slug)}&id=${encodeURIComponent(n.id)}`;
                return (
                    <Card key={n.id} density="default" className="flex flex-col gap-2" style={n.opensWizard ? { borderColor: "var(--accent)" } : undefined}>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-xs font-medium rounded-full px-2.5 py-0.5" style={{ color: tone.color, background: tone.bg }}>
                                {n.chip}
                            </span>
                            {n.siteName && (
                                <span className="text-xs" style={{ color: "var(--fg-3)" }}>
                                    {n.siteName}
                                </span>
                            )}
                        </div>
                        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
                            {n.opensWizard ? <Link href={wizard}>{n.heading}</Link> : n.heading}
                        </h2>
                        {n.body && (
                            <p className="text-sm max-w-prose" style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}>
                                {n.body}
                            </p>
                        )}
                        {(n.count || n.needed) && (
                            <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
                                {n.count ?? n.needed}
                            </p>
                        )}
                        {n.action && (n.opensWizard || n.href) && (
                            <div>
                                <Link
                                    href={n.opensWizard ? wizard : (n.href as string)}
                                    className="text-sm font-semibold"
                                    style={{ color: "var(--accent)" }}
                                    {...(n.href && !n.opensWizard ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                >
                                    {n.action}
                                </Link>
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
