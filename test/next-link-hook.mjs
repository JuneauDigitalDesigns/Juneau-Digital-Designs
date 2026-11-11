/**
 * Lets a component that imports `next/link` render to markup under node (`react-dom/server`).
 *
 * The bare `next/link` specifier has no `exports` entry Node's ESM resolver can follow, so it is
 * pointed at the real `next/link.js`. Nothing is stubbed: the anchor that renders is Next's own.
 */
export async function resolve(specifier, context, next) {
    if (specifier === "next/link") return next("next/link.js", context);
    return next(specifier, context);
}
