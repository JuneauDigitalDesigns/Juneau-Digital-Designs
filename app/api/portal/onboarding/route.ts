import { NextResponse, after } from "next/server";
import {
    mapBrandIntakeToIntake,
    zBrandIntakeSubmission,
    type BrandIntakeSubmission,
    type PalettePick,
    type ServiceEntry,
    type Intake,
} from "@/app/lib/site-schema";
import { sendClientCompleteNotification } from "@/app/lib/notification-email";
import { enqueueIntake, slugifyBrand } from "@/app/lib/intake-queue";
import { completeSiteOnboarding } from "@/app/lib/account-store";
import { deleteDraft } from "@/app/lib/onboarding-draft-store";
import { resolvePortalRequest } from "@/app/lib/portal-account";

/** Deep-clone replacing every empty string with null. */
function normalizeEmpties(value: unknown): unknown {
    if (value === "") return null;
    if (Array.isArray(value)) return value.map(normalizeEmpties);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeEmpties(v)]),
        );
    }
    return value;
}

type PlanSlug = "starter" | "growth" | "enterprise";

const maxFieldLength = 2000;

function sanitize(value: unknown, limit = maxFieldLength): string {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, limit);
}

function sanitizeStringArray(value: unknown, maxItems: number, itemLimit: number): string[] {
    if (!Array.isArray(value)) return [];
    return value.slice(0, maxItems).map((v) => sanitize(v, itemLimit)).filter(Boolean);
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidBlobUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com");
    } catch {
        return false;
    }
}

function sanitizeFilename(value: unknown): string {
    if (typeof value !== "string") return "";
    const base = value.replace(/\\/g, "/").split("/").pop() ?? "";
    return base.replace(/\.\./g, "").replace(/\0/g, "").trim().slice(0, 200);
}

function sanitizeImageMeta(item: unknown): { url: string; filename: string; alt: string } | null {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    const url = sanitize(obj.url, 500);
    if (!url || !isValidBlobUrl(url)) return null;
    return { url, filename: sanitizeFilename(obj.filename), alt: sanitize(obj.alt, 200) };
}

const BG_MOODS = ["white", "warm", "cool", "soft-dark", "deep-dark"] as const;
const PALETTE_SLOTS = ["accent", "accentFg", "bg", "bgSoft", "ink", "inkSoft", "rule"] as const;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeOverrides(raw: unknown): PalettePick["overrides"] {
    if (!raw || typeof raw !== "object") return undefined;
    const obj = raw as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const slot of PALETTE_SLOTS) {
        const v = obj[slot];
        if (typeof v === "string" && HEX_RE.test(v.trim())) out[slot] = v.trim().toUpperCase();
    }
    return Object.keys(out).length ? out : undefined;
}

function sanitizePalette(raw: unknown): PalettePick {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const overrides = sanitizeOverrides(obj.overrides);
    if (sanitize(obj.mode, 10) !== "custom") {
        return { mode: "preset", presetId: sanitize(obj.presetId, 60), overrides };
    }
    const mood = sanitize(obj.bgMood, 20);
    return {
        mode: "custom",
        presetId: sanitize(obj.presetId, 60),
        baseColor: sanitize(obj.baseColor, 20),
        accentColor: sanitize(obj.accentColor, 20),
        bgMood: (BG_MOODS as readonly string[]).includes(mood) ? (mood as PalettePick["bgMood"]) : undefined,
        overrides,
    };
}

function sanitizeServiceList(raw: unknown): ServiceEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .slice(0, 8)
        .map((s) => ({ name: sanitize((s as Record<string, unknown>)?.name, 120), tag: sanitize((s as Record<string, unknown>)?.tag, 80) }))
        .filter((s) => s.name);
}

