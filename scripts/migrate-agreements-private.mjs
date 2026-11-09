#!/usr/bin/env node
/**
 * Move signed agreement PDFs from the public Blob store to the private one.
 *
 *   node --env-file=<env> scripts/migrate-agreements-private.mjs                  # preview only
 *   node --env-file=<env> scripts/migrate-agreements-private.mjs --write          # copy, verify, rewrite records
 *   node --env-file=<env> scripts/migrate-agreements-private.mjs --write --delete-public
 *
 * Needs BLOB_READ_WRITE_TOKEN (public store), AGREEMENTS_BLOB_READ_WRITE_TOKEN (private store),
 * KV_REST_API_URL and KV_REST_API_TOKEN.
 *
 * Copies every blob under `agreements/`, including PDFs no record points at any more, because a
 * signed contract is not this script's to discard. A public copy is deleted only after the
 * private copy has been read back and its SHA-256 matches. Safe to re-run.
 *
 * Prints ids and counts only. These files are clients' contracts.
 *
 * Exit codes: 0 finished · 1 something failed verification · 2 missing config
 */
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isPublicUrl = (url) => typeof url === "string" && url.includes(".public.blob.vercel-storage.com/");

/** Every key matching `match`, across all SCAN pages. */
async function scanAll(redis, match) {
    const keys = [];
    let cursor = "0";
    do {
        const [next, page] = await redis.scan(cursor, { match, count: 200 });
        keys.push(...page);
        cursor = String(next);
    } while (cursor !== "0");
    return keys;
}

/**
 * The migration itself, on injected stores so a test can run the real logic.
 *
 * `set` passes `keepTtl`, which matters: `agreementIsPaid` reads "no expiry" as "paid", so a
 * rewrite that dropped the TTL would turn every abandoned draft into a paid agreement.
 */
export async function migrateAgreements({ publicStore, privateStore, redis, write, deletePublic, log = console.log }) {
    const summary = { found: 0, copied: 0, failed: [], records: 0, accounts: 0, indexed: 0, deleted: 0, stillPublic: [] };
    const verified = new Map(); // pathname -> { url, publicUrl }

    const blobs = await publicStore.list("agreements/");
    summary.found = blobs.length;

    for (const blob of blobs) {
        if (!write) continue;
        try {
            const bytes = await publicStore.read(blob.url);
            const url = await privateStore.write(blob.pathname, bytes);
            const back = await privateStore.read(blob.pathname);
            if (sha256(back) !== sha256(bytes)) throw new Error("private copy differs");
            verified.set(blob.pathname, { url, publicUrl: blob.url });
            summary.copied += 1;
        } catch (e) {
            summary.failed.push(blob.pathname);
            log(`  ✗ ${blob.pathname}: ${e.message}`);
        }
    }

    const urlFor = (id) => verified.get(`agreements/${id}.pdf`)?.url;

    for (const key of await scanAll(redis, "agreement:*")) {
        const record = await redis.get(key);
        if (!record?.id) continue;
        const url = urlFor(record.id);
        if (write && url && isPublicUrl(record.pdfUrl)) {
            await redis.set(key, { ...record, pdfUrl: url }, { keepTtl: true });
            summary.records += 1;
        }
        // A paid agreement signed through the portal joins its account's list.
        if (write && record.accountEmail && (await redis.ttl(key)) === -1) {
            await redis.sadd(`agreements:account:${record.accountEmail.trim().toLowerCase()}`, record.id);
            summary.indexed += 1;
        }
    }

    for (const key of await scanAll(redis, "jdd:account:*")) {
        const account = await redis.get(key);
        if (!account?.sites?.some((s) => isPublicUrl(s.agreementPdfUrl))) continue;
        const sites = account.sites.map((s) =>
            isPublicUrl(s.agreementPdfUrl) && urlFor(s.agreementId) ? { ...s, agreementPdfUrl: urlFor(s.agreementId) } : s,
        );
        if (write) {
            await redis.set(key, { ...account, sites });
            summary.accounts += 1;
        }
    }

    if (write && deletePublic) {
        for (const { publicUrl } of verified.values()) {
            await publicStore.remove(publicUrl);
            summary.deleted += 1;
            if (await publicStore.stillServes(publicUrl)) summary.stillPublic.push(publicUrl);
        }
    }

    return summary;
}

async function main() {
    const write = process.argv.includes("--write");
    const deletePublic = process.argv.includes("--delete-public");
    const publicToken = process.env.BLOB_READ_WRITE_TOKEN;
    const privateToken = process.env.AGREEMENTS_BLOB_READ_WRITE_TOKEN;
    if (!publicToken || !privateToken || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.error("Missing BLOB_READ_WRITE_TOKEN, AGREEMENTS_BLOB_READ_WRITE_TOKEN or KV_REST_API_*");
        process.exit(2);
    }
    if (deletePublic && !write) {
        console.error("--delete-public needs --write: a public copy is deleted only after its private copy is verified.");
        process.exit(2);
    }

    const { list, put, get, del } = await import("@vercel/blob");
    const { Redis } = await import("@upstash/redis");

    const publicStore = {
        async list(prefix) {
            const all = [];
            let cursor;
            do {
                const page = await list({ prefix, cursor, token: publicToken });
                all.push(...page.blobs);
                cursor = page.hasMore ? page.cursor : undefined;
            } while (cursor);
            return all;
        },
        async read(url) {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`public read ${res.status}`);
            return new Uint8Array(await res.arrayBuffer());
        },
        remove: (url) => del(url, { token: publicToken }),
        async stillServes(url) {
            const res = await fetch(url, { cache: "no-store" });
            await res.arrayBuffer();
            return res.ok;
        },
    };
    const privateStore = {
        async write(pathname, bytes) {
            const { url } = await put(pathname, Buffer.from(bytes), {
                access: "private",
                contentType: "application/pdf",
                allowOverwrite: true,
                token: privateToken,
            });
            return url;
        },
        async read(pathname) {
            const result = await get(pathname, { access: "private", token: privateToken, useCache: false });
            if (!result?.stream) throw new Error("private read failed");
            return new Uint8Array(await new Response(result.stream).arrayBuffer());
        },
    };

    const summary = await migrateAgreements({
        publicStore,
        privateStore,
        redis: new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }),
        write,
        deletePublic,
    });
    console.log(write ? "Done." : "Preview only. Nothing changed. Pass --write to copy.");
    console.log(JSON.stringify({ ...summary, stillPublic: summary.stillPublic.length }, null, 2));
    process.exit(summary.failed.length || summary.stillPublic.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
