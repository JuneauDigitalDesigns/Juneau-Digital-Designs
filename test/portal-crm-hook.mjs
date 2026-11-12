/**
 * Runs the portal CRM routes as themselves under node, signed in as whoever
 * `globalThis.__portalCrm` names: `{ email, site }`. Only the session lookup (Clerk and the portal
 * rate limiter, inside `resolvePortalRequest`) and `next/server` are swapped; the routes, the
 * stores and the plan gate (`siteFeature`) are real.
 */
const STUBS = {
    "@/app/lib/portal-account": `
        export const resolvePortalRequest = async () => ({
            ok: true,
            userId: "user_test",
            account: { email: globalThis.__portalCrm.email, sites: [globalThis.__portalCrm.site], createdAt: 0, updatedAt: 0 },
            site: globalThis.__portalCrm.site,
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
