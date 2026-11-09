/**
 * What `/api/portal/calls/[id]/recording` needs swapped to run as its real self under node:
 * Clerk (the signed-in user is `globalThis.__recordingRoute.userId`), `next/server` (no exports
 * map, see next-server-hook.mjs) and the rate limiter, whose Lua scripts a KV double can't run.
 * The account store, the KV helpers and the route are the real modules, on a fake Upstash.
 */
const STUBS = {
    "@clerk/nextjs/server": `
        export const auth = async () => ({ userId: globalThis.__recordingRoute.userId });
        export const clerkClient = async () => ({
            users: { getUser: async () => ({ emailAddresses: [], primaryEmailAddressId: null }) },
        });
    `,
    "next/server": `
        export const NextResponse = { json: (body, init) => Response.json(body, init) };
        export const after = (fn) => fn();
    `,
    "@upstash/ratelimit": `
        export class Ratelimit {
            static fixedWindow() { return {}; }
            async limit() { return { success: !globalThis.__recordingRoute.rateLimited }; }
        }
    `,
};

export async function resolve(specifier, context, next) {
    const source = STUBS[specifier];
    if (source) {
        return { url: `data:text/javascript,${encodeURIComponent(source)}`, format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
