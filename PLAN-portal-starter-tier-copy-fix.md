# PLAN (addendum) — Starter-tier copy & plan-detection fix

**Status:** Ready for execution (Sonnet) — bundle with the CRM work since it touches the same portal surfaces
**Branch base:** `feat/pricing-2026-10`
**Repos:** `juneau-digital-designs` (portal copy + logic), possibly a **data correction** in the account store (`jdd-ops`)
**Date drafted:** 2026-10-29

## Problem

Since the **2026-10-12 reprice, every tier (Starter included) ships the AI receptionist and call log.** The portal copy and some gating still assume the old world where the receptionist/call tracking was a **Growth** feature. Concretely, a real Starter test client ("Tesco" test site) is on the new infrastructure with a receptionist connected, but the portal presents it as if it were a Growth plan / treats the receptionist as a Growth upsell.

## What is already correct (do NOT "fix")

`@jdd/schema` v1.28.0 is already updated for the new model — verified in `node_modules/@jdd/schema/src/account.ts`:
- `isWebOnly(site)` = `site.plan === "starter" && site.receptionistMode === "declined"` (account.ts:307).
- `siteFeature(site, "calls")` returns `not-on-plan` **only** when `isWebOnly` (account.ts:600–603) — i.e. a Starter **with** a receptionist **does** get the call log. The comment at :601 and the `receptionistDeclined` note at :485–487 explicitly call out that entitlement must not be derived from `plan === "starter"` anymore.

So the **entitlement gate is right**. The bug is (A) a data/display issue and (B) stale copy.

---

## Part A — "Shows as Growth plan" (data + display)

The rail plan chip renders `planLabel[selected.plan]` (`PortalChrome.tsx:39–43`, `BillingSection.tsx:53`). If it shows "Growth", then `site.plan` is literally stored as `"growth"` for that client.

**Steps:**
1. **Verify the stored plan** for the Tesco test client in the account store (`jdd-ops` account records / `app/lib/account-store.ts`). _Expected finding:_ `plan: "growth"` where it should be `"starter"`.
2. **If it's a data error:** correct that client's `plan` to `"starter"` (via the console manage route / account-store write). This is the likely root cause of the symptom.
3. **Audit provisioning** (`jdd-ops/onboard.js` + `scripts/`): confirm a Starter onboarding writes `plan: "starter"` (not defaulting/forcing growth). `insertSite` in the schema already defaults `plan: "starter"` (account.ts:282), so check onboard.js isn't overriding it. Fix if it is, so new Starter clients aren't mislabelled.
4. **`isProvisioningGrowth` bug** (`GrowthProvisioning.tsx:147–151`): it gates on `site.plan === "growth" || site.plan === "enterprise"`. A Starter-with-receptionist mid-provisioning now also deserves the "your receptionist is being set up" state, but this excludes them. Widen the gate to "any site that is entitled to calls but `calls.state !== "ready"`" (i.e. not web-only), and **rename** to `isProvisioningReceptionist` / `ReceptionistProvisioning`. Keep the component's behaviour, drop the plan assumption.

---

## Part B — Stale "Growth" copy (reword for all-tier receptionist)

The receptionist/call log is **included on every tier**; the only client who doesn't get a call log is a **web-only** site (Starter that *declined* the receptionist). So "upgrade to Growth to get call tracking" is wrong on two counts: Starter already has it, and the real upsell for a web-only client is **"add a receptionist,"** not "change plan."

Reword these user-facing strings (keep tone consistent with the portal voice):

| File / line | Current (stale) | Direction |
|---|---|---|
| `ui/FeatureState.tsx:43` | "Call tracking comes with Growth" | "Your call log turns on with the AI receptionist" (web-only case) |
| `ui/FeatureState.tsx:46` | "Growth adds an AI receptionist … $X a month, including … minutes." | Reframe as **adding a receptionist to this site** (it's included on every plan), not upgrading tier. Pull price/minutes from the client's own plan via `SCHEDULES[plan]`, not hardcoded `SCHEDULES.growth`. |
| `ui/FeatureState.tsx:47,107` | "Upgrade to Growth" / mailto subject "Upgrade to Growth" | "Add a receptionist" / subject "Add a receptionist" |
| `CallsSection.tsx:311` | "With Growth, this page lists every call…" | "With a receptionist, this page lists every call…" (shown only to web-only now) |
| `HealthStrip.tsx:94` | "Add it with Growth" | "Add a receptionist" |
| `PortalChrome.tsx:128` (comment) + any pending-dot logic | assumes "a Growth client's [call log] is arriving" | Re-express in terms of *receptionist entitlement*, not plan tier. Verify the locked/pending marker logic (`tabState`) keys off `siteFeature` state, not `plan` — it already should (uses `availability.state`), so this is mostly a comment/wording pass. |

**Audit beyond the table:** grep the whole portal for `Growth` in JSX/string literals and review each for the same stale assumption (`BillingSection`, `OverviewSection`, `GrowthProvisioning` headings, upgrade CTAs). Leave legitimately plan-specific copy (e.g. Enterprise multi-site, genuine Starter→Growth minute-allowance upsells) intact — the goal is to stop implying the **receptionist/call log** is Growth-only, not to erase the word "Growth."

**Minutes/pricing:** several strings hardcode `SCHEDULES.growth` figures. Where the copy is about *this* client's receptionist, use the client's own plan schedule so a Starter sees Starter numbers.

---

## Part C — Verifications / open questions

- _(verify)_ Confirm the Tesco test client's stored `plan` value and `receptionistMode` (expect `starter` + a non-`declined` mode once corrected).
- _(verify)_ Whether any onboarding path still writes `plan: "growth"` for receptionist clients (the historical reason the data got set wrong).
- _(verify)_ `SCHEDULES` shape in `app/lib/legal/schedules.ts` exposes per-plan `monthlyPrice`/`callMinutes` for all tiers (FeatureState currently reads `SCHEDULES.growth.*`).

## Execution order
1. Data: verify + correct the test client's plan (unblocks the visible symptom immediately).
2. `isProvisioningGrowth` → receptionist-based gate + rename.
3. Copy pass (table above) + whole-portal `Growth` grep review.
4. Provisioning audit in `jdd-ops` so it can't recur.

This is independent of the CRM board and can ship first or in parallel; it only overlaps the CRM work in the files it edits (`CallsSection`, `FeatureState`, `PortalChrome`).
