"use client";

import {
    ArrowCounterClockwise,
    CaretLeft,
    Check,
    Clock,
    EnvelopeSimple,
    Phone,
    Plus,
    Trash,
    X,
} from "@phosphor-icons/react";
import type { InboxItem } from "@/app/lib/crm-contacts";
import { duration } from "@/app/lib/duration";
import { Chip, StatusChip, kindLabel } from "./chips";
import { callbackGap, fullWhen, type InboxRow } from "./model";
import { RemindPopover, RemindSheet } from "./RemindMenu";
import { dialNumber } from "./InboxList";

/**
 * One lead: the right-hand pane on desktop, the full screen that slides in on a phone.
 *
 * Call back is the primary action on every plan. It used to be replaced by Promote on Growth,
 * which made the thing the owner most needs to do with a lead the second-most-visible button
 * (the research note's first gap). Promote now sits at the end of the row; Remind me and Done
 * sit between.
 *
 * There is deliberately no Text here, on any plan. Texting is a Growth/Enterprise feature
 * reached only from the customer card once A2P registration has completed (Xander,
 * 2026-11-09) — to text a lead, promote them first.
 *
 * "What they want" carries the preview the payload already has — the call summary or the form
 * message. There is no separate AI one-line intent in the data, so the card does not invent
 * one; when the backend grows that field this is the place it goes.
 *
 * Opening a lead marks it read, so Mark unread (Xander, 2026-11-12) also closes it: left open,
 * it would read as opened again. On desktop it sits top right beside the ✕ that closes the
 * record, as a mail client's do; on a phone it is the top bar's right-hand button.
 */

export interface LeadActions {
    onDone: () => void;
    onRestore: () => void;
    onRemind: (at: Date) => void;
    onPromote: () => void;
    onDelete: () => void;
    onOpenItem: (id: string) => void;
    /** Close the record: the phone's Back, the desktop ✕, Esc. */
    onBack: () => void;
    onMarkUnread: () => void;
}

