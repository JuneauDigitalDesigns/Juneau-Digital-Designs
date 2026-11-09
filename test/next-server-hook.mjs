/**
 * Resolves `next/server` for tests that call a route's real handler. Next's package has no
 * exports map, so the bare specifier doesn't resolve under plain `node --test`, and its
 * `NextResponse.json` is only `Response.json` with cookies this suite doesn't use.
 */
const STUB = `export const NextResponse = { json: (body, init) => Response.json(body, init) }; export const after = (fn) => fn();`;

export async function resolve(specifier, context, next) {
    if (specifier === "next/server") {
        return { url: `data:text/javascript,${encodeURIComponent(STUB)}`, format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
