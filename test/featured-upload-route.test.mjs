/**
 * `/api/portal/featured/upload` stores a client's own showcase image. The proxy required sign-in,
 * but any signed-in Clerk user could store a file: no portal account or site check, no rate
 * limit, a client-declared type, and one shared path. Xander, 2026-11-11: harden it the same way
 * as /api/upload. These run the real route against stubbed Clerk, account lookup, rate limiter,
 * Blob and resize (test/upload-route-hook.mjs).
 *
 * Run: `npm test`
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);
register("./upload-route-hook.mjs", import.meta.url);

const { POST } = await import("../app/api/portal/featured/upload/route.ts");

const ACCOUNT = { email: "owner@ridgelineair.test", clerkUserId: "user_owner", sites: [{ slug: "ridgeline-air", status: "live", plan: "growth" }], createdAt: 1, updatedAt: 1 };
const OTHER = { email: "someone@else.test", clerkUserId: "user_other", sites: [{ slug: "other-site", status: "live", plan: "starter" }], createdAt: 1, updatedAt: 1 };

beforeEach(() => {
    globalThis.__uploadRoute = { userId: null, accounts: { user_owner: ACCOUNT, user_other: OTHER }, hits: {}, limit: 1000, issued: [], completed: [], puts: [] };
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 8, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

function uploadRequest({ bytes = PNG, type = "image/png", name = "showcase.png", site = "ridgeline-air" } = {}) {
    const form = new FormData();
    form.append("file", new File([bytes], name, { type }));
    return new Request(`https://www.juneaudigitaldesigns.com/api/portal/featured/upload${site ? `?site=${encodeURIComponent(site)}` : ""}`, { method: "POST", body: form });
}

test("signed out: refused with 401, nothing stored", async () => {
    const res = await POST(uploadRequest());
    assert.equal(res.status, 401);
    assert.equal(globalThis.__uploadRoute.puts.length, 0);
});

test("signed in with no portal account: refused with 403", async () => {
    globalThis.__uploadRoute.userId = "user_stranger";
    const res = await POST(uploadRequest());
    assert.equal(res.status, 403);
    assert.equal(globalThis.__uploadRoute.puts.length, 0);
});

test("signed in to a different account than the site's: refused with 403", async () => {
    globalThis.__uploadRoute.userId = "user_other";
    const res = await POST(uploadRequest({ site: "ridgeline-air" }));
    assert.equal(res.status, 403);
    assert.equal(globalThis.__uploadRoute.puts.length, 0);
});

test("the right account stores under its own path", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    for (const [bytes, type, name] of [[PNG, "image/png", "a.png"], [JPEG, "image/jpeg", "b.jpg"], [WEBP, "image/webp", "c.webp"]]) {
        const res = await POST(uploadRequest({ bytes, type, name }));
        assert.equal(res.status, 200, name);
    }
    const paths = globalThis.__uploadRoute.puts.map((p) => p.pathname);
    for (const p of paths) assert.match(p, /^featured\/[0-9a-f]{16}\/ridgeline-air\/[^/]+$/);
    assert.ok(paths.every((p) => !p.includes("owner@")), "the account's email never appears in the public URL");
    assert.ok(globalThis.__uploadRoute.puts.every((p) => p.options.addRandomSuffix === true && p.options.contentType === "image/webp"));
});

test("a file whose bytes are not an image is refused, whatever type it claims", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    for (const [bytes, type, name] of [[SVG, "image/png", "logo.png"], [new TextEncoder().encode("hello"), "image/jpeg", "x.jpg"], [SVG, "image/svg+xml", "logo.svg"]]) {
        const res = await POST(uploadRequest({ bytes, type, name }));
        assert.equal(res.status, 400, `${name} as ${type}`);
    }
    assert.equal(globalThis.__uploadRoute.puts.length, 0);
});

test("an oversized file is refused", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    const big = new Uint8Array(8_388_609);
    big.set(PNG);
    const res = await POST(uploadRequest({ bytes: big }));
    assert.equal(res.status, 400);
    assert.equal(globalThis.__uploadRoute.puts.length, 0);
});

test("the per-user rate limit trips with 429", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    globalThis.__uploadRoute.limit = 2;
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await POST(uploadRequest())).status);
    assert.deepEqual(statuses, [200, 200, 429]);
    assert.equal(globalThis.__uploadRoute.puts.length, 2);
});
