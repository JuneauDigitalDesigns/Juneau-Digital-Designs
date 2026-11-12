"use client";

import { useMemo, useState } from "react";
import { defaultReviewMessage } from "@/app/lib/review-message";
import Popover from "./ui/Popover";
import { CardLabel } from "./ui/Card";

/**
 * The review-request composer.
 *
 * Pre-fills an editable message with the caller's first name, the business name and a suggested
 * (deletable) discount line. The Google review link and the "Reply STOP" line are NOT editable
 * here — the server appends them, always, so a client cannot send a broken link or a
 * non-compliant message. One send per caller: once sent, this locks.
 *
 * It opens as a window right below the button that asked for it (`ui/Popover`), not as a drawer
 * from the right (Xander, 2026-11-12). The caller owns placement: it puts its button and this in
 * one `relative` element and passes the button as `triggerRef`.
 */

interface ContactLike {
    contactId: string;
    displayName: string | null;
    phone: string | null;
    phoneDisplay: string;
    reviewSent: { sentAt: string; deliveryStatus: string; optedOut: boolean } | null;
}

function fmtDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

export default function ReviewRequestDialog({
    open,
    onClose,
    contact,
    businessName,
    reviewLinkConfigured,
    messagingState = "ready",
    siteSlug,
    onSent,
    triggerRef,
    align = "end",
}: {
    open: boolean;
    onClose: () => void;
    contact: ContactLike | null;
    businessName: string;
    reviewLinkConfigured: boolean;
    /** Customer-facing SMS waits on the client's own A2P campaign — see the `messaging` gate. */
    messagingState?: "ready" | "not-on-plan" | "pending-build" | "connecting";
    siteSlug: string;
    onSent: (contactId: string) => void;
    /** The "Request a review" button. The popover hangs under it and hands focus back to it. */
    triggerRef: React.RefObject<HTMLElement | null>;
    /** `end` under the panel header's row of buttons; `stretch` under the phone sheet's full-width one. */
    align?: "end" | "stretch";
}) {
    const defaultBody = useMemo(
        () => (contact ? defaultReviewMessage(contact.displayName, businessName) : ""),
        [contact, businessName],
    );

    const [body, setBody] = useState(defaultBody);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset the editor whenever a different contact opens the dialog.
    const [seededFor, setSeededFor] = useState<string | null>(null);
    if (contact && seededFor !== contact.contactId) {
        setSeededFor(contact.contactId);
        setBody(defaultBody);
        setError(null);
    }

    const alreadySent = Boolean(contact?.reviewSent);
    const noNumber = !contact?.phone;
    const waiting = messagingState !== "ready";
    const canSend =
        Boolean(contact) && reviewLinkConfigured && !alreadySent && !noNumber && !waiting && !sending;

    async function send() {
        if (!contact?.phone) return;
        setSending(true);
        setError(null);
        try {
            const res = await fetch(`/api/portal/review-request?site=${encodeURIComponent(siteSlug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: contact.phone, messageBody: body }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json?.error ?? "We couldn't send that just now. Please try again.");
                return;
            }
            onSent(contact.contactId);
            onClose();
        } catch {
            setError("We couldn't send that just now. Please try again.");
        } finally {
            setSending(false);
        }
    }

    return (
        <Popover open={open} onClose={onClose} label="Request a Google review" triggerRef={triggerRef} align={align}>
            {contact && (
                <div className="space-y-4">
                    <div className="flex items-start gap-2.5">
                        <div className="flex-1 min-w-0">
                            <h3
                                className="m-0 mb-1 text-[15px] font-bold"
                                style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
                            >
                                Request a Google review
                            </h3>
                            <p className="m-0 text-[12.5px] leading-snug" style={{ color: "var(--fg-2)" }}>
                                To {contact.displayName ?? "this caller"} · {contact.phoneDisplay} · sent from your business number
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="portal-hit shrink-0 w-8 h-8 -mr-1 -mt-1 rounded-md flex items-center justify-center cursor-pointer"
                            style={{ color: "var(--fg-2)" }}
                        >
                            ✕
                        </button>
                    </div>

                    {alreadySent ? (
                        <LockedNote>
                            Review request already sent{contact.reviewSent?.sentAt ? ` on ${fmtDate(contact.reviewSent.sentAt)}` : ""}
                            {contact.reviewSent?.deliveryStatus ? ` · ${contact.reviewSent.deliveryStatus}` : ""}. You can
                            only send one per customer.
                        </LockedNote>
                    ) : noNumber ? (
                        <LockedNote>We don&rsquo;t have a mobile number for this caller, so we can&rsquo;t text them.</LockedNote>
                    ) : waiting ? (
                        <LockedNote>
                            {messagingState === "not-on-plan"
                                ? "Review requests come with Growth."
                                : "Review requests turn on once the carriers approve your business registration."}
                        </LockedNote>
                    ) : !reviewLinkConfigured ? (
                        <LockedNote>
                            Your Google review link isn&rsquo;t set up yet — contact Juneau Digital Designs and we&rsquo;ll add
                            it. (It&rsquo;s set up for you, not edited here.)
                        </LockedNote>
                    ) : null}

                    <div>
                        <CardLabel>Message</CardLabel>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={5}
                            data-demo="review-message"
                            disabled={!canSend && !sending}
                            className="mt-2 w-full text-sm rounded-lg border p-3 outline-none"
                            style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                        />
                        <p className="mt-2 text-xs" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                            Your Google review link and “Reply STOP to opt out” are added automatically.
                        </p>
                    </div>

                    {error && (
                        <p className="text-sm" style={{ color: "var(--chart-neg)" }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={send}
                        data-demo="review-send"
                        disabled={!canSend}
                        className="w-full rounded-lg px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        {sending ? "Sending…" : alreadySent ? "Already sent" : "Send review request"}
                    </button>
                </div>
            )}
        </Popover>
    );
}

function LockedNote({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="rounded-lg border p-3 text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--rule)", color: "var(--fg-2)" }}
        >
            {children}
        </div>
    );
}
