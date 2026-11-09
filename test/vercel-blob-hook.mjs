/**
 * Replaces `@vercel/blob` with a `put` that keeps nothing, so a test can run the real agreement
 * recording, PDF included, without a storage token. Registered by the test that needs it.
 */
const STUB = `export const put = async (pathname) => ({ url: "https://blob.test/" + pathname });
export const head = async (pathname, options) => globalThis.__blobHead(pathname, options);
export const get = async (pathname, options) => (globalThis.__blobGet ? globalThis.__blobGet(pathname, options) : null);`;

export async function resolve(specifier, context, next) {
    if (specifier === "@vercel/blob") {
        return { url: `data:text/javascript,${encodeURIComponent(STUB)}`, format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
