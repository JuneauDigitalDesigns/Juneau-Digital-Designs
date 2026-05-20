"use client";

import Link from "next/link";
import Script from "next/script";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { upload } from "@vercel/blob/client";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";

declare global {
    interface Window {
        turnstile?: {
            render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
            reset: (widgetId?: string) => void;
        };
    }
}

type PlanSlug = "starter" | "growth" | "enterprise";

type ImageMeta = { url: string; filename: string; alt: string };
type HeroBullet = { value: string; label: string };
type AboutStat = { n: string; l: string };
type Pillar = { k: string; t: string; d: string };
type Project = { t: string; loc: string; yr: string; scope: string; size: string; caption: string; image?: ImageMeta };
type ServiceEntry = { t: string; tag: string; d: string; images: ImageMeta[] };
type TestimonialEntry = { q: string; a: string; r: string; company: string; stars: string; avatar?: ImageMeta };
type FaqEntry = { q: string; a: string };

type OnboardingFormData = {
    // — Contact / Brand basics —
    brandName: string;
    brandLong: string;
    brandShort: string;
    email: string;
    phone: string;
    address: string;
    license: string;
    websiteType: string;
    // — Business details —
    industry: string;
    established: string;
    brandTagline: string;
    usp: string;
    notableClients: string;
    businessHours: string;
    certifications: string;
    awards: string;
    // — Branding / palette —
    paletteAccent: string;
    paletteBg: string;
    paletteBgSoft: string;
    paletteInk: string;
    paletteInkSoft: string;
    paletteRule: string;
    hasLogo: string;
    // — Announcement —
    announcement: string;
    // — SEO —
    seoTitle: string;
    seoDescription: string;
    seoCanonical: string;
    googleAnalyticsId: string;
    facebookPixelId: string;
    // — Extensions —
    mapsUrl: string;
    bookingUrl: string;
    portalUrl: string;
    // — Social —
    linkedin: string;
    instagram: string;
    facebook: string;
    youtube: string;
    // — Hero content —
    heroEyebrow: string;
    heroHeadline: string;
    heroHeadlineEmphasis: string;
    heroSub: string;
    heroCta: string;
    heroSecondaryCta: string;
    heroBadge: string;
    heroFrictionReducers: string[];
    heroBullets: HeroBullet[];
    // — About content —
    aboutEyebrow: string;
    aboutTitle: string;
    aboutBody: string;
    pillars: Pillar[];
    aboutStats: AboutStat[];
    // — Services section —
    servicesEyebrow: string;
    servicesTitle: string;
    servicesSub: string;
    services: ServiceEntry[];
    // — Work / Projects section —
    workEyebrow: string;
    workTitle: string;
    workSub: string;
    projects: Project[];
    // — Testimonials section —
    testimonialsEyebrow: string;
    testimonialsTitle: string;
    testimonials: TestimonialEntry[];
    // — FAQ section —
    faqEyebrow: string;
    faqTitle: string;
    faqSub: string;
    faqs: FaqEntry[];
    // — Final CTA section —
    finalCtaEyebrow: string;
    finalCtaHeadline: string;
    finalCtaSub: string;
    finalCtaCta: string;
    finalCtaSecondary: string;
    finalCtaFrictionReducers: string[];
    // — Footer —
    footerBlurb: string;
    footerLegal: string;
    // — Images —
    images: { logo?: ImageMeta; heroSlides: ImageMeta[]; aboutFeature?: ImageMeta };
    // — Form mode —
    formMode: "basic" | "detailed";
    scrapeExistingWebsite: boolean;
    scrapeWebsiteDomain: string;
    // — Form meta —
    selectedPlan: PlanSlug;
    consent: boolean;
    turnstileToken: string;
    website: string;
    // — Enterprise: additional sites (max 2; 3 sites total) —
    additionalSites: AdditionalSiteForm[];
};

type AdditionalSiteForm = {
    brandName: string;
    brandShort: string;
    brandTagline: string;
    email: string;
    phone: string;
    address: string;
    paletteAccent: string;
    paletteBg: string;
    paletteBgSoft: string;
    paletteInk: string;
    paletteInkSoft: string;
    paletteRule: string;
    heroHeadline: string;
    heroSub: string;
    businessHours: string;
    usp: string;
    services: ServiceEntry[];
    faqs: FaqEntry[];
};

type SubmitState = { type: "idle" | "success" | "error"; message: string };

const PLAN_META: Record<PlanSlug, { label: string; price: string }> = {
    starter: { label: "Starter", price: "$117/month" },
    growth: { label: "Growth", price: "$297/month" },
    enterprise: { label: "Enterprise", price: "$697/month" },
};

const BLANK_SERVICE: ServiceEntry = { t: "", tag: "", d: "", images: [] };
const BLANK_TESTIMONIAL: TestimonialEntry = { q: "", a: "", r: "", company: "", stars: "5" };
const BLANK_BULLET: HeroBullet = { value: "", label: "" };
const BLANK_PILLAR: Pillar = { k: "", t: "", d: "" };
const BLANK_ABOUT_STAT: AboutStat = { n: "", l: "" };
const BLANK_PROJECT: Project = { t: "", loc: "", yr: "", scope: "", size: "", caption: "" };
const BLANK_FAQ: FaqEntry = { q: "", a: "" };
const BLANK_ADDITIONAL_SITE: AdditionalSiteForm = {
    brandName: "",
    brandShort: "",
    brandTagline: "",
    email: "",
    phone: "",
    address: "",
    paletteAccent: "#3B82F6",
    paletteBg: "#FFFFFF",
    paletteBgSoft: "#F8FAFC",
    paletteInk: "#0F172A",
    paletteInkSoft: "#475569",
    paletteRule: "#E2E8F0",
    heroHeadline: "",
    heroSub: "",
    businessHours: "",
    usp: "",
    services: [{ ...BLANK_SERVICE }],
    faqs: [{ ...BLANK_FAQ }],
};

function makeInitialData(plan: PlanSlug, prefillEmail = ""): OnboardingFormData {
    return {
        brandName: "",
        brandLong: "",
        brandShort: "",
        email: prefillEmail,
        phone: "",
        address: "",
        license: "",
        websiteType: "New website",
        industry: "",
        established: "",
        brandTagline: "",
        usp: "",
        notableClients: "",
        businessHours: "",
        certifications: "",
        awards: "",
        paletteAccent: "#3B82F6",
        paletteBg: "#FFFFFF",
        paletteBgSoft: "#F8FAFC",
        paletteInk: "#0F172A",
        paletteInkSoft: "#475569",
        paletteRule: "#E2E8F0",
        hasLogo: "no",
        announcement: "",
        seoTitle: "",
        seoDescription: "",
        seoCanonical: "",
        googleAnalyticsId: "",
        facebookPixelId: "",
        mapsUrl: "",
        bookingUrl: "",
        portalUrl: "",
        linkedin: "",
        instagram: "",
        facebook: "",
        youtube: "",
        heroEyebrow: "",
        heroHeadline: "",
        heroHeadlineEmphasis: "",
        heroSub: "",
        heroCta: "",
        heroSecondaryCta: "",
        heroBadge: "",
        heroFrictionReducers: [],
        heroBullets: [{ ...BLANK_BULLET }],
        aboutEyebrow: "",
        aboutTitle: "",
        aboutBody: "",
        pillars: [{ ...BLANK_PILLAR }],
        aboutStats: [{ ...BLANK_ABOUT_STAT }],
        servicesEyebrow: "",
        servicesTitle: "",
        servicesSub: "",
        services: [{ ...BLANK_SERVICE }],
        workEyebrow: "",
        workTitle: "",
        workSub: "",
        projects: [{ ...BLANK_PROJECT }],
        testimonialsEyebrow: "",
        testimonialsTitle: "",
        testimonials: [{ ...BLANK_TESTIMONIAL }],
        faqEyebrow: "",
        faqTitle: "",
        faqSub: "",
        faqs: [{ ...BLANK_FAQ }],
        finalCtaEyebrow: "",
        finalCtaHeadline: "",
        finalCtaSub: "",
        finalCtaCta: "",
        finalCtaSecondary: "",
        finalCtaFrictionReducers: [],
        footerBlurb: "",
        footerLegal: "",
        images: { heroSlides: [], logo: undefined },
        formMode: "basic",
        scrapeExistingWebsite: false,
        scrapeWebsiteDomain: "",
        selectedPlan: plan,
        consent: false,
        turnstileToken: "",
        website: "",
        additionalSites: [],
    };
}

const inputCls =
    "rounded-xl border border-white/[0.12] bg-white/[0.06] w-full px-4 py-3 text-white/90 placeholder:text-white/30 outline-none transition focus:border-[var(--accent)]";
const labelCls = "flex flex-col gap-2 text-sm font-semibold";

function SectionHeading({ number, title }: { number: string; title: string }) {
    return (
        <div
            style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 12,
                paddingBottom: 12,
                borderBottom: "1px solid var(--rule)",
            }}
        >
            <span
                style={{
                    display: "flex",
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "#06121a",
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                }}
            >
                {number}
            </span>
            <h2
                style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--fg)",
                    fontFamily: "var(--font-display)",
                }}
            >
                {title}
            </h2>
        </div>
    );
}

