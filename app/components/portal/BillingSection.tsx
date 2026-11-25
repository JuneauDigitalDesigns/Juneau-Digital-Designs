"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { planName, planNameOf, type PortalSiteProps } from "@/app/portal/types";
import { StatTile } from "./ui/StatTile";
import { FeatureError } from "./ui/FeatureState";
import { SectionCard, FieldRow, StaticField, inputStyle } from "./ui/FormPrimitives";
import { StatRowSkeleton, TableSkeleton } from "./ui/Skeleton";
import { useCachedFetch, useInvalidate, CLIENT_TTL } from "./PortalDataProvider";
import { cancellationCardText, downgradeTile } from "@/app/lib/plan-change-copy";
import {
    BILLING_COPY as C,
    billingDate,
    renewalDay,
    statusText,
    type BillingStatus,
    type BillingStatusKind,
} from "@/app/lib/billing-tab";

interface Invoice {
    id: string;
    number: string | null;
    created: number;
    amountPaid: number;
    amountRemaining?: number;
    currency: string;
    status: string | null;
    url: string | null;
    pdf: string | null;
}

interface BillingData {
    state: "ready" | "pending-build" | "connecting" | "not-billed" | "error";
    plan?: string;
    status?: string;
    statusKind?: BillingStatusKind;
    endsAt?: number | null;
    amount?: number | null;
    currency?: string;
    interval?: string | null;
    currentPeriodStart?: number | null;
    currentPeriodEnd?: number | null;
    cancelAt?: number | null;
    endedAt?: number | null;
    nextPayment?: { amount: number; currency: string; dueAt: number | null; dueNow: boolean } | null;
    sitesOnPlan?: string[];
    canUpdateCard?: boolean;
    /** A downgrade the client accepted, waiting for the end of the paid period. */
    pendingPlanChange?: { fromPlan: string; toPlan: string; effectiveAt: number } | null;
    paymentMethod?: { brand: string; last4: string; expMonth: number; expYear: number } | null;
    invoices?: Invoice[];
    error?: string;
}

function money(cents: number | null | undefined, currency = "usd"): string | null {
    if (cents === null || cents === undefined) return null;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(cents / 100);
}

function date(ms: number | null | undefined): string {
    return billingDate(ms) || "—";
}

const CONTACT = "hello@juneaudigitaldesigns.com";

/** `GET /api/portal/cancel`: what cancelling this site would do right now. */
interface CancelTerms {
    mode: "refund" | "period-end";
    periodEndText?: string;
    hasMinutes?: boolean;
    refund?: { amountCents: number; amountText: string; windowEndsAt: number } | null;
}

/** The cancel card's words (E5, B5): one of four versions, from what the server says. */
function cardText(terms: CancelTerms | null, periodEnd: number | null, site: PortalSiteProps): string {
    return cancellationCardText({
        periodEnd: terms?.periodEndText ?? date(periodEnd),
        refund: terms?.mode === "refund" && terms.refund ? { amount: terms.refund.amountText } : null,
        hasMinutes: terms?.hasMinutes ?? !site.webOnly,
    });
}

/**
 * Settings › Plan & billing.
 *
 * Status, the real next payment, the term's dates, Update card, invoices with a View link, and a
 * cancel step in a dialog, in the wording Xander approved on 2026-11-16 (`billing-tab.ts`). Every
 * state is read from Stripe and the portal record, so a cancellation shows as "Cancelling" on every
 * visit, not only in the browser tab that made it.
 *
 * `usage` is the call-minutes meter, streamed from the server by the page; it sits under the plan
 * figures it belongs to, and is shown whatever state the subscription read is in.
 */
