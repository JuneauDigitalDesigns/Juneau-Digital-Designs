# HANDOFF — Portal CRM v2 session

**From:** the CRM v2 implementation session
**To:** the orchestrator agent
**Date:** 2026-11-02
**Primary repo:** `juneau-digital-designs` · branch `feat/pricing-2026-10`
**Also touched:** `jdd-schema` (released), `jdd-ops` + `jdd-ops/console` (pins only)

---

## 1. TL;DR

The portal's Call Log was rebuilt into a two-surface CRM: an **Inbox** (triage, every tier) and
**Customers** (pipeline + messaging, Growth/Enterprise only). All five planned phases are
implemented. `tsc --noEmit` clean, ESLint clean on new code, `npm run build` succeeds.

**Nothing in `juneau-digital-designs` is committed.** `jdd-schema` v1.30.0 is committed, tagged
and **pushed**. `jdd-ops` has two local commits (pin bumps) that are **not pushed**.

**Nothing has been run in a browser.** That is the single biggest gap — see §7.

---

## 2. Source-of-truth documents (read these before changing anything)

| File | What it is |
|---|---|
| `PLAN-portal-crm-v2-customers-messaging.md` | **The authoritative plan.** 28 locked decisions, data model, phases, and §9a — a line-level audit of the codebase |
| `design/crm-v2/mockups.html` | **Approved UI spec**, 7 tabs. The build follows these; deviating needs a new mockup |
| `HANDOFF-a2p-onboarding-identity-step.md` | Handed to the A2P agent. **They have since shipped it** (commit `7175ecd`) |
| `PLAN-portal-crm-review-sms.md` | **Superseded** — kept for decision history only. Banner at the top says so |
| `PLAN-portal-starter-tier-copy-fix.md` | Tier-copy fix; the code half is done, one data action outstanding (§6) |
| `PLAN-portal-first-run-tutorial.md` | v1 tutorial plan; superseded in part by v2 plan §4.8 |

Not mine, from parallel sessions: `PLAN-public-tier-capability-copy.md`,
`HANDOFF-tier-capability-copy.md`, `DRAFT-gate-a-wording.md`.

---

## 3. What exists now, by area

### 3.1 `@jdd/schema` v1.30.0 — released and pushed
- `PortalSite.twilioNumber`, `.messagingServiceSid`, `.a2pStatus` (+ zod)
- `A2pStatus` type + `A2P_STATUSES`
- `PortalFeature` widened: `calls | traffic | performance | **leads | crm | messaging**`
- `FEATURE_REQUIREMENT` → `Partial<Record<…>>` with a guarded lookup
- `WebLead` type in new `src/lead.ts`
- 276 tests pass (24 new gate-matrix cases in `test/crm-gates.test.mjs`)
- **All three consumers pinned + installed at v1.30.0.**

### 3.2 Gate semantics (the thing most likely to be misread)
```
leads      = site live.                      Every tier, including web-only. No required id.
crm        = site live + growth/enterprise.  Deliberately NOT gated on airtableBaseId.
messaging  = crm + a2pStatus === "verified". The 13–20 business-day carrier wait.
```
`a2pStatus === "failed"` maps to **`connecting`**, not a new state — `FeatureAvailability` has
exactly four variants and every consumer switches exhaustively. Registration failures surface to
the operator in the console, not to the client.

### 3.3 Portal — new files
```
app/lib/portal-crm.ts            REWRITTEN. v2 customer model, activity, tasks, messages,
                                 number→site index, review records. New `v2` key namespace.
app/lib/crm-contacts.ts          REPURPOSED. Inbox assembly + form↔callback collapse.
app/api/portal/inbox/            GET — calls + web leads, newest first
app/api/portal/customers/        GET list · POST promote-or-create · PATCH update
app/api/portal/customers/[id]/   GET full record (folds in calls + messages, marks read)
app/api/portal/tasks/            POST create / toggle
app/api/portal/messages/         POST send (gated on `messaging`)
app/api/webhooks/twilio-status/  delivery callbacks
app/components/portal/InboxSection.tsx
app/components/portal/crm/{stages.ts,CustomersSection.tsx,CustomerDrawer.tsx,StarterShowcase.tsx}
app/components/portal/tour/{TourController.tsx,steps.ts,showcase.ts,tour-theme.css}
app/portal/(dash)/customers/page.tsx
```

