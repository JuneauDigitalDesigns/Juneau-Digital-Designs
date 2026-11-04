/**
 * Replaces `@clerk/nextjs/server` with a module whose every entry point throws.
 *
 * Clerk's Next build doesn't load under plain `node --test`, and a test that imports a lib whose
 * import chain reaches it (fulfilment → portal invite) would fail before running. Throwing on
 * use rather than returning a fake is the point: a test that registers this proves the paths it
 * exercises never call Clerk, and fails loudly if one starts to.
 */
const STUB = `
const unreachable = () => { throw new Error("Clerk was called in a test that must not reach it"); };
export const clerkClient = unreachable;
export const auth = unreachable;
export const currentUser = unreachable;
export const clerkMiddleware = unreachable;
export const createRouteMatcher = unreachable;
`;

export async function resolve(specifier, context, next) {
    if (specifier === "@clerk/nextjs/server") {
        return { url: `data:text/javascript,${encodeURIComponent(STUB)}`, format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
