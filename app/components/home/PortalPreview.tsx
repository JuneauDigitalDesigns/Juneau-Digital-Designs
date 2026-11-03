/**
 * The portal section's visual: an inbox above a pipeline board.
 *
 * A drawing of the portal, not a screenshot of it, in the agency theme rather than the
 * portal's own cool-neutral one. It sits on a marketing page between two sections in the
 * agency palette, and a grey product surface dropped in here read as a different site.
 *
 * What it shows is held to what the product does:
 *   - The inbox is every call and web enquiry, newest first (InboxSection), on every plan.
 *   - The board's stages, the stale dot and its colours come from `crm/stages.ts` and
 *     CustomersSection — the four working stages only, since Won and Lost collapse by
 *     default there too. The board is Growth's, and the split bar says so.
 *   - Customers on the board are leads the owner promoted from the inbox. Nothing here
 *     implies a call drops onto the board by itself; in CRM v2 it does not.
 *   - The two customer-facing actions wait on the client's own carrier registration, so
 *     they are drawn dashed and say "after carrier approval" — never a timeframe.
 *
 * Names are fictional, and no phone number appears, so nothing here can dial a real person.
 */

type Source = "call" | "web";

const INBOX: { name: string; summary: string; source: Source; time: string; unread: boolean }[] = [
    { name: "Dana Kim", summary: "Kitchen sink leak, needs scheduling", source: "call", time: "2:47 PM", unread: true },
    { name: "Marcus Hale", summary: "Web form: quote for a 50-gallon water heater", source: "web", time: "11:02 AM", unread: true },
    { name: "Priya Shah", summary: "Slow drain in the upstairs bathroom", source: "call", time: "Yesterday", unread: false },
];

const BOARD: { label: string; color: string; cards: { name: string; note: string; stale?: boolean }[] }[] = [
    { label: "Lead", color: "var(--chart-neutral)", cards: [{ name: "Ana Lopez", note: "Bathroom remodel" }, { name: "Marcus Hale", note: "Water heater" }] },
    { label: "Contacted", color: "var(--accent)", cards: [{ name: "Tom Reyes", note: "Repipe estimate", stale: true }] },
    { label: "Quoted", color: "var(--chart-series-2)", cards: [{ name: "Leah Grant", note: "$1,850" }] },
    { label: "Scheduled", color: "var(--chart-warn)", cards: [{ name: "Priya Shah", note: "Thu 9:00 AM" }] },
];

function SourceIcon({ source }: { source: Source }) {
    return (
        <span className="pp-src" aria-label={source === "call" ? "Phone call" : "Website form"}>
            {source === "call" ? "☎" : "✉"}
        </span>
    );
}

export default function PortalPreview() {
    return (
        <div className="pp" aria-hidden="true">
            <div className="pp-bar">
                <span className="pp-title">Your portal</span>
                <span className="pp-tabs">
                    <span className="pp-tab pp-tab--on">Inbox</span>
                    <span className="pp-tab">Customers</span>
                </span>
            </div>

            <div>
                {INBOX.map((row) => (
                    <div key={row.name} className="pp-row">
                        <SourceIcon source={row.source} />
                        <div style={{ minWidth: 0 }}>
                            <div className="pp-name">
                                {row.name}
                                {row.unread && <span className="pp-unread" />}
                            </div>
                            <div className="pp-summary">{row.summary}</div>
                        </div>
                        <span className="pp-time">{row.time}</span>
                    </div>
                ))}
            </div>

            <div className="pp-split">
                <span>Inbox · every plan</span>
                <span className="pp-split-growth">Pipeline · Growth</span>
            </div>

            <div className="pp-board">
                {BOARD.map((col) => (
                    <div key={col.label} className="pp-col">
                        <div className="pp-col-h">
                            <span className="pp-dot" style={{ background: col.color }} />
                            {col.label}
                        </div>
                        {col.cards.map((card) => (
                            <div key={card.name} className="pp-card">
                                <div className="pp-card-name">
                                    {card.stale && <span className="pp-stale" title="Going stale" />}
                                    {card.name}
                                </div>
                                <div className="pp-card-note">{card.note}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="pp-actions">
                <span className="pp-action">
                    Text back
                    <small>after carrier approval</small>
                </span>
                <span className="pp-action">
                    Ask for a review
                    <small>after carrier approval</small>
                </span>
            </div>
        </div>
    );
}
