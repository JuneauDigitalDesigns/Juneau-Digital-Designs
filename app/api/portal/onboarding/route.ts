import { NextResponse, after } from "next/server";
import {
    mapBrandIntakeToIntake,
    uniqueSlug,
    zBrandIntakeSubmission,
    type Intake,
} from "@/app/lib/site-schema";
import { sendClientCompleteNotification } from "@/app/lib/notification-email";
import { gatherClientContext } from "@/app/lib/client-context";
import { enqueueIntake, slugifyBrand } from "@/app/lib/intake-queue";
import { completeSiteOnboarding } from "@/app/lib/account-store";
import { deleteDraft } from "@/app/lib/onboarding-draft-store";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getConsentStateForAccount, smsAlertsSnapshot } from "@/app/lib/sms-consent";
import { getAgreement } from "@/app/lib/kv";
import { getOrder } from "@/app/lib/operator-orders";
import {
    applySignedLegalName,
    buildSubmission,
    markPaletteNotClientChosen,
    signedLegalName,
} from "@/app/lib/onboarding-submission";

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

export async function POST(request: Request) {
    try {
        const ctx = await resolvePortalRequest(request);
        if (!ctx.ok) return ctx.response;

        const { userId, account, site } = ctx;

        if (site.status !== "pending-onboarding") {
            return NextResponse.json({ message: "Onboarding already completed." }, { status: 409 });
        }

        const body = (await request.json()) as Partial<Record<string, unknown>>;

        // Field by field in app/lib/onboarding-submission.ts, which is tested. It used to be inline
        // here and dropped nine answers the wizard collected.
        const built = buildSubmission(body, site);
        if (!built.ok) {
            const message =
                built.reason === "invalid-email"
                    ? "Please provide a valid email address."
                    : "Your submission could not be processed. Please try again.";
            return NextResponse.json({ message }, { status: 400 });
        }
        const { submission } = built;
        const { selectedPlan, receptionistMode, brandName, brandShort, email, phone, industry, serviceList } = submission;

        const parsed = zBrandIntakeSubmission.safeParse(submission);
        if (!parsed.success) {
            console.error("[portal/onboarding] schema validation failed", parsed.error.issues);
            return NextResponse.json({ message: "Your submission could not be processed. Please try again." }, { status: 400 });
        }

        // Consent travels with the intake so onboard.js knows whether to wire the Twilio
        // module in the cloned post-call scenario, and which number to point it at. Read
        // here rather than looked up later because this is the moment the envelope is
        // built; a lookup failure means no alerts, which is the safe direction.
        const consent = await getConsentStateForAccount(account.email).catch((e) => {
            console.error("[portal/onboarding] consent lookup failed, alerts will stay off", e);
            return null;
        });

        // The legal name the client signed under, which the wizard's business name is not: the
        // wizard prefills it, and a client who corrects it to their trading name is right to.
        // Read from the site's own agreement (and its order, for a sales-call close), the same
        // records the wizard's prefill reads. A failed lookup leaves `brand.long` flagged missing.
        const [agreement, order] = await Promise.all([
            site.agreementId
                ? getAgreement(site.agreementId).catch((e) => {
                      console.error("[portal/onboarding] legal name: agreement lookup failed", site.agreementId, e);
                      return null;
                  })
                : null,
            site.orderId
                ? getOrder(site.orderId).catch((e) => {
                      console.error("[portal/onboarding] legal name: order lookup failed", site.orderId, e);
                      return null;
                  })
                : null,
        ]);

        // The client no longer chooses colors (JDD does, in the console), so the default palette
        // the wizard sends is recorded as not client-supplied.
        const intake: Intake = markPaletteNotClientChosen(
            applySignedLegalName(
                { ...mapBrandIntakeToIntake(submission), smsAlerts: smsAlertsSnapshot(consent) },
                signedLegalName({ agreement, order }),
            ),
        );
        const payloadJson = JSON.stringify(normalizeEmpties(intake), null, 2);
        const slugSource = brandShort || brandName || "client";
        // Suffixed against the account's other sites. Nothing checked this before, so two
        // sites under one client could land on the same slug — after which `resolveSite` and
        // `upsertSite`, both slug-keyed, silently act on whichever came first. `site.slug` is
        // excluded so the placeholder this record still carries isn't treated as a rival.
        // A site closed on a sales call is never renamed: its slug was locked at order time, and
        // its A2P registration and `clients/<slug>/` folder were keyed on it from the call on.
        const newSlug = site.slugLocked ? site.slug : uniqueSlug(slugifyBrand(slugSource), account, site.slug);
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
                /**
                 * The activation choice, recorded on the site the moment it is made.
                 *
                 * Written here rather than left to provisioning because this is the only point
                 * the client's own answer is in hand, and three separate things read it later:
                 * the portal (a declined site has no call log and must say so rather than
                 * showing a tab that can never load), metering (a declined site must never be
                 * billed for minutes), and onboard.js (which decides whether to buy a phone
                 * number at all).
                 *
                 * Spread conditionally, so a submission from a pre-activation-step draft leaves
                 * the field absent rather than writing `undefined` over it. Absent means "not
                 * yet asked" everywhere downstream, and must never be read as "declined".
                 */
                ...(receptionistMode
                    ? { receptionistMode, receptionistChoiceAt: Date.now() }
                    : {}),
            });
        } catch (e) {
            console.error("[portal/onboarding] completeSiteOnboarding failed", account.email, e);
        }

        // Delete server-side draft now that submission succeeded. Scoped to the site that was
        // just filled in — an unscoped delete would wipe a sibling site's unfinished draft.
        deleteDraft(userId, site.slug).catch(() => {});

        after(async () => {
            // What they paid and what they signed, resolved from the site's checkout session.
            // This route used to send all three as null, which was survivable while the
            // anonymous funnel still existed and carried them — now that this is the only
            // onboarding path, that would have quietly stripped payment details and the
            // signed agreement out of every operator email.
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
            }).catch((e) => console.error("[portal/onboarding] notification email failed", e));
        });

        // The slug goes back because the client cannot know it: they arrived at a placeholder
        // and the brand name they just typed replaced it. Without this the success redirect
        // has nothing to point at and falls back to whichever site `selectSite` prefers.
        return NextResponse.json(
            { message: "Onboarding submitted successfully.", slug: newSlug },
            { status: 200 },
        );
    } catch {
        return NextResponse.json({ message: "Unexpected server error." }, { status: 500 });
    }
}
