/**
 * A brand-new client's first purchase goes through without a reload, and their API calls are
 * never answered "Sign in to continue".
 *
 * F2 from the 2026-11-04 Stripe test run, seen on both fresh sign-ups:
 *   1. Clerk finished sign-up with a client-side push from `/portal/sign-up` (the only layout
 *      with Clerk mounted) to `/start`, which redirects to `/agreement`. The transition never
 *      finished; a reload, which is a full page load, fixed it.
 *   2. `/agreement` had no Clerk on it, so nothing renewed the 60-second session token while the
 *      buyer read the terms. Clerk's middleware renews an expired token only on a page load, not
 *      on a POST, so `/api/checkout` answered 401 four seconds after the agreement saved. Since
 *      #55 `/api/agreement` makes the same check, and would refuse first.
 *
 * The last test shows (2) against the installed Clerk with a locally signed token: an expired
 * cookie on a POST is signed out, and a fresh Bearer token on the same POST is signed in. It
 * passes on any code; it pins the behaviour the fix relies on. On the code before this change,
 * every other test fails.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { generateKeyPairSync, createSign, randomUUID } from "node:crypto";
import { register } from "node:module";

register("./ts-hooks.mjs", import.meta.url);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ---------------------------------------------------------------------------------------------
// 1. After sign-up, the funnel starts with a full page load.

test("sign-up and sign-in send funnel destinations through the full-page hop", async () => {
  const { postAuthRedirect, POST_AUTH_HOP } = await import("../app/lib/post-auth-redirect.ts");

  assert.equal(POST_AUTH_HOP, "/portal/continue");
  assert.equal(
    postAuthRedirect("/start?plan=starter&period=monthly"),
    "/portal/continue?to=%2Fstart%3Fplan%3Dstarter%26period%3Dmonthly",
  );
  // Portal destinations stay a client-side push inside the portal layout, which works.
  for (const p of ["/portal", "/portal?site=rivera", "/portal/billing"]) {
    assert.equal(postAuthRedirect(p), p);
  }
  // A lookalike prefix is not the portal.
  assert.equal(postAuthRedirect("/portalx"), "/portal/continue?to=%2Fportalx");

  for (const page of [
    "app/portal/sign-up/[[...sign-up]]/page.tsx",
    "app/portal/sign-in/[[...sign-in]]/page.tsx",
  ]) {
    const src = read(page);
    assert.match(src, /forceRedirectUrl=\{postAuthRedirect\(redirectUrl\)\}/, page);
    assert.doesNotMatch(src, /forceRedirectUrl=\{redirectUrl\}/, page);
  }
});

test("the hop page is reachable straight after sign-up and leaves by a full page load", () => {
  assert.ok(existsSync(new URL("../app/portal/continue/page.tsx", import.meta.url)));

  // Not behind auth.protect(): it is part of the sign-in flow, like the sign-in pages.
  const proxy = read("proxy.ts");
  const authRoutes = proxy.match(/const isAuthRoute = createRouteMatcher\(\[([\s\S]*?)\]\)/);
  assert.ok(authRoutes, "isAuthRoute matcher not found");
  assert.match(authRoutes[1], /"\/portal\/continue\(\.\*\)"/);

  const client = read("app/components/portal/ContinueAfterAuth.tsx");
  assert.match(client, /useAuth\(\)/);
  assert.match(client, /window\.location\.replace\(to\)/);
  // A Next router transition here would be the same kind of hand-off that stalled.
  assert.doesNotMatch(client, /useRouter|router\.(push|replace)/);
});

// ---------------------------------------------------------------------------------------------
// 2. The agreement page's API calls carry a fresh session token.

test("the agreement page mounts Clerk, and every API call on it goes through sessionFetch", () => {
  const layout = read("app/agreement/layout.tsx");
  assert.match(layout, /<ClerkProvider[\s>]/);

  const client = read("app/components/agreement/AgreementClient.tsx");
  assert.match(client, /makeSessionFetch\(getToken\)/);
  const apiCalls = [...client.matchAll(/await\s+(\w+)\(\s*[`"]\/api\//g)].map((m) => m[1]);
  assert.ok(apiCalls.length >= 3, `found ${apiCalls.length} API calls`);
  assert.deepEqual([...new Set(apiCalls)], ["sessionFetch"]);
});

test("sessionFetch sends the session token as a Bearer header", async () => {
  const { makeSessionFetch } = await import("../app/lib/session-fetch.ts");
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, auth: new Headers(init.headers).get("authorization"), type: new Headers(init.headers).get("content-type"), body: init.body });
    return new Response("{}", { status: 200 });
  };
  const sessionFetch = makeSessionFetch(async () => "tok_fresh", fetchImpl);

  const res = await sessionFetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"plan":"starter"}',
  });
  assert.equal(res.status, 200);
  assert.deepEqual(seen, [
    { url: "/api/checkout", auth: "Bearer tok_fresh", type: "application/json", body: '{"plan":"starter"}' },
  ]);
});

test("sessionFetch retries a 401 once with a token Clerk does not take from its cache", async () => {
  const { makeSessionFetch } = await import("../app/lib/session-fetch.ts");
  const tokenCalls = [];
  const getToken = async (opts) => {
    tokenCalls.push(opts?.skipCache === true);
    return opts?.skipCache ? "tok_new" : "tok_stale";
  };
  const auths = [];
  const fetchImpl = async (_url, init) => {
    const auth = new Headers(init.headers).get("authorization");
    auths.push(auth);
    return new Response("{}", { status: auth === "Bearer tok_new" ? 200 : 401 });
  };

  const res = await makeSessionFetch(getToken, fetchImpl)("/api/agreement", { method: "POST", body: "{}" });
  assert.equal(res.status, 200);
  assert.deepEqual(tokenCalls, [false, true]);
  assert.deepEqual(auths, ["Bearer tok_stale", "Bearer tok_new"]);

  // A session that has really ended is reported, not retried forever.
  const ended = makeSessionFetch(async () => null, async () => new Response("{}", { status: 401 }));
  assert.equal((await ended("/api/checkout", { method: "POST" })).status, 401);
});

test("sessionFetch still sends the request when Clerk has no token to give", async () => {
  const { makeSessionFetch } = await import("../app/lib/session-fetch.ts");
  let auth = "unset";
  const res = await makeSessionFetch(
    async () => {
      throw new Error("clerk not loaded");
    },
    async (_url, init) => {
      auth = new Headers(init.headers).get("authorization");
      return new Response("{}", { status: 200 });
    },
  )("/api/checkout", { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(auth, null);
});

// ---------------------------------------------------------------------------------------------
// The mechanism, against the installed Clerk.

test("Clerk treats a POST with an expired session cookie as signed out, and a fresh Bearer token as signed in", async () => {
  const { createClerkClient } = await import("@clerk/backend");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwtKey = publicKey.export({ type: "spki", format: "pem" }).toString();

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  function sessionToken(issuedSecondsAgo) {
    const iat = Math.floor(Date.now() / 1000) - issuedSecondsAgo;
    const header = b64({ alg: "RS256", typ: "JWT", kid: "ins_test" });
    // Clerk's default session token lifetime: 60 seconds.
    const payload = b64({
      sub: "user_newbuyer",
      sid: `sess_${randomUUID()}`,
      iss: "https://clerk.example.com",
      iat,
      nbf: iat - 5,
      exp: iat + 60,
    });
    const sig = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKey).toString("base64url");
    return { token: `${header}.${payload}.${sig}`, iat };
  }

  const clerk = createClerkClient({
    secretKey: "sk_live_test_only",
    publishableKey: `pk_live_${Buffer.from("clerk.example.com$").toString("base64")}`,
  });
  const authenticate = (headers) =>
    clerk.authenticateRequest(
      new Request("https://www.example.com/api/checkout", { method: "POST", headers }),
      { jwtKey },
    );

  // Signed up three minutes ago and read the agreement since, on a page with no clerk-js.
  const stale = sessionToken(180);
  const cookie = `__session=${stale.token}; __client_uat=${stale.iat}`;
  const before = await authenticate({ cookie, "sec-fetch-dest": "empty", accept: "*/*" });
  assert.equal(before.isSignedIn, false, "an expired cookie on a POST should be signed out (the 401)");

  // The fix: the page asks clerk-js for a current token and sends it as a header.
  const fresh = sessionToken(1);
  const after = await authenticate({
    cookie,
    authorization: `Bearer ${fresh.token}`,
    "sec-fetch-dest": "empty",
    accept: "*/*",
  });
  assert.equal(after.isSignedIn, true, after.message ?? after.reason);
  assert.equal(after.toAuth().userId, "user_newbuyer");
});