export default function BillingSection({
    site,
    accountEmail,
    usage,
}: {
    site: PortalSiteProps;
    accountEmail: string;
    usage?: ReactNode;
}) {
    const {
        data,
        isLoading,
        refresh: retry,
    } = useCachedFetch<BillingData>(
        `billing:${site.slug}`,
        `/api/portal/billing?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.billing,
    );

    if (isLoading) {
        return (
            <div className="space-y-8">
                <StatRowSkeleton count={3} />
                <TableSkeleton rows={4} />
            </div>
        );
    }

    if (!data || data.state === "error") {
        return (
            <div className="space-y-8">
                <FeatureError message={data?.error} onRetry={retry} />
                {usage && <div data-tour="billing-minutes">{usage}</div>}
            </div>
        );
    }

    if (data.state !== "ready") {
        // Three different reasons there's nothing to show, and only one of them is a
        // promise we can keep. "not-billed" is a settled fact, not a pending task.
        const body =
            data.state === "pending-build"
                ? "Your invoices and next charge date will appear here once your site is live."
                : data.state === "not-billed"
                  ? "This site isn't billed through the portal, so there's nothing to show here. Get in touch about anything billing-related and we'll sort it out directly."
                  : "Your site is live and we're still linking up your billing details. Nothing is needed from you.";
        return (
            <div className="space-y-8">
                <SectionCard title="Plan" dataTour="billing-plan">
                    <StaticField label="Plan" value={planName(site)} />
                    <StaticField label="Billing account" value={accountEmail} />
                    <p className="text-sm" style={{ color: "var(--fg-2)" }}>
                        {body}
                    </p>
                    {data.state === "not-billed" && (
                        <p className="mt-3 text-sm">
                            <a
                                href={`mailto:${CONTACT}`}
                                className="underline underline-offset-4"
                                style={{ color: "var(--accent)" }}
                            >
                                {CONTACT}
                            </a>
                        </p>
                    )}
                </SectionCard>
                {usage && <div data-tour="billing-minutes">{usage}</div>}
            </div>
        );
    }

    const kind: BillingStatusKind = data.statusKind ?? "active";
    const status: BillingStatus =
        kind === "cancelling" && data.endsAt ? { kind, endsAt: data.endsAt } : kind === "cancelling" ? { kind: "active" } : { kind };
    const invoices = data.invoices ?? [];
    const amount = money(data.amount, data.currency);
    const endsOn = status.kind === "cancelling" ? date(status.endsAt) : "";

    return (
        <div className="space-y-8">
            <StatusBanner
                status={status}
                canUpdateCard={Boolean(data.canUpdateCard)}
                endedAt={data.endedAt ?? data.currentPeriodEnd ?? null}
            />

            <div data-tour="billing-plan" className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatTile
                    label="Plan"
                    value={planName(site)}
                    hint={amount && data.interval ? `${amount} per ${data.interval}` : undefined}
                    size="sm"
                />
                <StatTile label={C.statusLabel} value={statusText(status)} tone={statusTone(status.kind)} size="sm" />
                <NextPaymentTile data={data} kind={status.kind} minutes={!site.webOnly} />
            </div>

            {usage && <div data-tour="billing-minutes">{usage}</div>}

            {data.pendingPlanChange && status.kind !== "cancelling" && (
                <p
                    className="text-sm rounded-md px-3.5 py-2.5 border"
                    style={{ color: "var(--fg-2)", background: "var(--surface)", borderColor: "var(--rule)" }}
                >
                    {downgradeTile({
                        toName: planNameOf(data.pendingPlanChange.toPlan),
                        fromName: planNameOf(data.pendingPlanChange.fromPlan),
                        date: date(data.pendingPlanChange.effectiveAt),
                    })}
                </p>
            )}

            {status.kind !== "cancelled" && (
                <SectionCard title={C.subscriptionTitle}>
                    {data.currentPeriodStart && data.currentPeriodEnd && (
                        <StaticField
                            label={C.currentTermLabel}
                            value={C.currentTerm(date(data.currentPeriodStart), date(data.currentPeriodEnd))}
                        />
                    )}
                    {status.kind === "cancelling" ? (
                        <StaticField label={C.renewsLabel} value={C.renewsEnding(endsOn)} />
                    ) : (
                        data.currentPeriodEnd &&
                        (status.kind === "active" || status.kind === "overdue") && (
                            <StaticField label={C.renewsLabel} value={C.renewsMonthly(renewalDay(data.currentPeriodEnd))} />
                        )
                    )}
                    <StaticField label="Billing account" value={accountEmail} />
                    {(data.sitesOnPlan?.length ?? 0) > 0 && (
                        <StaticField
                            label={C.sitesOnPlanLabel}
                            value={
                                <>
                                    {data.sitesOnPlan!.map((name) => (
                                        <span key={name} className="block">
                                            {name}
                                        </span>
                                    ))}
                                </>
                            }
                        />
                    )}
                </SectionCard>
            )}

            {status.kind !== "cancelled" && (
                <PaymentMethodCard site={site} card={data.paymentMethod ?? null} canUpdateCard={Boolean(data.canUpdateCard)} />
            )}

            <SectionCard title="Invoices">
                {invoices.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--fg-2)" }}>
                        No invoices yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                                    {["Date", "Invoice", "Amount", "Status", ""].map((h) => (
                                        <th
                                            key={h}
                                            className="text-left px-3 py-2 text-xs uppercase tracking-widest font-medium whitespace-nowrap"
                                            style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--fg-2)" }}>
                                            {date(inv.created)}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
                                            {inv.number ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--fg)" }}>
                                            {money(inv.amountPaid, inv.currency)}
                                        </td>
                                        <td className="px-3 py-2.5 capitalize whitespace-nowrap" style={{ color: "var(--fg-2)" }}>
                                            {inv.status ?? "—"}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                            {inv.url && (
                                                <a
                                                    href={inv.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="underline underline-offset-4"
                                                    style={{ color: "var(--accent)" }}
                                                >
                                                    {C.invoiceView}
                                                </a>
                                            )}
                                            {inv.url && inv.pdf && <span style={{ color: "var(--fg-3)" }}> · </span>}
                                            {inv.pdf && (
                                                <a
                                                    href={inv.pdf}
                                                    className="underline underline-offset-4"
                                                    style={{ color: "var(--accent)" }}
                                                >
                                                    PDF
                                                </a>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>

            {/* Q5: any site with a subscription can cancel, live or not. */}
            {(status.kind === "active" || status.kind === "overdue" || status.kind === "cancelling") && (
                <CancellationCard
                    site={site}
                    periodEnd={data.currentPeriodEnd ?? null}
                    endsAt={status.kind === "cancelling" ? (status.endsAt ?? null) : null}
                />
            )}
        </div>
    );
}

function statusTone(kind: BillingStatusKind): "default" | "positive" | "negative" | "warn" {
    if (kind === "active") return "positive";
    if (kind === "cancelling") return "warn";
    if (kind === "overdue") return "negative";
    return "default";
}

function NextPaymentTile({ data, kind, minutes }: { data: BillingData; kind: BillingStatusKind; minutes: boolean }) {
    const next = data.nextPayment ?? null;
    if (kind === "active") {
        // The real next invoice (overage included); the plan price only if Stripe's preview failed.
        const value = next ? money(next.amount, next.currency) : money(data.amount, data.currency);
        const on = next?.dueAt ?? data.currentPeriodEnd ?? null;
        return <StatTile label={C.nextPaymentLabel} value={value} hint={on ? C.nextPaymentOn(date(on)) : undefined} size="sm" />;
    }
    if (kind === "overdue") {
        const value = next ? money(next.amount, next.currency) : money(data.amount, data.currency);
        return <StatTile label={C.nextPaymentLabel} value={value} hint={C.overdueHint} tone="negative" size="sm" />;
    }
    if (kind === "cancelling") {
        return <StatTile label={C.nextPaymentLabel} value={C.nextPaymentNone} hint={minutes ? C.nextPaymentNoneHint : C.nextPaymentNoneHintNoMinutes} size="sm" />;
    }
    return <StatTile label={C.nextPaymentLabel} value={C.nextPaymentNone} size="sm" />;
}

function StatusBanner({
    status,
    canUpdateCard,
    endedAt,
}: {
    status: BillingStatus;
    canUpdateCard: boolean;
    /** When a cancelled subscription ended (epoch ms). */
    endedAt: number | null;
}) {
    if (status.kind === "active") return null;
    const content =
        status.kind === "cancelling"
            ? { tone: "warn", title: C.cancellingBanner(date(status.endsAt)), body: C.cancellingBannerAfter }
            : status.kind === "cancelled"
              ? { tone: "off", title: C.cancelledBanner(date(endedAt)), body: C.cancelledBannerAfter }
              : status.kind === "overdue"
                ? {
                      tone: "bad",
                      title: C.overdueBanner,
                      body: canUpdateCard ? C.overdueBannerAfter : C.overdueBannerAfterNoCardPage,
                  }
                : { tone: "off", title: C.inactiveBanner, body: C.inactiveBannerAfter };

    const colour =
        content.tone === "warn"
            ? "var(--warn, #b45309)"
            : content.tone === "bad"
              ? "var(--accent-2)"
              : "var(--fg-3)";
    return (
        <div
            role="status"
            className="rounded-lg px-4 py-3 text-sm"
            style={{
                background: content.tone === "off" ? "var(--surface)" : `color-mix(in srgb, ${colour} 7%, transparent)`,
                border: `1px solid ${content.tone === "off" ? "var(--rule)" : `color-mix(in srgb, ${colour} 30%, transparent)`}`,
                color: "var(--fg-2)",
            }}
        >
            <p className="font-semibold mb-0.5" style={{ color: "var(--fg)" }}>
                {content.title}
            </p>
            <p>{content.body}</p>
        </div>
    );
}

function PaymentMethodCard({
    site,
    card,
    canUpdateCard,
}: {
    site: PortalSiteProps;
    card: BillingData["paymentMethod"] | null;
    canUpdateCard: boolean;
}) {
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function openCardPage() {
        setOpening(true);
        setError(null);
        try {
            const res = await fetch(`/api/portal/billing/card?site=${encodeURIComponent(site.slug)}`, { method: "POST" });
            const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
            if (!res.ok || !body.url) throw new Error(body.error ?? "We couldn't open the card page just now.");
            window.location.href = body.url;
        } catch (e) {
            setError(e instanceof Error ? e.message : "We couldn't open the card page just now.");
            setOpening(false);
        }
    }

    return (
        <SectionCard title="Payment method">
            {card ? (
                <StaticField
                    label="Card on file"
                    value={
                        <>
                            <span className="capitalize">{card.brand}</span> ending {card.last4}
                            <span style={{ color: "var(--fg-3)" }}>
                                {" "}
                                · expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                            </span>
                        </>
                    }
                />
            ) : (
                <p className="text-sm" style={{ color: "var(--fg-2)" }}>
                    No card is shown for this subscription.
                </p>
            )}
            {canUpdateCard ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={openCardPage}
                        disabled={opening}
                        className="px-4 py-2 rounded-md text-sm font-semibold"
                        style={{
                            border: "1px solid var(--rule)",
                            background: "var(--panel, transparent)",
                            color: "var(--fg)",
                            cursor: opening ? "wait" : "pointer",
                            opacity: opening ? 0.6 : 1,
                        }}
                    >
                        {C.updateCardButton}
                    </button>
                    <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                        {C.updateCardLine}
                    </span>
                </div>
            ) : (
                <p className="text-sm" style={{ color: "var(--fg-3)" }}>
                    To change your card, email{" "}
                    <a href={`mailto:${CONTACT}`} className="underline underline-offset-4" style={{ color: "var(--accent)" }}>
                        {CONTACT}
                    </a>{" "}
                    and we&apos;ll send a secure link.
                </p>
            )}
            {error && (
                <p className="mt-2 text-sm" style={{ color: "var(--accent-2)" }}>
                    {error}
                </p>
            )}
        </SectionCard>
    );
}

/**
 * Cancellation.
 *
 * It belongs next to what the client is actually paying. The business-name check is in a confirm
 * dialog (§5.3) rather than inline, so the card can't be cancelled by typing into the page. No undo
 * button (Q6): a client who changes their mind emails JDD.
 */
function CancellationCard({
    site,
    periodEnd,
    endsAt,
}: {
    site: PortalSiteProps;
    /** When the month already paid for ends (epoch ms). */
    periodEnd: number | null;
    /** Set when the subscription is already cancelling. */
    endsAt: number | null;
}) {
    const invalidate = useInvalidate();
    const [open, setOpen] = useState(false);
    const [requestedEnd, setRequestedEnd] = useState<string | null>(null);
    // What cancelling would do, read live from Stripe by the server (never from the cached billing
    // payload, never worked out here): the refund version of the card inside 30 days, else the
    // period-end one. Until it answers, or if it fails, the card says the period-end words.
    const [terms, setTerms] = useState<CancelTerms | null>(null);
    const needsTerms = !(endsAt || requestedEnd);
    useEffect(() => {
        if (!needsTerms) return;
        let live = true;
        void fetch(`/api/portal/cancel?site=${encodeURIComponent(site.slug)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((t) => live && t && typeof t.mode === "string" && setTerms(t as CancelTerms))
            .catch(() => {});
        return () => {
            live = false;
        };
    }, [site.slug, needsTerms]);

    const endDate = endsAt ? date(endsAt) : requestedEnd;
    if (endDate) {
        return (
            <SectionCard title="Cancellation">
                <div
                    className="rounded-lg p-4"
                    style={{
                        background: "color-mix(in srgb, var(--accent-2) 10%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--accent-2) 35%, transparent)",
                    }}
                >
                    <p className="font-semibold text-sm" style={{ color: "var(--fg)" }}>
                        Cancellation requested
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}>
                        Your service ends on <strong>{endDate}</strong>. You keep full access until then, and a
                        confirmation was sent to your account email.
                    </p>
                </div>
            </SectionCard>
        );
    }

    return (
        <SectionCard title="Cancellation">
            <p className="text-sm mb-4" style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}>
                {cardText(terms, periodEnd, site)}
            </p>

            {site.plan === "enterprise" && (
                <p
                    className="text-sm rounded-md px-3.5 py-2.5 mb-4 border"
                    style={{ color: "var(--fg-3)", background: "var(--surface)", borderColor: "var(--rule)" }}
                >
                    Enterprise subscriptions cover all sites under your account. Cancelling ends all of
                    them on the same date.
                </p>
            )}

            <button
                type="button"
                onClick={() => setOpen(true)}
                className="px-5 py-2 rounded-md text-sm font-semibold"
                style={{ border: "1px solid var(--accent-2)", background: "transparent", color: "var(--accent-2)", cursor: "pointer" }}
            >
                {C.cancelButton}
            </button>

            {open && (
                <CancelDialog
                    site={site}
                    periodEnd={periodEnd}
                    terms={terms}
                    onTerms={setTerms}
                    onClose={() => setOpen(false)}
                    onCancelled={(effectiveDate) => {
                        setOpen(false);
                        setRequestedEnd(effectiveDate);
                        // The route dropped the server cache; this drops the browser's copy too,
                        // so the whole tab turns to "Cancelling" without a reload.
                        invalidate(`billing:${site.slug}`);
                    }}
                />
            )}
        </SectionCard>
    );
}

