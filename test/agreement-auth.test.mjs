/**
 * `/api/agreement` is for signed-in clients only.
 *
 * Runs the real `POST` handler, with its side effects swapped for recorders by
 * `agreement-route-hook.mjs`. Found 2026-11-04 during a Stripe test run: the route rendered,
 * stored and emailed a signed agreement for any caller, signed in or not, to whatever address
 * the body named. On that code the first test fails: it answers 200 and calls `put`,
 * `saveAgreement` and the client email.
 *
 * The last test is the control. It shows the stubs are wired to the route, so the empty call
 * lists in the refusal tests mean "never reached", not "not recorded".
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
register("./agreement-route-hook.mjs", import.meta.url);

process.env.AGREEMENTS_BLOB_READ_WRITE_TOKEN = "private-store-token";

const { POST } = await import("../app/api/agreement/route.ts");

const NOW = new Date().toISOString();
const ACCOUNT = { email: "marisol@riverapd.example", sites: [], createdAt: 0, updatedAt: 0 };

/** A valid Growth submission, the same shape the agreement page sends. */
function submission(overrides = {}) {
  return {
    plan: "growth",
    clientLegalName: "Rivera Plumbing & Drain LLC",
    clientEntityType: "LLC",
    clientAddress: "1420 Example Ave, Orlando, FL 32801",
    signerName: "Marisol Rivera",
    signerTitle: "Owner",
    signerEmail: "marisol@riverapd.example",
    additionalSites: [],
    pageOpenedAt: NOW,
    scrollCompletedAt: NOW,
    receptionistMode: "published",
    termsAccepted: true,
    ...overrides,
  };
}

function post(body) {
  return POST(
    new Request("http://localhost/api/agreement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

/** The side effects a refused request must never reach. */
const SIDE_EFFECTS = ["generateSignedPdf", "put", "saveAgreement", "saveAccount", "after", "sendClientAgreementEmail"];

let state;
beforeEach(() => {
  state = {
    userId: null,
    accounts: {},
    calls: [],
    afterTasks: [],
    savedAgreements: [],
    savedAccounts: [],
    emailsTo: [],
  };
  globalThis.__agreementRoute = state;
});

test("a signed-out POST gets 401 and never renders, stores or emails anything", async () => {
  const res = await post(submission({ signerEmail: "anyone@elsewhere.example" }));

  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: "Sign in to continue" });
  assert.deepEqual(state.calls, ["auth"]);
  for (const call of SIDE_EFFECTS) assert.ok(!state.calls.includes(call), `${call} was reached`);
  assert.deepEqual(state.emailsTo, []);
});

test("a signed-out POST is refused before the body is read, even an invalid one", async () => {
  // The 2026-11-04 probe: an empty body used to reach validation and come back "Invalid plan".
  for (const body of ["{}", "not json"]) {
    state.calls = [];
    const res = await post(body);
    assert.equal(res.status, 401, `body ${body}`);
    assert.deepEqual(state.calls, ["auth"]);
  }
});

test("a signed-in login with no account is refused with 403 and reaches nothing", async () => {
  state.userId = "user_no_account";

  const res = await post(submission());

  assert.equal(res.status, 403);
  assert.deepEqual(state.calls, ["auth", "resolveAccountForUser"]);
  for (const call of SIDE_EFFECTS) assert.ok(!state.calls.includes(call), `${call} was reached`);
});

test("control: a signed-in client with an account signs, and the master lands on that account", async () => {
  state.userId = "user_rivera";
  state.accounts.user_rivera = ACCOUNT;

  const res = await post(submission());
  assert.equal(res.status, 200);
  const { agreement_id } = await res.json();

  // One account lookup, up front. The master is recorded on that same account rather than
  // asking Clerk a second time.
  assert.equal(state.calls.filter((c) => c === "auth").length, 1);
  assert.equal(state.calls.filter((c) => c === "resolveAccountForUser").length, 1);
  for (const call of ["generateSignedPdf", "put", "saveAgreement", "saveAccount", "after"]) {
    assert.ok(state.calls.includes(call), `${call} was not reached`);
  }
  assert.equal(state.savedAgreements[0].id, agreement_id);
  assert.equal(state.savedAccounts[0].email, ACCOUNT.email);
  assert.equal(state.savedAccounts[0].masterAgreement.agreementId, agreement_id);

  await Promise.all(state.afterTasks.map((fn) => fn()));
  assert.deepEqual(state.emailsTo, ["marisol@riverapd.example"]);
});
