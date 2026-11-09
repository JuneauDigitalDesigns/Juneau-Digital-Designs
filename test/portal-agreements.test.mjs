/**
 * A signed agreement can be read by the client whose agreement it is, and by the operator through
 * the authenticated ops path. Nobody else.
 *
 * Found 2026-11-09: every signed PDF went to the public Blob store with `access: "public"`, and
 * every reader fetched it by its open URL. The full PDF, audit page included (IP address, browser),
 * opened for anyone holding the link.
 *
 * Real routes, real account store, real KV module, real PDF code. The network and the Blob SDK
 * are the doubles.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";

register("./server-only-hook.mjs", import.meta.url);
register("./agreements-route-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    AGREEMENTS_BLOB_READ_WRITE_TOKEN: "private-store-token",
    OPS_ORDERS_SECRET: "ops-secret",
});

const portalRoute = await import("../app/api/portal/agreements/[id]/route.ts");
const opsRoute = await import("../app/api/ops/orders/[id]/agreement-pdf/route.ts");
const { listAccountAgreements } = await import("../app/lib/portal-agreements.ts");
const { persistAgreement } = await import("../app/lib/kv.ts");
const { storeAgreementPdf } = await import("../app/lib/agreement-store.ts");
const { accountKey, accountByUserKey } = await import("@jdd/schema");

const OWNER = "owner@example.test";
const OTHER = "other@example.test";
const MASTER = "11111111-1111-4111-8111-111111111111";
const ADDENDUM = "22222222-2222-4222-8222-222222222222";
const THEIRS = "33333333-3333-4333-8333-333333333333";

const site = (slug, agreementId) => ({ slug, name: `Site ${slug}`, plan: "enterprise", status: "live", addedAt: 0, ...(agreementId ? { agreementId } : {}) });
const ownerAccount = () => ({
    email: OWNER,
    sites: [site("one", MASTER), site("two", ADDENDUM)],
    masterAgreement: { agreementId: MASTER, version: "5.4", tierCeiling: "enterprise", signedAt: 1 },
    createdAt: 0,
    updatedAt: 0,
});
const record = (id, over = {}) => ({
    id,
    kind: "master",
    plan: "growth",
    agreementVersion: "5.4",
    accountEmail: OWNER,
    pdfUrl: `https://store.private.blob.vercel-storage.com/agreements/${id}.pdf`,
    audit: { signedAt: "2026-11-01T12:00:00.000Z" },
    ...over,
});

async function twoPagePdf() {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage(); // the audit page
    return doc.save();
}

/* ── the network ──────────────────────────────────────────────────────────── */

const kv = new Map();
const sets = new Map();
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

function upstash([op, ...args]) {
    switch (op.toLowerCase()) {
        case "get":
            return kv.has(args[0]) ? b64(kv.get(args[0])) : null;
        case "set":
            kv.set(args[0], args[1]);
            return "OK";
        case "del":
            return kv.delete(args[0]) ? 1 : 0;
        case "persist":
            return 1;
        case "sadd":
            sets.set(args[0], new Set([...(sets.get(args[0]) ?? []), ...args.slice(1)]));
            return 1;
        case "smembers":
            return [...(sets.get(args[0]) ?? [])].map(b64);
        default:
            throw new Error(`fake upstash: unhandled ${op}`);
    }
}

const seed = (id, over) => kv.set(`agreement:${id}`, JSON.stringify(record(id, over)));

