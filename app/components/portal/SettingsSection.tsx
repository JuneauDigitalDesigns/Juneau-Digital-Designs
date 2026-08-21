"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortalSiteProps } from "@/app/portal/types";
import { splitConsentText } from "@/app/lib/sms-consent-text";
import { SectionCard, FieldRow, inputStyle } from "./ui/FormPrimitives";

export interface SmsConsentProps {
    phone: string;
    status: "granted" | "revoked" | "pending-confirmation";
}

interface SettingsSectionProps {
    site: PortalSiteProps;
    accountEmail: string;
    accountProfile: { contactName?: string; contactPhone?: string } | null;
    smsConsent: SmsConsentProps | null;
}

// ── Profile ──────────────────────────────────────────────────────────────────

function ProfileSection({
    accountEmail,
    profile,
}: {
    accountEmail: string;
    profile: { contactName?: string; contactPhone?: string } | null;
}) {
    const [name, setName] = useState(profile?.contactName ?? "");
    const [phone, setPhone] = useState(profile?.contactPhone ?? "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function save() {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/portal/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactName: name, contactPhone: phone }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error ?? "Save failed");
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <SectionCard title="Contact info">
            <FieldRow label="Account email">
                <input
                    value={accountEmail}
                    readOnly
                    style={{ ...inputStyle, color: "var(--fg-3)", cursor: "not-allowed" }}
                />
                <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                    To change your email, contact support.
                </span>
            </FieldRow>
            <FieldRow label="Contact name">
                <input
                    value={name}
                    onChange={(e) => { setName(e.target.value); setSaved(false); }}
                    placeholder="Your name"
                    maxLength={120}
                    style={inputStyle}
                />
            </FieldRow>
            <FieldRow label="Contact phone">
                <input
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
                    placeholder="+1 (555) 000-0000"
                    maxLength={30}
                    style={inputStyle}
                />
            </FieldRow>
            {error && (
                <p style={{ color: "var(--accent-2)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
            )}
            <button
                onClick={save}
                disabled={saving}
                style={{
                    padding: "8px 20px",
                    borderRadius: 6,
                    border: "none",
                    background: saved ? "var(--accent)" : "var(--accent)",
                    color: "var(--on-accent, #fff)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1,
                }}
            >
                {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
            </button>
        </SectionCard>
    );
}

// ── Featured ──────────────────────────────────────────────────────────────────

function FeaturedSection({
    site,
}: {
    site: PortalSiteProps;
}) {
    const [optedIn, setOptedIn] = useState(site.featured !== null);
    const [quote, setQuote] = useState(site.featured?.quote ?? "");
    const [showName, setShowName] = useState(site.featured?.showName ?? true);
    const [showLink, setShowLink] = useState(site.featured?.showLink ?? true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const siteParam = `?site=${encodeURIComponent(site.slug)}`;

    async function submit(newOptIn: boolean) {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/portal/featured${siteParam}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    optIn: newOptIn,
                    quote: newOptIn ? quote : undefined,
                    showName,
                    showLink,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error ?? "Save failed");
            }
            setOptedIn(newOptIn);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <SectionCard title="Homepage showcase">
            <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 18px", lineHeight: "var(--leading-relaxed, 1.6)" }}>
                Opt in to have your site featured on the Juneau Digital Designs homepage.
                We review each request before anything goes live — nothing appears without our
                confirmation.
            </p>

            {!optedIn ? (
                <button
                    onClick={() => submit(true)}
                    disabled={saving}
                    style={{
                        padding: "8px 20px",
                        borderRadius: 6,
                        border: "1px solid var(--accent)",
                        background: "transparent",
                        color: "var(--accent)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: saving ? "not-allowed" : "pointer",
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? "Saving…" : "Feature my site"}
                </button>
            ) : (
                <>
                    <div
                        style={{
                            // `--accent-rgb` was never defined anywhere, so this silently
                            // painted the hard-coded fallback — the old agency teal — and
                            // ignored the accent entirely. color-mix needs no rgb triplet.
                            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                            border: "1px solid var(--accent)",
                            borderRadius: 6,
                            padding: "12px 16px",
                            marginBottom: 18,
                            fontSize: 13,
                            color: "var(--accent)",
                        }}
                    >
                        {saved ? "Preferences saved." : "Your site is opted in. We'll be in touch once it's live."}
                    </div>

                    <FieldRow label="Optional quote (shown with your listing)">
                        <textarea
                            value={quote}
                            onChange={(e) => { setQuote(e.target.value); setSaved(false); }}
                            placeholder="A sentence about working with JDD…"
                            maxLength={300}
                            rows={3}
                            style={{ ...inputStyle, resize: "vertical" }}
                        />
                    </FieldRow>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--fg-2)", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={showName}
                                onChange={(e) => { setShowName(e.target.checked); setSaved(false); }}
                                style={{ accentColor: "var(--accent)" }}
                            />
                            Show my business name
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--fg-2)", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={showLink}
                                onChange={(e) => { setShowLink(e.target.checked); setSaved(false); }}
                                style={{ accentColor: "var(--accent)" }}
                            />
                            Link to my site from the listing
                        </label>
                    </div>

                    {error && (
                        <p style={{ color: "var(--accent-2)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
                    )}

                    <div style={{ display: "flex", gap: 12 }}>
                        <button
                            onClick={() => submit(true)}
                            disabled={saving}
                            style={{
                                padding: "8px 20px",
                                borderRadius: 6,
                                border: "none",
                                background: "var(--accent)",
                                color: "var(--on-accent, #fff)",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: saving ? "not-allowed" : "pointer",
                                opacity: saving ? 0.6 : 1,
                            }}
                        >
                            {saving ? "Saving…" : "Save preferences"}
                        </button>
                        <button
                            onClick={() => submit(false)}
                            disabled={saving}
                            style={{
                                padding: "8px 20px",
                                borderRadius: 6,
                                border: "1px solid var(--rule)",
                                background: "transparent",
                                color: "var(--fg-3)",
                                fontSize: 14,
                                cursor: saving ? "not-allowed" : "pointer",
                                opacity: saving ? 0.6 : 1,
                            }}
                        >
                            Opt out
                        </button>
                    </div>
                </>
            )}
        </SectionCard>
    );
}

// ── Call alert texts ──────────────────────────────────────────────────────────

/**
 * Self-serve control over the SMS program.
 *
 * The consent wording is re-rendered here from the same constant the agreement page uses,
 * because turning alerts on from this screen is a fresh grant and has to be recorded
 * against words the client actually saw at that moment, not words they saw months ago on
 * a page they no longer remember.
 */
function SmsAlertsSection({
    consent,
    plan,
}: {
    consent: SmsConsentProps | null;
    plan: PortalSiteProps["plan"];
}) {
    // Same boundary as the agreement page: starter has no receptionist, so there are no
    // calls to summarize and nothing here would ever fire. Shown rather than hidden, so a
    // client who read about call texts on the marketing site learns why they can't find them.
    //
    // The branch lives here, in a component with no state of its own, so the controls below
    // can keep their hooks at the top of an unconditional body.
    if (plan === "starter") {
        return (
            <SectionCard title="Call alert texts">
                <p
                    style={{
                        fontSize: 14,
                        color: "var(--fg-2)",
                        margin: 0,
                        lineHeight: "var(--leading-relaxed, 1.6)",
                    }}
                >
                    Call summary texts are part of the Growth and Enterprise plans. Starter does not
                    include the AI receptionist, so there are no calls for us to text you about, and
                    we will not send you text messages on this plan.
                </p>
            </SectionCard>
        );
    }
    return <SmsAlertsControls consent={consent} />;
}

function SmsAlertsControls({ consent }: { consent: SmsConsentProps | null }) {
    const active = consent?.status === "granted" || consent?.status === "pending-confirmation";
    const [enabled, setEnabled] = useState(active);
    const [phone, setPhone] = useState(consent?.phone ?? "");
    const [agreed, setAgreed] = useState(active);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(nextEnabled: boolean) {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/portal/sms-consent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: nextEnabled, phone: nextEnabled ? phone : undefined }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error ?? "Save failed");
            }
            setEnabled(nextEnabled);
            setAgreed(nextEnabled);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <SectionCard title="Call alert texts">
            <p
                style={{
                    fontSize: 14,
                    color: "var(--fg-2)",
                    margin: "0 0 18px",
                    lineHeight: "var(--leading-relaxed, 1.6)",
                }}
            >
                Get a text after each call your receptionist handles, plus occasional alerts about
                your account. Optional, and never required to use the service. Full details on our{" "}
                <Link
                    href="/sms-terms"
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                >
                    SMS Terms
                </Link>{" "}
                page.
            </p>

            {enabled && (
                <div
                    style={{
                        background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                        border: "1px solid var(--accent)",
                        borderRadius: 6,
                        padding: "12px 16px",
                        marginBottom: 18,
                        fontSize: 13,
                        color: "var(--accent)",
                    }}
                >
                    {saved
                        ? "Preferences saved."
                        : consent?.status === "pending-confirmation"
                          ? "Waiting on your reply to the confirmation text before alerts start."
                          : "Call alerts are on."}
                </div>
            )}

            <FieldRow label="Mobile number for alerts">
                <input
                    value={phone}
                    onChange={(e) => {
                        setPhone(e.target.value);
                        setSaved(false);
                    }}
                    placeholder="(907) 555-0142"
                    maxLength={30}
                    style={inputStyle}
                />
            </FieldRow>

            <label
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    fontSize: 13.5,
                    color: "var(--fg-2)",
                    lineHeight: 1.55,
                    cursor: "pointer",
                    marginBottom: 16,
                }}
            >
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => {
                        setAgreed(e.target.checked);
                        setSaved(false);
                    }}
                    style={{ marginTop: 3, accentColor: "var(--accent)" }}
                />
                <span>
                    {splitConsentText().map((seg, i) =>
                        seg.kind === "link" ? (
                            <Link
                                key={i}
                                href={seg.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: "var(--accent)", textDecoration: "underline" }}
                            >
                                {seg.value}
                            </Link>
                        ) : (
                            <span key={i}>{seg.value}</span>
                        ),
                    )}
                </span>
            </label>

            {error && (
                <p style={{ color: "var(--accent-2)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 12 }}>
                <button
                    onClick={() => submit(true)}
                    disabled={saving || !agreed}
                    style={{
                        padding: "8px 20px",
                        borderRadius: 6,
                        border: "none",
                        background: "var(--accent)",
                        color: "var(--on-accent, #fff)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: saving || !agreed ? "not-allowed" : "pointer",
                        opacity: saving || !agreed ? 0.6 : 1,
                    }}
                >
                    {saving ? "Saving…" : enabled ? "Update number" : "Turn on call alerts"}
                </button>
                {enabled && (
                    <button
                        onClick={() => submit(false)}
                        disabled={saving}
                        style={{
                            padding: "8px 20px",
                            borderRadius: 6,
                            border: "1px solid var(--rule)",
                            background: "transparent",
                            color: "var(--fg-3)",
                            fontSize: 14,
                            cursor: saving ? "not-allowed" : "pointer",
                            opacity: saving ? 0.6 : 1,
                        }}
                    >
                        Turn off
                    </button>
                )}
            </div>
        </SectionCard>
    );
}

// ── Cancellation ──────────────────────────────────────────────────────────────

// ── Exports ───────────────────────────────────────────────────────────────────

export default function SettingsSection({
    site,
    accountEmail,
    accountProfile,
    smsConsent,
}: SettingsSectionProps) {
    return (
        <div>
            <ProfileSection accountEmail={accountEmail} profile={accountProfile} />
            <SmsAlertsSection consent={smsConsent} plan={site.plan} />
            <FeaturedSection site={site} />
        </div>
    );
}
