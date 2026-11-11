/**
 * Runs `/api/portal/sms-consent` as itself under node, signed in as whoever
 * `globalThis.__portalSms.email` names. Only the session lookup (Clerk + the portal rate limiter,
 * inside `resolvePortalRequest`) and `next/server` are swapped; the route, the consent store and
 * the campaign switch are real.
 */
const STUBS = {
    "@/app/lib/portal-account": `
        export const resolvePortalRequest = async () => ({
            ok: true,
            account: { email: globalThis.__portalSms.email, sites: [], createdAt: 0, updatedAt: 0 },
        });
    `,
    "next/server": `export const NextResponse = { json: (body, init) => Response.json(body, init) };`,
};

export async function resolve(specifier, context, next) {
    const source = STUBS[specifier];
    if (source) {
        return { url: `data:text/javascript,${encodeURIComponent(source)}`, format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
