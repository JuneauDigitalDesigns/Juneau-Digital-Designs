/**
 * `/api/upload` issues the Vercel Blob client tokens the onboarding wizard uploads photos with.
 * It used to issue one to anyone, signed in or not, so anyone could write into the public Blob
 * store. Xander, 2026-11-11: "Yes, fix it." These run the real route handler against stubbed
 * Clerk, account lookup, rate limiter and Blob (test/upload-route-hook.mjs).
 *
 * Run: `npm test`
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);
register("./upload-route-hook.mjs", import.meta.url);

const { POST } = await import("../app/api/upload/route.ts");

const ACCOUNT = {
    email: "owner@ridgelineair.test",
    clerkUserId: "user_owner",
    sites: [{ slug: "ridgeline-air", status: "pending-onboarding", plan: "growth" }],
    createdAt: 1,
    updatedAt: 1,
};
const OTHER = {
    email: "someone@else.test",
    clerkUserId: "user_other",
    sites: [{ slug: "other-site", status: "pending-onboarding", plan: "starter" }],
    createdAt: 1,
    updatedAt: 1,
};

beforeEach(() => {
    globalThis.__uploadRoute = {
        userId: null,
        accounts: { user_owner: ACCOUNT, user_other: OTHER },
        hits: {},
        limit: 1000,
        issued: [],
        completed: [],
    };
});

const tokenRequest = (pathname, site = "ridgeline-air") =>
    new Request(`https://www.juneaudigitaldesigns.com/api/upload${site ? `?site=${encodeURIComponent(site)}` : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "blob.generate-client-token", payload: { pathname, callbackUrl: "https://x.test/api/upload", clientPayload: null, multipart: false } }),
    });

test("signed out: refused with 401 and no token issued", async () => {
    const res = await POST(tokenRequest("IMG_0001.jpg"));
    assert.equal(res.status, 401);
    assert.equal(globalThis.__uploadRoute.issued.length, 0);
});

test("signed in with no portal account: refused with 403", async () => {
    globalThis.__uploadRoute.userId = "user_stranger";
    const res = await POST(tokenRequest("IMG_0001.jpg"));
    assert.equal(res.status, 403);
    assert.equal(globalThis.__uploadRoute.issued.length, 0);
});

test("signed in to a different account than the site's: refused with 403", async () => {
    globalThis.__uploadRoute.userId = "user_other";
    const res = await POST(tokenRequest("IMG_0001.jpg", "ridgeline-air"));
    assert.equal(res.status, 403);
    assert.equal(globalThis.__uploadRoute.issued.length, 0);
});

test("the right account gets a token: images only, 10 MB, under its own path", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    const res = await POST(tokenRequest("../../evil/IMG_0001.jpg"));
    assert.equal(res.status, 200);
    const [opts] = globalThis.__uploadRoute.issued;
    assert.deepEqual([...opts.allowedContentTypes].sort(), ["image/jpeg", "image/png", "image/webp"]);
    assert.equal(opts.maximumSizeInBytes, 10_485_760);
    assert.equal(opts.addRandomSuffix, true);
    assert.match(opts.pathname, /^onboarding\/[0-9a-f]{16}\/ridgeline-air\/IMG_0001\.jpg$/);
    assert.ok(!opts.pathname.includes("owner@"), "the account's email never appears in the public URL");
});

test("each account gets its own path prefix", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    await POST(tokenRequest("a.jpg"));
    globalThis.__uploadRoute.userId = "user_other";
    await POST(tokenRequest("a.jpg", "other-site"));
    const [a, b] = globalThis.__uploadRoute.issued.map((o) => o.pathname.split("/")[1]);
    assert.notEqual(a, b);
});

test("non-image and SVG names are refused before a token is issued", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    for (const name of ["logo.svg", "page.html", "script.js", "notes.txt", "noextension"]) {
        const res = await POST(tokenRequest(name));
        assert.equal(res.status, 400, name);
    }
    assert.equal(globalThis.__uploadRoute.issued.length, 0);
});

test("anything but a token request is refused (no upload-completed callback is used)", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    const res = await POST(new Request("https://www.juneaudigitaldesigns.com/api/upload?site=ridgeline-air", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "blob.upload-completed", payload: { blob: { url: "https://x" }, tokenPayload: "{}" } }),
    }));
    assert.equal(res.status, 400);
    assert.equal(globalThis.__uploadRoute.completed.length, 0);
});

test("the per-user rate limit trips with 429", async () => {
    globalThis.__uploadRoute.userId = "user_owner";
    globalThis.__uploadRoute.limit = 3;
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await POST(tokenRequest(`p${i}.jpg`))).status);
    assert.deepEqual(statuses, [200, 200, 200, 429]);
    assert.equal(globalThis.__uploadRoute.issued.length, 3);
});
