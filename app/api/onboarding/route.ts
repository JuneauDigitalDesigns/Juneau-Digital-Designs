import { NextResponse, after } from "next/server";
import {
    mapBrandIntakeToIntake,
    zBrandIntakeSubmission,
    type BrandIntakeSubmission,
    type PalettePick,
    type ServiceEntry,
    type Intake,
} from "@/app/lib/site-schema";
import {
    sendClientCompleteNotification,
    type PaymentDetails,
} from "@/app/lib/notification-email";
import { stripe } from "@/app/lib/stripe";
import { getAgreement } from "@/app/lib/kv";
import { enqueueIntake, slugifyBrand } from "@/app/lib/intake-queue";
import { savePendingClient } from "@/app/lib/pending-client";
import type { AgreementRecord } from "@/app/lib/agreement-types";

const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;

/** Deep-clone replacing every empty string with null. Empty arrays/objects pass through. */
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

type TurnstileVerifyResponse = {
    success: boolean;
    "error-codes"?: string[];
};

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

/** Accepts only https URLs hosted on the Vercel public Blob CDN. */
function isValidBlobUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com");
    } catch {
        return false;
    }
}

/** Strips path traversal sequences and returns the basename only. */
function sanitizeFilename(value: unknown): string {
    if (typeof value !== "string") return "";
    const base = value.replace(/\\/g, "/").split("/").pop() ?? "";
    return base.replace(/\.\./g, "").replace(/\0/g, "").trim().slice(0, 200);
}

/** Sanitizes and validates a single ImageMeta object. Returns null if the URL is invalid. */
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

/** Keep only the 7 known slots, and only when they hold a well-formed hex. */
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

/** Sanitize a client-supplied PalettePick into a safe {mode, preset|colors} object. */
function sanitizePalette(raw: unknown): PalettePick {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const overrides = sanitizeOverrides(obj.overrides);
    if (sanitize(obj.mode, 10) !== "custom") {
        return { mode: "preset", presetId: sanitize(obj.presetId, 60), overrides };
    }
    const mood = sanitize(obj.bgMood, 20);
    return {
        mode: "custom",
        baseColor: sanitize(obj.baseColor, 20),
        accentColor: sanitize(obj.accentColor, 20),
        bgMood: (BG_MOODS as readonly string[]).includes(mood)
            ? (mood as PalettePick["bgMood"])
            : undefined,
        overrides,
    };
}

/** Sanitize a client-supplied list of {name, tag} services. */
function sanitizeServiceList(raw: unknown): ServiceEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .slice(0, 8)
        .map((s) => ({ name: sanitize((s as Record<string, unknown>)?.name, 120), tag: sanitize((s as Record<string, unknown>)?.tag, 80) }))
        .filter((s) => s.name);
}

/**
 * Resolve the Stripe payment and signed-agreement context for the combined
 * operator email. Every lookup degrades gracefully.
 */
async function gatherClientContext(sessionId: string): Promise<{
    payment: PaymentDetails | null;
    agreement: AgreementRecord | null;
    agreementPdf: Buffer | null;
}> {
    let payment: PaymentDetails | null = null;
    let agreement: AgreementRecord | null = null;
    let agreementPdf: Buffer | null = null;

    if (!sessionId) return { payment, agreement, agreementPdf };

    let agreementId: string | undefined;
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") {
            payment = {
                plan: session.metadata?.plan,
                customerName: session.customer_details?.name,
                customerEmail: session.customer_details?.email,
                amountTotal: session.amount_total,
                subscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
                sessionId: session.id,
            };
            agreementId = session.metadata?.agreement_id;
        } else {
            console.warn("[onboarding] session not paid — skipping payment section", sessionId);
        }
    } catch (e) {
        console.error("[onboarding] stripe session lookup failed", sessionId, e);
    }

    if (agreementId) {
        try {
            agreement = await getAgreement(agreementId);
        } catch (e) {
            console.error("[onboarding] agreement lookup failed", agreementId, e);
        }
    }

    if (agreement?.pdfUrl) {
        try {
            const res = await fetch(agreement.pdfUrl);
            if (res.ok) agreementPdf = Buffer.from(await res.arrayBuffer());
            else console.error("[onboarding] agreement PDF fetch returned", res.status, agreement.pdfUrl);
        } catch (e) {
            console.error("[onboarding] agreement PDF fetch failed", agreement.pdfUrl, e);
        }
    }

    return { payment, agreement, agreementPdf };
}

async function verifyTurnstileToken(token: string, remoteIp: string): Promise<boolean> {
    if (!turnstileSecretKey) return false;
    const payload = new URLSearchParams({ secret: turnstileSecretKey, response: token });
    if (remoteIp) payload.set("remoteip", remoteIp);

    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload,
    });
    if (!verifyResponse.ok) return false;

    const verifyResult = (await verifyResponse.json()) as TurnstileVerifyResponse;
    if (!verifyResult.success) console.error("[onboarding] Turnstile verification failed:", verifyResult["error-codes"]);
    return Boolean(verifyResult.success);
}

/** Loose shape of the incoming JSON (all optional — nothing is required to submit). */
type BrandIntakePayload = Partial<Record<string, unknown>> & {
    website?: string;
    turnstileToken?: string;
    consent?: boolean;
    sessionId?: string;
};

