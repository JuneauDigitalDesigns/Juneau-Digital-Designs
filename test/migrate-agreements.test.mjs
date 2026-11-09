/**
 * Moving signed agreements to the private store.
 *
 * Two things must not happen. A public copy must not be deleted before its private copy is proven
 * good, or a signed contract is gone. And rewriting a record must not drop its TTL:
 * `agreementIsPaid` reads "no expiry" as "paid", so that would turn every abandoned draft into a
 * paid agreement.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { migrateAgreements } from "../scripts/migrate-agreements-private.mjs";

const PUBLIC = (id) => `https://abc.public.blob.vercel-storage.com/agreements/${id}.pdf`;
const PRIVATE = (path) => `https://abc.private.blob.vercel-storage.com/${path}`;

function world({ corrupt = false } = {}) {
    const pub = new Map([[PUBLIC("a"), new Uint8Array([1, 2, 3])], [PUBLIC("orphan"), new Uint8Array([9])]]);
    const priv = new Map();
    const kv = new Map([
        ["agreement:a", { value: { id: "a", pdfUrl: PUBLIC("a"), accountEmail: "Owner@Example.test" }, ttl: -1 }],
        ["agreement:draft", { value: { id: "draft", pdfUrl: PUBLIC("draft"), accountEmail: "o@x.test" }, ttl: 500 }],
        ["jdd:account:o", { value: { email: "o", sites: [{ slug: "s", agreementId: "a", agreementPdfUrl: PUBLIC("a") }] }, ttl: -1 }],
    ]);
    const sets = new Map();
    const setCalls = [];
    return {
        pub,
        priv,
        kv,
        sets,
        setCalls,
        publicStore: {
            list: async () => [...pub.keys()].map((url) => ({ url, pathname: new URL(url).pathname.slice(1) })),
            read: async (url) => pub.get(url),
            remove: async (url) => void pub.delete(url),
            stillServes: async (url) => pub.has(url),
        },
        privateStore: {
            write: async (path, bytes) => {
                priv.set(path, corrupt ? new Uint8Array([0]) : bytes);
                return PRIVATE(path);
            },
            read: async (path) => priv.get(path),
        },
        redis: {
            scan: async (_c, { match }) => ["0", [...kv.keys()].filter((k) => k.startsWith(match.slice(0, -1)))],
            get: async (k) => kv.get(k)?.value ?? null,
            ttl: async (k) => kv.get(k)?.ttl ?? -2,
            set: async (k, value, opts) => {
                setCalls.push({ k, opts });
                kv.set(k, { value, ttl: opts?.keepTtl ? kv.get(k).ttl : -1 });
            },
            sadd: async (k, m) => void sets.set(k, new Set([...(sets.get(k) ?? []), m])),
        },
    };
}
const run = (w, flags) => migrateAgreements({ ...w, log: () => {}, ...flags });

test("the preview changes nothing", async () => {
    const w = world();
    const s = await run(w, { write: false, deletePublic: false });
    assert.equal(s.found, 2);
    assert.equal(w.priv.size, 0);
    assert.equal(w.setCalls.length, 0);
    assert.equal(w.pub.size, 2);
});

test("every PDF is copied, a PDF no record points at included", async () => {
    const w = world();
    const s = await run(w, { write: true, deletePublic: false });
    assert.equal(s.copied, 2);
    assert.ok(w.priv.has("agreements/orphan.pdf"));
    assert.equal(w.pub.size, 2, "nothing deleted without --delete-public");
});

test("records and accounts point at the private copy", async () => {
    const w = world();
    await run(w, { write: true, deletePublic: false });
    assert.equal(w.kv.get("agreement:a").value.pdfUrl, PRIVATE("agreements/a.pdf"));
    assert.equal(w.kv.get("jdd:account:o").value.sites[0].agreementPdfUrl, PRIVATE("agreements/a.pdf"));
});

test("a rewrite keeps the record's expiry, so a draft is not made to look paid", async () => {
    const w = world();
    w.pub.set(PUBLIC("draft"), new Uint8Array([5]));
    await run(w, { write: true, deletePublic: false });
    assert.equal(w.kv.get("agreement:draft").ttl, 500);
    assert.equal(w.setCalls.find((c) => c.k === "agreement:draft").opts.keepTtl, true);
});

test("only a paid agreement joins its account's list", async () => {
    const w = world();
    await run(w, { write: true, deletePublic: false });
    assert.deepEqual([...w.sets.get("agreements:account:owner@example.test")], ["a"]);
    assert.equal(w.sets.has("agreements:account:o@x.test"), false);
});

test("a private copy that doesn't match is reported, and the public copy is kept", async () => {
    const w = world({ corrupt: true });
    const s = await run(w, { write: true, deletePublic: true });
    assert.equal(s.deleted, 0);
    assert.equal(s.failed.length, 2);
    assert.equal(w.pub.size, 2);
    assert.equal(w.kv.get("agreement:a").value.pdfUrl, PUBLIC("a"));
});

test("--delete-public removes the verified public copies", async () => {
    const w = world();
    const s = await run(w, { write: true, deletePublic: true });
    assert.equal(s.deleted, 2);
    assert.equal(w.pub.size, 0);
    assert.deepEqual(s.stillPublic, []);
});

test("a public link that still answers after deletion is reported", async () => {
    const w = world();
    w.publicStore.stillServes = async () => true;
    const s = await run(w, { write: true, deletePublic: true });
    assert.equal(s.stillPublic.length, 2);
});