### 3.4 Portal — modified
`twilio.ts` (required lane), `twilio-sms` webhook (inbound threading + routing),
`review-request` route (messaging gate + customer lane), `review-request.ts` (reads real
fields), `ui/Drawer.tsx` (`width`/`padded`/`surface` props), `ui/FeatureState.tsx` (copy for 3
new features + a messaging-specific `connecting` panel), `portal/types.ts` (nav),
`PortalChrome.tsx` (icons, tour tier, Help button), `(dash)/layout.tsx`, `(dash)/calls/page.tsx`.

**Deleted:** `app/api/portal/crm/` (v1), `CrmBoard.tsx`, `CrmView.tsx`, `ViewToggle.tsx`.

---

## 4. Decisions worth not re-litigating

1. **Promotion-only CRM.** Customers exist because the client deliberately promoted an inbox
   item or added one by hand. v1 auto-created a card per caller — that is a call tracker with
   stages, not a CRM. The inbound SMS webhook deliberately does **not** auto-create customers
   for the same reason.
2. **Drawer, not modal.** Research is consistent that side-sheets beat modals for record detail
   in dense workspaces. The v1 complaint was that it was 380px and overstuffed — fixed by width
   (520/760) and a two-column layout, not by changing pattern.
3. **`sendSms` lane is a required argument.** An optional override is one forgotten parameter
   away from sending customer traffic on the account campaign — which produces no error and
   surfaces weeks later as carrier filtering. Both existing callers were found by the compiler.
4. **Owner reply alerts carry the fact, not the message body.** The portal is where the
   conversation happens; the alert's job is to get them there.
5. **Calls are folded into the timeline on read, never copied.** Copying would let an upstream
   edit silently disagree with the record.
6. **Staleness and unread are derived, never stored.** They cannot go stale against the record.
7. **`stageChangedAt` only moves on a real stage change** — editing a note must not make an
   eight-day-old quote look freshly worked.
8. **Mobile bar swapped Traffic → Customers.** Four slots is a hard ceiling; the bar is for what
   a client opens the portal *to do*.

---

## 5. Cross-session state — important

Two other sessions committed to this branch **during** mine:

| Commit | What |
|---|---|
| `7175ecd` | A2P identity onboarding step, zero-retention submit-and-consume — **the handoff I wrote was executed** |
| `0f3c8c7` | tier-capability copy, two-lane SMS terms, consent v2 |

And the **form-capture session's work has landed uncommitted**: `app/lib/portal-leads.ts` and
`app/api/ingest/lead/route.ts` now exist, and someone wired `listLeads()` into my
`/api/portal/inbox` route with independent per-source error degradation.

✅ **I verified this integration: `tsc` passes, and their `WebLead` matches my `WebLeadLike`
structurally.** The Inbox is now genuinely fed by both calls and web-form leads.

**Consequence:** the §1.4 "tolerate leads being absent" caveat in the plan is now resolved. The
form↔callback collapse (plan §1.5) is live and worth smoke-testing first, since it is the one
piece of logic that depends on both sources at once.

---

## 6. Outstanding actions (not code)

1. **Tesco test client shows "Growth".** Root-caused: `onboard.js:300` faithfully reads
   `CONTENT._meta.selectedPlan`, so the client's schema literally says `growth`. Fix the data,
   not the code.
2. **`jdd-ops` has 2 unpushed commits** (`189636e`, `50b5483` — schema pin bumps) on
   `feat/onboard-wizard-redesign`. I did not push: another session may be on that branch.
3. **`googleReviewUrl` has no population path yet.** The field ships in v1.29.0 and the portal
   reads it, but the console manage-route field + onboarding capture were never built. Until
   then every review composer shows "contact Juneau Digital Designs".
4. **A2P per-client registration** must actually run before any customer SMS works.

---

## 7. Known gaps — be honest about these

