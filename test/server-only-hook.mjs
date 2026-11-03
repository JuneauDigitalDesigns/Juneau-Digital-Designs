/**
 * Resolves `server-only` to an empty module for tests that import server libs.
 *
 * The package's default export throws on import; Next swaps it for an empty file under the
 * `react-server` condition, which `node --test` does not set. Every lib that talks to Redis
 * or Twilio imports it, so without this none of them can be tested as the real thing.
 *
 * Kept out of `ts-transpile.mjs` and registered by the test that needs it, rather than by
 * `npm test`, so the shared transpile hook stays a pure type-stripper.
 */
export async function resolve(specifier, context, next) {
    if (specifier === "server-only") {
        return { url: "data:text/javascript,export {};", format: "module", shortCircuit: true };
    }
    return next(specifier, context);
}
