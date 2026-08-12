"use client";

import { useState } from "react";
import type { PortalSiteProps } from "@/app/portal/types";
import { SectionHeader } from "./ui/Card";
import { StatTile } from "./ui/StatTile";
import { FeatureError } from "./ui/FeatureState";
import { SectionCard, FieldRow, StaticField, inputStyle } from "./ui/FormPrimitives";
import { StatRowSkeleton, TableSkeleton } from "./ui/Skeleton";
import { useCachedFetch, useInvalidate, CLIENT_TTL } from "./PortalDataProvider";
import { freshness } from "./ui/format";

interface Invoice {
    id: string;
    number: string | null;
    created: number;
    amountPaid: number;
    currency: string;
    status: string | null;
    url: string | null;
    pdf: string | null;
}

interface BillingData {
    state: "ready" | "pending-build" | "connecting" | "not-billed" | "error";
    plan?: string;
    status?: string;
    amount?: number | null;
    currency?: string;
    interval?: string | null;
    currentPeriodEnd?: number;
    cancelAt?: number | null;
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
    if (!ms) return "—";
    return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const planLabel: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
};

export default function BillingSection({
    site,
    accountEmail,
}: {
    site: PortalSiteProps;
    accountEmail: string;
}) {
    const {
        data,
        isLoading,
        fetchedAt,
        refresh: retry,
    } = useCachedFetch<BillingData>(
        `billing:${site.slug}`,
        `/api/portal/billing?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.billing,
    );

    if (isLoading) {
        return (
            <div className="space-y-8">
                <SectionHeader title="Billing" />
                <StatRowSkeleton count={3} />
                <TableSkeleton rows={4} />
            </div>
        );
    }

    if (!data || data.state === "error") {
        return (
            <div className="space-y-8">
                <SectionHeader title="Billing" />
                <FeatureError message={data?.error} onRetry={retry} />
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
                <SectionHeader title="Billing" />
                <SectionCard title="Plan">
                    <StaticField label="Plan" value={planLabel[site.plan] ?? site.plan} />
                    <StaticField label="Billing account" value={accountEmail} />
                    <p className="text-sm" style={{ color: "var(--fg-2)" }}>
                        {body}
                    </p>
                    {data.state === "not-billed" && (
                        <p className="mt-3 text-sm">
                            <a
                                href="mailto:hello@juneaudigitaldesigns.com"
                                className="underline underline-offset-4"
                                style={{ color: "var(--accent)" }}
                            >
                                hello@juneaudigitaldesigns.com
                            </a>
                        </p>
                    )}
                </SectionCard>
            </div>
        );
    }

    const invoices = data.invoices ?? [];
    const amount = money(data.amount, data.currency);

    return (
        <div className="space-y-8">
            <SectionHeader title="Billing" meta={freshness(undefined, fetchedAt)} />

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatTile label="Plan" value={planLabel[site.plan] ?? site.plan} />
                <StatTile
                    label="Amount"
                    value={amount}
                    hint={data.interval ? `per ${data.interval}` : undefined}
                />
                <StatTile
                    label={data.cancelAt ? "Access ends" : "Next charge"}
                    value={date(data.cancelAt ?? data.currentPeriodEnd)}
                    tone={data.cancelAt ? "warn" : "default"}
                />
            </div>

            <SectionCard title="Payment method">
                {data.paymentMethod ? (
                    <StaticField
                        label="Card on file"
                        value={
                            <>
                                <span className="capitalize">{data.paymentMethod.brand}</span> ending{" "}
                                {data.paymentMethod.last4}
                                <span style={{ color: "var(--fg-3)" }}>
                                    {" "}
                                    · expires {String(data.paymentMethod.expMonth).padStart(2, "0")}/
                                    {String(data.paymentMethod.expYear).slice(-2)}
                                </span>
                            </>
                        }
                    />
                ) : (
                    <p className="text-sm" style={{ color: "var(--fg-2)" }}>
                        No card is shown for this subscription.
                    </p>
                )}
                <p className="text-sm" style={{ color: "var(--fg-3)" }}>
                    To change your card, email{" "}
                    <a
                        href="mailto:hello@juneaudigitaldesigns.com"
                        className="underline underline-offset-4"
                        style={{ color: "var(--accent)" }}
                    >
                        hello@juneaudigitaldesigns.com
                    </a>{" "}
                    and we&apos;ll send a secure link.
                </p>
            </SectionCard>

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

            {site.status === "live" && <CancellationCard site={site} />}
        </div>
    );
}

/**
 * Cancellation.
 *
 * Moved here from Settings: it is the most consequential money decision in the product,
 * and burying it under "homepage showcase opt-in" made it hard to find deliberately and
 * easy to hit accidentally. It belongs next to what the client is actually paying.
 */
function CancellationCard({ site }: { site: PortalSiteProps }) {
    const invalidate = useInvalidate();
    const [confirm, setConfirm] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ effectiveDate: string } | null>(
        site.cancelRequestedAt && site.cancelEffectiveAt
            ? { effectiveDate: date(site.cancelEffectiveAt) }
            : null,
    );

    const noticeDays = site.plan === "enterprise" ? 60 : 30;
    const nameMatches = confirm.trim().toLowerCase() === site.name.toLowerCase();

    async function cancel() {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/portal/cancel?site=${encodeURIComponent(site.slug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirm }),
            });
            const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            if (!res.ok) throw new Error((data.error as string) ?? "Cancellation failed");
            setResult({ effectiveDate: data.effectiveDate as string });

            // Drop the cached billing payload. Without this the client would keep seeing
            // their old subscription state for the full TTL, which reads as the
            // cancellation not having worked.
            invalidate(`billing:${site.slug}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Cancellation failed. Please contact support.");
        } finally {
            setSubmitting(false);
        }
    }

    if (result) {
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
                        Your service ends on <strong>{result.effectiveDate}</strong>. You keep full access
                        until then, and a confirmation was sent to your account email.
                    </p>
                </div>
            </SectionCard>
        );
    }

    return (
        <SectionCard title="Cancellation">
            <p className="text-sm mb-4" style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}>
                Cancellations require {noticeDays} days written notice per your agreement. Your service
                stays active — and billed — until the first billing date at or after {noticeDays} days
                from today.
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

            <FieldRow label={`Type "${site.name}" to confirm`}>
                <input
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

            <button
                type="button"
                onClick={cancel}
                disabled={submitting || !nameMatches}
                className="px-5 py-2 rounded-md text-sm font-semibold transition-opacity"
                style={{
                    border: "1px solid var(--accent-2)",
                    background: "transparent",
                    color: "var(--accent-2)",
                    cursor: submitting || !nameMatches ? "not-allowed" : "pointer",
                    opacity: submitting || !nameMatches ? 0.5 : 1,
                }}
            >
                {submitting ? "Requesting…" : "Request cancellation"}
            </button>
        </SectionCard>
    );
}