export async function POST(request: Request) {
    try {
        if (!turnstileSecretKey) {
            return NextResponse.json({ message: "Server is not configured for onboarding submissions yet." }, { status: 500 });
        }

        const body = (await request.json()) as BrandIntakePayload;

        // Honeypot — silently accept bots.
        if (sanitize(body.website, 120)) {
            return NextResponse.json({ message: "Submission accepted." }, { status: 200 });
        }

        const turnstileToken = sanitize(body.turnstileToken, 4000);
        if (!turnstileToken) {
            return NextResponse.json({ message: "Please complete security verification before submitting." }, { status: 400 });
        }

        const forwardedFor = request.headers.get("x-forwarded-for") || "";
        const remoteIp = forwardedFor.split(",")[0]?.trim() || "";
        if (!(await verifyTurnstileToken(turnstileToken, remoteIp))) {
            return NextResponse.json({ message: "Security verification failed. Please try again." }, { status: 400 });
        }

        const consent = Boolean(body.consent);
        if (!consent) {
            return NextResponse.json({ message: "Privacy consent is required before submission." }, { status: 400 });
        }

        const validPlans: PlanSlug[] = ["starter", "growth", "enterprise"];
        const rawPlan = sanitize(body.selectedPlan, 20);
        const selectedPlan: PlanSlug = validPlans.includes(rawPlan as PlanSlug) ? (rawPlan as PlanSlug) : "starter";

        // ── Facts ──
        const brandName = sanitize(body.brandName, 160);
        const brandShort = sanitize(body.brandShort, 80);
        const email = sanitize(body.email, 160);
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

        // Email is optional, but if present it must be well-formed.
        if (email && !isValidEmail(email)) {
            return NextResponse.json({ message: "Please provide a valid email address." }, { status: 400 });
        }

        // ── Service list ──
        const serviceList = sanitizeServiceList(body.serviceList);

        // ── Brand direction ──
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

        // ── Palette + images ──
        const palette = sanitizePalette(body.palette);
        const rawImages = body.images && typeof body.images === "object" ? (body.images as Record<string, unknown>) : {};
        const heroSlides = Array.isArray(rawImages.heroSlides)
            ? rawImages.heroSlides.slice(0, 10).map(sanitizeImageMeta).filter((x): x is { url: string; filename: string; alt: string } => x !== null)
            : [];
        const logo = rawImages.logo ? sanitizeImageMeta(rawImages.logo) ?? undefined : undefined;
        const aboutFeature = rawImages.aboutFeature ? sanitizeImageMeta(rawImages.aboutFeature) ?? undefined : undefined;

        // ── Enterprise additional sites ──
        const additionalSites = Array.isArray(body.additionalSites)
            ? body.additionalSites
                  .slice(0, 2)
                  .map((s) => {
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
                  })
                  .filter((s) => s.brandName)
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

        // Defense-in-depth: reject anything that doesn't match the contract shape.
        const parsed = zBrandIntakeSubmission.safeParse(submission);
        if (!parsed.success) {
            console.error("[onboarding] submission failed schema validation", parsed.error.issues);
            return NextResponse.json({ message: "Your submission could not be processed. Please try again." }, { status: 400 });
        }

        // Same cs_… shape the client enforces in safeStorageKey.
        const rawSessionId = sanitize(body.sessionId, 200);
        const sessionId = /^cs_[a-zA-Z0-9_]+$/.test(rawSessionId) ? rawSessionId : "";

        // Map to the Intake envelope. The copywriter fills the empty copy scaffold later.
        const intake = mapBrandIntakeToIntake(submission);
        const payloadJson = JSON.stringify(normalizeEmpties(intake), null, 2);
        const slugSource = brandShort || brandName || "client";

        // Push the intake onto the KV queue so the local jdd-ops console can pull it.
        // Awaited for reliability, but a queue failure must never block the response —
        // the operator email below is the audit-trail fallback. Gate off with INTAKE_QUEUE_ENABLED=false.
        if (process.env.INTAKE_QUEUE_ENABLED !== "false") {
            try {
                await enqueueIntake({
                    id: crypto.randomUUID(),
                    receivedAt: Date.now(),
                    status: "pending",
                    plan: selectedPlan,
                    brandName: brandName || "(unnamed)",
                    slugGuess: slugifyBrand(slugSource),
                    sessionId,
                    // normalizeEmpties only maps "" → null; the envelope shape is preserved.
                    intake: normalizeEmpties(intake) as Intake,
                });
            } catch (e) {
                console.error("[onboarding] intake queue push failed", e);
            }
        }

        // Stash a pending-client record (keyed by email) so Clerk signup grants portal
        // access immediately. Skipped when no email was provided. Non-blocking.
        if (email) {
            try {
                await savePendingClient({
                    email,
                    brandName: brandName || "(unnamed)",
                    plan: selectedPlan,
                    slug: slugifyBrand(slugSource),
                    status: "building",
                    sessionId,
                    createdAt: Date.now(),
                });
            } catch (e) {
                console.error("[onboarding] pending-client save failed", email, e);
            }
        }

        // The single operator email (payment + agreement PDF + intake JSON) runs after
        // the response via after() so Vercel keeps the function alive for it.
        after(async () => {
            const { payment, agreement, agreementPdf } = await gatherClientContext(sessionId);
            await sendClientCompleteNotification({
                brandName: brandName || "(unnamed)",
                email,
                phone,
                plan: selectedPlan,
                websiteType: industry,
                servicesCount: serviceList.length,
                payloadJson,
                payment,
                agreement,
                agreementPdf,
            }).catch((e) => console.error("[onboarding] notification email failed", e));
        });

        return NextResponse.json({ message: "Onboarding submission sent successfully." }, { status: 200 });
    } catch {
        return NextResponse.json({ message: "Unexpected server error while processing your submission." }, { status: 500 });
    }
}