export default function OnboardingPageClient({ plan, prefillEmail = "" }: { plan: PlanSlug; prefillEmail?: string }) {
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const [formData, setFormData] = useState<OnboardingFormData>(() => makeInitialData(plan, prefillEmail));
    const [submitting, setSubmitting] = useState(false);
    const [turnstileScriptLoaded, setTurnstileScriptLoaded] = useState(false);
    const [submitState, setSubmitState] = useState<SubmitState>({ type: "idle", message: "" });
    const [uploadingSlots, setUploadingSlots] = useState<Set<string>>(new Set());
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

    const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
    const turnstileWidgetIdRef = useRef<string | null>(null);

    const planMeta = PLAN_META[plan];

    useEffect(() => {
        if (!turnstileSiteKey || !turnstileScriptLoaded || !window.turnstile || !turnstileContainerRef.current) {
            return;
        }
        if (turnstileWidgetIdRef.current) {
            return;
        }
        turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: turnstileSiteKey,
            callback: (token: string) => {
                setFormData((prev) => ({ ...prev, turnstileToken: token }));
            },
            "expired-callback": () => {
                setFormData((prev) => ({ ...prev, turnstileToken: "" }));
            },
            "error-callback": () => {
                setFormData((prev) => ({ ...prev, turnstileToken: "" }));
            },
            theme: "light",
        });
    }, [turnstileScriptLoaded, turnstileSiteKey]);

    function set(field: keyof OnboardingFormData, value: unknown) {
        setFormData((prev) => ({ ...prev, [field]: value }));
    }

    // Enterprise additional-site helpers
    function addAdditionalSite() {
        setFormData((prev) => ({
            ...prev,
            additionalSites: [...prev.additionalSites, { ...BLANK_ADDITIONAL_SITE }],
        }));
    }
    function removeAdditionalSite(index: number) {
        setFormData((prev) => ({
            ...prev,
            additionalSites: prev.additionalSites.filter((_, i) => i !== index),
        }));
    }
    function updateAdditionalSite<K extends keyof AdditionalSiteForm>(
        index: number,
        field: K,
        value: AdditionalSiteForm[K],
    ) {
        setFormData((prev) => ({
            ...prev,
            additionalSites: prev.additionalSites.map((s, i) =>
                i === index ? { ...s, [field]: value } : s,
            ),
        }));
    }
    function addAdditionalSiteService(siteIndex: number) {
        setFormData((prev) => ({
            ...prev,
            additionalSites: prev.additionalSites.map((s, i) =>
                i === siteIndex ? { ...s, services: [...s.services, { ...BLANK_SERVICE }] } : s,
            ),
        }));
    }
    function removeAdditionalSiteService(siteIndex: number, svcIndex: number) {
        setFormData((prev) => ({
            ...prev,
            additionalSites: prev.additionalSites.map((s, i) =>
                i === siteIndex
                    ? { ...s, services: s.services.filter((_, j) => j !== svcIndex) }
                    : s,
            ),
        }));
    }
    function updateAdditionalSiteService(
        siteIndex: number,
        svcIndex: number,
        field: keyof Omit<ServiceEntry, "images">,
        value: string,
    ) {
        setFormData((prev) => ({
            ...prev,
            additionalSites: prev.additionalSites.map((s, i) =>
                i === siteIndex
                    ? {
                          ...s,
                          services: s.services.map((sv, j) =>
                              j === svcIndex ? { ...sv, [field]: value } : sv,
                          ),
                      }
                    : s,
            ),
        }));
    }
    function addAdditionalSiteFaq(siteIndex: number) {
        setFormData((prev) => ({
            ...prev,
            additionalSites: prev.additionalSites.map((s, i) =>
                i === siteIndex ? { ...s, faqs: [...s.faqs, { ...BLANK_FAQ }] } : s,
            ),
        }));
    }
    function removeAdditionalSiteFaq(siteIndex: number, faqIndex: number) {
        setFormData((prev) => ({
            ...prev,
            additionalSites: prev.additionalSites.map((s, i) =>
                i === siteIndex
                    ? { ...s, faqs: s.faqs.filter((_, j) => j !== faqIndex) }
                    : s,
            ),
        }));
    }
    function updateAdditionalSiteFaq(
        siteIndex: number,
        faqIndex: number,
        field: keyof FaqEntry,
        value: string,
    ) {
        setFormData((prev) => ({
            ...prev,
            additionalSites: prev.additionalSites.map((s, i) =>
                i === siteIndex
                    ? {
                          ...s,
                          faqs: s.faqs.map((f, j) =>
                              j === faqIndex ? { ...f, [field]: value } : f,
                          ),
                      }
                    : s,
            ),
        }));
    }

    // Services helpers
    function updateService(index: number, field: keyof Omit<ServiceEntry, "images">, value: string) {
        setFormData((prev) => ({
            ...prev,
            services: prev.services.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
        }));
    }
    function addService() {
        setFormData((prev) => ({ ...prev, services: [...prev.services, { ...BLANK_SERVICE }] }));
    }
    function removeService(index: number) {
        setFormData((prev) => ({ ...prev, services: prev.services.filter((_, i) => i !== index) }));
    }

    // Pillar helpers
    function updatePillar(index: number, field: keyof Pillar, value: string) {
        setFormData((prev) => ({
            ...prev,
            pillars: prev.pillars.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
        }));
    }
    function addPillar() {
        setFormData((prev) => ({ ...prev, pillars: [...prev.pillars, { ...BLANK_PILLAR }] }));
    }
    function removePillar(index: number) {
        setFormData((prev) => ({ ...prev, pillars: prev.pillars.filter((_, i) => i !== index) }));
    }

    // About-stat helpers
    function updateAboutStat(index: number, field: keyof AboutStat, value: string) {
        setFormData((prev) => ({
            ...prev,
            aboutStats: prev.aboutStats.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
        }));
    }
    function addAboutStat() {
        setFormData((prev) => ({ ...prev, aboutStats: [...prev.aboutStats, { ...BLANK_ABOUT_STAT }] }));
    }
    function removeAboutStat(index: number) {
        setFormData((prev) => ({ ...prev, aboutStats: prev.aboutStats.filter((_, i) => i !== index) }));
    }

    // Project helpers
    function updateProject(index: number, field: keyof Omit<Project, "image">, value: string) {
        setFormData((prev) => ({
            ...prev,
            projects: prev.projects.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
        }));
    }
    function addProject() {
        setFormData((prev) => ({ ...prev, projects: [...prev.projects, { ...BLANK_PROJECT }] }));
    }
    function removeProject(index: number) {
        setFormData((prev) => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }));
    }

    // Testimonial helpers
    function updateTestimonial(index: number, field: keyof Omit<TestimonialEntry, "avatar">, value: string) {
        setFormData((prev) => ({
            ...prev,
            testimonials: prev.testimonials.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
        }));
    }
    function addTestimonial() {
        setFormData((prev) => ({ ...prev, testimonials: [...prev.testimonials, { ...BLANK_TESTIMONIAL }] }));
    }
    function removeTestimonial(index: number) {
        setFormData((prev) => ({ ...prev, testimonials: prev.testimonials.filter((_, i) => i !== index) }));
    }

    // Bullet helpers (hero key metrics)
    function updateBullet(index: number, field: keyof HeroBullet, value: string) {
        setFormData((prev) => ({
            ...prev,
            heroBullets: prev.heroBullets.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
        }));
    }
    function addBullet() {
        setFormData((prev) => ({ ...prev, heroBullets: [...prev.heroBullets, { ...BLANK_BULLET }] }));
    }
    function removeBullet(index: number) {
        setFormData((prev) => ({ ...prev, heroBullets: prev.heroBullets.filter((_, i) => i !== index) }));
    }

    // FAQ helpers
    function updateFaq(index: number, field: keyof FaqEntry, value: string) {
        setFormData((prev) => ({
            ...prev,
            faqs: prev.faqs.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
        }));
    }
    function addFaq() {
        setFormData((prev) => ({ ...prev, faqs: [...prev.faqs, { ...BLANK_FAQ }] }));
    }
    function removeFaq(index: number) {
        setFormData((prev) => ({ ...prev, faqs: prev.faqs.filter((_, i) => i !== index) }));
    }

    // Friction-reducer helpers (reusable for hero + finalCta)
    function addFrictionReducer(field: "heroFrictionReducers" | "finalCtaFrictionReducers") {
        setFormData((prev) => ({ ...prev, [field]: [...prev[field], ""] }));
    }
    function updateFrictionReducer(field: "heroFrictionReducers" | "finalCtaFrictionReducers", index: number, value: string) {
        setFormData((prev) => ({
            ...prev,
            [field]: prev[field].map((v, i) => (i === index ? value : v)),
        }));
    }
    function removeFrictionReducer(field: "heroFrictionReducers" | "finalCtaFrictionReducers", index: number) {
        setFormData((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
    }

    // ── Upload helpers ──────────────────────────────────────────────────────────
    const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];
    const MAX_UPLOAD_BYTES = 10_485_760; // 10 MB

    function validateUploadFile(file: File): string | null {
        if (!ALLOWED_UPLOAD_TYPES.includes(file.type))
            return "Only JPEG, PNG, and WebP images are allowed.";
        if (file.size > MAX_UPLOAD_BYTES)
            return "File must be 10 MB or smaller.";
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
        setUploadingSlots((prev) => {
            const next = new Set(prev);
            next.delete(slot);
            return next;
        });
        setUploadErrors((prev) => ({ ...prev, [slot]: message }));
    }

    async function uploadFile(file: File): Promise<ImageMeta> {
        const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
        });
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
            setFormData((prev) => ({ ...prev, images: { ...prev.images, logo: meta } }));
            clearSlot("logo");
        } catch {
            setSlotError("logo", "Upload failed. Please try again.");
        }
    }

    function removeLogo() {
        setFormData((prev) => ({ ...prev, images: { ...prev.images, logo: undefined } }));
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
            setFormData((prev) => ({
                ...prev,
                images: {
                    ...prev.images,
                    heroSlides: [...prev.images.heroSlides, ...results].slice(0, 10),
                },
            }));
            clearSlot("hero");
        } catch {
            setSlotError("hero", "Upload failed. Please try again.");
        }
    }

    function removeHeroSlide(i: number) {
        setFormData((prev) => ({
            ...prev,
            images: {
                ...prev.images,
                heroSlides: prev.images.heroSlides.filter((_, idx) => idx !== i),
            },
        }));
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

    function removeAboutFeature() {
        setFormData((prev) => ({ ...prev, images: { ...prev.images, aboutFeature: undefined } }));
    }

    async function handleProjectImageUpload(projectIndex: number, e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const slot = `project-${projectIndex}`;
        const err = validateUploadFile(file);
        if (err) { setSlotError(slot, err); return; }
        markSlotUploading(slot);
        try {
            const meta = await uploadFile(file);
            setFormData((prev) => ({
                ...prev,
                projects: prev.projects.map((p, i) =>
                    i === projectIndex ? { ...p, image: meta } : p
                ),
            }));
            clearSlot(slot);
        } catch {
            setSlotError(slot, "Upload failed. Please try again.");
        }
    }

    function removeProjectImage(projectIndex: number) {
        setFormData((prev) => ({
            ...prev,
            projects: prev.projects.map((p, i) =>
                i === projectIndex ? { ...p, image: undefined } : p
            ),
        }));
    }

    async function handleServiceImageUpload(serviceIndex: number, e: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (!files.length) return;
        e.target.value = "";
        const slot = `service-${serviceIndex}`;
        const current = formData.services[serviceIndex]?.images ?? [];
        const remaining = 5 - current.length;
        const toUpload = files.slice(0, remaining);
        for (const file of toUpload) {
            const err = validateUploadFile(file);
            if (err) { setSlotError(slot, err); return; }
        }
        markSlotUploading(slot);
        try {
            const results = await Promise.all(toUpload.map(uploadFile));
            setFormData((prev) => ({
                ...prev,
                services: prev.services.map((s, i) =>
                    i === serviceIndex
                        ? { ...s, images: [...s.images, ...results].slice(0, 5) }
                        : s
                ),
            }));
            clearSlot(slot);
        } catch {
            setSlotError(slot, "Upload failed. Please try again.");
        }
    }

    function removeServiceImage(serviceIndex: number, imageIndex: number) {
        setFormData((prev) => ({
            ...prev,
            services: prev.services.map((s, i) =>
                i === serviceIndex
                    ? { ...s, images: s.images.filter((_, j) => j !== imageIndex) }
                    : s
            ),
        }));
    }
    // ── End upload helpers ──────────────────────────────────────────────────────

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!turnstileSiteKey) {
            setSubmitState({ type: "error", message: "Security verification is not configured yet. Please try again later." });
            return;
        }

        if (!formData.turnstileToken) {
            setSubmitState({ type: "error", message: "Please complete the security verification before submitting." });
            return;
        }

        if (!formData.brandName || !formData.email || !formData.phone || !formData.websiteType) {
            setSubmitState({ type: "error", message: "Please complete all required fields." });
            return;
        }

        setSubmitting(true);
        setSubmitState({ type: "idle", message: "" });

        try {
            const response = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = (await response.json()) as { message?: string };

            if (!response.ok) {
                throw new Error(data.message || "Unable to submit your onboarding form right now.");
            }

            setSubmitState({ type: "success", message: "" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Something went wrong.";
            setSubmitState({ type: "error", message });
        } finally {
            setSubmitting(false);
        }
    };

    if (submitState.type === "success") {
        return (
            <main
                style={{
                    minHeight: "100vh",
                    background: "var(--bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "64px max(16px, 4vw)",
                }}
            >
                <div className="glass text-center" style={{ maxWidth: 520, width: "100%", padding: "48px 40px", borderRadius: 22 }}>
                    <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
                        <span
                            style={{
                                display: "flex",
                                width: 64,
                                height: 64,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "50%",
                                background: "rgba(182,168,255,0.15)",
                                border: "1px solid var(--accent-glow)",
                                fontSize: 28,
                                color: "var(--accent)",
                            }}
                        >✓</span>
                    </div>
                    <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, color: "var(--fg)", marginBottom: 12 }}>You&apos;re all set!</h1>
                    <p style={{ color: "var(--fg-2)", lineHeight: 1.6 }}>
                        Your onboarding form has been submitted. We&apos;ll review your information and reach out within 1 business day to get things moving.
                    </p>
                    <Link href="/" className="btn primary" style={{ marginTop: 32, display: "inline-flex" }}>
                        Back to home
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Aurora backdrop */}
            <div className="aurora-bg" style={{ opacity: 0.5 }}>
                <div
                    className="aurora-blob"
                    style={{
                        width: 600,
                        height: 600,
                        background: "radial-gradient(circle, rgba(182,168,255,0.4) 0%, transparent 70%)",
                        right: "-5%",
                        top: "5%",
                    }}
                />
            </div>
            <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                strategy="afterInteractive"
                onLoad={() => setTurnstileScriptLoaded(true)}
            />

            {/* Sticky plan banner */}
            <div
                style={{
                    position: "sticky",
                    top: 64,
                    zIndex: 40,
                    background: "rgba(7,16,30,0.9)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    borderBottom: "1px solid var(--rule)",
                    padding: "12px max(16px, 2vw)",
                }}
            >
                <div style={{ maxWidth: 896, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className="kicker">Selected Plan</span>
                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>{planMeta.label}</span>
                        <span style={{ color: "var(--fg-3)" }}>—</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-2)" }}>{planMeta.price}</span>
                    </div>
                    <Link href="/pricing" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "underline" }}>
                        Change plan
                    </Link>
                </div>
            </div>

            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6" style={{ position: "relative", zIndex: 1 }}>
                {/* Page header */}
                <div className="mb-10">
                    <span className="eyebrow">Onboarding</span>
                    <h1
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(28px, 4vw, 40px)",
                            fontWeight: 400,
                            letterSpacing: "-0.025em",
                            color: "var(--fg)",
                            marginTop: 16,
                            marginBottom: 12,
                        }}
                    >
                        Tell us about your business
                    </h1>
                    <p style={{ color: "var(--fg-2)", lineHeight: 1.6, fontSize: 15 }}>
                        Fill out as much or as little as you have right now. We&apos;ll follow up on anything we need. Required fields are marked with <span style={{ fontWeight: 700, color: "#ff7b7b" }}>*</span>.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-10" noValidate>

                    {/* Honeypot */}
                    <label className="hidden" aria-hidden="true">
                        <input
                            tabIndex={-1}
                            autoComplete="off"
                            type="text"
                            value={formData.website}
                            onChange={(e) => set("website", e.target.value)}
                        />
                    </label>

                    {/* ── Onboarding mode ──────────────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <p style={{ lineHeight: 1.75, fontSize: 15, color: "var(--fg-2)", marginBottom: 20 }}>
                            Both options will get your site built and launched. If you have the time, we strongly
                            recommend completing the{" "}
                            <span style={{ fontWeight: 700, color: "var(--fg)" }}>Detailed</span>{" "}
                            version — it gives us a much richer picture of your business and helps us capture
                            your intent more accurately, resulting in a far richer final website.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {(["basic", "detailed"] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => set("formMode", mode)}
                                    className="flex flex-col items-start rounded-2xl border px-5 py-4 text-left transition"
                                    style={{
                                        minWidth: 160,
                                        ...(formData.formMode === mode
                                            ? { border: "2px solid var(--accent)", background: "rgba(182,168,255,0.1)", color: "var(--fg)" }
                                            : { border: "1px solid var(--rule-strong)", background: "var(--surface)", color: "var(--fg-2)" }),
                                    }}
                                >
                                    <span style={{ fontWeight: 700, fontSize: 15 }}>
                                        {mode === "basic" ? "Basic" : "Detailed"}
                                    </span>
                                    <span style={{ fontSize: 13, marginTop: 4, color: formData.formMode === mode ? "var(--fg-2)" : "var(--fg-3)" }}>
                                        {mode === "basic"
                                            ? "Contact info only — quick to complete"
                                            : "All sections — recommended for the richest result"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* ── Section 1: Contact Info ─────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="1" title="Contact Information" />
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Business name <span className="text-red-500">*</span></span>
                                <input
                                    type="text"
                                    required
                                    value={formData.brandName}
                                    onChange={(e) => set("brandName", e.target.value)}
                                    placeholder="Acme Co."
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Legal business name</span>
                                <input
                                    type="text"
                                    value={formData.brandLong}
                                    onChange={(e) => set("brandLong", e.target.value)}
                                    placeholder="Acme Company LLC"
                                    className={inputCls}
                                />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Short / abbreviated name</span>
                                <input
                                    type="text"
                                    value={formData.brandShort}
                                    onChange={(e) => set("brandShort", e.target.value)}
                                    placeholder="e.g. Acme (used in compact UI elements)"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Email address <span className="text-red-500">*</span></span>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => set("email", e.target.value)}
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Phone number <span className="text-red-500">*</span></span>
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => set("phone", e.target.value)}
                                    className={inputCls}
                                />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Business address</span>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => set("address", e.target.value)}
                                    placeholder="123 Main St, City, State 00000"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Contractor / license number</span>
                                <input
                                    type="text"
                                    value={formData.license}
                                    onChange={(e) => set("license", e.target.value)}
                                    placeholder="e.g. #1234567"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Type of website <span className="text-red-500">*</span></span>
                                <select
                                    required
                                    value={formData.websiteType}
                                    onChange={(e) => set("websiteType", e.target.value)}
                                    className={inputCls}
                                >
                                    <option>New website</option>
                                    <option>Website redesign</option>
                                    <option>Not sure</option>
                                </select>
                            </label>
                        </div>

                        {/* Existing website scrape option (Basic mode only) */}
                        {formData.formMode === "basic" && (
                            <div className="mt-5 rounded-2xl border border-white/[0.10] bg-white/[0.04] p-5 space-y-4">
                                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                                    Existing website
                                </p>
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.scrapeExistingWebsite}
                                        onChange={(e) => set("scrapeExistingWebsite", e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-white/20"
                                    />
                                    <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6 }}>
                                        I have an existing website — scrape it for content, branding, and metadata to use as a starting point for the new site.
                                    </span>
                                </label>
                                {formData.scrapeExistingWebsite && (
                                    <label className={labelCls}>
                                        <span>Existing website domain</span>
                                        <input
                                            type="text"
                                            value={formData.scrapeWebsiteDomain}
                                            onChange={(e) => set("scrapeWebsiteDomain", e.target.value)}
                                            placeholder="e.g. yourbusiness.com"
                                            className={inputCls}
                                        />
                                    </label>
                                )}
                            </div>
                        )}
                    </section>

                    {/* ── Section 2: Business Details ─────────────────────────── */}
                    {formData.formMode === "detailed" && (<>

                    {/* ── Section 2: Business Details (detailed only) ─────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="2" title="Business Details" />
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Industry</span>
                                <input
                                    type="text"
                                    value={formData.industry}
                                    onChange={(e) => set("industry", e.target.value)}
                                    placeholder="e.g. Construction, Retail, Healthcare"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Year founded</span>
                                <input
                                    type="text"
                                    value={formData.established}
                                    onChange={(e) => set("established", e.target.value)}
                                    placeholder="2005"
                                    className={inputCls}
                                />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Tagline</span>
                                <input
                                    type="text"
                                    value={formData.brandTagline}
                                    onChange={(e) => set("brandTagline", e.target.value)}
                                    placeholder="A short phrase that captures your brand"
                                    className={inputCls}
                                />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>About your business</span>
                                <textarea
                                    rows={4}
                                    value={formData.aboutBody}
                                    onChange={(e) => set("aboutBody", e.target.value)}
                                    placeholder="Tell us what you do, who you serve, and what makes you different."
                                    className={inputCls}
                                />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Unique selling proposition</span>
                                <input
                                    type="text"
                                    value={formData.usp}
                                    onChange={(e) => set("usp", e.target.value)}
                                    placeholder="What do you do better than anyone else?"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Notable clients</span>
                                <input
                                    type="text"
                                    value={formData.notableClients}
                                    onChange={(e) => set("notableClients", e.target.value)}
                                    placeholder="Company A, Company B, Company C"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Business hours</span>
                                <input
                                    type="text"
                                    value={formData.businessHours}
                                    onChange={(e) => set("businessHours", e.target.value)}
                                    placeholder="Mon–Fri 8am–5pm"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Certifications / licenses</span>
                                <input
                                    type="text"
                                    value={formData.certifications}
                                    onChange={(e) => set("certifications", e.target.value)}
                                    placeholder="Licensed, Bonded, Insured"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Awards</span>
                                <input
                                    type="text"
                                    value={formData.awards}
                                    onChange={(e) => set("awards", e.target.value)}
                                    placeholder="Best of City 2023, etc."
                                    className={inputCls}
                                />
                            </label>
                        </div>
                    </section>

                    {/* ── Section 3: Branding ─────────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="3" title="Branding" />
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className={labelCls}>
                                <span>Primary brand color</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.paletteAccent}
                                        onChange={(e) => set("paletteAccent", e.target.value)}
                                        className="h-11 w-16 cursor-pointer rounded-lg border border-white/[0.12] p-1"
                                    />
                                    <span className="font-mono text-sm text-white/60">{formData.paletteAccent}</span>
                                </div>
                            </div>
                            <div className={labelCls}>
                                <span>Background color</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.paletteBg}
                                        onChange={(e) => set("paletteBg", e.target.value)}
                                        className="h-11 w-16 cursor-pointer rounded-lg border border-white/[0.12] p-1"
                                    />
                                    <span className="font-mono text-sm text-white/60">{formData.paletteBg}</span>
                                </div>
                            </div>
                            <div className={labelCls}>
                                <span>Soft background</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.paletteBgSoft}
                                        onChange={(e) => set("paletteBgSoft", e.target.value)}
                                        className="h-11 w-16 cursor-pointer rounded-lg border border-white/[0.12] p-1"
                                    />
                                    <span className="font-mono text-sm text-white/60">{formData.paletteBgSoft}</span>
                                </div>
                            </div>
                            <div className={labelCls}>
                                <span>Body text color</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.paletteInk}
                                        onChange={(e) => set("paletteInk", e.target.value)}
                                        className="h-11 w-16 cursor-pointer rounded-lg border border-white/[0.12] p-1"
                                    />
                                    <span className="font-mono text-sm text-white/60">{formData.paletteInk}</span>
                                </div>
                            </div>
                            <div className={labelCls}>
                                <span>Secondary text color</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.paletteInkSoft}
                                        onChange={(e) => set("paletteInkSoft", e.target.value)}
                                        className="h-11 w-16 cursor-pointer rounded-lg border border-white/[0.12] p-1"
                                    />
                                    <span className="font-mono text-sm text-white/60">{formData.paletteInkSoft}</span>
                                </div>
                            </div>
                            <div className={labelCls}>
                                <span>Border / rule color</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={formData.paletteRule}
                                        onChange={(e) => set("paletteRule", e.target.value)}
                                        className="h-11 w-16 cursor-pointer rounded-lg border border-white/[0.12] p-1"
                                    />
                                    <span className="font-mono text-sm text-white/60">{formData.paletteRule}</span>
                                </div>
                            </div>
                            <div className={labelCls}>
                                <span>Do you have a logo?</span>
                                <div className="flex gap-3 pt-1">
                                    {["yes", "no"].map((val) => (
                                        <label
                                            key={val}
                                            className="cursor-pointer rounded-xl border px-5 py-2.5 text-sm font-semibold transition"
                                            style={
                                                formData.hasLogo === val
                                                    ? { border: "1px solid var(--accent)", background: "rgba(182,168,255,0.15)", color: "var(--accent)" }
                                                    : { border: "1px solid var(--rule-strong)", background: "var(--surface)", color: "var(--fg-2)" }
                                            }
                                        >
                                            <input
                                                type="radio"
                                                name="hasLogo"
                                                value={val}
                                                checked={formData.hasLogo === val}
                                                onChange={() => set("hasLogo", val)}
                                                className="sr-only"
                                            />
                                            {val === "yes" ? "Yes, I have one" : "No, I need one"}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {formData.hasLogo === "yes" && (
                                <div className={`${labelCls} md:col-span-2`}>
                                    <span>Upload your logo</span>
                                    <div className="flex flex-col gap-3">
                                        {formData.images.logo && (
                                            <div className="flex items-center gap-3 rounded-xl border border-white/[0.10] bg-white/[0.04] p-3">
                                                <img
                                                    src={formData.images.logo.url}
                                                    alt="Logo preview"
                                                    className="h-12 w-auto max-w-[120px] object-contain rounded"
                                                />
                                                <span className="flex-1 truncate text-sm text-white/60">{formData.images.logo.filename}</span>
                                                <button
                                                    type="button"
                                                    onClick={removeLogo}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                                    aria-label="Remove logo"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        )}
                                        <label className="w-fit cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="sr-only"
                                                onChange={handleLogoUpload}
                                                disabled={uploadingSlots.has("logo")}
                                            />
                                            {uploadingSlots.has("logo") ? "Uploading…" : formData.images.logo ? "Replace logo" : "Choose logo file"}
                                        </label>
                                        {uploadErrors["logo"] && (
                                            <p className="text-sm text-red-600">{uploadErrors["logo"]}</p>
                                        )}
                                        <p className="text-xs text-slate-500">JPEG, PNG, or WebP · Max 10 MB</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ── Section 4: Online Presence ──────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="4" title="Online Presence" />

                        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">SEO</p>
                        <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Page title <span className="font-normal text-slate-500">(browser tab / search result headline)</span></span>
                                <input
                                    type="text"
                                    value={formData.seoTitle}
                                    onChange={(e) => set("seoTitle", e.target.value)}
                                    placeholder="Acme Co. — Plumbing in Juneau, AK"
                                    className={inputCls}
                                />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Meta description</span>
                                <textarea
                                    rows={3}
                                    value={formData.seoDescription}
                                    onChange={(e) => set("seoDescription", e.target.value)}
                                    placeholder="A 1–2 sentence description of your business that appears in search results (150–160 chars)."
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Domain / desired domain</span>
                                <input
                                    type="text"
                                    value={formData.seoCanonical}
                                    onChange={(e) => set("seoCanonical", e.target.value)}
                                    placeholder="yourbusiness.com"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Google Analytics ID</span>
                                <input
                                    type="text"
                                    value={formData.googleAnalyticsId}
                                    onChange={(e) => set("googleAnalyticsId", e.target.value)}
                                    placeholder="G-XXXXXXXXXX"
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Facebook Pixel ID</span>
                                <input
                                    type="text"
                                    value={formData.facebookPixelId}
                                    onChange={(e) => set("facebookPixelId", e.target.value)}
                                    placeholder="0000000000000000"
                                    className={inputCls}
                                />
                            </label>
                        </div>

                        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Extensions</p>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Google Maps URL</span>
                                <input
                                    type="url"
                                    value={formData.mapsUrl}
                                    onChange={(e) => set("mapsUrl", e.target.value)}
                                    placeholder="https://maps.google.com/..."
                                    className={inputCls}
                                />
                            </label>
                            <label className={labelCls}>
                                <span>Booking URL</span>
                                <input
                                    type="url"
                                    value={formData.bookingUrl}
                                    onChange={(e) => set("bookingUrl", e.target.value)}
                                    placeholder="https://calendly.com/..."
                                    className={inputCls}
                                />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Client portal URL</span>
                                <input
                                    type="url"
                                    value={formData.portalUrl}
                                    onChange={(e) => set("portalUrl", e.target.value)}
                                    placeholder="https://..."
                                    className={inputCls}
                                />
                            </label>
                        </div>
                    </section>

                    {/* ── Section 5: Social Media ─────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="5" title="Social Media" />
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            {(
                                [
                                    { field: "linkedin" as const, label: "LinkedIn", placeholder: "https://linkedin.com/company/..." },
                                    { field: "instagram" as const, label: "Instagram", placeholder: "https://instagram.com/..." },
                                    { field: "facebook" as const, label: "Facebook", placeholder: "https://facebook.com/..." },
                                    { field: "youtube" as const, label: "YouTube", placeholder: "https://youtube.com/@..." },
                                ] as const
                            ).map(({ field, label, placeholder }) => (
                                <label key={field} className={labelCls}>
                                    <span>{label}</span>
                                    <input
                                        type="url"
                                        value={formData[field]}
                                        onChange={(e) => set(field, e.target.value)}
                                        placeholder={placeholder}
                                        className={inputCls}
                                    />
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* ── Section 6: Website Content ──────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="6" title="Hero Section" />
                        <p className="mb-5 text-sm" style={{ color: "var(--fg-3)" }}>
                            These populate your homepage hero. Leave any field blank and we&apos;ll suggest copy.
                        </p>
                        <div className="grid grid-cols-1 gap-5">
                            <label className={labelCls}>
                                <span>Eyebrow <span className="font-normal text-slate-500">(small label above headline)</span></span>
                                <input
                                    type="text"
                                    value={formData.heroEyebrow}
                                    onChange={(e) => set("heroEyebrow", e.target.value)}
                                    placeholder="e.g. Serving Juneau since 2005"
                                    className={inputCls}
                                />
                            </label>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <label className={labelCls}>
                                    <span>Hero headline</span>
                                    <input
                                        type="text"
                                        value={formData.heroHeadline}
                                        onChange={(e) => set("heroHeadline", e.target.value)}
                                        placeholder="The bold statement at the top of your homepage"
                                        className={inputCls}
                                    />
                                </label>
                                <label className={labelCls}>
                                    <span>Headline emphasis <span className="font-normal text-slate-500">(highlighted word / phrase)</span></span>
                                    <input
                                        type="text"
                                        value={formData.heroHeadlineEmphasis}
                                        onChange={(e) => set("heroHeadlineEmphasis", e.target.value)}
                                        placeholder="e.g. Juneau"
                                        className={inputCls}
                                    />
                                </label>
                            </div>
                            <label className={labelCls}>
                                <span>Hero subheadline</span>
                                <textarea
                                    rows={2}
                                    value={formData.heroSub}
                                    onChange={(e) => set("heroSub", e.target.value)}
                                    placeholder="A supporting sentence that expands on the headline"
                                    className={inputCls}
                                />
                            </label>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <label className={labelCls}>
                                    <span>Primary call-to-action</span>
                                    <input
                                        type="text"
                                        value={formData.heroCta}
                                        onChange={(e) => set("heroCta", e.target.value)}
                                        placeholder="e.g. Get a free quote"
                                        className={inputCls}
                                    />
                                </label>
                                <label className={labelCls}>
                                    <span>Secondary call-to-action</span>
                                    <input
                                        type="text"
                                        value={formData.heroSecondaryCta}
                                        onChange={(e) => set("heroSecondaryCta", e.target.value)}
                                        placeholder="e.g. See our work"
                                        className={inputCls}
                                    />
                                </label>
                            </div>
                            <label className={labelCls}>
                                <span>Trust badge <span className="font-normal text-slate-500">(short credibility line near the CTA)</span></span>
                                <input
                                    type="text"
                                    value={formData.heroBadge}
                                    onChange={(e) => set("heroBadge", e.target.value)}
                                    placeholder="e.g. Licensed, bonded & insured"
                                    className={inputCls}
                                />
                            </label>
                            <div className={labelCls}>
                                <span>Friction reducers <span className="font-normal text-slate-500">(reassurances shown near the CTA)</span></span>
                                <div className="space-y-2">
                                    {formData.heroFrictionReducers.map((fr, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={fr}
                                                onChange={(e) => updateFrictionReducer("heroFrictionReducers", i, e.target.value)}
                                                placeholder="e.g. No contract required"
                                                className={inputCls}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeFrictionReducer("heroFrictionReducers", i)}
                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.10] text-white/50 transition hover:bg-red-500/10 hover:text-red-400"
                                                aria-label="Remove"
                                            >
                                                <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {formData.heroFrictionReducers.length < 4 && (
                                    <button
                                        type="button"
                                        onClick={() => addFrictionReducer("heroFrictionReducers")}
                                        className="mt-1 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                        Add friction reducer
                                    </button>
                                )}
                            </div>
                            <div className={labelCls}>
                                <span>Hero slideshow photos</span>
                                {formData.images.heroSlides.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                        {formData.images.heroSlides.map((img, i) => (
                                            <div key={i} className="relative overflow-hidden rounded-lg border border-white/[0.10]">
                                                <img
                                                    src={img.url}
                                                    alt={img.alt || `Hero ${i + 1}`}
                                                    className="h-20 w-full object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeHeroSlide(i)}
                                                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                                                    aria-label="Remove photo"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} className="h-2.5 w-2.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex flex-col gap-2">
                                    {formData.images.heroSlides.length < 10 && (
                                        <label className="w-fit cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                multiple
                                                className="sr-only"
                                                onChange={handleHeroSlideUpload}
                                                disabled={uploadingSlots.has("hero")}
                                            />
                                            {uploadingSlots.has("hero") ? "Uploading…" : "Add photos"}
                                        </label>
                                    )}
                                    <p className="text-xs text-slate-500">
                                        {formData.images.heroSlides.length}/10 uploaded · We recommend uploading at least 3 hero photos for the slideshow.
                                    </p>
                                    {uploadErrors["hero"] && (
                                        <p className="text-sm text-red-600">{uploadErrors["hero"]}</p>
                                    )}
                                    <p className="text-xs text-slate-400">JPEG, PNG, or WebP · Max 10 MB per photo</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ── Section 7: Announcement ──────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="7" title="Announcement Banner" />
                        <p className="mb-5 text-sm" style={{ color: "var(--fg-3)" }}>
                            Optional site-wide banner shown at the top of every page — promotions, seasonal hours, new service alerts, etc.
                        </p>
                        <label className={labelCls}>
                            <span>Announcement text</span>
                            <input
                                type="text"
                                value={formData.announcement}
                                onChange={(e) => set("announcement", e.target.value)}
                                placeholder="e.g. Now accepting new clients for summer 2026!"
                                className={inputCls}
                            />
                        </label>
                    </section>

                    {/* ── Section 8: About ─────────────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="8" title="About Section" />
                        <p className="mb-5 text-sm" style={{ color: "var(--fg-3)" }}>
                            This populates the &ldquo;About&rdquo; section of your homepage. Leave any field blank and we&apos;ll write it for you.
                        </p>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Eyebrow</span>
                                <input type="text" value={formData.aboutEyebrow} onChange={(e) => set("aboutEyebrow", e.target.value)} placeholder="e.g. Who we are" className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Title</span>
                                <input type="text" value={formData.aboutTitle} onChange={(e) => set("aboutTitle", e.target.value)} placeholder="e.g. Built on trust, driven by results" className={inputCls} />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Body copy</span>
                                <textarea rows={4} value={formData.aboutBody} onChange={(e) => set("aboutBody", e.target.value)} placeholder="2–4 sentences about your company, your team, or your story." className={inputCls} />
                            </label>
                        </div>

                        {/* Feature image */}
                        <div className={`${labelCls} mt-5`}>
                            <span>Feature / team photo</span>
                            <div className="flex flex-col gap-3">
                                {formData.images.aboutFeature && (
                                    <div className="flex items-center gap-3 rounded-xl border border-white/[0.10] bg-white/[0.04] p-3">
                                        <img src={formData.images.aboutFeature.url} alt="About feature preview" className="h-14 w-auto max-w-[140px] rounded object-cover" />
                                        <span className="flex-1 truncate text-sm text-white/60">{formData.images.aboutFeature.filename}</span>
                                        <button type="button" onClick={removeAboutFeature} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500" aria-label="Remove photo">
                                            <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                                <label className="w-fit cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAboutFeatureUpload} disabled={uploadingSlots.has("about-feature")} />
                                    {uploadingSlots.has("about-feature") ? "Uploading…" : formData.images.aboutFeature ? "Replace photo" : "Choose photo"}
                                </label>
                                {uploadErrors["about-feature"] && <p className="text-sm text-red-600">{uploadErrors["about-feature"]}</p>}
                                <p className="text-xs text-slate-400">JPEG, PNG, or WebP · Max 10 MB</p>
                            </div>
                        </div>

                        {/* Pillars */}
                        <div className="mt-6">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Value pillars <span className="normal-case font-normal text-slate-500">(shown as icon cards in the about section — max 4)</span></p>
                            <div className="space-y-3">
                                {formData.pillars.map((pillar, i) => (
                                    <div key={i} className="relative rounded-2xl border border-white/[0.10] bg-white/[0.04] p-4">
                                        {formData.pillars.length > 1 && (
                                            <button type="button" onClick={() => removePillar(i)} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500" aria-label="Remove pillar">
                                                <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                            <label className={labelCls}>
                                                <span>Icon key <span className="font-normal text-slate-500">(e.g. shield)</span></span>
                                                <input type="text" value={pillar.k} onChange={(e) => updatePillar(i, "k", e.target.value)} placeholder="shield" className={inputCls} />
                                            </label>
                                            <label className={labelCls}>
                                                <span>Title</span>
                                                <input type="text" value={pillar.t} onChange={(e) => updatePillar(i, "t", e.target.value)} placeholder="e.g. Licensed & Insured" className={inputCls} />
                                            </label>
                                            <label className={labelCls}>
                                                <span>Description</span>
                                                <input type="text" value={pillar.d} onChange={(e) => updatePillar(i, "d", e.target.value)} placeholder="One sentence" className={inputCls} />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {formData.pillars.length < 4 && (
                                <button type="button" onClick={addPillar} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                    <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                    Add pillar
                                </button>
                            )}
                        </div>

                        {/* About stats */}
                        <div className="mt-6">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">About stats <span className="normal-case font-normal text-slate-500">(numbers shown in the about section — max 4)</span></p>
                            <div className="space-y-2">
                                {formData.aboutStats.map((stat, i) => (
                                    <div key={i} className="flex items-end gap-3">
                                        <label className={`${labelCls} flex-1`}>
                                            <span>Number</span>
                                            <input type="text" value={stat.n} onChange={(e) => updateAboutStat(i, "n", e.target.value)} placeholder="25+" className={inputCls} />
                                        </label>
                                        <label className={`${labelCls} flex-1`}>
                                            <span>Label</span>
                                            <input type="text" value={stat.l} onChange={(e) => updateAboutStat(i, "l", e.target.value)} placeholder="Years in business" className={inputCls} />
                                        </label>
                                        {formData.aboutStats.length > 1 && (
                                            <button type="button" onClick={() => removeAboutStat(i)} className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.10] text-white/50 transition hover:bg-red-500/10 hover:text-red-400" aria-label="Remove stat">
                                                <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {formData.aboutStats.length < 4 && (
                                <button type="button" onClick={addAboutStat} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                    <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                    Add stat
                                </button>
                            )}
                        </div>
                    </section>

                    {/* ── Section 9: Services ─────────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="9" title="Your Services" />
                        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Section eyebrow</span>
                                <input type="text" value={formData.servicesEyebrow} onChange={(e) => set("servicesEyebrow", e.target.value)} placeholder="e.g. What we offer" className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Section title</span>
                                <input type="text" value={formData.servicesTitle} onChange={(e) => set("servicesTitle", e.target.value)} placeholder="e.g. Our Services" className={inputCls} />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Section subtitle</span>
                                <input type="text" value={formData.servicesSub} onChange={(e) => set("servicesSub", e.target.value)} placeholder="A short sentence introducing your services" className={inputCls} />
                            </label>
                        </div>
                        <p className="mb-3 text-sm text-slate-500">Add up to 6 services you want featured on your site.</p>
                        <div className="space-y-4">
                            {formData.services.map((service, index) => (
                                <div
                                    key={index}
                                    className="relative rounded-2xl border border-white/[0.10] bg-white/[0.04] p-4"
                                >
                                    {formData.services.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeService(index)}
                                            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                            aria-label="Remove service"
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <label className={labelCls}>
                                            <span>Service name</span>
                                            <input
                                                type="text"
                                                value={service.t}
                                                onChange={(e) => updateService(index, "t", e.target.value)}
                                                placeholder="e.g. Residential Plumbing"
                                                className={inputCls}
                                            />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Category / tag</span>
                                            <input
                                                type="text"
                                                value={service.tag}
                                                onChange={(e) => updateService(index, "tag", e.target.value)}
                                                placeholder="e.g. Residential"
                                                className={inputCls}
                                            />
                                        </label>
                                        <label className={`${labelCls} md:col-span-2`}>
                                            <span>Description</span>
                                            <textarea
                                                rows={2}
                                                value={service.d}
                                                onChange={(e) => updateService(index, "d", e.target.value)}
                                                placeholder="Brief description of this service"
                                                className={inputCls}
                                            />
                                        </label>
                                        <div className={`${labelCls} md:col-span-2`}>
                                            <span>Service photos</span>
                                            {service.images.length > 0 && (
                                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                                    {service.images.map((img, imgIdx) => (
                                                        <div key={imgIdx} className="relative overflow-hidden rounded-lg border border-white/[0.10]">
                                                            <img
                                                                src={img.url}
                                                                alt={img.alt || `Service photo ${imgIdx + 1}`}
                                                                className="h-20 w-full object-cover"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeServiceImage(index, imgIdx)}
                                                                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                                                                aria-label="Remove photo"
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-2">
                                                {service.images.length < 5 && (
                                                    <label className="w-fit cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            multiple
                                                            className="sr-only"
                                                            onChange={(e) => handleServiceImageUpload(index, e)}
                                                            disabled={uploadingSlots.has(`service-${index}`)}
                                                        />
                                                        {uploadingSlots.has(`service-${index}`) ? "Uploading…" : "Add photos"}
                                                    </label>
                                                )}
                                                {uploadErrors[`service-${index}`] && (
                                                    <p className="text-sm text-red-600">{uploadErrors[`service-${index}`]}</p>
                                                )}
                                                <p className="text-xs text-slate-400">{service.images.length}/5 · JPEG, PNG, or WebP · Max 10 MB each</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {formData.services.length < 6 && (
                            <button
                                type="button"
                                onClick={addService}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10"
                            >
                                <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                Add service
                            </button>
                        )}
                    </section>

                    {/* ── Section 10: Work / Projects ──────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="10" title="Work / Projects" />
                        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Section eyebrow</span>
                                <input type="text" value={formData.workEyebrow} onChange={(e) => set("workEyebrow", e.target.value)} placeholder="e.g. Our work" className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Section title</span>
                                <input type="text" value={formData.workTitle} onChange={(e) => set("workTitle", e.target.value)} placeholder="e.g. Recent Projects" className={inputCls} />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Section subtitle</span>
                                <input type="text" value={formData.workSub} onChange={(e) => set("workSub", e.target.value)} placeholder="A brief sentence showcasing your project portfolio" className={inputCls} />
                            </label>
                        </div>
                        <p className="mb-3 text-sm text-slate-500">Add up to 6 featured projects. Each can have a photo, location, year, and scope.</p>
                        <div className="space-y-4">
                            {formData.projects.map((project, index) => (
                                <div key={index} className="relative rounded-2xl border border-white/[0.10] bg-white/[0.04] p-4">
                                    {formData.projects.length > 1 && (
                                        <button type="button" onClick={() => removeProject(index)} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500" aria-label="Remove project">
                                            <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <label className={`${labelCls} md:col-span-2`}>
                                            <span>Project name / title</span>
                                            <input type="text" value={project.t} onChange={(e) => updateProject(index, "t", e.target.value)} placeholder="e.g. Downtown Office Renovation" className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Location</span>
                                            <input type="text" value={project.loc} onChange={(e) => updateProject(index, "loc", e.target.value)} placeholder="e.g. Juneau, AK" className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Year</span>
                                            <input type="text" value={project.yr} onChange={(e) => updateProject(index, "yr", e.target.value)} placeholder="2025" className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Scope / type</span>
                                            <input type="text" value={project.scope} onChange={(e) => updateProject(index, "scope", e.target.value)} placeholder="e.g. Full remodel" className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Size</span>
                                            <input type="text" value={project.size} onChange={(e) => updateProject(index, "size", e.target.value)} placeholder="e.g. 3,200 sq ft" className={inputCls} />
                                        </label>
                                        <label className={`${labelCls} md:col-span-2`}>
                                            <span>Caption</span>
                                            <input type="text" value={project.caption} onChange={(e) => updateProject(index, "caption", e.target.value)} placeholder="One sentence describing the project" className={inputCls} />
                                        </label>
                                        {/* Project photo */}
                                        <div className={`${labelCls} md:col-span-2`}>
                                            <span>Project photo</span>
                                            {project.image && (
                                                <div className="flex items-center gap-3 rounded-xl border border-white/[0.10] bg-white/[0.04] p-3">
                                                    <img src={project.image.url} alt={project.image.alt || "Project"} className="h-14 w-auto max-w-[120px] rounded object-cover" />
                                                    <span className="flex-1 truncate text-sm text-white/60">{project.image.filename}</span>
                                                    <button type="button" onClick={() => removeProjectImage(index)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500" aria-label="Remove photo">
                                                        <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                            <label className="w-fit cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => handleProjectImageUpload(index, e)} disabled={uploadingSlots.has(`project-${index}`)} />
                                                {uploadingSlots.has(`project-${index}`) ? "Uploading…" : project.image ? "Replace photo" : "Choose photo"}
                                            </label>
                                            {uploadErrors[`project-${index}`] && <p className="text-sm text-red-600">{uploadErrors[`project-${index}`]}</p>}
                                            <p className="text-xs text-slate-400">JPEG, PNG, or WebP · Max 10 MB</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {formData.projects.length < 6 && (
                            <button type="button" onClick={addProject} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                Add project
                            </button>
                        )}
                    </section>

                    {/* ── Section 11: Testimonials ─────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="11" title="Testimonials" />
                        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Section eyebrow</span>
                                <input type="text" value={formData.testimonialsEyebrow} onChange={(e) => set("testimonialsEyebrow", e.target.value)} placeholder="e.g. What clients say" className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Section title</span>
                                <input type="text" value={formData.testimonialsTitle} onChange={(e) => set("testimonialsTitle", e.target.value)} placeholder="e.g. Trusted by locals" className={inputCls} />
                            </label>
                        </div>
                        <p className="mb-3 text-sm text-slate-500">Add up to 3 client quotes for your site.</p>
                        <div className="space-y-4">
                            {formData.testimonials.map((t, index) => (
                                <div key={index} className="relative rounded-2xl border border-white/[0.10] bg-white/[0.04] p-4">
                                    {formData.testimonials.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeTestimonial(index)}
                                            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                            aria-label="Remove testimonial"
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <label className={`${labelCls} md:col-span-2`}>
                                            <span>Quote</span>
                                            <textarea
                                                rows={3}
                                                value={t.q}
                                                onChange={(e) => updateTestimonial(index, "q", e.target.value)}
                                                placeholder="What did your client say?"
                                                className={inputCls}
                                            />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Author name</span>
                                            <input
                                                type="text"
                                                value={t.a}
                                                onChange={(e) => updateTestimonial(index, "a", e.target.value)}
                                                placeholder="Jane Smith"
                                                className={inputCls}
                                            />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Author title / role</span>
                                            <input
                                                type="text"
                                                value={t.r}
                                                onChange={(e) => updateTestimonial(index, "r", e.target.value)}
                                                placeholder="Owner"
                                                className={inputCls}
                                            />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Company</span>
                                            <input
                                                type="text"
                                                value={t.company}
                                                onChange={(e) => updateTestimonial(index, "company", e.target.value)}
                                                placeholder="Company name"
                                                className={inputCls}
                                            />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Rating</span>
                                            <select
                                                value={t.stars}
                                                onChange={(e) => updateTestimonial(index, "stars", e.target.value)}
                                                className={inputCls}
                                            >
                                                <option value="5">5 stars</option>
                                                <option value="4">4 stars</option>
                                                <option value="3">3 stars</option>
                                                <option value="2">2 stars</option>
                                                <option value="1">1 star</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {formData.testimonials.length < 3 && (
                            <button
                                type="button"
                                onClick={addTestimonial}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10"
                            >
                                <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                Add testimonial
                            </button>
                        )}
                    </section>

                    {/* ── Section 12: Key Stats ─────────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="12" title="Key Stats" />
                        <p className="mb-5 text-sm" style={{ color: "var(--fg-3)" }}>
                            Numbers shown in the hero section to build instant trust — e.g. &ldquo;200+ clients&rdquo; or &ldquo;10 years in business&rdquo;. Add up to 4.
                        </p>
                        <div className="space-y-3">
                            {formData.heroBullets.map((stat, index) => (
                                <div key={index} className="flex items-end gap-3">
                                    <label className={`${labelCls} flex-1`}>
                                        <span>Value</span>
                                        <input
                                            type="text"
                                            value={stat.value}
                                            onChange={(e) => updateBullet(index, "value", e.target.value)}
                                            placeholder="200+"
                                            className={inputCls}
                                        />
                                    </label>
                                    <label className={`${labelCls} flex-1`}>
                                        <span>Label</span>
                                        <input
                                            type="text"
                                            value={stat.label}
                                            onChange={(e) => updateBullet(index, "label", e.target.value)}
                                            placeholder="Happy clients"
                                            className={inputCls}
                                        />
                                    </label>
                                    {formData.heroBullets.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeBullet(index)}
                                            className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.10] text-white/50 transition hover:bg-red-500/10 hover:text-red-400"
                                            aria-label="Remove stat"
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {formData.heroBullets.length < 4 && (
                            <button
                                type="button"
                                onClick={addBullet}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10"
                            >
                                <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                Add stat
                            </button>
                        )}
                    </section>

                    {/* ── Section 13: FAQs ────────────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="13" title="Frequently Asked Questions" />
                        <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Section eyebrow</span>
                                <input type="text" value={formData.faqEyebrow} onChange={(e) => set("faqEyebrow", e.target.value)} placeholder="e.g. Got questions?" className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Section title</span>
                                <input type="text" value={formData.faqTitle} onChange={(e) => set("faqTitle", e.target.value)} placeholder="e.g. Frequently Asked Questions" className={inputCls} />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Section subtitle</span>
                                <input type="text" value={formData.faqSub} onChange={(e) => set("faqSub", e.target.value)} placeholder="A sentence introducing your FAQ section" className={inputCls} />
                            </label>
                        </div>
                        <p className="mb-3 text-sm text-slate-500">Add up to 6 questions your customers commonly ask.</p>
                        <div className="space-y-4">
                            {formData.faqs.map((faq, index) => (
                                <div key={index} className="relative rounded-2xl border border-white/[0.10] bg-white/[0.04] p-4">
                                    {formData.faqs.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeFaq(index)}
                                            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                                            aria-label="Remove FAQ"
                                        >
                                            <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <div className="grid grid-cols-1 gap-4">
                                        <label className={labelCls}>
                                            <span>Question</span>
                                            <input
                                                type="text"
                                                value={faq.q}
                                                onChange={(e) => updateFaq(index, "q", e.target.value)}
                                                placeholder="What question do your customers ask?"
                                                className={inputCls}
                                            />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Answer</span>
                                            <textarea
                                                rows={3}
                                                value={faq.a}
                                                onChange={(e) => updateFaq(index, "a", e.target.value)}
                                                placeholder="Your answer"
                                                className={inputCls}
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {formData.faqs.length < 6 && (
                            <button
                                type="button"
                                onClick={addFaq}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10"
                            >
                                <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                Add question
                            </button>
                        )}
                    </section>

                    {/* ── Section 14: Final CTA ────────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="14" title="Final Call-to-Action" />
                        <p className="mb-5 text-sm" style={{ color: "var(--fg-3)" }}>
                            The closing section of your homepage — drives visitors to contact you or book.
                        </p>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <label className={labelCls}>
                                <span>Eyebrow</span>
                                <input type="text" value={formData.finalCtaEyebrow} onChange={(e) => set("finalCtaEyebrow", e.target.value)} placeholder="e.g. Ready to get started?" className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Headline</span>
                                <input type="text" value={formData.finalCtaHeadline} onChange={(e) => set("finalCtaHeadline", e.target.value)} placeholder="e.g. Let's build something great" className={inputCls} />
                            </label>
                            <label className={`${labelCls} md:col-span-2`}>
                                <span>Subheadline</span>
                                <textarea rows={2} value={formData.finalCtaSub} onChange={(e) => set("finalCtaSub", e.target.value)} placeholder="A sentence encouraging the visitor to take action" className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Primary CTA</span>
                                <input type="text" value={formData.finalCtaCta} onChange={(e) => set("finalCtaCta", e.target.value)} placeholder="e.g. Get a free quote" className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Secondary CTA</span>
                                <input type="text" value={formData.finalCtaSecondary} onChange={(e) => set("finalCtaSecondary", e.target.value)} placeholder="e.g. Call us now" className={inputCls} />
                            </label>
                            <div className={`${labelCls} md:col-span-2`}>
                                <span>Friction reducers <span className="font-normal text-slate-500">(reassurances near the CTA button — max 4)</span></span>
                                <div className="space-y-2">
                                    {formData.finalCtaFrictionReducers.map((fr, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input type="text" value={fr} onChange={(e) => updateFrictionReducer("finalCtaFrictionReducers", i, e.target.value)} placeholder="e.g. Free estimates" className={inputCls} />
                                            <button type="button" onClick={() => removeFrictionReducer("finalCtaFrictionReducers", i)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.10] text-white/50 transition hover:bg-red-500/10 hover:text-red-400" aria-label="Remove">
                                                <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {formData.finalCtaFrictionReducers.length < 4 && (
                                    <button type="button" onClick={() => addFrictionReducer("finalCtaFrictionReducers")} className="mt-1 inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/10">
                                        <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
                                        Add friction reducer
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ── Section 15: Footer ───────────────────────────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="15" title="Footer" />
                        <p className="mb-5 text-sm" style={{ color: "var(--fg-3)" }}>
                            Content that appears in your site&apos;s footer on every page.
                        </p>
                        <div className="grid grid-cols-1 gap-5">
                            <label className={labelCls}>
                                <span>Footer blurb <span className="font-normal text-slate-500">(1–2 sentences about your business)</span></span>
                                <textarea rows={3} value={formData.footerBlurb} onChange={(e) => set("footerBlurb", e.target.value)} placeholder="A short description of your business for the footer." className={inputCls} />
                            </label>
                            <label className={labelCls}>
                                <span>Legal / copyright line</span>
                                <input type="text" value={formData.footerLegal} onChange={(e) => set("footerLegal", e.target.value)} placeholder="e.g. © 2026 Acme Co. All rights reserved." className={inputCls} />
                            </label>
                        </div>
                    </section>

                    {/* ── Section 15.5 (Enterprise only): Additional sites ─────── */}
                    {formData.selectedPlan === "enterprise" && (
                        <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                            <SectionHeading
                                number="15.5"
                                title={`Additional sites (Enterprise — Site 1 of ${1 + formData.additionalSites.length})`}
                            />
                            <p style={{ marginBottom: 16, fontSize: 14, color: "var(--ink-soft)" }}>
                                Enterprise bundles up to 3 sites that share one pool of voice minutes.
                                Add up to 2 more sites here — each gets its own deployed site, phone number,
                                and AI voice agent. Fields you leave blank inherit from the primary site above.
                            </p>

                            {formData.additionalSites.map((site, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        marginBottom: 24,
                                        padding: 20,
                                        border: "1px solid var(--rule)",
                                        borderRadius: 14,
                                        background: "var(--bg-soft)",
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                                            Site {idx + 2} of {1 + formData.additionalSites.length}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => removeAdditionalSite(idx)}
                                            style={{
                                                fontSize: 13,
                                                color: "#dc2626",
                                                background: "transparent",
                                                border: "1px solid #dc2626",
                                                padding: "6px 12px",
                                                borderRadius: 8,
                                                cursor: "pointer",
                                            }}
                                        >
                                            × Remove this site
                                        </button>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className={labelCls}>
                                            <span>Business name *</span>
                                            <input type="text" required value={site.brandName} onChange={(e) => updateAdditionalSite(idx, "brandName", e.target.value)} placeholder="Acme Plumbing — Anchorage" className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Short name (1 word, used as URL slug)</span>
                                            <input type="text" value={site.brandShort} onChange={(e) => updateAdditionalSite(idx, "brandShort", e.target.value)} placeholder="acme-anchorage" className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Tagline</span>
                                            <input type="text" value={site.brandTagline} onChange={(e) => updateAdditionalSite(idx, "brandTagline", e.target.value)} placeholder="Reliable service, every season." className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Email *</span>
                                            <input type="email" required value={site.email} onChange={(e) => updateAdditionalSite(idx, "email", e.target.value)} className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Phone *</span>
                                            <input type="tel" required value={site.phone} onChange={(e) => updateAdditionalSite(idx, "phone", e.target.value)} placeholder="(907) 555-0142" className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Address</span>
                                            <input type="text" value={site.address} onChange={(e) => updateAdditionalSite(idx, "address", e.target.value)} className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Business hours</span>
                                            <input type="text" value={site.businessHours} onChange={(e) => updateAdditionalSite(idx, "businessHours", e.target.value)} placeholder="Mon–Fri 8a–5p" className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Unique selling point (used by the AI agent)</span>
                                            <input type="text" value={site.usp} onChange={(e) => updateAdditionalSite(idx, "usp", e.target.value)} className={inputCls} />
                                        </label>
                                    </div>

                                    <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-soft)" }}>
                                        Brand palette
                                    </h4>
                                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                                        {(["paletteAccent", "paletteBg", "paletteBgSoft", "paletteInk", "paletteInkSoft", "paletteRule"] as const).map((key) => (
                                            <label key={key} className={labelCls} style={{ fontSize: 12 }}>
                                                <span>{key.replace("palette", "")}</span>
                                                <input
                                                    type="color"
                                                    value={site[key]}
                                                    onChange={(e) => updateAdditionalSite(idx, key, e.target.value)}
                                                    style={{ height: 40, padding: 4, borderRadius: 8 }}
                                                />
                                            </label>
                                        ))}
                                    </div>

                                    <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-soft)" }}>
                                        Hero (seeds the homepage + AI greeting)
                                    </h4>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className={labelCls}>
                                            <span>Hero headline</span>
                                            <input type="text" value={site.heroHeadline} onChange={(e) => updateAdditionalSite(idx, "heroHeadline", e.target.value)} className={inputCls} />
                                        </label>
                                        <label className={labelCls}>
                                            <span>Hero subhead</span>
                                            <input type="text" value={site.heroSub} onChange={(e) => updateAdditionalSite(idx, "heroSub", e.target.value)} className={inputCls} />
                                        </label>
                                    </div>

                                    <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-soft)" }}>
                                        Services ({site.services.length})
                                    </h4>
                                    {site.services.map((svc, svcIdx) => (
                                        <div key={svcIdx} style={{ marginBottom: 12, padding: 12, border: "1px solid var(--rule)", borderRadius: 10, background: "var(--bg)" }}>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                <input type="text" value={svc.t} onChange={(e) => updateAdditionalSiteService(idx, svcIdx, "t", e.target.value)} placeholder="Service title" className={inputCls} />
                                                <input type="text" value={svc.tag} onChange={(e) => updateAdditionalSiteService(idx, svcIdx, "tag", e.target.value)} placeholder="Category" className={inputCls} />
                                            </div>
                                            <textarea rows={2} value={svc.d} onChange={(e) => updateAdditionalSiteService(idx, svcIdx, "d", e.target.value)} placeholder="Short description (≤ 120 chars)" className={inputCls} style={{ marginTop: 8 }} />
                                            {site.services.length > 1 && (
                                                <button type="button" onClick={() => removeAdditionalSiteService(idx, svcIdx)} style={{ marginTop: 6, fontSize: 12, color: "#dc2626", background: "transparent", border: 0, cursor: "pointer" }}>
                                                    × Remove service
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {site.services.length < 6 && (
                                        <button type="button" onClick={() => addAdditionalSiteService(idx)} style={{ fontSize: 13, color: "var(--accent)", background: "transparent", border: "1px solid var(--accent)", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
                                            + Add service
                                        </button>
                                    )}

                                    <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-soft)" }}>
                                        FAQs ({site.faqs.length})
                                    </h4>
                                    {site.faqs.map((faq, faqIdx) => (
                                        <div key={faqIdx} style={{ marginBottom: 12, padding: 12, border: "1px solid var(--rule)", borderRadius: 10, background: "var(--bg)" }}>
                                            <input type="text" value={faq.q} onChange={(e) => updateAdditionalSiteFaq(idx, faqIdx, "q", e.target.value)} placeholder="Question" className={inputCls} />
                                            <textarea rows={2} value={faq.a} onChange={(e) => updateAdditionalSiteFaq(idx, faqIdx, "a", e.target.value)} placeholder="Answer" className={inputCls} style={{ marginTop: 8 }} />
                                            {site.faqs.length > 1 && (
                                                <button type="button" onClick={() => removeAdditionalSiteFaq(idx, faqIdx)} style={{ marginTop: 6, fontSize: 12, color: "#dc2626", background: "transparent", border: 0, cursor: "pointer" }}>
                                                    × Remove FAQ
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {site.faqs.length < 6 && (
                                        <button type="button" onClick={() => addAdditionalSiteFaq(idx)} style={{ fontSize: 13, color: "var(--accent)", background: "transparent", border: "1px solid var(--accent)", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
                                            + Add FAQ
                                        </button>
                                    )}
                                </div>
                            ))}

                            {formData.additionalSites.length < 2 && (
                                <button
                                    type="button"
                                    onClick={addAdditionalSite}
                                    style={{
                                        marginTop: 8,
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "var(--accent)",
                                        background: "transparent",
                                        border: "2px dashed var(--accent)",
                                        padding: "12px 20px",
                                        borderRadius: 12,
                                        cursor: "pointer",
                                        width: "100%",
                                    }}
                                >
                                    + Add another site ({1 + formData.additionalSites.length} of 3)
                                </button>
                            )}
                        </section>
                    )}

                    </>)}

                    {/* ── Section 16: Consent + Security + Submit ─────────────── */}
                    <section className="glass p-6 sm:p-8" style={{ borderRadius: 22 }}>
                        <SectionHeading number="16" title="Submit" />

                        <label className="flex items-start gap-3 rounded-xl border border-white/[0.10] bg-white/[0.04] p-4 text-sm text-white/80">
                            <input
                                required
                                type="checkbox"
                                checked={formData.consent}
                                onChange={(e) => set("consent", e.target.checked)}
                                className="mt-1 h-4 w-4 rounded border-white/20"
                            />
                            <span>
                                I agree to the collection and processing of my information as described in the{" "}
                                <Link href="/privacy-policy" className="font-semibold underline underline-offset-4 hover:text-white">
                                    Privacy Policy
                                </Link>
                                .
                            </span>
                        </label>

                        <div className="mt-5 flex flex-col gap-3">
                            <div className="rounded-xl border border-white/[0.10] bg-white/[0.04] p-4">
                                <p className="mb-3 text-sm font-semibold text-white/90">Security verification</p>
                                <div ref={turnstileContainerRef} />
                            </div>

                            <button
                                disabled={
                                    submitting ||
                                    uploadingSlots.size > 0 ||
                                    !turnstileSiteKey ||
                                    !formData.turnstileToken ||
                                    !formData.consent
                                }
                                type="submit"
                            className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 btn primary"
                            >
                                {submitting ? "Submitting..." : "Submit onboarding form"}
                            </button>

                            {submitState.type === "error" && (
                                <p
                                    role="alert"
                                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                                >
                                    {submitState.message}
                                </p>
                            )}
                        </div>
                    </section>
                </form>
            </div>
        </main>
    );
}