const realFetch = globalThis.fetch;
let S;
beforeEach(async () => {
    kv.clear();
    sets.clear();
    S = globalThis.__agreements = { userId: "user_owner", puts: [], gets: [], blobs: new Map() };
    kv.set(accountByUserKey("user_owner"), JSON.stringify(OWNER));
    kv.set(accountKey(OWNER), JSON.stringify(ownerAccount()));
    kv.set(accountByUserKey("user_other"), JSON.stringify(OTHER));
    kv.set(accountKey(OTHER), JSON.stringify({ email: OTHER, sites: [site("x", THEIRS)], createdAt: 0, updatedAt: 0 }));
    seed(MASTER);
    seed(ADDENDUM, { kind: "addendum" });
    seed(THEIRS, { accountEmail: OTHER });
    const pdf = await twoPagePdf();
    for (const id of [MASTER, ADDENDUM, THEIRS]) S.blobs.set(`agreements/${id}.pdf`, pdf);

    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.startsWith(KV_URL)) {
            const body = JSON.parse(init.body);
            return url.endsWith("/pipeline")
                ? Response.json(body.map((cmd) => ({ result: upstash(cmd) })))
                : Response.json({ result: upstash(body) });
        }
        throw new Error(`no reader may fetch a PDF by URL: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const download = (id) =>
    portalRoute.GET(new Request(`https://portal.test/api/portal/agreements/${id}`), { params: Promise.resolve({ id }) });

/* ── who can download ─────────────────────────────────────────────────────── */

test("signed out: refused, and the store is never read", async () => {
    S.userId = null;
    assert.equal((await download(MASTER)).status, 401);
    assert.equal(S.gets.length, 0);
});

test("signed in with no account here: refused, and the store is never read", async () => {
    S.userId = "user_stranger";
    assert.equal((await download(MASTER)).status, 403);
    assert.equal(S.gets.length, 0);
});

test("another client's agreement id: 404, and the store is never read", async () => {
    assert.equal((await download(THEIRS)).status, 404);
    assert.equal(S.gets.length, 0);
});

test("the other client gets their own and not this one's", async () => {
    S.userId = "user_other";
    assert.equal((await download(THEIRS)).status, 200);
    assert.equal((await download(MASTER)).status, 404);
});

test("an id on this account's list but signed for another account is still refused", async () => {
    seed(ADDENDUM, { kind: "addendum", accountEmail: OTHER });
    assert.equal((await download(ADDENDUM)).status, 404);
    assert.equal(S.gets.length, 0);
});

// An operator-closed agreement has no accountEmail, so being on the account is the only proof.
test("another client's operator-closed agreement: 404, and the store is never read", async () => {
    seed(THEIRS, { accountEmail: undefined });
    assert.equal((await download(THEIRS)).status, 404);
    assert.equal(S.gets.length, 0);
});

test("a made-up id: 404", async () => {
    assert.equal((await download("not-an-agreement")).status, 404);
});

/* ── what the owner gets ──────────────────────────────────────────────────── */

test("the owner downloads the client's copy, with the audit page removed", async () => {
    const res = await download(MASTER);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.match(res.headers.get("content-disposition"), /^attachment; filename="jdd-agreement-2026-11-01\.pdf"$/);
    assert.equal(res.headers.get("cache-control"), "private, no-store");
    const doc = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()));
    assert.equal(doc.getPageCount(), 1, "the audit page holds the signer's IP and browser");
});

test("the file is read from the private store with its own token", async () => {
    await download(MASTER);
    assert.deepEqual(S.gets, [
        { pathname: `agreements/${MASTER}.pdf`, opts: { access: "private", token: "private-store-token" } },
    ]);
});

test("an addendum downloads under its own name", async () => {
    const res = await download(ADDENDUM);
    assert.match(res.headers.get("content-disposition"), /jdd-addendum-2026-11-01\.pdf/);
});

/* ── what the list shows ──────────────────────────────────────────────────── */

const owner = () => JSON.parse(kv.get(accountKey(OWNER)));

test("Enterprise: the master first, each addendum named by its site", async () => {
    assert.deepEqual(
        (await listAccountAgreements(owner())).map((a) => [a.id, a.kind, a.current, a.siteName]),
        [
            [MASTER, "master", true, null],
            [ADDENDUM, "addendum", false, "Site two"],
        ],
    );
});

