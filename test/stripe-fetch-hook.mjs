import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads the real Stripe SDK through its fetch transport, so a test can answer Stripe's HTTP
 * requests from a `globalThis.fetch` double, the same way the Upstash tests do.
 *
 * On Node the SDK's default entry sends requests with `node:http`, which a fetch stub can't see.
 * Its `worker` entry is the same SDK (same resources, same request encoding, same error types)
 * on `fetch`. Registered by the test that needs it, like `server-only-hook.mjs`.
 */
const ROOT = resolvePath(fileURLToPath(import.meta.url), "../..");
const WORKER = pathToFileURL(resolvePath(ROOT, "node_modules/stripe/esm/stripe.esm.worker.js")).href;

export async function resolve(specifier, context, next) {
    if (specifier === "stripe") return { url: WORKER, format: "module", shortCircuit: true };
    return next(specifier, context);
}
