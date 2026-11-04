/**
 * Swaps `/api/agreement`'s side effects for recorders, so a test can run the real `POST` and
 * see exactly which of them it reached.
 *
 * Replaced: Clerk (`auth`), the account lookup and save, PDF rendering, the Blob upload, the
 * agreement store and its idempotency slots (in memory), the client email, and `next/server`
 * (whose `after()` needs a live request scope). `failPut` and `failSave` make the upload or the
 * save throw.
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
            if (${STATE}.failPut) { ${STATE}.failPut -= 1; throw new Error("blob down"); }
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
    // The agreement store and the idempotency slots, in memory. `slots` and `paid` are created on
    // first use, so a test that never repeats an acceptance need not set them up.
    "@/app/lib/kv": `
        const slots = () => (${STATE}.slots ??= new Map());
        const paid = () => (${STATE}.paid ??= new Set());
        export const saveAgreement = async (record) => {
            ${STATE}.calls.push("saveAgreement");
            if (${STATE}.failSave) throw new Error("kv down");
            ${STATE}.savedAgreements.push(record);
        };
        export const getAgreement = async (id) => ${STATE}.savedAgreements.find((r) => r.id === id) ?? null;
        export const agreementIsPaid = async (id) => paid().has(id);
        export const claimAgreementSlot = async (key, id) => {
            if (!slots().has(key)) { slots().set(key, id); return null; }
            return slots().get(key);
        };
        export const peekAgreementSlot = async (key) => slots().get(key) ?? null;
        export const takeAgreementSlot =async (key, id) => { slots().set(key, id); };
        export const releaseAgreementSlot = async (key, id) => { if (slots().get(key) === id) slots().delete(key); };
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
