"use client";

import { useEffect, useState, type ChangeEvent } from "react";
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

interface FeaturedImageState {
    image: string | null;
    imageMode: "upload" | "auto" | null;
}

function FeaturedSection({
    site,
}: {
    site: PortalSiteProps;
}) {
    const [optedIn, setOptedIn] = useState(site.featured !== null);
    const [quote, setQuote] = useState(site.featured?.quote ?? "");
    // One choice, not two toggles: a listing is either credited (name shown + site linked)
    // or anonymous (quote only, never linked). `showName` and `showLink` therefore move
    // together — an anonymous listing that still linked the site would defeat the point.
    const [anonymous, setAnonymous] = useState(site.featured?.showName === false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Chosen before opt-in, then locked — see the server route's re-submission guard. Once
    // opted in, `locked` is the only source of truth for what image is on file; a repeat
    // save (editing the quote, say) can never change it.
    const [pendingMode, setPendingMode] = useState<"auto" | "upload">("auto");
    const [pendingUpload, setPendingUpload] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [locked, setLocked] = useState<FeaturedImageState>({ image: null, imageMode: null });

    const siteParam = `?site=${encodeURIComponent(site.slug)}`;

    // Rehydrate the locked image after a reload — `site.featured` (the account record) never
    // carried image data, only the request record in KV does.
    useEffect(() => {
        if (!optedIn) return;
        let cancelled = false;
        fetch(`/api/portal/featured${siteParam}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { featured?: FeaturedImageState } | null) => {
                if (cancelled || !data?.featured) return;
                setLocked({ image: data.featured.image ?? null, imageMode: data.featured.imageMode ?? null });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
        // Only ever needs to run once per mount for the currently opted-in site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleImageFile(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/portal/featured/upload", {
                method: "POST",
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((data as { error?: string }).error ?? "Upload failed");
            }
            setPendingUpload((data as { url: string }).url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    }

    async function submit(newOptIn: boolean) {
        setSaving(true);
        setError(null);
        try {
            const isFreshOptIn = newOptIn && !optedIn;
            const res = await fetch(`/api/portal/featured${siteParam}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    optIn: newOptIn,
                    quote: newOptIn ? quote : undefined,
                    showName: !anonymous,
                    showLink: !anonymous,
                    ...(isFreshOptIn
                        ? { imageMode: pendingMode, image: pendingMode === "upload" ? pendingUpload : undefined }
                        : {}),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error ?? "Save failed");
            }
            if (isFreshOptIn) {
                const data = (await res.json().catch(() => ({}))) as FeaturedImageState;
                setLocked({ image: data.image ?? null, imageMode: data.imageMode ?? null });
            }
            if (!newOptIn) {
                setLocked({ image: null, imageMode: null });
                setPendingUpload(null);
                setPendingMode("auto");
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

    const imageChoiceStyle = (active: boolean) => ({
        flex: 1,
        textAlign: "left" as const,
        padding: "10px 14px",
        borderRadius: 8,
        border: `1px solid ${active ? "var(--accent)" : "var(--rule)"}`,
        background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
        cursor: "pointer",
    });

    return (
        <SectionCard title="Homepage showcase">
            <p style={{ fontSize: 14, color: "var(--fg-2)", margin: "0 0 18px", lineHeight: "var(--leading-relaxed, 1.6)" }}>
                Opt in to have your site featured on the Juneau Digital Designs homepage.
                We review each request before anything goes live — nothing appears without our
                confirmation.
            </p>

            {!optedIn ? (
                <>
                    <FieldRow label="Showcase image">
                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            {(
                                [
                                    { mode: "auto" as const, label: "Screenshot my site", hint: "We'll capture one automatically" },
                                    { mode: "upload" as const, label: "Upload my own", hint: "PNG, JPG or WebP" },
                                ]
                            ).map((opt) => (
                                <button
                                    key={opt.mode}
                                    type="button"
                                    onClick={() => setPendingMode(opt.mode)}
                                    aria-pressed={pendingMode === opt.mode}
                                    style={imageChoiceStyle(pendingMode === opt.mode)}
                                >
                                    <div style={{ fontSize: 14, fontWeight: 600, color: pendingMode === opt.mode ? "var(--accent)" : "var(--fg-2)" }}>
                                        {opt.label}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>{opt.hint}</div>
                                </button>
                            ))}
                        </div>

                        {pendingMode === "upload" && (
                            <div>
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={handleImageFile}
                                    disabled={uploading}
                                />
                                {uploading && (
                                    <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "6px 0 0" }}>Uploading…</p>
                                )}
                                {pendingUpload && (
                                    <img
                                        src={pendingUpload}
                                        alt="Showcase preview"
                                        style={{ height: 90, borderRadius: 8, border: "1px solid var(--rule)", marginTop: 8 }}
                                    />
                                )}
                            </div>
                        )}
                    </FieldRow>

                    {error && (
                        <p style={{ color: "var(--accent-2)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
                    )}

                    <button
                        onClick={() => submit(true)}
                        disabled={saving || uploading || (pendingMode === "upload" && !pendingUpload)}
                        style={{
                            padding: "8px 20px",
                            borderRadius: 6,
                            border: "1px solid var(--accent)",
                            background: "transparent",
                            color: "var(--accent)",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: saving || uploading ? "not-allowed" : "pointer",
                            opacity: saving || uploading ? 0.6 : 1,
                        }}
                    >
                        {saving ? "Saving…" : "Feature my site"}
                    </button>
                </>
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

                    <FieldRow label="Showcase image">
                        {locked.image ? (
                            <>
                                <img
                                    src={locked.image}
                                    alt="Showcase preview"
                                    style={{ height: 100, borderRadius: 8, border: "1px solid var(--rule)" }}
                                />
                                <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "6px 0 0" }}>
                                    This is your showcase image. To change it, opt out and opt back in.
                                </p>
                            </>
                        ) : (
                            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>
                                {locked.imageMode === "auto"
                                    ? "We couldn't capture a screenshot of your site yet — we'll add one before this goes live. To upload your own instead, opt out and opt back in."
                                    : "No image on file yet."}
                            </p>
                        )}
                    </FieldRow>

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

                    <FieldRow label="How should we credit you?">
                        <div style={{ display: "flex", gap: 8 }}>
                            {([
                                { anon: false, label: "Credit me", hint: "Show my name and link my site" },
                                { anon: true, label: "Anonymous", hint: "Show my quote only, not linked" },
                            ] as const).map((opt) => {
                                const active = anonymous === opt.anon;
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() => { setAnonymous(opt.anon); setSaved(false); }}
                                        aria-pressed={active}
                                        style={{
                                            flex: 1,
                                            textAlign: "left",
                                            padding: "10px 14px",
                                            borderRadius: 8,
                                            border: `1px solid ${active ? "var(--accent)" : "var(--rule)"}`,
                                            background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <div style={{ fontSize: 14, fontWeight: 600, color: active ? "var(--accent)" : "var(--fg-2)" }}>
                                            {opt.label}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                                            {opt.hint}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </FieldRow>

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
    // calls to summarize and nothing here would ever fire. Hidden outright rather than
    // explained — Starter never receives texts as part of the service, so the section has
    // nothing to show a Starter client either way.
    //
    // The branch lives here, in a component with no state of its own, so the controls below
    // can keep their hooks at the top of an unconditional body.
    if (plan === "starter") {
        return null;
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
