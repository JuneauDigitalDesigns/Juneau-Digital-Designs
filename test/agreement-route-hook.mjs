/**
 * Swaps `/api/agreement`'s side effects for recorders, so a test can run the real `POST` and
 * see exactly which of them it reached.
 *
 * Replaced: Clerk (`auth`), the account lookup and save, PDF rendering, the Blob upload, the
 * KV save, the client email, and `next/server` (whose `after()` needs a live request scope).
 * Everything else is the real module. Each stub reads and writes `globalThis.__agreementRoute`,
 * which the test sets up; the stubs run in the test's own thread, so they share that object.
 *
 * Registered by the test that needs it, after `ts-hooks.mjs`, so it is consulted first and the
 * `@/` specifiers below never reach the transpile hook.
 */
const STATE = "globalThis.__agreementRoute";

const STUBS = {
    "@clerk/nextjs/server": `
        export const auth = async () => { ${STATE}.calls.push("auth"); return { userId: ${STATE}.userId }; };
        export const clerkClient = () => { throw new Error("clerkClient must not be reached"); };
    `,
    "next/server": `
        export const NextResponse = { json: (body, init) => Response.json(body, init) };
        export const after = (fn) => { ${STATE}.calls.push("after"); ${STATE}.afterTasks.push(fn); };
    `,
    "@vercel/blob": `
        export const put = async (pathname) => {
            ${STATE}.calls.push("put");
            return { url: "https://blob.test/" + pathname };
        };
    `,
    "@/app/lib/portal-account": `
        export const resolveAccountForUser = async (userId) => {
            ${STATE}.calls.push("resolveAccountForUser");
            return ${STATE}.accounts[userId] ?? null;
        };
    `,
    "@/app/lib/account-store": `
        export const saveAccount = async (account) => { ${STATE}.calls.push("saveAccount"); ${STATE}.savedAccounts.push(account); };
    `,
    "@/app/lib/kv": `
        export const saveAgreement = async (record) => { ${STATE}.calls.push("saveAgreement"); ${STATE}.savedAgreements.push(record); };
    `,
    "@/app/lib/pdf-signer": `
        export const hashSubmission = () => "hash";
        export const generateSignedPdf = async () => { ${STATE}.calls.push("generateSignedPdf"); return new Uint8Array([37, 80, 68, 70]); };
        export const stripLastPage = async (bytes) => bytes;
    `,
    "@/app/lib/agreement-email": `
        export const sendClientAgreementEmail = async (record) => { ${STATE}.calls.push("sendClientAgreementEmail"); ${STATE}.emailsTo.push(record.signerEmail); };
    `,
};

/**
 * Two `@/` imports the route makes that the shared transpile hook cannot resolve on its own: it
 * only appends `.ts`-family extensions, so a directory (`legal` → `legal/index.ts`) and a plain
 * `.mjs` file both miss. Mapped to real files here rather than by widening the shared hook.
 */
const REAL_FILES = {
    "@/app/lib/legal": "app/lib/legal/index.ts",
    "@/app/lib/agreement-validate.mjs": "app/lib/agreement-validate.mjs",
};
const ROOT = new URL("../", import.meta.url);

export async function resolve(specifier, context, next) {
    const stub = STUBS[specifier];
    if (stub) {
        return { url: `data:text/javascript,${encodeURIComponent(stub)}`, format: "module", shortCircuit: true };
    }
    const file = REAL_FILES[specifier];
    if (file) return next(new URL(file, ROOT).href, context);
    return next(specifier, context);
}