test("an addendum the account record never names is listed once it is paid for", async () => {
    // A downgrade or consolidation addendum is held only on the agreement itself.
    const held = "44444444-4444-4444-8444-444444444444";
    seed(held, { kind: "addendum" });
    assert.equal((await listAccountAgreements(owner())).some((a) => a.id === held), false, "unpaid: not listed");
    await persistAgreement(held, OWNER);
    assert.equal((await listAccountAgreements(owner())).some((a) => a.id === held), true);
    S.blobs.set(`agreements/${held}.pdf`, await twoPagePdf());
    assert.equal((await download(held)).status, 200);
});

test("a master replaced by an upgrade stays listed, marked as earlier", async () => {
    const older = "55555555-5555-4555-8555-555555555555";
    seed(older, { audit: { signedAt: "2026-10-01T12:00:00.000Z" } });
    await persistAgreement(older, OWNER);
    const rows = await listAccountAgreements(owner());
    assert.deepEqual(rows.find((a) => a.id === older), {
        id: older,
        kind: "master",
        current: false,
        signedAt: "2026-10-01T12:00:00.000Z",
        siteName: null,
    });
    assert.equal(rows[0].id, MASTER, "the current master stays first");
});

/* ── the operator's path ──────────────────────────────────────────────────── */

const ORDER = "order_recorded";
const opsGet = (secret) =>
    opsRoute.GET(
        new Request(`https://portal.test/api/ops/orders/${ORDER}/agreement-pdf`, {
            headers: secret ? { "x-ops-secret": secret } : {},
        }),
        { params: Promise.resolve({ id: ORDER }) },
    );

test("the ops path refuses a request without the secret, before reading anything", async () => {
    assert.equal((await opsGet(null)).status, 401);
    assert.equal((await opsGet("wrong")).status, 401);
    assert.equal(S.gets.length, 0);
});

test("the operator still gets the agreement, with the secret, from the private store", async () => {
    S.orders = { [ORDER]: { agreementId: MASTER } };
    const res = await opsGet("ops-secret");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.equal((await PDFDocument.load(new Uint8Array(await res.arrayBuffer()))).getPageCount(), 1);
    assert.deepEqual(S.gets.map((g) => g.opts.access), ["private"]);
});

/* ── storing ──────────────────────────────────────────────────────────────── */

test("a signed PDF is written privately, with the private store's token", async () => {
    const url = await storeAgreementPdf(MASTER, new Uint8Array([1, 2]));
    assert.equal(S.puts[0].opts.access, "private");
    assert.equal(S.puts[0].opts.token, "private-store-token");
    assert.equal(url.includes(".public."), false);
});

test("with the private token missing, signing fails rather than using the public store", async () => {
    const saved = process.env.AGREEMENTS_BLOB_READ_WRITE_TOKEN;
    delete process.env.AGREEMENTS_BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = "public-store-token";
    try {
        await assert.rejects(storeAgreementPdf(MASTER, new Uint8Array([1])), /AGREEMENTS_BLOB_READ_WRITE_TOKEN/);
        assert.equal(S.puts.length, 0);
    } finally {
        process.env.AGREEMENTS_BLOB_READ_WRITE_TOKEN = saved;
        delete process.env.BLOB_READ_WRITE_TOKEN;
    }
});

/* ── nothing else reads it the old way ────────────────────────────────────── */

function sources(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) sources(full, out);
        else if (/\.tsx?$/.test(name)) out.push(full);
    }
    return out;
}

test("no code fetches, links or returns an agreement's stored URL", () => {
    for (const file of sources(new URL("../app", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
        const src = readFileSync(file, "utf8");
        assert.doesNotMatch(src, /fetch\([^)]*pdfUrl/, `${file} fetches a stored URL`);
        assert.doesNotMatch(src, /href="\$\{[^}]*pdfUrl/, `${file} links a stored URL`);
        assert.doesNotMatch(src, /pdf_url/, `${file} returns the stored URL`);
    }
});

test("nothing writes an agreement to the public store", () => {
    for (const file of ["app/api/agreement/route.ts", "app/lib/verbal-agreement.ts", "app/lib/agreement-store.ts"]) {
        const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
        assert.doesNotMatch(src, /access:\s*"public"/, file);
    }
});
