import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import type { ActivityEvent, ActivityKind } from "@/app/lib/portal-overview-activity";
import { msOf, whenLabel } from "@/app/lib/portal-overview-time";
import { CardHead, CardTitle, ChatIcon, CheckIcon, FormIcon, PhoneIcon } from "./parts";

/**
 * Icon and tint per event, as `.evi` in the mockup: blue for things that came in, green for
 * things that went well. The icon is decoration; the sentence beside it carries the meaning.
 */
const ICON: Record<ActivityKind, { icon: ReactNode; color: string }> = {
    call: { icon: <PhoneIcon />, color: "var(--accent)" },
    web: { icon: <FormIcon />, color: "var(--accent)" },
    "text-in": { icon: <ChatIcon />, color: "var(--accent)" },
    won: { icon: <CheckIcon />, color: "var(--chart-pos)" },
    done: { icon: <CheckIcon />, color: "var(--chart-pos)" },
};

/** "Latest activity". Renders nothing at all when there is nothing to list. */
export function ActivityFeed({
    events,
    nowMs,
    timeZone,
}: {
    events: ActivityEvent[];
    nowMs: number;
    timeZone: string;
}) {
    if (events.length === 0) return null;
    return (
        <Card density="none" className="overflow-hidden">
            <section aria-labelledby="ov-activity" data-tour="ov-activity">
                <CardHead>
                    <CardTitle id="ov-activity">Latest activity</CardTitle>
                </CardHead>
                <ul>
                    {events.map((e, i) => {
                        const t = msOf(e.at);
                        const look = ICON[e.kind];
                        return (
                            <li
                                key={e.id}
                                className="flex gap-3 items-start px-3.5 py-2.5 lg:px-[18px] lg:py-[11px]"
                                style={i === 0 ? undefined : { borderTop: "1px solid var(--rule-weak)" }}
                            >
                                <span
                                    aria-hidden="true"
                                    className="hidden lg:flex items-center justify-center shrink-0"
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: "50%",
                                        color: look.color,
                                        background: `color-mix(in srgb, ${look.color} 8%, transparent)`,
                                    }}
                                >
                                    {look.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <strong className="block" style={{ fontSize: "13.5px", color: "var(--fg)" }}>
                                        {e.title}
                                    </strong>
                                    {e.detail && (
                                        <p
                                            className="line-clamp-1"
                                            style={{ fontSize: "12px", color: "var(--fg-3)", lineHeight: 1.4, margin: 0 }}
                                        >
                                            {e.detail}
                                        </p>
                                    )}
                                </div>
                                {t !== null && (
                                    <span className="shrink-0" style={{ color: "var(--fg-3)", fontSize: "var(--text-sm)" }}>
                                        {whenLabel(t, nowMs, timeZone, "short")}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>
        </Card>
    );
}
