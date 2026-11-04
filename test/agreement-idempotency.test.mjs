/**
 * Accepting the same agreement twice files one agreement and sends one email.
 *
 * Runs the real `POST /api/agreement`, with its side effects swapped for recorders by
 * `agreement-route-hook.mjs` (the agreement store and its idempotency slots are in memory).
 *
 * Found 2026-11-04 on the Stripe test run (F2): checkout failed after the agreement saved, the
 * client went back through `/pricing` and accepted again, and that produced a second agreement
 * record and a second agreement email for one purchase. On the code before this change the first
 * two tests fail: each acceptance renders, stores and emails its own agreement.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
register("./agreement-route-hook.mjs", import.meta.url);

const { POST } = await import("../app/api/agreement/route.ts");

const ACCOUNT = { email: "marisol@riverapd.example", sites: [], createdAt: 0, updatedAt: 0 };

/** A valid Starter submission, the shape the agreement page sends, opened at `openedAt`. */
function submission(overrides = {}, openedAt = new Date().toISOString()) {
  return {
    plan: "starter",
    clientLegalName: "Rivera Plumbing & Drain LLC",
    clientEntityType: "LLC",
    clientAddress: "1420 Example Ave, Orlando, FL 32801",
    signerName: "Marisol Rivera",
    signerTitle: "Owner",
    signerEmail: "marisol@riverapd.example",
    additionalSites: [],
    billingPeriod: "monthly",
    pageOpenedAt: openedAt,
    scrollCompletedAt: openedAt,
    receptionistMode: "published",
    termsAccepted: true,
    ...overrides,
  };
}

async function accept(body) {
  const res = await POST(
    new Request("http://localhost/api/agreement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const json = await res.json();
  // Send whatever emails the route queued, as Vercel would after the response.
  const tasks = state.afterTasks.splice(0);
  await Promise.all(tasks.map((fn) => fn()));
  return { status: res.status, ...json };
}

const count = (name) => state.calls.filter((c) => c === name).length;

let state;
beforeEach(() => {
  state = {
    userId: "user_rivera",
    accounts: { user_rivera: ACCOUNT, user_other: { ...ACCOUNT, email: "someone@else.example" } },
    calls: [],
    afterTasks: [],
    savedAgreements: [],
    savedAccounts: [],
    emailsTo: [],
  };
  globalThis.__agreementRoute = state;
});

test("accepting twice for the same purchase files one agreement and sends one email", async () => {
  const first = await accept(submission({}, "2026-11-04T18:00:00.000Z"));
  // The retry from the test run: a fresh visit to the page, so new timestamps, same details.
  const second = await accept(submission({}, "2026-11-04T18:06:00.000Z"));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.agreement_id, first.agreement_id);
  assert.equal(second.pdf_url, first.pdf_url);
  assert.equal(state.savedAgreements.length, 1);
  assert.deepEqual(state.emailsTo, ["marisol@riverapd.example"]);
  assert.equal(count("generateSignedPdf"), 1);
  assert.equal(count("put"), 1);
  // The master is recorded once, by the first acceptance.
  assert.equal(count("saveAccount"), 1);
});

test("a double press, two requests at once, files one agreement and sends one email", async () => {
  const [a, b] = await Promise.all([accept(submission()), accept(submission())]);

  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.agreement_id, b.agreement_id);
  assert.equal(state.savedAgreements.length, 1);
  assert.deepEqual(state.emailsTo, ["marisol@riverapd.example"]);
});

test("whitespace and a capital in the email are the same agreement", async () => {
  const first = await accept(submission());
  const second = await accept(
    submission({ signerEmail: "Marisol@RiveraPD.example", clientLegalName: "Rivera Plumbing & Drain LLC " }),
  );
  assert.equal(second.agreement_id, first.agreement_id);
  assert.equal(state.savedAgreements.length, 1);
});

test("changed details are a new agreement, sent to the address now given", async () => {
  const first = await accept(submission());
  const second = await accept(submission({ signerEmail: "office@riverapd.example" }));

  assert.notEqual(second.agreement_id, first.agreement_id);
  assert.equal(state.savedAgreements.length, 2);
  assert.deepEqual(state.emailsTo, ["marisol@riverapd.example", "office@riverapd.example"]);
});

