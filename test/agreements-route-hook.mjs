/**
 * What the agreement download and ops routes need swapped to run as themselves under node: Clerk,
 * `next/server`, the rate limiter, and `@vercel/blob`, whose in-memory stand-in records every
 * access mode and token in `globalThis.__agreements`. The route, the account store, the KV module
 * and the PDF code are real.
 */
const S = "globalThis.__agreements";

const STUBS = {
    "@clerk/nextjs/server": `
        export const auth = async () => ({ userId: ${S}.userId });
        export const clerkClient = async () => ({
            users: { getUser: async () => ({ emailAddresses: [], primaryEmailAddressId: null }) },
        });
    `,
    "next/server": `
        export class NextResponse extends Response {
            static json(body, init) { return Response.json(body, init); }
        }
        export const after = (fn) => fn();
    `,
    "@upstash/ratelimit": `
        export class Ratelimit {
            static fixedWindow() { return {}; }
            async limit() { return { success: true }; }
        }
    `,
    "@/app/lib/operator-orders": `
        export const getOrder = async (id) => ${S}.orders?.[id] ?? null;
    `,
    "@vercel/blob": `
        export const put = async (pathname, body, opts) => {
            ${S}.puts.push({ pathname, opts });
            ${S}.blobs.set(pathname, new Uint8Array(body));
            return { url: "https://store.private.blob.vercel-storage.com/" + pathname };
        };
        export const get = async (pathname, opts) => {
            ${S}.gets.push({ pathname, opts });
            const bytes = ${S}.blobs.get(pathname);
            return bytes ? { statusCode: 200, stream: new Response(bytes).body } : null;
        };
    `,
};

export async function resolve(specifier, context, next) {
    const source = STUBS[specifier];
    if (source) {
        return { url: `data:text/javascript,${encodeURIComponent(source)}`, format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