export default function LeadDetail({
    item,
    row,
    now,
    isDesktop,
    canPromote,
    remindSupported,
    promoting,
    remindOpen,
    setRemindOpen,
    error,
    actions,
}: {
    item: InboxItem;
    row: InboxRow | null;
    now: Date;
    isDesktop: boolean;
    canPromote: boolean;
    remindSupported: boolean;
    promoting: boolean;
    remindOpen: boolean;
    setRemindOpen: (v: boolean) => void;
    error: string | null;
    actions: LeadActions;
}) {
    const status = row?.status ?? (item.promoted ? "promoted" : item.archived ? "done" : "needs");
    const dial = dialNumber(item);
    const name = item.name ?? item.phoneDisplay;

    const canDone = status !== "done" && status !== "promoted";
    const canRemind = remindSupported && status !== "done" && status !== "promoted";
    // Done and promoted always read as read (`rowIsUnread`), so there is nothing to put back.
    const canMarkUnread = status !== "done" && status !== "promoted";

    const callHref = dial ? `tel:${dial}` : undefined;

    const title = (
        <h2
            className="font-extrabold truncate"
            style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--fg)" }}
        >
            {name}
        </h2>
    );
    const meta = `${item.phoneDisplay} · ${kindLabel(item)} · ${fullWhen(item.at, now)}`;

    const header = isDesktop ? (
        <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
                {title}
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" style={{ color: "var(--fg-3)" }}>
                    <span>{meta}</span>
                    <StatusChip row={{ status }} item={item} now={now} />
                </p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
                {canMarkUnread && (
                    <button
                        type="button"
                        onClick={actions.onMarkUnread}
                        data-inbox-action="unread"
                        className="h-8 px-2.5 rounded-[7px] border border-transparent inline-flex items-center gap-1.5 text-[13px] font-semibold cursor-pointer hover:bg-[var(--surface)] hover:border-[var(--rule)]"
                        style={{ color: "var(--fg-2)" }}
                    >
                        <EnvelopeSimple size={15} /> Mark unread <Key>U</Key>
                    </button>
                )}
                <button
                    type="button"
                    onClick={actions.onBack}
                    title="Close"
                    aria-label="Close"
                    className="w-8 h-8 rounded-[7px] border inline-flex items-center justify-center cursor-pointer hover:border-[var(--fg-3)]"
                    style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                >
                    <X size={14} weight="bold" />
                </button>
            </div>
        </div>
    ) : (
        <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
                {title}
                <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
                    {meta}
                </p>
            </div>
            <StatusChip row={{ status }} item={item} now={now} size="md" />
        </div>
    );

    const promoteButton = canPromote && (
        <button
            type="button"
            onClick={actions.onPromote}
            data-tour="inbox-promote"
            disabled={promoting || item.promoted}
            className={
                isDesktop
                    ? "h-[38px] px-3.5 rounded-[7px] border text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    : "min-h-11 w-full text-center font-semibold text-sm cursor-pointer disabled:opacity-60"
            }
            style={
                isDesktop
                    ? { background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }
                    : { color: "var(--accent)" }
            }
        >
            {isDesktop && <Plus size={14} weight="bold" />}
            {item.promoted ? "Already in your customers" : promoting ? "Adding…" : "Promote to customer"}
        </button>
    );

    const desktopActions = (
        <div data-tour="inbox-actions" className="relative flex flex-wrap items-center gap-2">
            <a
                href={callHref}
                aria-disabled={!callHref}
                className="h-10 px-4 rounded-[7px] text-sm font-semibold inline-flex items-center gap-2"
                style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: callHref ? 1 : 0.6 }}
            >
                <Phone size={15} weight="bold" /> Call back <Key>C</Key>
            </a>
            {canRemind && (
                <span className="relative">
                    <ActionButton onClick={() => setRemindOpen(!remindOpen)} pressed={remindOpen} remindToggle action="remind">
                        <Clock size={14} /> Remind me <Key>H</Key>
                    </ActionButton>
                    {remindOpen && (
                        <RemindPopover
                            now={now}
                            onPick={(at) => {
                                setRemindOpen(false);
                                actions.onRemind(at);
                            }}
                            onClose={() => setRemindOpen(false)}
                        />
                    )}
                </span>
            )}
            {canDone ? (
                <ActionButton onClick={actions.onDone} action="done">
                    <Check size={14} weight="bold" /> Done <Key>E</Key>
                </ActionButton>
            ) : status === "done" ? (
                <ActionButton onClick={actions.onRestore}>
                    <ArrowCounterClockwise size={14} /> Restore to inbox
                </ActionButton>
            ) : null}
            {promoteButton}
        </div>
    );

    const phoneActions = (
        <div className="flex flex-col gap-2">
            <a
                href={callHref}
                aria-disabled={!callHref}
                className="h-[52px] w-full rounded-[10px] text-base font-bold inline-flex items-center justify-center gap-2"
                style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: callHref ? 1 : 0.6 }}
            >
                <Phone size={18} weight="bold" /> Call back
            </a>
            <div className="grid grid-flow-col auto-cols-fr gap-2">
                {canRemind && (
                    <TileButton onClick={() => setRemindOpen(true)}>
                        <Clock size={18} /> Remind me
                    </TileButton>
                )}
                {canDone ? (
                    <TileButton onClick={actions.onDone}>
                        <Check size={18} weight="bold" /> Done
                    </TileButton>
                ) : status === "done" ? (
                    <TileButton onClick={actions.onRestore}>
                        <ArrowCounterClockwise size={18} /> Restore to inbox
                    </TileButton>
                ) : null}
            </div>
        </div>
    );

    const gap = item.callback ? callbackGap(item.at, item.callback.at) : null;

    return (
        <div className="flex flex-col min-h-0 h-full">
            {!isDesktop && (
                <div className="shrink-0 h-14 flex items-center justify-between px-1.5 border-b" style={{ background: "var(--elev-1)", borderColor: "var(--rule)" }}>
                    <button
                        type="button"
                        onClick={actions.onBack}
                        className="inline-flex items-center gap-1 h-11 px-2.5 text-[15px] font-semibold cursor-pointer"
                        style={{ color: "var(--accent)" }}
                    >
                        <CaretLeft size={18} weight="bold" /> Inbox
                    </button>
                    {canMarkUnread && (
                        <button
                            type="button"
                            onClick={actions.onMarkUnread}
                            className="inline-flex items-center h-11 px-2.5 text-[15px] font-semibold cursor-pointer"
                            style={{ color: "var(--accent)" }}
                        >
                            Mark unread
                        </button>
                    )}
                </div>
            )}

            <div className={isDesktop ? "shrink-0 px-6 pt-[18px] pb-3.5 border-b flex flex-col gap-2.5" : "px-4 pt-4 flex flex-col gap-3"} style={{ borderColor: "var(--rule)" }}>
                {header}
                {isDesktop ? desktopActions : phoneActions}
                {!canPromote && (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--fg-3)" }}>
                        Customer records and follow-up texting come with Growth.
                    </p>
                )}
            </div>

            <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-3.5 ${isDesktop ? "px-6 py-[18px]" : "px-4 py-3 pb-8"}`}>
                {error && (
                    <p className="text-sm" style={{ color: "var(--chart-neg)" }}>
                        {error}
                    </p>
                )}

                <Card data-tour="inbox-detail">
                    <Label>What they want</Label>
                    <p className="text-sm leading-relaxed" style={{ color: item.preview ? "var(--fg)" : "var(--fg-3)" }}>
                        {item.preview ?? "No message"}
                    </p>
                </Card>

                {/* Recordings are signed portal URLs (`/api/portal/calls/<id>/recording`), so
                    the plain player is all this needs; preload none, so nothing is fetched
                    until they press play. */}
                {item.recordingUrl && !item.callback && (
                    <Card>
                        <Label>Recording</Label>
                        <audio controls preload="none" src={item.recordingUrl} className="w-full" />
                    </Card>
                )}

                {item.callback && (
                    <Card>
                        <div className="flex items-start gap-2.5 text-[13.5px]" style={{ color: "var(--fg)" }}>
                            <Chip tone="pos">Callback</Chip>
                            <span>
                                {gap
                                    ? `Your receptionist called them back ${gap} later.`
                                    : "Your receptionist called them back"}
                            </span>
                        </div>
                        {item.callback.summary && (
                            <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-2)" }}>
                                {item.callback.summary}
                            </p>
                        )}
                        {item.callback.recordingUrl && (
                            <audio controls preload="none" src={item.callback.recordingUrl} className="w-full" />
                        )}
                    </Card>
                )}

                {row && row.count > 1 && (
                    <Card>
                        <Label>{row.count} calls</Label>
                        <ul className="divide-y" style={{ borderColor: "var(--rule-weak)" }}>
                            {row.items.map((sub) => (
                                <li key={sub.id}>
                                    <button
                                        type="button"
                                        onClick={() => actions.onOpenItem(sub.id)}
                                        aria-current={sub.id === item.id ? "true" : undefined}
                                        className="w-full flex items-center gap-3 py-2.5 min-h-11 text-left cursor-pointer"
                                    >
                                        <span
                                            className="shrink-0 w-[118px] text-[11px]"
                                            style={{ fontFamily: "var(--font-mono)", color: sub.id === item.id ? "var(--accent)" : "var(--fg-3)" }}
                                        >
                                            {fullWhen(sub.at, now)}
                                        </span>
                                        <span className="shrink-0 w-[52px] text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                            {duration(sub.durationSeconds) ?? "—"}
                                        </span>
                                        <span className="flex-1 min-w-0 truncate text-[12.5px]" style={{ color: "var(--fg-2)" }}>
                                            {sub.preview ?? "No message"}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}

                <div className="portal-elev grid grid-cols-2 lg:grid-cols-3">
                    <Fact label="Phone">
                        {item.phone ? (
                            <a href={`tel:${item.phone}`} style={{ color: "var(--accent)" }}>
                                {item.phoneDisplay}
                            </a>
                        ) : (
                            "No number"
                        )}
                    </Fact>
                    {item.callbackPhone && (
                        <Fact label="Callback number">
                            <a href={`tel:${item.callbackPhone}`} style={{ color: "var(--accent)" }}>
                                {item.callbackPhoneDisplay}
                            </a>
                        </Fact>
                    )}
                    {item.email && (
                        <Fact label="Email">
                            <a href={`mailto:${item.email}`} className="break-all" style={{ color: "var(--accent)" }}>
                                {item.email}
                            </a>
                        </Fact>
                    )}
                    <Fact label="Address">{item.address ?? "—"}</Fact>
                    <Fact label="Came in">{fullWhen(item.at, now)}</Fact>
                </div>

                {!isDesktop && promoteButton}

                {/* The one destructive path in the inbox, behind the confirmation the parent
                    owns. Only a web enquiry is ours to destroy (a call is a row in the client's
                    own Airtable log), and only once it is Done, as before. */}
                {item.source === "web-form" && status === "done" && (
                    <button
                        type="button"
                        onClick={actions.onDelete}
                        className="self-start inline-flex items-center gap-1.5 min-h-11 lg:min-h-0 text-[13px] font-medium cursor-pointer"
                        style={{ color: "var(--chart-neg)" }}
                    >
                        <Trash size={14} /> Delete
                    </button>
                )}
            </div>

            {!isDesktop && remindOpen && canRemind && (
                <RemindSheet
                    now={now}
                    onPick={(at) => {
                        setRemindOpen(false);
                        actions.onRemind(at);
                    }}
                    onClose={() => setRemindOpen(false)}
                />
            )}
        </div>
    );
}

function Key({ children }: { children: React.ReactNode }) {
    return (
        // Full-strength colour, not the mockup's .65 opacity: faded, the hint on the blue button
        // would drop to about 3.4:1.
        <span aria-hidden="true" className="text-[10px] font-normal" style={{ fontFamily: "var(--font-mono)" }}>
            {children}
        </span>
    );
}

function ActionButton({
    onClick,
    pressed,
    remindToggle,
    action,
    children,
}: {
    onClick: () => void;
    pressed?: boolean;
    remindToggle?: boolean;
    /** What the e / h shortcuts click, so a shortcut and its button can never disagree. */
    action?: "remind" | "done";
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={pressed}
            data-remind-toggle={remindToggle ? "" : undefined}
            data-inbox-action={action}
            className="h-[38px] px-3.5 rounded-[7px] border text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:border-[var(--fg-3)]"
            style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
        >
            {children}
        </button>
    );
}

function TileButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="h-14 rounded-[10px] border flex flex-col items-center justify-center gap-[3px] text-[12.5px] font-semibold cursor-pointer"
            style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
        >
            {children}
        </button>
    );
}

function Card({ children, "data-tour": dataTour }: { children: React.ReactNode; "data-tour"?: string }) {
    return (
        <div className="portal-elev px-4 py-3.5 flex flex-col gap-2" data-tour={dataTour}>
            {children}
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <span
            className="text-[10.5px] uppercase tracking-[0.06em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
        >
            {children}
        </span>
    );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="px-3.5 py-2.5 flex flex-col gap-[3px] min-w-0 text-[13px]" style={{ color: "var(--fg)" }}>
            <Label>{label}</Label>
            <span className="min-w-0">{children}</span>
        </div>
    );
}
