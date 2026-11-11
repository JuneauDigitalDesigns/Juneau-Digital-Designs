/**
 * Runs `/api/portal/onboarding` as itself under node. Swapped: the session lookup
 * (`resolvePortalRequest`, which is Clerk), the site write-back (`completeSiteOnboarding`, a
 * recorder), and the after-response operator email with its Stripe and Blob lookups. Each stub
 * reads and writes `globalThis.__onboardingRoute`, which the test sets up. The mapper, the
 * agreement and order stores and the intake queue are real, on an in-memory Upstash.
 *
 * Registered by the test that needs it, after `ts-hooks.mjs`, so it is consulted first.
 */
const STATE = "globalThis.__onboardingRoute";

const STUBS = {
    "@/app/lib/portal-account": `
        export const resolvePortalRequest = async () => ({
            ok: true,
            userId: "user_test",
            account: ${STATE}.account,
            site: ${STATE}.site,
        });
    `,
    "@/app/lib/account-store": `
        export const completeSiteOnboarding = async (email, sessionId, patch) => {
            ${STATE}.completed.push({ email, sessionId, patch });
        };
    `,
    "@/app/lib/notification-email": `export const sendClientCompleteNotification = async () => {};`,
    "@/app/lib/client-context": `export const gatherClientContext = async () => ({ payment: null, agreement: null, agreementPdf: null });`,
    // The operator email runs after the response; the test is about what was queued.
    "next/server": `export const NextResponse = { json: (body, init) => Response.json(body, init) }; export const after = () => {};`,
};

export async function resolve(specifier, context, next) {
    const source = STUBS[specifier];
    if (source) {
        return { url: `data:text/javascript,${encodeURIComponent(source)}`, format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