export async function POST(request: Request) {
    try {
        const ctx = await resolvePortalRequest(request);
        if (!ctx.ok) return ctx.response;

        const { userId, account, site } = ctx;

        if (site.status !== "pending-onboarding") {
            return NextResponse.json({ message: "Onboarding already completed." }, { status: 409 });
        }

        const body = (await request.json()) as Partial<Record<string, unknown>>;

        const validPlans: PlanSlug[] = ["starter", "growth", "enterprise"];
        const rawPlan = sanitize(body.selectedPlan, 20);
        const selectedPlan: PlanSlug = validPlans.includes(rawPlan as PlanSlug)
            ? (rawPlan as PlanSlug)
            : site.plan;

        const brandName = sanitize(body.brandName, 160);
        const brandShort = sanitize(body.brandShort, 80);
        const email = sanitize(body.email, 160) || site.signerEmail || "";
        const phone = sanitize(body.phone, 60);
        const address = sanitize(body.address, 300);
        const license = sanitize(body.license, 200);
        const industry = sanitize(body.industry, 120);
        const established = sanitize(body.established, 40);
        const notableClients = sanitize(body.notableClients, 500);
        const certifications = sanitize(body.certifications, 300);
        const businessHours = sanitize(body.businessHours, 300);
        const serviceArea = sanitize(body.serviceArea, 400);
        const agentName = sanitize(body.agentName, 80);
        const existingWebsiteUrl = sanitize(body.existingWebsiteUrl, 500);
        const announcement = sanitize(body.announcement, 300);
        const hasLogo = Boolean(body.hasLogo);

        if (email && !isValidEmail(email)) {
            return NextResponse.json({ message: "Please provide a valid email address." }, { status: 400 });
        }

        const serviceList = sanitizeServiceList(body.serviceList);
        const bd = body.brandDirection && typeof body.brandDirection === "object" ? (body.brandDirection as Record<string, unknown>) : {};
        const brandDirection = {
            differentiators: sanitize(bd.differentiators, 800),
            targetCustomer: sanitize(bd.targetCustomer, 300),
            vibe: sanitizeStringArray(bd.vibe, 12, 40),
            tone: sanitizeStringArray(bd.tone, 12, 40),
            adjectives: sanitizeStringArray(bd.adjectives, 12, 40),
            references: sanitize(bd.references, 500),
            forbidden: sanitize(bd.forbidden, 500),
        };

        const palette = sanitizePalette(body.palette);
        const rawImages = body.images && typeof body.images === "object" ? (body.images as Record<string, unknown>) : {};
        const heroSlides = Array.isArray(rawImages.heroSlides)
            ? rawImages.heroSlides.slice(0, 10).map(sanitizeImageMeta).filter((x): x is { url: string; filename: string; alt: string } => x !== null)
            : [];
        const logo = rawImages.logo ? sanitizeImageMeta(rawImages.logo) ?? undefined : undefined;
        const aboutFeature = rawImages.aboutFeature ? sanitizeImageMeta(rawImages.aboutFeature) ?? undefined : undefined;

        const additionalSites = Array.isArray(body.additionalSites)
            ? body.additionalSites.slice(0, 2).map((s) => {
                const site = s as Record<string, unknown>;
                const sbd = site.brandDirection && typeof site.brandDirection === "object" ? (site.brandDirection as Record<string, unknown>) : {};
                return {
                    brandName: sanitize(site.brandName, 160),
                    brandShort: sanitize(site.brandShort, 80),
                    email: sanitize(site.email, 160),
                    phone: sanitize(site.phone, 60),
                    address: sanitize(site.address, 300),
                    businessHours: sanitize(site.businessHours, 300),
                    serviceList: sanitizeServiceList(site.serviceList),
                    palette: sanitizePalette(site.palette),
                    brandDirection: {
                        differentiators: sanitize(sbd.differentiators, 800),
                        targetCustomer: "",
                        vibe: [],
                        tone: [],
                        adjectives: [],
                        references: "",
                        forbidden: "",
                    },
                };
            }).filter((s) => s.brandName)
            : [];

        const submission: BrandIntakeSubmission = {
            selectedPlan,
            brandName,
            brandShort,
            email,
            phone,
            address,
            license,
            industry,
            established,
            notableClients,
            certifications,
            businessHours,
            serviceArea,
            agentName,
            serviceList,
            brandDirection,
            palette,
            hasLogo,
            images: { logo, heroSlides, aboutFeature },
            existingWebsiteUrl,
            announcement,
            additionalSites: selectedPlan === "enterprise" ? additionalSites : undefined,
        };

        const parsed = zBrandIntakeSubmission.safeParse(submission);
        if (!parsed.success) {
            console.error("[portal/onboarding] schema validation failed", parsed.error.issues);
            return NextResponse.json({ message: "Your submission could not be processed. Please try again." }, { status: 400 });
        }

        const intake = mapBrandIntakeToIntake(submission);
        const payloadJson = JSON.stringify(normalizeEmpties(intake), null, 2);
        const slugSource = brandShort || brandName || "client";
        const newSlug = slugifyBrand(slugSource);
        const sessionId = site.sessionId ?? "";

        // Enqueue intake for the console Build wizard.
        if (process.env.INTAKE_QUEUE_ENABLED !== "false") {
            try {
                await enqueueIntake({
                    id: crypto.randomUUID(),
                    receivedAt: Date.now(),
                    status: "pending",
                    plan: selectedPlan,
                    brandName: brandName || "(unnamed)",
                    slugGuess: newSlug,
                    sessionId,
                    intake: normalizeEmpties(intake) as Intake,
                });
            } catch (e) {
                console.error("[portal/onboarding] intake queue push failed", e);
            }
        }

        // Promote the pending site to "building" with the real wizard data.
        try {
            await completeSiteOnboarding(account.email, sessionId, {
                slug: newSlug,
                name: brandName || "(unnamed)",
                plan: selectedPlan,
                status: "building",
                onboardingCompletedAt: Date.now(),
            });
        } catch (e) {
            console.error("[portal/onboarding] completeSiteOnboarding failed", account.email, e);
        }

        // Delete server-side draft now that submission succeeded.
        deleteDraft(userId).catch(() => {});

        after(async () => {
            await sendClientCompleteNotification({
                brandName: brandName || "(unnamed)",
                email,
                phone,
                plan: selectedPlan,
                websiteType: industry,
                servicesCount: serviceList.length,
                payloadJson,
                payment: null,
                agreement: null,
                agreementPdf: null,
            }).catch((e) => console.error("[portal/onboarding] notification email failed", e));
        });

        return NextResponse.json({ message: "Onboarding submitted successfully." }, { status: 200 });
    } catch {
        return NextResponse.json({ message: "Unexpected server error." }, { status: 500 });
    }
}
