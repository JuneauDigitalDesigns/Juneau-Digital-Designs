/**
 * Swaps `/api/upload`'s outside world for recorders, so a test can run the real `POST`.
 *
 * Replaced: Clerk (`auth`), the account lookup the portal guard uses, the rate limiters (an
 * in-memory fixed window per user), and Vercel Blob's `handleUpload`, which here calls the route's
 * `onBeforeGenerateToken` exactly as the real one does and records the token options it returns.
 * Everything else is the real module, including `resolvePortalRequest` and `resolveSite`.
 * Each stub reads and writes `globalThis.__uploadRoute`, which the test sets up.
 *
 * Registered by the test that needs it, after `ts-hooks.mjs`, so it is consulted first.
 */
const STATE = "globalThis.__uploadRoute";

const LIMITER = `({
    limit: async (key) => {
        const n = (${STATE}.hits[key] = (${STATE}.hits[key] ?? 0) + 1);
        return { success: n <= ${STATE}.limit };
    },
})`;

const STUBS = {
    "@clerk/nextjs/server": `
        export const auth = async () => ({ userId: ${STATE}.userId });
        export const clerkClient = async () => ({ users: { getUser: async () => ({ emailAddresses: [], primaryEmailAddressId: null }) } });
    `,
    "@vercel/blob/client": `
        export const handleUpload = async ({ body, onBeforeGenerateToken, onUploadCompleted }) => {
            // A completion callback is treated as correctly signed, as the real one would be.
            if (body?.type === "blob.upload-completed") {
                ${STATE}.completed.push(body.payload);
                if (onUploadCompleted) await onUploadCompleted(body.payload);
                return { type: "blob.upload-completed", response: "ok" };
            }
            if (body?.type !== "blob.generate-client-token") throw new Error("unexpected event " + body?.type);
            const p = body.payload;
            const options = await onBeforeGenerateToken(p.pathname, p.clientPayload ?? null, p.multipart ?? false);
            ${STATE}.issued.push(options);
            return { type: "blob.generate-client-token", clientToken: "test-token" };
        };
    `,
    "portal-kv": `
        export const getPortalRatelimit = () => ${LIMITER};
        export const getUploadRatelimit = () => ${LIMITER};
    `,
    "account-store": `
        export const getCachedAccountByUserId = async (userId) => ${STATE}.accounts[userId] ?? null;
        export const getAccount = async () => null;
    `,
};

const stub = (name) => ({ url: `data:text/javascript,${encodeURIComponent(STUBS[name])}`, format: "module", shortCircuit: true });

export async function resolve(specifier, context, next) {
    if (specifier === "@clerk/nextjs/server" || specifier === "@vercel/blob/client") return stub(specifier);
    if (specifier === "@/app/lib/portal-kv" || (specifier === "./portal-kv" && context.parentURL?.endsWith("/portal-account.ts"))) return stub("portal-kv");
    if (specifier === "./account-store" && context.parentURL?.endsWith("/portal-account.ts")) return stub("account-store");
    return next(specifier, context);
}