- 🔴 **Nothing has been run in a browser.** Build/types/lint pass. The riskiest untested areas:
  **driver.js tour timing** (it clicks a card and polls for the drawer), **drag-and-drop** on the
  board, and the **inbound SMS webhook** (needs a real Twilio POST).
- 🔴 **Messaging is inert** until a client's A2P campaign verifies. Cannot be meaningfully
  tested before that.
- 🟡 **Bulk multi-select actions not built.** Plan decision #22 listed them; filters cover the
  real use case and I did not want to ship a bulk UI next to messaging unreviewed.
- 🟡 **File attachments** are in the plan and the `Activity` model but have **no upload UI**.
  `@vercel/blob` is a dependency and unused.
- 🟡 **`CallsSection.tsx` is now unreferenced.** It holds the call-volume chart, outcomes donut
  and **usage meter** — the Inbox does not replace that analytics. I kept it rather than
  silently dropping a client's minute-allowance view. **Decide:** surface it as a secondary view,
  move the usage meter to Overview, or delete.
- 🟡 **No unit tests for the portal CRM.** `crm-contacts.ts`'s collapse logic is pure and the
  obvious first candidate; the plan called for it and I did not get to it.
- 🟡 Teardown does not purge `portal:crm:v2:*` or `portal:number-owner:v1:*`. The latter is a
  **correctness bug**: a recycled Twilio number would route a stranger's SMS into an old
  client's thread.

---

## 8. Mistakes made in this session (so they are not repeated)

1. **Three mockup revisions lost to a wrong theme.** I styled against `globals.css` `:root`
   (the beige marketing theme) when the portal runs a separate **`.portal-scope`** block at
   `globals.css:3041` — different surfaces, different accent, *different fonts*. Always read
   `.portal-scope`.
2. **Misdiagnosed a CSS collision twice.** Inbox rows rendered as blue pills because the board's
   standalone `.unread` badge class matched the row modifier `class="irow unread"`. The user
   described it accurately on the first report and I rewrote the layout twice before inspecting
   why only *those* rows differed. **Lesson: when a subset of items renders wrong, find what
   distinguishes them before redesigning.**
3. **Shipped an incomplete schema release.** Cut v1.29.0 and re-pinned only the agency site,
   leaving `jdd-ops` and the console on v1.28.0 — which silently blocked the console from
   reaching the very field the release added. Another agent caught it. The 6-step release
   checklist now lives in plan §1.3; a plain `npm install` can serve a cached git dep, so
   **verify the installed version, not just the pin**.

---

## 9. Suggested next steps, in order

1. **Smoke test in `npm run dev`** — the Inbox (with real leads now wired), promote → customer,
   the board drag, the drawer timeline, and the tour on a fresh Clerk user. This is the gate
   before anything else.
2. **Decide the `CallsSection` question** (§7) — it is the only user-visible regression risk.
3. **Commit.** The portal work is one coherent body; `FeatureState.tsx` and `PortalChrome.tsx`
   carry both earlier tier-copy work and Phase 0 edits, so they cannot be split cleanly.
4. **Push `jdd-ops`** once branch ownership is confirmed.
5. **Unit-test `crm-contacts.ts`** collapse logic.
6. Fix the Tesco data, then build the `googleReviewUrl` population path.

---

## 10. Quick verification commands

```bash
cd juneau-digital-designs
npx tsc --noEmit          # expect clean
npm run build             # expect success, /portal/customers in the route list
npx eslint app/components/portal/crm app/components/portal/InboxSection.tsx
cd ../jdd-schema && npm test     # expect 276 pass

# pin alignment — all three must read 1.30.0
for d in juneau-digital-designs jdd-ops jdd-ops/console; do
  grep -o 'jdd-schema#v[0-9.]*' ../$d/package.json
  grep -o '"version": *"[^"]*"' ../$d/node_modules/@jdd/schema/package.json | head -1
done
```

**Pre-existing lint errors** in `useMediaQuery.ts`, `ThemeToggle.tsx` and `pricingpageclient.tsx`
are not from this session — do not treat them as regressions.