test("a different plan, period or receptionist choice is a different agreement", async () => {
  const base = await accept(submission());
  for (const change of [
    { plan: "growth" },
    { billingPeriod: "annual" },
    { receptionistMode: "declined" },
  ]) {
    const other = await accept(submission(change));
    assert.equal(other.status, 200, JSON.stringify(change));
    assert.notEqual(other.agreement_id, base.agreement_id, JSON.stringify(change));
  }
  assert.equal(state.savedAgreements.length, 4);
});

test("another account accepting identical details gets its own agreement", async () => {
  const mine = await accept(submission());
  state.userId = "user_other";
  const theirs = await accept(submission());
  assert.notEqual(theirs.agreement_id, mine.agreement_id);
  assert.equal(state.savedAgreements.length, 2);
});

test("once the first agreement is paid for, accepting again is a new agreement", async () => {
  const first = await accept(submission());
  state.paid = new Set([first.agreement_id]);

  const second = await accept(submission());
  assert.notEqual(second.agreement_id, first.agreement_id);
  assert.equal(state.savedAgreements.length, 2);
  assert.equal(state.emailsTo.length, 2);

  // And the new one is now the agreement a further retry returns.
  const third = await accept(submission());
  assert.equal(third.agreement_id, second.agreement_id);
});

test("a failed acceptance does not block the retry: it signs afresh and is saved", async () => {
  state.failPut = 1;
  const failed = await accept(submission());
  assert.equal(failed.status, 500);
  assert.equal(state.savedAgreements.length, 0);

  const retry = await accept(submission());
  assert.equal(retry.status, 200);
  assert.equal(state.savedAgreements.length, 1);
  assert.equal(state.savedAgreements[0].id, retry.agreement_id);
  assert.deepEqual(state.emailsTo, ["marisol@riverapd.example"]);
});

/**
 * The retry the test run actually took. The master is recorded on the account when it is
 * signed, so the client who comes back through `/pricing` after a failed checkout is offered
 * the short addendum against it. Submitting that used to file a second agreement and send a
 * second email for the same purchase.
 */
async function signMasterThenReturn() {
  const master = await accept(submission({}, "2026-11-04T18:00:00.000Z"));
  // What /start and /agreement see next time: the account with that master on it.
  state.accounts.user_rivera = state.savedAccounts.at(-1);
  assert.equal(state.accounts.user_rivera.masterAgreement.agreementId, master.agreement_id);
  return master;
}
const addendumFor = (masterId, overrides = {}) =>
  submission({ kind: "addendum", parentAgreementId: masterId, ...overrides }, "2026-11-04T18:09:00.000Z");

test("coming back after a failed checkout: the addendum against the unpaid master returns the master", async () => {
  const master = await signMasterThenReturn();

  const again = await accept(addendumFor(master.agreement_id));
  assert.equal(again.status, 200);
  assert.equal(again.agreement_id, master.agreement_id);
  assert.equal(state.savedAgreements.length, 1);
  assert.deepEqual(state.emailsTo, ["marisol@riverapd.example"]);
});

test("an addendum against a master that has been paid for is a real addendum", async () => {
  const master = await signMasterThenReturn();
  state.paid = new Set([master.agreement_id]);

  const addendum = await accept(addendumFor(master.agreement_id));
  assert.equal(addendum.status, 200);
  assert.notEqual(addendum.agreement_id, master.agreement_id);
  assert.equal(state.savedAgreements.at(-1).kind, "addendum");
  assert.equal(state.emailsTo.length, 2);

  // And repeating that addendum returns it, not a third agreement.
  const again = await accept(addendumFor(master.agreement_id));
  assert.equal(again.agreement_id, addendum.agreement_id);
  assert.equal(state.savedAgreements.length, 2);
});

test("an addendum with different details from the unpaid master is filed as its own agreement", async () => {
  const master = await signMasterThenReturn();

  const other = await accept(addendumFor(master.agreement_id, { clientLegalName: "Rivera Drain East LLC" }));
  assert.notEqual(other.agreement_id, master.agreement_id);
  assert.equal(state.savedAgreements.length, 2);
});
