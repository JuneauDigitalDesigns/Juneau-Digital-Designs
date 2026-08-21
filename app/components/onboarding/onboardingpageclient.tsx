"use client";

import Link from "next/link";
import Script from "next/script";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { upload } from "@vercel/blob/client";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import {
    PALETTE_PRESETS,
    BACKGROUND_MOODS,
    resolvePalette,
    derivePalette,
    auditPalette,
    presetById,
    presetToPick,
    palettesForVertical,
    DEFAULT_PALETTE_PRESET_ID,
    INDUSTRY_MENUS,
    OTHER_INDUSTRY,
    VOICE_OPTIONS,
    menuFor,
    differentiatorsFor,
    customersFor,
    joinChoices,
    type BrandIntakeSubmission,
    type BrandPalette,
    type PalettePick,
    type ServiceEntry,
    type ImageMeta,
} from "@jdd/schema";

declare global {
    interface Window {
        turnstile?: {
            render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
            reset: (widgetId?: string) => void;
        };
    }
}

type PlanSlug = "starter" | "growth" | "enterprise";

/** One enterprise additional site, collected with a reduced field set. */
type AdditionalSiteForm = {
    brandName: string;
    brandShort: string;
    email: string;
    phone: string;
    address: string;
    businessHours: string;
    serviceList: ServiceEntry[];
    palette: PalettePick;
    differentiators: string;
};

/**
 * Wizard form state. Mirrors BrandIntakeSubmission (the payload) plus a few
 * form-only fields: brand-direction is kept flat for simpler inputs (assembled
 * into BrandDirection at submit), adjectives are free text (split at submit),
 * and consent/turnstile/honeypot/currentStep are meta.
 */
/**
 * What the wizard collects.
 *
 * ── Four typed fields, everything else picked ───────────────────────────────
 *
 * This used to be ~30 blank inputs across nine steps, which is a writing assignment rather
 * than an onboarding form. Only `brandName`, `email`, `phone` and `address` are typed now;
 * industry, services, differentiators, audience, voice and colours are all chosen from
 * options, each with an optional free-text box for anyone who wants to add their own.
 *
 * ── Chips are stored separately from the free text ──────────────────────────
 *
 * `diffChips`/`diffText` and `customerChips`/`customerText` are joined into the single
 * strings `BrandDirection` expects only at submit, via `joinChoices`. Keeping them apart in
 * form state is what lets a client deselect a chip without their own typed sentence being
 * rebuilt or lost.
 *
 * ── What's gone, and where it comes from now ────────────────────────────────
 *
 * `brandShort` derives from `brandName`. `license`, `established`, `notableClients`,
 * `certifications`, `businessHours`, `serviceArea` come from the website scan when the
 * client has a site, the console otherwise, or are honestly absent — the copywriter is
 * forbidden from inventing them. `agentName` defaults in the console. `announcement` is a
 * post-launch promo. `vibe`/`adjectivesText`/`references` collapsed into one `voice` picker;
 * all three fed the same paragraph of the copywriter prompt anyway.
 */
type WizardData = {
    selectedPlan: PlanSlug;
    // The only fields a client must type.
    brandName: string;
    email: string;
    phone: string;
    address: string;
    // Picked. Drives the service, differentiator, audience and palette options downstream.
    industry: string;
    serviceList: ServiceEntry[];
    // Brand direction — chips plus optional free text, joined at submit.
    diffChips: string[];
    diffText: string;
    customerChips: string[];
    customerText: string;
    voice: string[];
    forbidden: string;
    // Look & feel
    palette: PalettePick;
    hasLogo: boolean;
    images: { logo?: ImageMeta; heroSlides: ImageMeta[]; aboutFeature?: ImageMeta };
    /** Fed to the copywriter's website scan — the single input that saves the most typing. */
    existingWebsiteUrl: string;
    // Enterprise
    additionalSites: AdditionalSiteForm[];
    // Meta
    consent: boolean;
    turnstileToken: string;
    website: string; // honeypot
    currentStep: number;
    /** Which screen of the Look & feel color sub-wizard (0 pick, 1 preview, 2 confirm). */
    colorStep: number;
    /** Reveal all ten palettes rather than the four suited to their trade. */
    showAllPalettes: boolean;
};

/** Number of screens in the color sub-wizard nested inside the "look" step. */
const COLOR_STEPS = 3;

type SubmitState = { type: "idle" | "success" | "error"; message: string };

// Derived from Schedule A — plan pricing lives in one place (app/lib/legal/schedules.ts).
const PLAN_META: Record<PlanSlug, { label: string; price: string; maxSites: number }> = {
    starter: schedulePlanMeta("starter"),
    growth: schedulePlanMeta("growth"),
    enterprise: schedulePlanMeta("enterprise"),
};

function schedulePlanMeta(slug: PlanSlug) {
    const s = SCHEDULES[slug];
    return { label: s.name, price: `$${s.monthlyPrice}/month`, maxSites: s.maxSites };
}

/**
 * Derived from the shared menus rather than written out again.
 *
 * This list used to be a local literal that happened to use the same six ids as the
 * console's `VerticalId` union. Nothing compared them, so a rename on either side would
 * have surfaced as the console quietly falling back to a manual vertical pick rather than
 * as an error. @jdd/schema is canonical now; "Other" is appended because it is a real answer
 * a client can give but not a trade we hold a menu for.
 */
const INDUSTRY_OPTIONS: { id: string; label: string }[] = [
    ...INDUSTRY_MENUS.map((m) => ({ id: m.id as string, label: m.label })),
    { id: OTHER_INDUSTRY, label: "Other / Not listed" },
];

// Vibe, tone and free-text adjectives were three questions describing one thing, and all
// three collapsed into the same paragraph of the copywriter prompt. VOICE_OPTIONS from
// @jdd/schema replaces them with a single picker.

const emptyPalette = (): PalettePick => ({ mode: "preset", presetId: DEFAULT_PALETTE_PRESET_ID });
const COLOR_SUB_LABELS = ["Theme", "Preview", "Confirm"];

/**
 * Sub-progress for the color wizard nested inside the "look" step. The top rail
 * keeps a single "Look & feel" pill, so this is what tells the client where they
 * are within the three color screens.
 */