function CancelDialog({
    site,
    periodEnd,
    terms,
    onTerms,
    onClose,
    onCancelled,
}: {
    site: PortalSiteProps;
    periodEnd: number | null;
    terms: CancelTerms | null;
    onTerms: (t: CancelTerms) => void;
    onClose: () => void;
    onCancelled: (effectiveDate: string | null) => void;
}) {
    const [confirm, setConfirm] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const nameMatches = confirm.trim().toLowerCase() === site.name.toLowerCase();

    useEffect(() => {
        inputRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !submitting) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, submitting]);

    async function cancel() {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/portal/cancel?site=${encodeURIComponent(site.slug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // `expect` is what the card promised. If the window closed since, the server answers
                // 409 with the real mode and nothing is cancelled or refunded.
                body: JSON.stringify({ confirm, expect: terms?.mode ?? "period-end" }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (res.status === 409 && (data.mode === "refund" || data.mode === "period-end") && data.mode !== (terms?.mode ?? "period-end")) {
                // The card is re-read, so the client sees the new promise before confirming again.
                const next = await fetch(`/api/portal/cancel?site=${encodeURIComponent(site.slug)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
                if (next && typeof next.mode === "string") onTerms(next as CancelTerms);
            }
            if (!res.ok) throw new Error((data.error as string) ?? "Cancellation failed");
            // A cancel inside the 30-day window ends the service today and answers `refunded`
            // with no end date: the refreshed tab then shows the Cancelled banner.
            onCancelled(typeof data.effectiveDate === "string" ? data.effectiveDate : null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Cancellation failed. Please contact support.");
            setSubmitting(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16"
            style={{ background: "rgba(13,17,23,.38)" }}
            onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-dialog-title"
                className="w-full max-w-[520px] rounded-xl p-5 shadow-2xl"
                style={{ background: "var(--panel, #fff)", color: "var(--fg)" }}
            >
                <h2 id="cancel-dialog-title" className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                    {C.confirmHeading}
                </h2>
                <p className="text-sm mb-2.5" style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}>
                    {cardText(terms, periodEnd, site)}
                </p>
                <p className="text-sm mb-3" style={{ color: "var(--fg-2)" }}>
                    {terms?.mode === "refund" ? C.confirmAfterRefund : C.confirmAfter}
                </p>
                <FieldRow label={C.confirmField(site.name)}>
                    <input
                        ref={inputRef}
                        value={confirm}
                        onChange={(e) => {
                            setConfirm(e.target.value);
                            setError(null);
                        }}
                        placeholder={site.name}
                        style={inputStyle}
                        autoComplete="off"
                    />
                </FieldRow>
                {error && (
                    <p className="text-sm mb-3" style={{ color: "var(--accent-2)" }}>
                        {error}
                    </p>
                )}
                <div className="mt-4 flex flex-wrap justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-md text-sm font-semibold"
                        style={{ border: "1px solid var(--rule)", background: "transparent", color: "var(--fg)", cursor: "pointer" }}
                    >
                        {C.keepButton}
                    </button>
                    <button
                        type="button"
                        onClick={cancel}
                        disabled={submitting || !nameMatches}
                        className="px-4 py-2 rounded-md text-sm font-semibold"
                        style={{
                            border: "1px solid var(--accent-2)",
                            background: "transparent",
                            color: "var(--accent-2)",
                            cursor: submitting || !nameMatches ? "not-allowed" : "pointer",
                            opacity: submitting || !nameMatches ? 0.5 : 1,
                        }}
                    >
                        {submitting ? "Requesting…" : C.cancelButton}
                    </button>
                </div>
            </div>
        </div>
    );
}