function ColorSubSteps({ current }: { current: number }) {
    return (
        <div className="flex items-center gap-2" aria-label="Color steps">
            {COLOR_SUB_LABELS.map((label, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <div key={label} className="flex items-center gap-2">
                        {i > 0 && <span style={{ width: 16, height: 1, background: "var(--rule)" }} />}
                        <span
                            className="flex items-center gap-1.5 text-xs font-semibold"
                            style={{ color: active ? "var(--fg)" : "var(--fg-3)" }}
                            aria-current={active ? "step" : undefined}
                        >
                            <span
                                className="flex items-center justify-center"
                                style={{
                                    width: 18, height: 18, borderRadius: 999, fontSize: 10,
                                    fontFamily: "var(--font-mono)",
                                    background: active || done ? "var(--accent)" : "var(--surface)",
                                    color: active || done ? "var(--on-accent)" : "var(--fg-3)",
                                    border: `1px solid ${active || done ? "var(--accent)" : "var(--rule)"}`,
                                }}
                            >
                                {done ? "✓" : i + 1}
                            </span>
                            {label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/** One-line provenance for the confirm screen. */
function paletteSummary(pick: PalettePick): string {
    const preset = presetById(pick.presetId);
    if (pick.mode === "preset") return preset ? `Theme: ${preset.label}` : "Custom colors";
    const tweaks = Object.keys(pick.overrides ?? {}).length;
    const base = preset ? `Based on ${preset.label}, customized` : "Custom colors";
    return tweaks ? `${base} — ${tweaks} color${tweaks === 1 ? "" : "s"} pinned by hand` : base;
}

/** Dark moods derive their own ink, so the wizard hides the ink picker for them. */
const isDarkMood = (mood: PalettePick["bgMood"]) =>
    BACKGROUND_MOODS.some((m) => m.id === (mood ?? "white") && m.dark);
const emptyService = (): ServiceEntry => ({ name: "", tag: "" });

function makeInitialData(plan: PlanSlug, prefillEmail: string): WizardData {
    return {
        selectedPlan: plan,
        brandName: "",
        email: prefillEmail,
        phone: "",
        address: "",
        industry: "",
        // No blank starter row: services are chosen from chips now, and an empty row sitting
        // under them reads as "you still have to type one".
        serviceList: [],
        diffChips: [],
        diffText: "",
        customerChips: [],
        customerText: "",
        voice: [],
        forbidden: "",
        palette: emptyPalette(),
        hasLogo: false,
        images: { heroSlides: [] },
        existingWebsiteUrl: "",
        additionalSites: [],
        consent: false,
        turnstileToken: "",
        website: "",
        currentStep: 0,
        colorStep: 0,
        showAllPalettes: false,
    };
}

// ── Shared styling tokens (match the rest of the onboarding UI) ──────────────
const inputCls =
    "rounded-xl border border-[var(--rule)] bg-[var(--surface)] w-full px-4 py-3 text-[var(--fg)] placeholder:text-[var(--fg-3)] outline-none transition focus:border-[var(--accent)]";
const labelCls = "flex flex-col gap-2 text-sm font-semibold text-[var(--fg)]";
const cardCls = "relative rounded-2xl border border-[var(--rule)] bg-[var(--surface)] p-4";
const addBtnCls =
    "cursor-pointer inline-flex items-center gap-2 rounded-xl border border-[var(--rule-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--fg-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]";
const removeRowBtnCls =
    "cursor-pointer mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--rule)] text-[var(--fg-3)] transition hover:text-[var(--accent-2)]";
const uploadBtnCls =
    "w-fit cursor-pointer inline-flex items-center gap-2 rounded-xl border border-[var(--rule-strong)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--fg-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]";
const helpText = { fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 } as const;

const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function safeStorageKey(sessionId: string): string | null {
    return /^cs_[a-zA-Z0-9_]+$/.test(sessionId) ? `jdd-onboarding-${sessionId}` : null;
}

/**
 * Scoped to the site, not just the user.
 *
 * A client can have more than one site awaiting its wizard — buy two starters in a row and
 * both sit there pending. Keying on `clerkUserId` alone gave them one shared draft, so
 * whichever site they opened second showed the first one's answers and autosave overwrote
 * them on the way out.
 */
function portalStorageKey(clerkUserId: string, siteRef: string): string | null {
    if (!clerkUserId) return null;
    return siteRef
        ? `jdd-onboarding-portal-${clerkUserId}-${siteRef}`
        : `jdd-onboarding-portal-${clerkUserId}`;
}

// ── Small presentational helpers ─────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className={labelCls}>
            <span>{label}</span>
            {children}
            {hint ? <span style={helpText}>{hint}</span> : null}
        </label>
    );
}

function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const on = selected.includes(opt);
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onToggle(opt)}
                        className="rounded-full px-4 py-2 text-sm font-semibold transition"
                        style={{
                            border: `1px solid ${on ? "var(--accent)" : "var(--rule-strong)"}`,
                            background: on ? "var(--accent)" : "var(--surface)",
                            color: on ? "var(--on-accent)" : "var(--fg-2)",
                            cursor: "pointer",
                        }}
                    >
                        {opt}
                    </button>
                );
            })}
        </div>
    );
}

const PALETTE_SLOT_META: { slot: keyof BrandPalette; label: string }[] = [
    { slot: "accent", label: "Accent" },
    { slot: "accentFg", label: "Text on accent" },
    { slot: "bg", label: "Background" },
    { slot: "bgSoft", label: "Soft background" },
    { slot: "ink", label: "Body text" },
    { slot: "inkSoft", label: "Muted text" },
    { slot: "rule", label: "Borders" },
];

/**
 * A miniature page rendered in the client's own colors. Swatches alone can't answer
 * "do these work together" — you have to see text on the background and a label on
 * a button. Everything here is styled from literal palette hex, never the wizard's
 * own design tokens, or the preview would inherit the site's colors instead.
 */
function PalettePreview({ palette }: { palette: PalettePick }) {
    const p = resolvePalette(palette);
    return (
        <div>
            <div style={{ borderRadius: 12, border: `1px solid ${p.rule}`, background: p.bg, padding: 18, overflow: "hidden" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", fontWeight: 700, color: p.inkSoft }}>
                    Licensed &amp; insured
                </div>
                <div style={{ marginTop: 8, fontSize: 20, lineHeight: 1.2, fontWeight: 700, color: p.ink }}>
                    Same-day service, done right.
                </div>
                <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: p.inkSoft }}>
                    Straight answers, honest pricing, and a team that shows up when we say we will.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    <span style={{ background: p.accent, color: p.accentFg, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8 }}>
                        Get a quote
                    </span>
                    <span style={{ border: `1px solid ${p.rule}`, color: p.ink, fontSize: 12, fontWeight: 600, padding: "8px 14px", borderRadius: 8 }}>
                        Our work
                    </span>
                </div>
                <div style={{ height: 1, background: p.rule, margin: "16px 0" }} />
                <div style={{ background: p.bgSoft, border: `1px solid ${p.rule}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: p.ink }}>Emergency repairs</div>
                    <div style={{ marginTop: 3, fontSize: 11, color: p.inkSoft }}>Available 24/7 across the valley.</div>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                {PALETTE_SLOT_META.filter((s) => s.slot !== "accentFg").map(({ slot, label }) => (
                    <div key={slot} title={`${slot} ${p[slot]}`} className="flex flex-col items-center gap-1">
                        <span style={{ width: 32, height: 32, borderRadius: 8, background: p[slot], border: "1px solid var(--rule)" }} />
                        <span style={{ fontSize: 9, color: "var(--fg-3)" }}>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** The five background characters, each previewed with the bg it would actually produce. */
function MoodChips({ palette, onChange }: { palette: PalettePick; onChange: (p: PalettePick) => void }) {
    const accent = palette.accentColor ?? "#1E6FBF";
    const ink = palette.baseColor ?? "#0F172A";
    const current = palette.bgMood ?? "white";
    return (
        <div className="flex flex-wrap gap-2">
            {BACKGROUND_MOODS.map((m) => {
                const on = current === m.id;
                const swatch = derivePalette(accent, ink, m.id).bg;
                return (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => onChange({ ...palette, mode: "custom", bgMood: m.id })}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
                        style={{
                            border: on ? "1px solid var(--accent)" : "1px solid var(--rule)",
                            boxShadow: on ? "0 0 0 1px var(--accent)" : "none",
                            color: on ? "var(--fg)" : "var(--fg-2)",
                            background: "var(--surface)",
                            cursor: "pointer",
                        }}
                    >
                        <span style={{ width: 16, height: 16, borderRadius: 4, background: swatch, border: "1px solid var(--rule)" }} />
                        {m.label}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Advisory contrast warnings. These never block the step — a client who insists on
 * their brand color gets to keep it — but each one offers a same-hue shade that passes.
 */
function ContrastWarnings({ palette, onChange }: { palette: PalettePick; onChange: (p: PalettePick) => void }) {
    const issues = auditPalette(resolvePalette(palette));
    if (!issues.length) return null;
    return (
        <div className="space-y-2">
            {issues.map((issue) => (
                <div
                    key={`${issue.slot}-${issue.against}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs"
                    style={{ border: "1px solid var(--rule)", background: "var(--surface-2, var(--surface))", color: "var(--fg-2)" }}
                >
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: issue.suggestion, border: "1px solid var(--rule)", flexShrink: 0 }} />
                    <span>
                        <strong style={{ color: "var(--fg)" }}>{issue.label}</strong> may be hard to read —{" "}
                        {issue.ratio}:1, needs {issue.required}:1.
                    </span>
                    <button
                        type="button"
                        className="font-semibold underline"
                        style={{ color: "var(--accent)", cursor: "pointer" }}
                        onClick={() => onChange({ ...palette, overrides: { ...palette.overrides, [issue.slot]: issue.suggestion } })}
                    >
                        Use suggested
                    </button>
                </div>
            ))}
        </div>
    );
}

/** Per-slot manual pins, for clients with an exact brand spec. Collapsed by default. */
function AdvancedColors({ palette, onChange }: { palette: PalettePick; onChange: (p: PalettePick) => void }) {
    const resolved = resolvePalette(palette);
    const overrides = palette.overrides ?? {};
    const setSlot = (slot: keyof BrandPalette, hex: string) =>
        onChange({ ...palette, overrides: { ...overrides, [slot]: hex } });
    const resetSlot = (slot: keyof BrandPalette) => {
        const next = { ...overrides };
        delete next[slot];
        onChange({ ...palette, overrides: Object.keys(next).length ? next : undefined });
    };
    return (
        <details className="rounded-xl" style={{ border: "1px solid var(--rule)" }}>
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold" style={{ color: "var(--fg-2)" }}>
                Advanced — fine-tune individual colors
            </summary>
            <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
                {PALETTE_SLOT_META.map(({ slot, label }) => (
                    <div key={slot} className="flex items-center gap-2">
                        <input
                            type="color"
                            aria-label={label}
                            value={resolved[slot] ?? "#000000"}
                            onChange={(e) => setSlot(slot, e.target.value.toUpperCase())}
                            style={{ width: 38, height: 28, borderRadius: 6, border: "1px solid var(--rule)", background: "none", flexShrink: 0 }}
                        />
                        <span className="flex-1 truncate text-xs" style={{ color: "var(--fg-2)" }}>{label}</span>
                        {overrides[slot] && (
                            <button type="button" className="text-xs underline" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => resetSlot(slot)}>
                                Reset
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </details>
    );
}

export default function OnboardingPageClient({
    plan,
    prefillEmail = "",
    sessionId = "",
    portalMode = false,
    clerkUserId = "",
    siteRef = "",
}: {
    plan: PlanSlug;
    prefillEmail?: string;
    sessionId?: string;
    /** When true: no Turnstile, no consent, submit goes to /api/portal/onboarding. */
    portalMode?: boolean;
    /** Used as part of the localStorage key in portal mode (pass the Clerk userId). */
    clerkUserId?: string;
    /**
     * Which site this wizard is filling in. Scopes the draft and is sent with the
     * submission, so a client with two pending sites can't answer for one and save it
     * against the other.
     */
    siteRef?: string;
}) {
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    // The server render and the first client render MUST be identical, so the saved
    // draft is deliberately NOT read here — reading localStorage during render made
    // the step rail hydrate as "✓" where the server sent "1". The draft is restored
    // in a mount-only effect below.
    const [formData, setFormData] = useState<WizardData>(() => makeInitialData(plan, prefillEmail));
    const [restored, setRestored] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [turnstileScriptLoaded, setTurnstileScriptLoaded] = useState(false);
    const [submitState, setSubmitState] = useState<SubmitState>({ type: "idle", message: "" });
    const [uploadingSlots, setUploadingSlots] = useState<Set<string>>(new Set());
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
    const [maxVisited, setMaxVisited] = useState(0);
    // The real slug the server assigned on submit. The wizard arrives at a placeholder
    // (`pending-<session>`) and the brand name replaces it, so this is only known after the
    // response — and it is what the success redirect has to point at.
    const [completedSlug, setCompletedSlug] = useState<string | null>(null);
    // Deliberately not persisted: a reload returns the client to the "happy with
    // these?" gate with their adjustments intact, rather than mid-edit.
    const [colorAdjusting, setColorAdjusting] = useState(false);

    const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
    const turnstileWidgetIdRef = useRef<string | null>(null);
    /** Set once the draft-restore attempt has finished, so autosave can't clobber it. */
    const didRestoreRef = useRef(false);

    const planMeta = PLAN_META[plan];

    // ── Turnstile widget (rendered on the final step) ──
    useEffect(() => {
        if (!turnstileSiteKey || !turnstileScriptLoaded || !window.turnstile || !turnstileContainerRef.current) return;
        if (turnstileWidgetIdRef.current) return;
        turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: turnstileSiteKey,
            callback: (token: string) => setFormData((prev) => ({ ...prev, turnstileToken: token })),
            "expired-callback": () => setFormData((prev) => ({ ...prev, turnstileToken: "" })),
            "error-callback": () => setFormData((prev) => ({ ...prev, turnstileToken: "" })),
            theme: "auto",
        });
    }, [turnstileScriptLoaded, turnstileSiteKey, formData.currentStep]);

    // ── Draft restore (post-hydration only) ──
    // Runs after mount so the first client render still matches the server HTML.
    useEffect(() => {
        const key = portalMode ? portalStorageKey(clerkUserId, siteRef) : safeStorageKey(sessionId);
        if (!key && !portalMode) {
            didRestoreRef.current = true;
            return;
        }
        const draftUrl = `/api/portal/onboarding/draft${siteRef ? `?site=${encodeURIComponent(siteRef)}` : ""}`;

        async function restore() {
            let localSavedAt: Date | null = null;
            let localSaved: Partial<WizardData> | null = null;

            // 1. Try localStorage first.
            if (key) {
                try {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        const { savedAt, ...saved } = JSON.parse(raw) as Partial<WizardData> & { savedAt?: string };
                        if (savedAt && Date.now() - new Date(savedAt).getTime() > STORAGE_TTL_MS) {
                            localStorage.removeItem(key);
                        } else {
                            localSavedAt = savedAt ? new Date(savedAt) : null;
                            localSaved = saved;
                        }
                    }
                } catch {
                    /* corrupt draft — ignore */
                }
            }

            // 2. In portal mode, also fetch server draft and use whichever is newer.
            if (portalMode) {
                try {
                    const res = await fetch(draftUrl, { cache: "no-store" });
                    if (res.ok) {
                        const body = (await res.json()) as { data: Partial<WizardData> | null; savedAt: string | null };
                        if (body.data && body.savedAt) {
                            const serverDate = new Date(body.savedAt);
                            if (!localSavedAt || serverDate > localSavedAt) {
                                localSaved = body.data;
                            }
                        }
                    }
                } catch {
                    /* server draft unavailable — use local */
                }
            }

            if (localSaved) {
                setFormData((base) => ({
                    ...base,
                    ...localSaved,
                    turnstileToken: "",
                    consent: false,
                    website: "",
                    colorStep: (localSaved as Partial<WizardData>).colorStep ?? 0,
                }));
                setMaxVisited((localSaved as Partial<WizardData>).currentStep ?? 0);
                setRestored(true);
            }

            didRestoreRef.current = true;
        }

        void restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Draft autosave (persists currentStep too) ──
    useEffect(() => {
        const key = portalMode ? portalStorageKey(clerkUserId, siteRef) : safeStorageKey(sessionId);
        if (!didRestoreRef.current) return;
        if (!key && !portalMode) return;
        const id = setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { turnstileToken, consent, website, ...persistable } = formData;
            const record = { ...persistable, savedAt: new Date().toISOString() };
            if (key) {
                localStorage.setItem(key, JSON.stringify(record));
            }
            // In portal mode also sync to the server so the draft survives a cache clear.
            if (portalMode) {
                fetch(
                    `/api/portal/onboarding/draft${siteRef ? `?site=${encodeURIComponent(siteRef)}` : ""}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ data: record }),
                        keepalive: true,
                    },
                ).catch(() => {});
            }
        }, 800);
        return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData]);

    // After success (non-portal mode), auto-advance to portal signup after 5s.
    useEffect(() => {
        if (submitState.type !== "success" || portalMode) return;
        const id = setTimeout(() => window.location.assign("/portal/sign-up"), 5000);
        return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitState.type]);

    function set<K extends keyof WizardData>(field: K, value: WizardData[K]) {
        setFormData((prev) => ({ ...prev, [field]: value }));
    }
    function toggleIn(field: "voice" | "diffChips" | "customerChips", value: string) {
        setFormData((prev) => {
            const has = prev[field].includes(value);
            return { ...prev, [field]: has ? prev[field].filter((v) => v !== value) : [...prev[field], value] };
        });
    }

    /**
     * Tick or untick a service chip.
     *
     * `serviceList` stays a structured `ServiceEntry[]` rather than a list of labels because
     * it becomes real site content — the tag is the category shown on the built page. Custom
     * rows the client types live in the same array, so unticking a chip must match on name
     * and leave their own entries alone.
     */
    function toggleService(label: string, tag: string) {
        setFormData((prev) => {
            const has = prev.serviceList.some((s) => s.name === label);
            return {
                ...prev,
                serviceList: has
                    ? prev.serviceList.filter((s) => s.name !== label)
                    : [...prev.serviceList, { name: label, tag }],
            };
        });
    }

    // ── Service list editor helpers ──
    function addService() {
        setFormData((prev) => ({ ...prev, serviceList: [...prev.serviceList, emptyService()] }));
    }
    function updateService(i: number, key: keyof ServiceEntry, value: string) {
        setFormData((prev) => ({ ...prev, serviceList: prev.serviceList.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)) }));
    }
    function removeService(i: number) {
        setFormData((prev) => ({ ...prev, serviceList: prev.serviceList.filter((_, idx) => idx !== i) }));
    }

    // ── Enterprise additional-site helpers ──
    function addAdditionalSite() {
        setFormData((prev) => ({
            ...prev,
            additionalSites: [
                ...prev.additionalSites,
                { brandName: "", brandShort: "", email: "", phone: "", address: "", businessHours: "", serviceList: [emptyService()], palette: emptyPalette(), differentiators: "" },
            ],
        }));
    }
    function updateAdditionalSite(i: number, patch: Partial<AdditionalSiteForm>) {
        setFormData((prev) => ({ ...prev, additionalSites: prev.additionalSites.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
    }
    function removeAdditionalSite(i: number) {
        setFormData((prev) => ({ ...prev, additionalSites: prev.additionalSites.filter((_, idx) => idx !== i) }));
    }

    // ── Upload helpers ──
    const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
    const MAX_UPLOAD_BYTES = 10_485_760; // 10 MB
    function validateUploadFile(file: File): string | null {
        if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) return "Only JPEG, PNG, and WebP images are allowed.";
        if (file.size > MAX_UPLOAD_BYTES) return "File must be 10 MB or smaller.";
        return null;
    }
    function markSlotUploading(slot: string) {
        setUploadingSlots((prev) => new Set(prev).add(slot));
        setUploadErrors((prev) => {
            const next = { ...prev };
            delete next[slot];
            return next;
        });
    }
    function clearSlot(slot: string) {
        setUploadingSlots((prev) => {
            const next = new Set(prev);
            next.delete(slot);
            return next;
        });
    }
    function setSlotError(slot: string, message: string) {
        clearSlot(slot);
        setUploadErrors((prev) => ({ ...prev, [slot]: message }));
    }
    async function uploadFile(file: File): Promise<ImageMeta> {
        const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/upload" });
        return { url: blob.url, filename: file.name, alt: "" };
    }
    async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const err = validateUploadFile(file);
        if (err) { setSlotError("logo", err); return; }
        markSlotUploading("logo");
        try {
            const meta = await uploadFile(file);
            setFormData((prev) => ({ ...prev, hasLogo: true, images: { ...prev.images, logo: meta } }));
            clearSlot("logo");
        } catch {
            setSlotError("logo", "Upload failed. Please try again.");
        }
    }
    async function handleHeroSlideUpload(e: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        e.target.value = "";
        const remaining = 10 - formData.images.heroSlides.length;
        const toUpload = files.slice(0, remaining);
        for (const file of toUpload) {
            const err = validateUploadFile(file);
            if (err) { setSlotError("hero", err); return; }
        }
        markSlotUploading("hero");
        try {
            const results = await Promise.all(toUpload.map(uploadFile));
            setFormData((prev) => ({ ...prev, images: { ...prev.images, heroSlides: [...prev.images.heroSlides, ...results].slice(0, 10) } }));
            clearSlot("hero");
        } catch {
            setSlotError("hero", "Upload failed. Please try again.");
        }
    }
    function removeHeroSlide(i: number) {
        setFormData((prev) => ({ ...prev, images: { ...prev.images, heroSlides: prev.images.heroSlides.filter((_, idx) => idx !== i) } }));
    }
    async function handleAboutFeatureUpload(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const err = validateUploadFile(file);
        if (err) { setSlotError("about-feature", err); return; }
        markSlotUploading("about-feature");
        try {
            const meta = await uploadFile(file);
            setFormData((prev) => ({ ...prev, images: { ...prev.images, aboutFeature: meta } }));
            clearSlot("about-feature");
        } catch {
            setSlotError("about-feature", "Upload failed. Please try again.");
        }
    }

    // ── Steps ──
    /**
     * Five steps, in the order the answers build on each other.
     *
     * `business` comes first because the industry picked there decides what every later step
     * offers — services, differentiators, audiences and which palettes lead. The old order
     * put the existing-site URL on the second-to-last screen, where the one input that saves
     * the client the most typing was invisible until they had already typed everything.
     *
     * Welcome and the separate media/existing-site steps are gone: a screen that only sets
     * expectations is a click, and photos belong with the rest of the look.
     */
    const steps: { key: string; label: string }[] = [
        { key: "business", label: "Your business" },
        { key: "services", label: "What you do" },
        { key: "apart", label: "What sets you apart" },
        { key: "sound", label: "How it should sound" },
        { key: "look", label: "Look" },
        ...(plan === "enterprise" ? [{ key: "sites", label: "Extra sites" }] : []),
        { key: "review", label: "Review & submit" },
    ];
    const lastStep = steps.length - 1;
    const step = Math.min(formData.currentStep, lastStep);

    const lookIndex = steps.findIndex((s) => s.key === "look");
    const onLook = steps[step].key === "look";

    /** The chip menu for the chosen trade, or null for "Other" — the free-text fallback. */
    const menu = menuFor(formData.industry);

    /**
     * Services the client typed rather than ticked.
     *
     * Split out by identity against the menu so the custom rows render as editable inputs
     * while ticked chips stay chips. Carrying the original index matters: `updateService`
     * and `removeService` address `serviceList` positionally, so filtering without it would
     * edit the wrong row.
     */
    const customServices = formData.serviceList
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => !menu?.services.some((s) => s.label === entry.name));

    /**
     * Palettes to show. Four that suit the trade, or all ten once the client asks —
     * `palettesForVertical` already falls back to all of them for "Other".
     */
    const shownPalettes = formData.showAllPalettes
        ? PALETTE_PRESETS
        : palettesForVertical(formData.industry);
    const colorStep = Math.max(0, Math.min(COLOR_STEPS - 1, formData.colorStep ?? 0));

    const scrollTop = () => {
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /**
     * Move to a top-level step. Entering "look" lands on the first color screen when
     * arriving forward and the LAST one when arriving backward — otherwise Back from
     * the following step would teleport the client to the start of the color flow.
     * `forceColorStep` overrides that for the rail, which always restarts the flow.
     */
    function goTo(n: number, forceColorStep?: number) {
        const clamped = Math.max(0, Math.min(lastStep, n));
        const entering = clamped === lookIndex && clamped !== step;
        setFormData((prev) => ({
            ...prev,
            currentStep: clamped,
            colorStep:
                forceColorStep ?? (entering ? (clamped < step ? COLOR_STEPS - 1 : 0) : prev.colorStep),
        }));
        setMaxVisited((m) => Math.max(m, clamped));
        scrollTop();
    }

    function goToColorStep(n: number) {
        set("colorStep", Math.max(0, Math.min(COLOR_STEPS - 1, n)));
        scrollTop();
    }

    // On the "look" step the footer buttons drive the nested color wizard first.
    const next = () => (onLook && colorStep < COLOR_STEPS - 1 ? goToColorStep(colorStep + 1) : goTo(step + 1));
    const back = () => (onLook && colorStep > 0 ? goToColorStep(colorStep - 1) : goTo(step - 1));

    /**
     * How much the client left blank, for an advisory hint only — nothing blocks submit.
     *
     * Counts only what we still ask for. It used to include `license` and `established`,
     * which the wizard no longer collects at all, so it would have reported every client as
     * two fields short of complete no matter what they did.
     */
    function blankCount(): number {
        let n = 0;
        const factStrings = [formData.phone, formData.address, formData.industry, formData.existingWebsiteUrl];
        n += factStrings.filter((v) => !v || !v.trim()).length;
        if (!formData.serviceList.some((s) => s.name.trim())) n += 1;
        if (!formData.hasLogo) n += 1;
        if (formData.images.heroSlides.length === 0) n += 1;
        if (!formData.diffChips.length && !formData.diffText.trim()) n += 1;
        return n;
    }

    function buildPayload(): BrandIntakeSubmission {
        return {
            selectedPlan: plan,
            brandName: formData.brandName,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            industry: formData.industry,
            serviceList: formData.serviceList.filter((s) => s.name.trim()),
            // Chips and free text are joined here, not in form state, so unticking a chip
            // never rebuilds or loses a sentence the client typed themselves.
            //
            // `vibe`, `adjectives` and `references` are sent empty rather than dropped:
            // BrandDirection still declares them, and brandDirectionToDetails already skips
            // empty arrays, so the copywriter prompt is unchanged by their absence.
            brandDirection: {
                differentiators: joinChoices(formData.diffChips, formData.diffText),
                targetCustomer: joinChoices(formData.customerChips, formData.customerText),
                vibe: [],
                tone: formData.voice,
                adjectives: [],
                references: "",
                forbidden: formData.forbidden,
            },
            palette: formData.palette,
            hasLogo: formData.hasLogo,
            images: formData.images,
            existingWebsiteUrl: formData.existingWebsiteUrl,
            additionalSites:
                plan === "enterprise"
                    ? formData.additionalSites
                          .filter((s) => s.brandName.trim())
                          .map((s) => ({
                              brandName: s.brandName,
                              brandShort: s.brandShort,
                              email: s.email,
                              phone: s.phone,
                              address: s.address,
                              businessHours: s.businessHours,
                              serviceList: s.serviceList.filter((x) => x.name.trim()),
                              palette: s.palette,
                              brandDirection: {
                                  differentiators: s.differentiators,
                                  targetCustomer: "",
                                  vibe: [],
                                  tone: [],
                                  adjectives: [],
                                  references: "",
                                  forbidden: "",
                              },
                          }))
                    : undefined,
        };
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!portalMode) {
            if (!turnstileSiteKey) {
                setSubmitState({ type: "error", message: "Security verification is not configured yet. Please try again later." });
                return;
            }
            if (!formData.turnstileToken) {
                setSubmitState({ type: "error", message: "Please complete the security verification before submitting." });
                return;
            }
            if (!formData.consent) {
                setSubmitState({ type: "error", message: "Please agree to the Privacy Policy before submitting." });
                return;
            }
        }

        setSubmitting(true);
        setSubmitState({ type: "idle", message: "" });

        // The site is named in the query string, not the body: it is an authorization
        // parameter, and `resolvePortalRequest` already reads `?site=` for every portal route.
        //
        // No longer a branch. `/api/onboarding` is gone along with the anonymous funnel — the
        // gate authenticates before checkout, so there is no unauthenticated wizard left to
        // serve. `portalMode` and the Turnstile/consent/honeypot machinery it gates are dead
        // weight now; removing them is mechanical and deliberately left as its own change so
        // it doesn't hide inside a behavioural one.
        const endpoint = `/api/portal/onboarding${siteRef ? `?site=${encodeURIComponent(siteRef)}` : ""}`;

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...buildPayload(),
                    ...(portalMode ? {} : {
                        consent: formData.consent,
                        turnstileToken: formData.turnstileToken,
                        website: formData.website,
                        sessionId,
                    }),
                }),
            });
            const data = (await response.json()) as { message?: string; slug?: string };
            if (!response.ok) throw new Error(data.message || "Unable to submit your onboarding form right now.");
            // The wizard renames the site from its placeholder, so the slug we arrived with is
            // already stale. Keep the one the server actually assigned for the redirect below.
            if (data.slug) setCompletedSlug(data.slug);
            setSubmitState({ type: "success", message: "" });
            // Clear local draft
            const storageKey = portalMode ? portalStorageKey(clerkUserId, siteRef) : safeStorageKey(sessionId);
            if (storageKey) localStorage.removeItem(storageKey);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Something went wrong.";
            setSubmitState({ type: "error", message });
        } finally {
            setSubmitting(false);
        }
    };

    if (submitState.type === "success") {
        if (portalMode) {
            // Portal mode: redirect immediately — they're already logged in.
            //
            // Carrying the slug matters for a multi-site client. Bare `/portal` re-runs
            // `selectSite`, which prefers a *live* site — so a client who had just spent ten
            // minutes describing their second site landed back on their first one with no
            // acknowledgement that anything had been submitted.
            const target = completedSlug
                ? `/portal?site=${encodeURIComponent(completedSlug)}`
                : "/portal";
            window.location.assign(target);
            return null;
        }
        return (
            <main style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "64px max(16px, 4vw)" }}>
                <div className="glass text-center" style={{ maxWidth: 520, width: "100%", padding: "48px 40px", borderRadius: 22 }}>
                    <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
                        <span style={{ display: "flex", width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--accent-glow)", fontSize: 28, color: "var(--accent)" }}>✓</span>
                    </div>
                    <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: 12 }}>You&apos;re all set!</h1>
                    <p style={{ color: "var(--fg-2)", lineHeight: 1.6 }}>
                        Your onboarding details have been submitted — our team will write your site copy and design from what you gave us, and follow up on anything we still need. Next, create your{" "}
                        <span style={{ color: "var(--fg)", fontWeight: 600 }}>client portal login</span> — where you&apos;ll track your website&apos;s performance
                        {plan === "starter" ? "" : " and review your AI call logs"}.
                    </p>
                    <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                        <Link href="/portal/sign-up" className="btn primary" style={{ display: "inline-flex" }}>Create your portal login</Link>
                        <Link href="/" className="btn ghost" style={{ display: "inline-flex" }}>Back to home</Link>
                    </div>
                    <p style={{ marginTop: 20, fontSize: 13, color: "var(--fg-3)" }}>Taking you there automatically…</p>
                </div>
            </main>
        );
    }

    // Advance the bar across the color sub-screens too, so it doesn't sit frozen
    // for three clicks while the client works through the palette flow.
    const progressPct = Math.round(
        ((step + (onLook ? colorStep / COLOR_STEPS : 0)) / lastStep) * 100,
    );
    const blanks = blankCount();

    return (
        <main style={{ minHeight: "100vh", background: "var(--bg)", position: "relative", overflow: "hidden" }}>
            <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => setTurnstileScriptLoaded(true)} />

            {/* Sticky plan banner + progress */}
            <div style={{ position: "sticky", top: 64, zIndex: 40, background: "var(--nav-bg-solid)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: "12px max(16px, 2vw)" }}>
                <div style={{ maxWidth: 896, margin: "0 auto" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span className="kicker">Selected Plan</span>
                            <span style={{ fontWeight: 600, color: "var(--fg)" }}>{planMeta.label}</span>
                            <span style={{ color: "var(--fg-3)" }}>—</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-2)" }}>{planMeta.price}</span>
                        </div>
                        <Link href="/pricing" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "underline" }}>Change plan</Link>
                    </div>
                    {/* Step rail */}
                    <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
                        {steps.map((s, i) => {
                            const done = i < step;
                            const active = i === step;
                            const reachable = i <= maxVisited;
                            return (
                                <button
                                    key={s.key}
                                    type="button"
                                    disabled={!reachable}
                                    onClick={() => reachable && goTo(i, i === lookIndex ? 0 : undefined)}
                                    className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition"
                                    style={{
                                        border: `1px solid ${active ? "var(--accent)" : "var(--rule)"}`,
                                        background: active ? "var(--accent)" : "var(--surface)",
                                        color: active ? "var(--on-accent)" : reachable ? "var(--fg-2)" : "var(--fg-3)",
                                        cursor: reachable ? "pointer" : "not-allowed",
                                    }}
                                >
                                    <span style={{ fontFamily: "var(--font-mono)" }}>{done ? "✓" : i + 1}</span>
                                    <span className="hidden sm:inline">{s.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ marginTop: 8, height: 4, borderRadius: 999, background: "var(--rule)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progressPct}%`, borderRadius: 999, background: "var(--accent)", transition: "width .4s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                    </div>
                </div>
            </div>

            {/* pt-24 = the sticky header's 64px overhang (it renders `top: 64` below its
                flow slot to clear the fixed nav) + a 32px breathing gap. Anything less and
                the restore banner / step card tuck under the progress bar. */}
            <div className="mx-auto max-w-4xl px-4 pt-24 pb-10 sm:px-6" style={{ position: "relative", zIndex: 1 }}>
                {restored && (
                    <div className="mb-6 flex items-start gap-3 rounded-lg px-4 py-3 text-sm" style={{ border: "1px solid var(--rule-strong)", background: "var(--surface)", color: "var(--fg-2)" }}>
                        <span className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }}>✓</span>
                        <p className="flex-1">
                            Welcome back — your progress has been restored.{" "}
                            <button type="button" className="underline hover:no-underline" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => {
                                const key = safeStorageKey(sessionId);
                                if (key) localStorage.removeItem(key);
                                setFormData(makeInitialData(plan, prefillEmail));
                                setMaxVisited(0);
                                setRestored(false);
                            }}>Start fresh instead</button>
                        </p>
                        <button type="button" onClick={() => setRestored(false)} className="shrink-0" style={{ color: "var(--fg-3)", cursor: "pointer" }} aria-label="Dismiss">✕</button>
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    {/* Honeypot */}
                    <label className="hidden" aria-hidden="true">
                        <input tabIndex={-1} autoComplete="off" type="text" value={formData.website} onChange={(e) => set("website", e.target.value)} />
                    </label>

                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        {/* ── Step: Your business ── */}
                        {steps[step].key === "business" && (
                            <div className="space-y-6">
                                <div>
                                    <span className="eyebrow">Onboarding</span>
                                    <h1 style={{ fontSize: "var(--text-2xl)", marginTop: 12, marginBottom: 12 }}>Tell us about your business</h1>
                                    <div className="rounded-xl p-4" style={{ border: "1px solid var(--rule-strong)", background: "var(--surface)" }}>
                                        <p style={{ color: "var(--fg-2)", lineHeight: 1.65, fontSize: 15 }}>
                                            <strong style={{ color: "var(--fg)" }}>Mostly clicking, not typing.</strong> Pick your trade and we&apos;ll
                                            offer you the rest &mdash; services, what sets you apart, how you want to sound.
                                            <strong style={{ color: "var(--fg)" }}> You never write any copy</strong>; we write your headlines and
                                            descriptions from what you choose here. Nothing is required.
                                        </p>
                                    </div>
                                </div>

                                {/* Industry leads the whole wizard: it decides which services, differentiators,
                                    audiences and palettes every later step offers. */}
                                <Field label="What do you do?" hint="This tailors everything we offer you from here on.">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {INDUSTRY_OPTIONS.map((o) => {
                                            const on = formData.industry === o.id;
                                            return (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    onClick={() => set("industry", o.id)}
                                                    className="rounded-xl px-4 py-3 text-left text-sm font-semibold transition"
                                                    style={{
                                                        border: `1px solid ${on ? "var(--accent)" : "var(--rule-strong)"}`,
                                                        background: on ? "var(--accent)" : "var(--surface)",
                                                        color: on ? "var(--on-accent)" : "var(--fg-2)",
                                                        cursor: "pointer",
                                                    }}
                                                    aria-pressed={on}
                                                >
                                                    {o.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Field>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <Field label="Business name"><input className={inputCls} value={formData.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="Peak Home Services" /></Field>
                                    <Field label="Email"><input type="email" className={inputCls} value={formData.email} onChange={(e) => set("email", e.target.value)} placeholder="owner@business.com" /></Field>
                                    <Field label="Phone"><input className={inputCls} value={formData.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(907) 555-0142" /></Field>
                                    <Field label="Business address"><input className={inputCls} value={formData.address} onChange={(e) => set("address", e.target.value)} placeholder="318 Glacier Ave, Juneau, AK" /></Field>
                                </div>
                            </div>
                        )}

                        {/* ── Step: What you do ── */}
                        {steps[step].key === "services" && (
                            <div className="space-y-6">
                                <StepTitle title="What you do" sub="Tick what you offer. We write the descriptions." />

                                {menu ? (
                                    <div className="space-y-2">
                                        <Chips
                                            options={menu.services.map((s) => s.label)}
                                            selected={formData.serviceList.map((s) => s.name)}
                                            onToggle={(label) => {
                                                const hit = menu.services.find((s) => s.label === label);
                                                if (hit) toggleService(hit.label, hit.tag);
                                            }}
                                        />
                                        <p style={helpText}>Missing something? Add it below.</p>
                                    </div>
                                ) : (
                                    // "Other" has no menu, so this step falls back to typing. Roughly one client
                                    // in seven lands here, and they genuinely do have to describe themselves —
                                    // the alternative is offering options that don't fit.
                                    <p style={helpText}>Tell us what you offer &mdash; just the name and a short category. We write the descriptions.</p>
                                )}

                                {/* Custom rows live in the same serviceList as the chips, so a client can mix
                                    ticked options with their own without the two competing. */}
                                <div className="space-y-3">
                                    {customServices.map(({ entry, index }) => (
                                        <div key={index} className="flex items-end gap-2">
                                            <div className="flex-1"><Field label=""><input className={inputCls} value={entry.name} onChange={(e) => updateService(index, "name", e.target.value)} placeholder="Service name" /></Field></div>
                                            <div style={{ width: 160 }}><Field label=""><input className={inputCls} value={entry.tag} onChange={(e) => updateService(index, "tag", e.target.value)} placeholder="Category" /></Field></div>
                                            <button type="button" className={removeRowBtnCls} onClick={() => removeService(index)} aria-label="Remove service"><Trash size={16} /></button>
                                        </div>
                                    ))}
                                    {formData.serviceList.length < 12 && (
                                        <button type="button" className={addBtnCls} onClick={addService}><Plus size={16} /> Add your own</button>
                                    )}
                                </div>

                                {/* The single highest-value input on the form: it lets the copywriter read their
                                    real site and recover the facts we no longer ask anyone to retype. */}
                                <Field label="Do you have a website already?" hint="We'll read it so you don't have to retype your hours, credentials or reviews. Leave blank if you don't have one.">
                                    <input className={inputCls} value={formData.existingWebsiteUrl} onChange={(e) => set("existingWebsiteUrl", e.target.value)} placeholder="https://yourbusiness.com" />
                                </Field>
                            </div>
                        )}

                        {/* ── Step: What sets you apart ── */}
                        {steps[step].key === "apart" && (
                            <div className="space-y-6">
                                <StepTitle title="What sets you apart" sub="The most useful thing we can know. Pick anything that is true." />

                                <div className="space-y-2">
                                    <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>What makes you different?</span>
                                    <Chips options={differentiatorsFor(formData.industry)} selected={formData.diffChips} onToggle={(v) => toggleIn("diffChips", v)} />
                                    <input className={inputCls} value={formData.diffText} onChange={(e) => set("diffText", e.target.value)} placeholder="Anything else that sets you apart (optional)" />
                                </div>

                                <div className="space-y-2">
                                    <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Who do you serve?</span>
                                    <Chips options={customersFor(formData.industry)} selected={formData.customerChips} onToggle={(v) => toggleIn("customerChips", v)} />
                                    <input className={inputCls} value={formData.customerText} onChange={(e) => set("customerText", e.target.value)} placeholder="Anyone else you would add (optional)" />
                                </div>
                            </div>
                        )}

                        {/* ── Step: How it should sound ── */}
                        {steps[step].key === "sound" && (
                            <div className="space-y-6">
                                <StepTitle title="How it should sound" sub="Steers how we write. Pick a few that feel right." />
                                <div className="space-y-2">
                                    <Chips options={VOICE_OPTIONS} selected={formData.voice} onToggle={(v) => toggleIn("voice", v)} />
                                </div>
                                <Field label="Anything to avoid?" hint="Words, claims, or styles you do not want. Optional.">
                                    <input className={inputCls} value={formData.forbidden} onChange={(e) => set("forbidden", e.target.value)} placeholder="e.g. cheap, overly corporate tone" />
                                </Field>
                            </div>
                        )}

                        {/* ── Step: Look & feel — a 3-screen color sub-wizard ── */}
                        {steps[step].key === "look" && (
                            <div className="space-y-6">
                                <ColorSubSteps current={colorStep} />

                                {/* Screen 0 — pick a preset */}
                                {colorStep === 0 && (
                                    <div className="space-y-4">
                                        <StepTitle
                                            title="Choose a color theme"
                                            sub={
                                                formData.showAllPalettes || !menu
                                                    ? "Pick the direction that feels closest to your brand. You'll see it previewed next, and you can fine-tune it there."
                                                    : "These suit your trade. You'll see your pick previewed next, and you can fine-tune it there."
                                            }
                                        />
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {shownPalettes.map((preset) => {
                                                const on = formData.palette.presetId === preset.id;
                                                return (
                                                    <button key={preset.id} type="button" onClick={() => { set("palette", { mode: "preset", presetId: preset.id }); setColorAdjusting(false); }} className={cardCls} style={{ borderColor: on ? "var(--accent)" : "var(--rule)", boxShadow: on ? "0 0 0 1px var(--accent)" : "none", textAlign: "left", cursor: "pointer" }}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{preset.label}</span>
                                                            {on && <span style={{ color: "var(--accent)" }}>✓</span>}
                                                        </div>
                                                        <div className="mt-3 flex gap-1.5">
                                                            {[preset.palette.ink, preset.palette.accent, preset.palette.bgSoft, preset.palette.bg].map((c, idx) => (
                                                                <span key={idx} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: "1px solid var(--rule)" }} />
                                                            ))}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Narrowing the opening choice, not taking one away: every palette
                                            stays reachable, it just isn't all ten at once for a client who
                                            has no reason to judge them cold. */}
                                        {!formData.showAllPalettes && menu && shownPalettes.length < PALETTE_PRESETS.length && (
                                            <button
                                                type="button"
                                                onClick={() => set("showAllPalettes", true)}
                                                className="text-sm font-semibold"
                                                style={{ color: "var(--fg-3)", textDecoration: "underline", cursor: "pointer" }}
                                            >
                                                See all {PALETTE_PRESETS.length} themes
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Screen 1 — preview, then optionally adjust */}
                                {colorStep === 1 && (
                                    <div className="space-y-5">
                                        <StepTitle title="Here's how it looks" sub="A preview of your site in the colors you picked." />
                                        <div style={{ maxWidth: 460 }}><PalettePreview palette={formData.palette} /></div>

                                        {colorAdjusting ? (
                                            <div className="space-y-4 rounded-xl p-4" style={{ border: "1px solid var(--rule)", background: "var(--surface)" }}>
                                                <div className="flex flex-wrap items-center gap-6">
                                                    <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--fg)" }}>
                                                        Accent
                                                        <input type="color" value={formData.palette.accentColor ?? "#1E6FBF"} onChange={(e) => set("palette", { ...formData.palette, mode: "custom", accentColor: e.target.value.toUpperCase() })} style={{ width: 44, height: 32, borderRadius: 8, border: "1px solid var(--rule)", background: "none" }} />
                                                    </label>
                                                    {isDarkMood(formData.palette.bgMood) ? (
                                                        <span className="text-xs" style={{ color: "var(--fg-3)" }}>
                                                            Text color is set automatically on dark backgrounds so it stays readable.
                                                        </span>
                                                    ) : (
                                                        <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--fg)" }}>
                                                            Text / ink
                                                            <input type="color" value={formData.palette.baseColor ?? "#0F172A"} onChange={(e) => set("palette", { ...formData.palette, mode: "custom", baseColor: e.target.value.toUpperCase() })} style={{ width: 44, height: 32, borderRadius: 8, border: "1px solid var(--rule)", background: "none" }} />
                                                        </label>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Background</span>
                                                    <MoodChips palette={formData.palette} onChange={(p) => set("palette", p)} />
                                                </div>
                                                <ContrastWarnings palette={formData.palette} onChange={(p) => set("palette", p)} />
                                                <AdvancedColors palette={formData.palette} onChange={(p) => set("palette", p)} />
                                                <button type="button" className="text-sm font-semibold underline" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => { set("palette", { mode: "preset", presetId: formData.palette.presetId ?? DEFAULT_PALETTE_PRESET_ID }); setColorAdjusting(false); }}>
                                                    ← Undo my changes
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-3 rounded-xl p-4" style={{ border: "1px solid var(--rule)", background: "var(--surface)" }}>
                                                <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Happy with these colors?</span>
                                                <div className="flex flex-wrap gap-2">
                                                    <button type="button" className="btn primary" onClick={next}>Looks great →</button>
                                                    <button type="button" className="btn ghost" onClick={() => { if (formData.palette.mode === "preset") set("palette", presetToPick(formData.palette.presetId)); setColorAdjusting(true); }}>
                                                        Let me adjust
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Screen 2 — confirm */}
                                {colorStep === 2 && (
                                    <div className="space-y-5">
                                        <StepTitle title="Confirm your colors" sub="This is the palette we'll build your site with. You can always change it later — just tell us." />
                                        <div style={{ maxWidth: 520 }}><PalettePreview palette={formData.palette} /></div>
                                        <p className="text-sm" style={{ color: "var(--fg-2)" }}>{paletteSummary(formData.palette)}</p>
                                        <button type="button" className="text-sm font-semibold underline" style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => { setColorAdjusting(true); goToColorStep(1); }}>
                                            ← Adjust colors
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Logo & photos, shown on the last Look screen — media belongs with the
                            rest of the look, and a step of its own was one more click. */}
                        {steps[step].key === "look" && colorStep === COLOR_STEPS - 1 && (
                            <div className="space-y-6">
                                <StepTitle title="Logo & photos" sub="Share what you have. Anything you skip, we'll design or source for you." />

                                {/* Logo */}
                                <div className="space-y-3">
                                    <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Logo</span>
                                    {formData.images.logo ? (
                                        <div className="flex items-center gap-3 rounded-xl border border-[var(--rule)] bg-[var(--surface)] p-3">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={formData.images.logo.url} alt="Logo preview" style={{ height: 40, borderRadius: 6 }} />
                                            <span className="flex-1 truncate text-sm" style={{ color: "var(--fg-2)" }}>{formData.images.logo.filename}</span>
                                            <button type="button" className="text-sm" style={{ color: "var(--accent-2)", cursor: "pointer" }} onClick={() => setFormData((prev) => ({ ...prev, images: { ...prev.images, logo: undefined } }))}>Remove</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-4">
                                            <label className={uploadBtnCls}>
                                                {uploadingSlots.has("logo") ? "Uploading…" : "Upload logo"}
                                                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--fg-2)" }}>
                                                <input type="checkbox" checked={!formData.hasLogo} onChange={(e) => set("hasLogo", !e.target.checked)} className="h-4 w-4 cursor-pointer" />
                                                No logo yet — design one for me
                                            </label>
                                        </div>
                                    )}
                                    {uploadErrors["logo"] && <p className="text-sm" style={{ color: "var(--accent-2)" }}>{uploadErrors["logo"]}</p>}
                                </div>

                                {/* Photos */}
                                <div className="space-y-3">
                                    <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Photos <span style={{ fontWeight: 400, color: "var(--fg-3)" }}>(optional — real photos of your work/team beat stock)</span></span>
                                    <label className={uploadBtnCls}>
                                        {uploadingSlots.has("hero") ? "Uploading…" : "Add photos"}
                                        <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleHeroSlideUpload} />
                                    </label>
                                    {uploadErrors["hero"] && <p className="text-sm" style={{ color: "var(--accent-2)" }}>{uploadErrors["hero"]}</p>}
                                    {formData.images.heroSlides.length > 0 && (
                                        <div className="flex flex-wrap gap-3">
                                            {formData.images.heroSlides.map((img, i) => (
                                                <div key={i} className="relative">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={img.url} alt={`Upload ${i + 1}`} style={{ height: 72, width: 96, objectFit: "cover", borderRadius: 8, border: "1px solid var(--rule)" }} />
                                                    <button type="button" onClick={() => removeHeroSlide(i)} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--surface)", border: "1px solid var(--rule-strong)", color: "var(--fg-3)", cursor: "pointer" }} aria-label="Remove photo">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}


                        {/* ── Step: Enterprise additional sites ── */}
                        {steps[step].key === "sites" && (
                            <div className="space-y-5">
                                <StepTitle title="Additional sites" sub={`Your ${planMeta.label} plan includes up to ${planMeta.maxSites} sites. Add facts for each extra location or brand — we write their copy too.`} />
                                {formData.additionalSites.map((s, i) => (
                                    <div key={i} className={cardCls}>
                                        <button type="button" className="absolute right-3 top-3 text-sm" style={{ color: "var(--accent-2)", cursor: "pointer" }} onClick={() => removeAdditionalSite(i)}>Remove</button>
                                        <p className="mb-3 text-sm font-semibold" style={{ color: "var(--fg)" }}>Site {i + 2}</p>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <Field label="Business name"><input className={inputCls} value={s.brandName} onChange={(e) => updateAdditionalSite(i, { brandName: e.target.value })} /></Field>
                                            <Field label="Short name"><input className={inputCls} value={s.brandShort} onChange={(e) => updateAdditionalSite(i, { brandShort: e.target.value })} /></Field>
                                            <Field label="Email"><input className={inputCls} value={s.email} onChange={(e) => updateAdditionalSite(i, { email: e.target.value })} /></Field>
                                            <Field label="Phone"><input className={inputCls} value={s.phone} onChange={(e) => updateAdditionalSite(i, { phone: e.target.value })} /></Field>
                                            <Field label="Address"><input className={inputCls} value={s.address} onChange={(e) => updateAdditionalSite(i, { address: e.target.value })} /></Field>
                                            <Field label="What makes it different?"><input className={inputCls} value={s.differentiators} onChange={(e) => updateAdditionalSite(i, { differentiators: e.target.value })} /></Field>
                                        </div>
                                        <div className="mt-3">
                                            <span className="text-xs font-semibold" style={{ color: "var(--fg-2)" }}>Color theme</span>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {PALETTE_PRESETS.map((preset) => {
                                                    const on = s.palette.mode === "preset" && s.palette.presetId === preset.id;
                                                    return (
                                                        <button key={preset.id} type="button" onClick={() => updateAdditionalSite(i, { palette: { mode: "preset", presetId: preset.id } })} title={preset.label} style={{ display: "flex", gap: 3, padding: 4, borderRadius: 8, border: `1px solid ${on ? "var(--accent)" : "var(--rule)"}`, background: "var(--surface)", cursor: "pointer" }}>
                                                            <span style={{ width: 16, height: 16, borderRadius: 4, background: preset.palette.ink }} />
                                                            <span style={{ width: 16, height: 16, borderRadius: 4, background: preset.palette.accent }} />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {formData.additionalSites.length < planMeta.maxSites - 1 && (
                                    <button type="button" className={addBtnCls} onClick={addAdditionalSite}><Plus size={16} /> Add a site</button>
                                )}
                            </div>
                        )}

                        {/* ── Step: Review & submit ── */}
                        {steps[step].key === "review" && (
                            <div className="space-y-5">
                                <StepTitle title="Review & submit" sub="A quick recap. Blanks are fine — we'll follow up on anything we need." />
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <ReviewItem label="Business" value={formData.brandName} />
                                    <ReviewItem label="Industry" value={INDUSTRY_OPTIONS.find((o) => o.id === formData.industry)?.label ?? ""} />
                                    <ReviewItem label="Email" value={formData.email} />
                                    <ReviewItem label="Phone" value={formData.phone} />
                                    <ReviewItem label="Services" value={formData.serviceList.filter((s) => s.name.trim()).map((s) => s.name).join(", ")} />
                                    {/* The direction answers are what actually steer the copy, so the
                                        review should show them rather than only the contact facts. */}
                                    <ReviewItem label="Sets you apart" value={joinChoices(formData.diffChips, formData.diffText)} />
                                    <ReviewItem label="You serve" value={joinChoices(formData.customerChips, formData.customerText)} />
                                    <ReviewItem label="Voice" value={formData.voice.join(", ")} />
                                    <ReviewItem label="Color theme" value={presetById(formData.palette.presetId)?.label ?? "Custom"} />
                                    <ReviewItem label="Logo" value={formData.images.logo ? "Uploaded" : formData.hasLogo ? "—" : "Design one for me"} />
                                    <ReviewItem label="Photos" value={formData.images.heroSlides.length ? `${formData.images.heroSlides.length} uploaded` : "None"} />
                                    <ReviewItem label="Existing site" value={formData.existingWebsiteUrl} />
                                </div>
                                {blanks > 0 && (
                                    <p className="rounded-lg px-4 py-3 text-sm" style={{ border: "1px solid var(--rule-strong)", background: "var(--surface)", color: "var(--fg-2)" }}>
                                        You left about <strong style={{ color: "var(--fg)" }}>{blanks}</strong> {blanks === 1 ? "detail" : "details"} blank. That&apos;s okay — we&apos;ll reach out to fill any gaps before we build.
                                    </p>
                                )}
                                {!portalMode && (
                                    <>
                                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--rule)] bg-[var(--surface)] p-4 text-sm" style={{ color: "var(--fg-2)" }}>
                                            <input type="checkbox" checked={formData.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1 h-4 w-4 cursor-pointer rounded border-[var(--rule-strong)]" />
                                            <span>I agree to the collection and processing of my information as described in the <Link href="/privacy-policy" className="font-semibold underline underline-offset-4" style={{ color: "var(--fg)" }}>Privacy Policy</Link>.</span>
                                        </label>
                                        <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] p-4">
                                            <p className="mb-3 text-sm font-semibold" style={{ color: "var(--fg)" }}>Security verification</p>
                                            <div ref={turnstileContainerRef} />
                                        </div>
                                    </>
                                )}
                                {submitState.type === "error" && (<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitState.message}</p>)}
                            </div>
                        )}
                    </section>

                    {/* Nav controls */}
                    <div className="mt-6 flex items-center justify-between">
                        <button type="button" onClick={back} disabled={step === 0} className="btn ghost" style={{ opacity: step === 0 ? 0.4 : 1, cursor: step === 0 ? "not-allowed" : "pointer" }}>← Back</button>
                        {step < lastStep ? (
                            <button type="button" onClick={next} className="btn primary">Next →</button>
                        ) : (
                            <button
                                type="submit"
                                disabled={
                                    submitting ||
                                    uploadingSlots.size > 0 ||
                                    (!portalMode && (!turnstileSiteKey || !formData.turnstileToken || !formData.consent))
                                }
                                className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 btn primary"
                            >
                                {submitting ? "Submitting…" : "Submit onboarding"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </main>
    );
}

function StepTitle({ title, sub }: { title: string; sub?: string }) {
    return (
        <div style={{ marginBottom: 8 }}>
            <h2 style={{ fontSize: "var(--text-xl)", marginBottom: sub ? 6 : 0 }}>{title}</h2>
            {sub ? <p style={{ color: "var(--fg-2)", lineHeight: 1.6, fontSize: 14 }}>{sub}</p> : null}
        </div>
    );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] px-4 py-3">
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--fg-3)" }}>{label}</p>
            <p style={{ marginTop: 2, color: value ? "var(--fg)" : "var(--fg-3)", fontSize: 14 }}>{value || "—"}</p>
        </div>
    );
}
