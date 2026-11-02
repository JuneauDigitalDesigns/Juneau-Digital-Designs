# PLAN: JDD Pricing Update (2026-10-12)

**Source brief:** `C:\Users\Xander\.claude\uploads\d249fb91-5734-4c7b-9226-711a32ed8c0d\33a46150-JDD-pricing-handoff.md`
**Owner decisions:** captured in §0.3 below. Where an owner decision contradicts the brief, **the owner decision wins** and the deviation is recorded in §0.4.
**Executor:** read §0 in full before touching a file. Do not skip it. It contains four traps that will silently produce wrong output.

---

## 0. Before you start

### 0.1 Repo layout and the two-repo ordering constraint

Two repos change. **Order is mandatory**, because the second consumes the first:

| Order | Repo | Path | Role |
|---|---|---|---|
| 1 | `jdd-schema` | `C:\Users\Xander\Desktop\ops\jdd-schema` | `@jdd/schema`, consumed by tag |
| 2 | agency site | `C:\Users\Xander\Desktop\ops\juneau-digital-designs` | public site, portal, legal, billing |

`@jdd/schema` is **not** on npm. It is consumed as `github:JuneauDigitalDesigns/jdd-schema#v1.23.0`. Three files pin it and all three must end up on the same new tag:

- `ops/juneau-digital-designs/package.json:12`
- `ops/jdd-ops/package.json:33`
- `ops/jdd-ops/console/package.json:19`

`dist/` **is committed** in `jdd-schema` (100 tracked files). A source edit without a rebuild+commit of `dist/` ships nothing. The publish loop is:

```
edit src/ -> npm run build -> npm test -> git add src dist package.json -> commit -> git tag v1.24.0 -> git push origin main --tags
```

Then bump the three pins and `npm install` in each consumer.

### 0.2 Four traps

1. **Zod strips unknown keys.** A field added to `src/` but missing from the *consumer's pinned tag* is silently deleted on read, with no error. After bumping pins, verify the new field survives a round trip before trusting any UI that reads it. Check `node_modules/@jdd/schema/dist/`, never `src/`, when debugging what a consumer actually sees.
2. **PowerShell mangles UTF-8.** Do **not** round-trip any source file through `Get-Content`/`Set-Content` for the em-dash sweep or anything else. It produces mojibake that `tsc` will not catch. Use the `Edit` tool for every edit in this plan.
3. **`.env.local` holds TEST Stripe keys.** `grep -c sk_test .env.local` returns 2; `sk_live` returns 0. Any price-creation script run with the ambient env will create objects in the **test** account. See §6 for the required guard. The test account also holds roughly 20 fixture subscriptions at the old $297 price. They are not customers. Do not migrate, count, or surface them.
4. **There is no `typecheck` script.** `package.json` has only `dev`/`build`/`start`/`lint`. Typecheck is `npx tsc --noEmit`.

### 0.3 Owner decisions (authoritative)

| # | Decision |
|---|---|
| D1 | Starter is **fully provisioned**: real phone number and Retell agent, same as Growth. |
| D2 | Starter **gets the call log**, same as Growth. No portal gating by tier for calls. |
| D3 | Web-only is a **real flag on Starter**, not a fourth plan slug. Schema change. |
| D4 | **Remove all cancellation notice periods**, every tier, plus dependent MSA prose. |
| D5 | MSA **bumps to v5** (new file, new `TERMS_VERSION`). |
| D6 | The non-refundable onboarding-fee clause is **replaced by the guarantee**, with an objective metric. |
| D7 | Guarantee appears on the **pricing page and in the MSA**. |
| D8 | Guarantee metric: **activation-conditioned, fewer than 3 qualified leads in the first 30 days**. |
| D9 | Keep ancillary fees; **drop the $200 Enterprise site-swap fee**. |
| D10 | Keep "2 content edits/month" and "client portal". **Drop ongoing SEO from the cards AND the MSA.** |
| D11 | "What's the catch?" FAQ is **replaced by the AI-objection question**. |
| D12 | Receptionist presentation: **page-level band** with the human-first line, **plus a Growth-only callout** re-aimed at the 60-second callback. |
| D13 | Enterprise upsell **re-pitched on pooled minutes**, not cost savings. |
| D14 | "Starter tells you. Growth acts for you." splits across the **Starter and Growth card taglines**. |
| D15 | Align **everything** to "2 to 3 websites", MSA and Schedule A included. |
| D16 | **Full FAQ pass.** |
| D17 | Stripe prices created **by script, shown to the owner for approval before running**. |
| D18 | Env vars handled **locally and on Vercel**, by the executor. |
| D19 | Old price objects **archived after proving zero references**. |
| D20 | **Annual prepay with a public toggle on the pricing page**, open to all. |
| D21 | Activation: **choice captured as a wizard step, instructions on a dedicated page after**. |
| D22 | Activation state lives in **`@jdd/schema`, new minor version**. |
| D23 | Delivery: **new branch, commits, clean typecheck + build, then a Vercel preview deploy**. No production deploy. |
| D24 | The receptionist mode is **always explicitly stated by the writer**, never inferred and never defaulted. `receptionistDeclined` / `receptionistMode` are **required** inputs, not optional. |
| D25 | Starter overage **is billed** at $0.20/min, same as every tier. No special case in metering or billing. |
| D26 | Starter receives the **full Growth stack except the outbound callback**. `LEAD_DELIVERY_MODE` (`email` vs `callback`) is the only provisioning difference. |
| D27 | The A2P 10DLC 30034 issue **is resolved**. Post-call SMS works; Starter may advertise and receive the text brief. |
| D28 | A declining client signs **standard Starter terms**. Declining is an activation choice made after signing. |
| D29 | **Keep `hasVoiceAgent`, and define a web-only schedule now**, so a receptionist-free agreement is renderable rather than theoretical. |
| D30 | `cancellationNoticeDays` **stays as a field, set to 0**, documented as cancel-at-period-end. |
| D31 | Cancellation takes effect at the **end of the paid period**. Service continues until then. No proration, no immediate teardown. |

**Reconciling D28 and D29:** the public funnel has every Starter client sign the standard agreement, because signing precedes the activation step. The web-only schedule exists for the sales-assisted case where a prospect refuses AI up front and the document should say so. Both paths end at `receptionistMode: "declined"`; they differ only in which document was signed.

**Provisioning is a separate document.** D24, D25, D26, and D27 drive changes in `jdd-ops`, specified in `ops/jdd-ops/HANDOFF-starter-receptionist.md`. That file supersedes §3.6 below. Read it before touching `onboard.js`.

### 0.4 Deviations from the brief (state these in the final report)

- **D20 contradicts brief §4 and two acceptance-checklist lines** ("Annual prepay exists but is never advertised", "No annual/monthly billing toggle on the pricing page"). Owner overrode deliberately. Build the toggle.
- **D1/D2/D22 cross brief §10** ("do not touch the client portal or the console"). Unavoidable: Starter provisioning plus a schema minor version has to be consumed by the console and portal or the new field is stripped. Scope is limited to what the pin bump and the Starter entitlement require. No unrelated portal work.
- **D10 removes an entitlement** (ongoing SEO) rather than only changing prices. Owner-directed.

### 0.5 Copy rules (non-negotiable)

- **No em-dashes** (`—`) in any string that renders to a user. Comma, colon, or period. Strip pre-existing ones in files you touch.
- Prices as `$497/mo`, never `$497.00 per month`.
- Never the words "cheap", "affordable", "budget". Positioning is value, not price.
- Note: en-dash in numeric ranges (`$15-$25`) is fine; the rule is about the em-dash as punctuation.

### 0.6 Starting state

Agency repo is on `feat/portal-support-tickets`, working tree **clean**, HEAD `ea48459`. That commit is local and unpushed. Branch from it:

```
git switch -c feat/pricing-2026-10
```

`jdd-schema` is on `main`, clean, HEAD `be92940` (= `v1.23.0`).

### 0.7 The price card (single source of truth for every number below)

| Tier | Monthly | Onboarding | Annual (10x monthly) | Included minutes |
|---|---|---|---|---|
| Starter | $197 | $297 | $1,970 | 100 |
| Growth (most popular) | $497 | $297 | $4,970 | 350 |
| Enterprise | $1,097 | $697 | $10,970 | 1,050 pooled |

Overage $0.20/min, unchanged. Web-only: $197/mo + $297 onboarding, no receptionist, **never shown publicly**.

Old values for reference only: Starter $117/$100, Growth $297/$0, Enterprise $697/$0. **Never blind-replace a bare number.** `297` is both an old Growth monthly and the new onboarding fee; `697` is both an old Enterprise monthly and the new Enterprise onboarding fee. Inspect every occurrence.

---

## Phase 1: `@jdd/schema` v1.24.0

All paths relative to `ops/jdd-schema`.

### 1.1 `src/account.ts` — add the activation/receptionist state

Add above `PortalSite` (near the `PortalPlan` declaration at line 26):

```ts
/**
 * How the client activated, or refused, the AI receptionist.
 *
 * Captured as an explicit step in onboarding rather than inferred, because the AI only works
 * once the business line actually points at the JDD number, and "nobody forwarded the line"
 * and "the client declined a receptionist" are different facts with different remedies. The
 * first is a nudge; the second is a web-only client who must never be billed for minutes or
 * promised a call log.
 *
 * `declined` is the web-only variant. It is deliberately not a fourth plan slug: the price is
 * identical to Starter, so it is a property of a Starter site, not a product of its own.
 */
export type ReceptionistMode = "forwarded" | "published" | "declined";
```

Add to the `PortalSite` interface (after `retellAgentId`, around line 53):

```ts
  /**
   * The activation choice from onboarding. Undefined on records that predate the step;
   * treat undefined as "not yet asked", never as "declined".
   */
  receptionistMode?: ReceptionistMode;
  /** Epoch ms the choice was recorded. */
  receptionistChoiceAt?: number;
```

Add to `zPortalSite` (after `retellAgentId` at line 154):

```ts
  receptionistMode: z.enum(["forwarded", "published", "declined"]).optional(),
  receptionistChoiceAt: z.number().optional(),
```

Add a helper near `isSiteOnboarded` (line 270):

```ts
/**
 * A web-only site: Starter, with the receptionist explicitly refused.
 *
 * One predicate, because three separate places need this answer and a fourth copy of
 * `plan === "starter" && mode === "declined"` would eventually disagree: feature gating,
 * minute metering, and provisioning. Undefined mode is **not** web-only, so a client who has
 * not reached the activation step yet keeps their full entitlement.
 */
export function isWebOnly(site: PortalSite): boolean {
  return site.plan === "starter" && site.receptionistMode === "declined";
}
```

**Update the stale `retellAgentId` doc comment** at lines 49-53. It currently reads "absent on starter sites, which have no agent." Replace that clause with: "absent only on web-only sites, which have no agent."

### 1.2 `src/account.ts` — `buildPortalSiteEntries`

Lines 483-497 currently special-case Starter and **actively blank** `airtableBaseId` and `retellAgentId` for it. Under D1 that would wipe a Starter site's agent on every console repair. The condition must move from plan to the web-only flag.

Add to `PortalEntrySource` (interface at line 422). **Required, not optional, per D24:**

```ts
  /**
   * Whether this client refused the receptionist. **Required: state it, never infer it.**
   *
   * An optional flag with a `false` default is the inference D24 forbids. The wrong value
   * costs money in both directions: `false` on a web-only site preserves an agent id that
   * should not exist, and `true` on a real Starter site blanks an agent that was paid for.
   * Both writers (onboard.js, the console repair tool) know the answer, so both must say it.
   */
  receptionistDeclined: boolean;
```

Making it required is a **breaking change to the call signature**, which is deliberate: it forces both writers to resolve the mode rather than inheriting a silent default. Expect `tsc` to flag every call site, and treat that as the feature working.

Replace the `if (plan === "starter") { ... } else { ... }` block with the same two branches keyed on `s.receptionistDeclined === true` instead of `plan === "starter"`. Update the two inline comments: "Starter genuinely has no call data" becomes "A web-only site genuinely has no call data"; "starter has no voice agent at all" becomes "a web-only site has no voice agent at all".

Also update the rules comment at lines 453-457 ("**Airtable base** - starter sites get an explicit `null`...") to say web-only sites rather than starter sites.

### 1.3 `src/account.ts` — `siteFeature`

Line 546 is the Starter call-data gate:

```ts
  if (feature === "calls" && site.plan === "starter") return { state: "not-on-plan" };
```

Under D1+D2, Starter gets calls. Only web-only does not:

```ts
  // Plan. Only call data is gated, and only for web-only sites: every tier now includes the
  // receptionist, so the tier itself no longer decides this. A client who refused the
  // receptionist has no call data to show and never will.
  if (feature === "calls" && isWebOnly(site)) return { state: "not-on-plan" };
```

Update the doc comment above it (lines 537-543): the example "a Starter site mid-build hears the truth about its plan" is now wrong. Reword to a web-only site.

### 1.4 `src/metering.ts` — Starter consumes minutes

Starter now has an allowance, so it must be metered and billed. Currently Starter cannot even be typed.

- Line 26: `export type VoicePlan = "growth" | "enterprise";` becomes `"starter" | "growth" | "enterprise"`.
- `MinuteCaps` (line 39): add `starter: number;`.
- `voiceSitesOf` (line 64): the plan filter `(s.plan === "growth" || s.plan === "enterprise")` must accept starter **and exclude web-only**. Replace the predicate with:

```ts
  return sites.filter(
    (s) =>
      !isWebOnly(s) &&
      Boolean(s.retellAgentId) &&
      s.status !== "pending-onboarding",
  );
```

  Import `isWebOnly` from `./account.js`. Every plan has an agent now, so the plan check collapses into the web-only exclusion; `Boolean(s.retellAgentId)` still carries the "actually provisioned" requirement.

- `meteringGroups` (line 85): Starter meters **per site**, like Growth, not pooled. Generalise the Growth loop to cover both:

```ts
  for (const site of voice) {
    if (site.plan === "enterprise") continue;
    const cap = site.plan === "starter" ? caps.starter : caps.growth;
    if (!cap) continue;
    groups.push({ ref: site.slug, plan: site.plan, sites: [site], cap });
  }
```

  Keep the Enterprise pooled block below it unchanged.

- Update the module header (lines 4-12). It currently asserts "**Growth minutes are per site. Enterprise minutes are pooled.**" Restate as: Starter and Growth minutes are per site; only Enterprise pools.

### 1.5 `src/entitlements.ts` — stale notice-period comment

`isActiveSite`'s doc comment (lines 60-63) says "which would put them over the cap for the remainder of the notice period (60 days on Enterprise)". Under D4 there is no notice period. Reword to reference the remainder of the paid period. **The function body does not change**: a scheduled `cancelEffectiveAt` still holds the slot until it passes.

Also line 14's "**Starter** - unlimited. Cheap to build and run" uses a banned word and is now inaccurate (Starter carries a receptionist and real telephony cost). Reword to note it is still unlimited per account but is no longer free of per-site operating cost.

### 1.6 `src/zod.ts` + `src/brand-intake.ts` — carry the activation choice through intake

`zBrandIntakeSubmission` (`src/zod.ts:168`) is what the onboarding route validates against, and anything absent from it is **stripped**. `BrandIntakeSubmission` (`src/brand-intake.ts:31`) is the matching TS interface.

Add to both, beside `selectedPlan`:

```ts
  /** The activation choice from the wizard's activation step. */
  receptionistMode: "forwarded" | "published" | "declined";
```

In `zod.ts` make it `z.enum(["forwarded", "published", "declined"])`. Decide required vs `.optional()` by checking whether the wizard can submit without reaching the step; §5 makes it a required step, so required is correct, but if any existing draft fixture would fail validation, use `.optional()` and default to `undefined` at the read site rather than defaulting to a choice nobody made.

### 1.7 Tests

`npm test` runs `node --test test/**/*.test.mjs`. Update and extend:

- `test/metering.test.mjs` — existing cases assume Starter is never metered. Add: a Starter site with an agent produces its own 100-minute group; a web-only Starter produces none; Starter and Growth on one account produce two separate groups that do not pool.
- `test/account.test.mjs` — `buildPortalSiteEntries` no longer nulls a Starter agent; it does null a web-only one. `siteFeature(starterSite, "calls")` is no longer `not-on-plan`; a web-only site still is.
- `test/entitlements.test.mjs` — should still pass untouched. If it fails, the change in 1.5 went further than a comment.
- `test/brand-intake.test.mjs` — a submission carrying `receptionistMode` round-trips with the field intact.

### 1.8 Publish

```
npm run build && npm test
```

Both clean, then set `package.json` version to `1.24.0`, commit `src dist package.json`, tag `v1.24.0`, push with `--tags`. Pushing needs the JDD GitHub account: if `gh auth status` shows the personal account, use the `github-account-switch` skill first.

**Gate 1:** do not start Phase 2 until `v1.24.0` is pushed and the three pins are bumped and installed.

---

## Phase 2: Schedule A and the MSA (v5)

All paths relative to `ops/juneau-digital-designs`.

This is the highest-leverage phase. `app/lib/legal/schedules.ts` is the one place prices live; it feeds the pricing page, the MSA body, the addendum, the signed PDF, and the agreement email.

### 2.1 `app/lib/legal/types.ts`

- `cancellationNoticeDays` (line 77): keep the field, document that `0` means cancel at period end with no notice requirement. Keeping it at 0 rather than deleting it is deliberate: `app/api/portal/cancel/route.ts:117` reads it, and `noticeDays = 0` makes `target = now`, so `firstBoundaryAtOrAfter` returns the current period end, which is exactly the wanted behaviour with no restructuring.
- `includesSeo` (line 78): **delete the field.** D10 removes SEO from every tier, so a flag that is now always `false` is dead weight that invites someone to flip it back on.

### 2.2 `app/lib/legal/schedules.ts` — rewrite all three entries

Per tier:

**Starter** (lines 26-61): `monthlyPrice: 197`, `onboardingFee: 297`, `hasVoiceAgent: true`, `callMinutes: 100`, `overagePerMinute: OVERAGE_PER_MINUTE`, `cancellationNoticeDays: 0`, remove `includesSeo`. Add a `STARTER_MINUTES = 100` constant beside the existing `GROWTH_MINUTES`/`ENTERPRISE_MINUTES` at lines 14-16 and interpolate it, matching the file's existing discipline that no figure is written twice.

`included` must now carry the receptionist, the post-call text brief, and the lead email. Keep the four-page site, hosting, SSL, backups, the two content edits, GA4, and portal access. Remove nothing except what D10 removes. Minutes go **last**.

**Growth** (lines 63-101): `monthlyPrice: 497`, `onboardingFee: 297`, `cancellationNoticeDays: 0`, remove `includesSeo`. `included` must **lead with the 60-second callback**, then AI qualification, then the searchable call log with transcripts, then urgency and caller-name extraction. Remove the "Ongoing technical on-page SEO" bullet. Minutes last.

**Enterprise** (lines 103-142): `monthlyPrice: 1097`, `onboardingFee: 697`, `cancellationNoticeDays: 0`, remove `includesSeo`. `siteLabel` becomes the D15 wording, `maxSites` stays `3`. Remove the SEO inheritance implicitly (it inherits from Growth's list).

**Every `feeTable`:** update the monthly and onboarding rows, delete the "Cancellation notice period" row (lines 59, 99, 140), delete Enterprise's "Site swap fee" row (line 136) per D9. Keep late fee, chargeback, port-out, and the quoted-per-request rows. Add an onboarding-guarantee row.

**`maxSites: 3` is load-bearing beyond prose.** `app/lib/plan-limits.ts:23` derives `enterpriseSites` from it, which feeds `canAddPlan`. Leave the number alone; D15 is a wording change only.

### 2.3 `app/lib/legal/terms-v4.ts` -> `terms-v5.ts`

Rename the file. Set `TERMS_VERSION = "v5.0"` (line 3). Update the import in `app/lib/legal/index.ts:3` and the re-export at line 6. Then make these content changes:

**a. The guarantee replaces the non-refundable clause.** Lines 116-123, inside the "Monthly Subscription" subsection, currently emit:

> "A one-time onboarding fee of {fee} applies to the {plan} plan and is charged at signing. The onboarding fee is non-refundable once onboarding has begun."

Replace the second sentence with the guarantee, worded to D8. The clause must state all four elements or it is not enforceable in practice:

1. the window: the first thirty (30) days after the receptionist goes live;
2. the metric: fewer than three (3) qualified leads captured, where a qualified lead is a call the receptionist answered that produced a caller name, a callback number, and a stated reason, as recorded in the client's call log;
3. the activation condition: void if the client never completed activation under the activation section, because a line that was never forwarded cannot capture anything;
4. the remedy: the onboarding fee is refunded. The monthly fee for service already rendered is not.

Note the window runs from **receptionist go-live**, not from signing. A client who takes three weeks to forward their line must not burn the window waiting.

**b. Add an activation subsection** to the `onboarding` section (id at line 54). Fold in the existing "Voice Agent Setup" subsection at lines 82-91, which is currently `plans: ["growth", "enterprise"]` and must now apply to everyone: **delete that `plans` key.** The new subsection states that the receptionist only answers once the client forwards their business line to the JDD number or publishes the JDD number as their business number; that the client chooses one at onboarding; that the client may decline, which maps to the web-only variant and skips the phone-number purchase; and that the choice is recorded.

**c. Delete the SEO subsection.** Lines 234-252, the whole `...(s.includesSeo ? [{ heading: "Technical SEO", ... }] : [])` spread.

**d. Fix the "Not Included" list** (lines 262-291). Four edits:
- The `includesSeo` ternary at 269-271 collapses to the no-SEO arm: SEO of any kind is out of scope on every tier now.
- The `hasVoiceAgent` ternary at 274-276 collapses to the has-agent arm, since all three tiers have one.
- The `hasVoiceAgent` spread at 283-290, the whole "The {plan} plan is a website-only plan" paragraph, is now dead for all three current schedules. **Do not delete it.** Per D29 it becomes live text again the moment the web-only schedule in §2.6 exists, which is this same phase. Leave it keyed on `hasVoiceAgent` and it will render correctly for web-only and for nobody else, which is exactly right.
- Line 278's "more than three (3) websites" stays accurate.

**e. Remove every notice period.** With `cancellationNoticeDays: 0`, `const notice = "0 days"` at line 30 renders nonsense. Delete the `notice` constant and rewrite its three consumers:
- Line 1013, "Termination for Convenience": either party may terminate effective at the end of the current monthly billing cycle, no notice period, no penalty. **Delete the Enterprise 60-day rationale** at lines 1014-1016 entirely.
- Line 1055, "Effect of Termination": "All monthly fees through the end of the applicable {notice} notice period remain payable" becomes fees through the end of the current paid month.
- Line 1096, "Plan Changes / Change Process": drop the notice requirement; the change takes effect at the next billing boundary.
- Line 162, "No Refunds for Partial Months", cross-references the notice period via `ref("term")`. Reword to the end of the current paid month.

**f. Add explicit no-commitment language** to the `term` section. The brief requires the absence of minimum terms; say so affirmatively: no minimum term, no commitment period, no early-termination fee, month to month. Scan the whole file for any surviving commitment language before declaring this done.

**g. Fees on a Plan Change** (lines 1128-1141). Both bullets are now wrong:
- Line 1134 hardcodes "The $100 onboarding fee applies on any change into the Starter plan". Interpolate from the schedule, never a literal.
- Line 1135, "No onboarding fee applies on a change into the Growth or Enterprise plan", is false: both now carry one. Restate so the onboarding fee follows the target plan's `onboardingFee`.

**h. Site-swap fee** (line 364, in the `sitelist` section): remove the "$200 per swap" bullet per D9. The swap mechanism itself stays; only the fee goes. Line 1116's "site swap fees" in the surviving-obligations list should drop that phrase too. Also reconsider line 1038's breach bullet about cycling sites "to obtain free onboarding", which was premised on the fee.

**i. §15 `callvolume` plan gate.** Line 309 is `plans: ["growth", "enterprise"]`. Starter now has minutes, so **delete the `plans` key** and let it apply to all three. Check the Enterprise-vs-other ternary at 316-318 still reads correctly for Starter: it falls to the non-pooled arm, which is right.

**j. `hasVoiceAgent` is `true` for all three *sold* schedules**, which makes roughly fifteen ternaries and spreads look constant. Locations: 65, 274, 283, 420, 552, 578, 615, 803, 921, 928, 939, 977, 984, 1034, 1058, 1168, 1208.

**Do not inline any of them.** Per D29 the flag keeps a real consumer: the web-only schedule added in §2.6. Every one of these branches becomes live again for that schedule. Leave them exactly as written; they are already correct. Collapse only the two `includesSeo` and voice-agent arms in (d) where the false arm actively contradicts the sold product, and even there check §2.6 first.

This is the single most likely place for an executor to "tidy up" and silently destroy the web-only capability. Add a comment at the `hasVoiceAgent` declaration in `types.ts` saying so.

**k. Em-dashes in rendered legal text.** `app/lib/legal/index.ts:119` (`SCHEDULE A — ...`) and `:123` (`Plan: ... — $...`) both render into the signed PDF. Fix both. Also `app/lib/pdf-signer.ts:78`.

### 2.4 `app/lib/legal/addendum-v1.ts`

Reads the schedule, so prices follow automatically. Three things to check by hand:
- Lines 96-99: the onboarding-fee sentence is behind `s.onboardingFee > 0`, now true for every tier, including Growth where it was previously never emitted. Read the result for all three and confirm it is sensible.
- Line 172: "Either party may cancel this site on the notice period set out in the ..." must change under D4.
- Lines 119-130: the pooled-vs-per-site minutes text now also applies to Starter. Verify the non-pooled arm reads correctly.

### 2.6 The web-only schedule (D29)

Define it now, so the receptionist-free agreement is renderable rather than theoretical.

**Key constraint: this must not become a fourth `PlanSlug`.** `PlanSlug` is a union consumed across the agency app, `@jdd/schema` (`PortalPlan`), `jdd-ops`, and the console. Widening it would ripple into every exhaustive switch, `canAddPlan`, `meteringGroups`, and the account record. Web-only is a property of a Starter site, not a product.

Instead, add a schedule keyed outside the `PlanSlug` map, consumed only by the agreement renderer:

- A `WEB_ONLY_SCHEDULE: PlanSchedule` with `slug: "starter"`, `name` distinguishing it in the document heading, `monthlyPrice: 197`, `onboardingFee: 297`, `hasVoiceAgent: false`, `callMinutes: null`, `overagePerMinute: null`, `maxSites: 1`, `cancellationNoticeDays: 0`. Its `included` list is Starter's minus the receptionist, the text brief, and the minutes. Its `feeTable` carries no minutes or overage rows.
- `getTermsForPlan` (`index.ts:26`) takes an optional variant in its existing `Options` object (which already carries `siteNames`), so the default call signature is unchanged and no existing caller breaks.
- `hashTermsForPlan` must incorporate the variant, or a web-only agreement and a Starter agreement would hash identically and the stored hash would stop identifying what was signed. Check `hash.ts:20` and thread the variant through the same way `getAddendumForPlan` is handled at line 33.

Because `hasVoiceAgent: false` is live again, §2.3(j)'s branches all resolve. **Read the rendered web-only agreement end to end** before declaring this done; it is the only document where the false arms have ever been exercised against the v5 text.

Price it identically to Starter. That is deliberate, not an oversight: web-only must never be the economically attractive choice.

### 2.5 Hashes and the version bump

`app/lib/legal/hash.ts` hashes `[version, plan, ...sections]`. Every price change alters every hash; `TERMS_VERSION = "v5.0"` makes that legible rather than silent. Nothing is signed yet, so no stored agreement needs re-papering. Do not add a migration.

---

## Phase 3: Agency app, non-legal

### 3.1 `app/lib/retell-usage.ts` — add the Starter cap

`minuteCaps()` at lines 93-98 returns only `growth` and `enterprise`. With `MinuteCaps` now requiring `starter`, this fails typecheck until you add:

```ts
    starter: getSchedule("starter").callMinutes ?? 0,
```

This adapter is the only place caps are injected, so this one edit propagates to both the portal usage tile and the billing cron. Verify `app/lib/usage-billing.ts:65` and `app/lib/portal-usage.ts:80` need no change; they call the wrappers. Update `usage-billing.ts`'s header comment at lines 49-50 ("Growth is sold per site and each site has its own 350 minutes") to include Starter.

### 3.2 `app/lib/portal-usage.ts`

Line 68's `if (!schedule.callMinutes) return { ...EMPTY, state: "not-on-plan" }` self-corrects once Starter has 100 minutes. Update the now-wrong comment at line 67 ("Starter has no voice agent at all"). Web-only sites must still return `not-on-plan`: add an `isWebOnly(site)` check beside it, since a declined site has a schedule with minutes but no agent.

### 3.3 `app/lib/agreement-email.ts`

Lines 8-12 hardcode all three plan labels, including the banned word "setup", and already drift from Schedule A. Replace the literal map with values derived from `SCHEDULES`, formatted `$197/mo + $297 onboarding` per §0.5.

### 3.4 `app/lib/plan-billing.ts`

The comment at lines 323-324 says "Starter's one-time onboarding fee is not a recurring price, and replacing it would re-bill setup." The logic is still correct and more important now that all three tiers have an onboarding fee. Update the wording to drop "setup" and to stop implying Starter is the only tier with one.

### 3.5 `app/api/portal/cancel/route.ts`

Line 117 reads `cancellationNoticeDays`, now `0`. Confirm by reading that `noticeDays = 0` yields cancel-at-period-end, and that the `?? 30` fallback on that line cannot now reintroduce a notice period for an unknown plan. Change the fallback to `?? 0`. Update any user-facing copy in this route or its UI that promises a notice period.

### 3.6 Provisioning for Starter (D1, D26) — SUPERSEDED

**This section is replaced by `ops/jdd-ops/HANDOFF-starter-receptionist.md`.** Read that document; do not improvise from this one.

Summary of why it moved: the Starter telephony gate is **not** a one-line condition. It is nine branches in `onboard.js` (including a second, independent `retellAgentId = null` kill switch at line 1456 that duplicates the schema rule on purpose), plus a stale plan-tier table in `jdd-ops/CLAUDE.md` that is read at the start of every session, plus a live-client regression affecting two real sites. That is its own piece of work with its own verification, not a sub-step of a pricing change.

What still belongs to *this* plan: the schema changes in Phase 1, which the provisioning work depends on. Finish Phase 1 and bump all three pins before starting the provisioning handoff.

### 3.7 Reference sweep

Grep the app for surviving stale values and fix each in context, never by blind replace:

```
grep -rn '\$117\|\$297\|\$697\|\$100 \|\$250\|\$500' app --include=*.ts --include=*.tsx
grep -rn 'setup fee\|setup cost\|Setup Fee' app -i
grep -rn 'notice period\|60 days\|30 days notice' app -i
grep -rn 'waived' app -i
```

Known hits beyond those already listed: `app/components/home/homepageclient.tsx` and `app/components/home/SiteToCallPanel.tsx` matched the numeric grep; most are calculator bounds like `$500K`, not prices. Check each. `app/globals.css:791` is a comment about slider scaling, not a price.

---

## Phase 4: The pricing page

`app/components/pricing/pricingpageclient.tsx` (427 lines). Brief §10 forbids design and layout changes, so this is **content and conditional-rendering work only**. Do not restyle, do not reorganise the grid, do not swap components.

### 4.1 Tier data

`TIERS` at lines 28-71 already reads prices from `SCHEDULES`, so the numbers follow Phase 2 automatically. Rewrite per tier:

- **Starter tagline** (line 33): currently "Add the receptionist whenever you're ready", now false. Replace with the "Starter tells you" half of D14.
- **Growth tagline** (line 47): the "Growth acts for you" half.
- **Feature lists**: per D10, lead with the brief's bullets in the brief's order, then the surviving extras (two content edits, client portal), then minutes **last**. Drop the SEO bullet at line 53. Starter's list must show the receptionist and the post-call text brief. Growth's must **lead with the 60-second callback**, not minutes.
- **Enterprise** (lines 62-68): D15 wording, and keep the pooled-minutes line last.

### 4.2 Onboarding fee lines

Lines 304-313 hardcode `+ $100 one-time onboarding fee` for Starter and `Onboarding fee waived for new clients!` for Growth. Both are wrong. Replace with one unconditional line per card, interpolated from `SCHEDULES[slug].onboardingFee`. Delete the "waived" message outright.

### 4.3 The human-first band (D12)

Add a page-level band above the cards grid (which starts at line 191) carrying, verbatim in substance:

> **The AI never answers before you do.** A caller rings your real phone first. Only if nobody picks up does the AI step in, so it is replacing voicemail, not replacing you.

This is the single most important message on the page. It defuses the main objection and it is what makes the price increase defensible.

### 4.4 Receptionist callout (D12)

The `tier.slug === "growth"` callout at lines 320-347 currently advertises "24/7 AI Voice Receptionist / Never miss a call, even after hours", which is now true of every tier. Keep it Growth-only but re-aim it at the **60-second callback**, Growth's actual differentiator.

### 4.5 The guarantee (D7)

Add a prominent block, worded to match the MSA clause from §2.3(a) including the activation condition:

> If the system does not pay for itself in your first month from recaptured calls, the onboarding fee is refunded.

Wherever the page states the promise in short form, the qualifying detail must be reachable on the same page. A bare promise on the page and a three-condition clause in the contract is the mismatch D6 exists to prevent.

### 4.6 FAQ, full pass (D16)

`FAQS` at lines 75-115. Per-entry:

- **"What's the catch?"** (line 80): delete, replaced per D11 with a question answering the AI objection. Its current answer names "$297" and argues from price, which §0.5 forbids.
- **"What happens if I go over my minutes?"**: still accurate, reads from the schedule. Confirm the rate renders.
- **"Am I locked into a contract?"** (line 88): rewrite for D4. No notice periods on any tier.
- **"How fast can I be live?"**: unchanged.
- **"Do I get to keep my phone number?"**: MSA-sourced and still correct. Verify the $50 port-out and 30-day window survived Phase 2.
- **"Do I own my website?"**: verify the 30-day export window still matches the MSA.
- **"What if I already have a website?"**: unchanged.
- **"Is this replacing a receptionist?"**: still good, and now reinforces the human-first line.
- Keep the MSA section-reference comments accurate. They are the mechanism that stops marketing copy drifting from the contract; a stale `§14.1-14.2` is worse than none.
- Line 89 and line 60-ish carry em-dashes in rendered strings. Sweep.

### 4.7 Annual toggle (D20, deviates from brief)

Add a monthly/annual toggle. Annual is 10x monthly per §0.7. Requirements:

- The toggle changes the displayed price and makes the savings explicit ("2 months free").
- The onboarding fee does **not** change with billing period.
- Annual prices come from one derived constant, not three literals. Add an `annualPrice` to Schedule A derived as `monthlyPrice * 10` so the discount cannot drift from the price.
- The selected period must reach `/start` and then checkout. Extend the existing `subscribe()` at line 121, which currently sends `window.location.href = /start?plan={slug}`, to carry the period.

This block is the plan's largest deviation from the brief. If any part of it cannot be done cleanly, **the toggle is the thing to defer**, not the price changes.

### 4.8 `app/components/pricing/UpsellEnterprise.tsx` (D13)

Lines 62-64 claim a third Growth site "would cost you more than it should and give you less than Enterprise does". The cost half is now false: 2 x $497 = $994 against Enterprise's $1,097. Rewrite to the pooled-minutes argument, which is genuinely true: 1,050 shared minutes against two sealed pools of 350. The `Figure` pair at lines 96-108 may keep rendering real numbers; just stop asserting Enterprise is cheaper. Line 60 has a rendered em-dash.

`app/portal/consolidate/page.tsx` (lines 43, 92, 103, 106) runs the same arithmetic and needs the same treatment.

---

## Phase 5: Activation in onboarding (D21)

### 5.1 The wizard step

`app/components/onboarding/onboardingpageclient.tsx`, 1592 lines.

`WizardData` (line 89): add `receptionistMode: "forwarded" | "published" | "declined" | ""`, empty meaning not yet chosen. Initialise in `makeInitialData` (line 226) to `""`.

`steps` (lines 821-829): insert an activation step. Place it **after `look` and before `sites`/`review`** so it sits with the operational questions rather than interrupting the creative ones. Note the array is plan-conditional and `lookIndex`, `onLook`, and the `COLOR_STEPS` sub-wizard arithmetic at lines 833-834, 858, 865-890 and 1073 all index off it. Those use `findIndex` by key rather than hardcoded positions, so inserting a step after `look` is safe, but **re-read lines 1073 and 865-890 after the edit** and confirm the progress math still resolves.

The step must present all three options explicitly, with the human-first line from §4.3 restated, and must **not** pre-select one. Declining is a legitimate choice, not an error state, and the copy should not shame it.

Render the step body alongside the existing `steps[step].key === "..."` branches (the pattern at lines 1154, 1225, 1272, 1291, 1304, 1472, 1510).

Gate `next()` so the step cannot be skipped without a choice, consistent with how other required fields block advancement.

Add the choice to the review screen (`ReviewItem`, line 1585) so the client sees what they picked before submitting.

### 5.2 Submission

Submit posts to `/api/portal/onboarding` (line 1001). Include `receptionistMode` in the payload.

`app/api/portal/onboarding/route.ts` validates with `zBrandIntakeSubmission`. **If Phase 1.6 was skipped or the pin was not bumped, zod silently drops this field and the whole step records nothing.** Verify end to end with a real submission, not by reading code.

Persist via `completeSiteOnboarding` (`app/lib/account-store.ts`) onto the site record as `receptionistMode` + `receptionistChoiceAt`.

### 5.3 The instructions page

A dedicated page the client can return to, reachable after submission, with carrier-level forwarding instructions for the chosen option. Forwarding is a task clients often cannot finish in one sitting, which is why D21 splits the choice from the instructions.

For `declined`, this page instead confirms the web-only arrangement and states that no number will be purchased.

### 5.4 Declined after paying for Starter-with-receptionist

A client can pay for Starter at $197, then decline in the wizard. Web-only is **deliberately the same price**, so there is no refund and no proration: the amount owed does not change. Do not build a refund path. Do make sure the client is told plainly that declining does not reduce the price, at the moment they decline, so it is never discovered later. Skip the phone-number purchase (§3.6) and leave `retellAgentId` null.

---

## Phase 6: Stripe (D17, D18, D19)

**Nothing in this phase runs without explicit owner approval of the exact script and the target account.**

### 6.1 The account guard

`.env.local` holds `sk_test` keys. A script run with the ambient env hits the **test** account, which also contains roughly 20 fixture subscriptions at the old $297 price.

The script must:
1. Read the key from an explicitly passed variable, not ambient `.env.local`.
2. Print the resolved account id and `livemode` and **require an interactive confirmation** before any write.
3. Refuse to run if `livemode` does not match an explicit `--live` / `--test` flag.
4. Be idempotent, keyed on price `lookup_key` or metadata, so a re-run cannot create duplicates.
5. Write the created price ids to stdout in `KEY=value` form, ready to paste.

Write it to the scratchpad, not the repo: `C:\Users\Xander\AppData\Local\Temp\claude\C--Users-Xander-Desktop\d249fb91-5734-4c7b-9226-711a32ed8c0d\scratchpad`. It is a one-shot provisioning tool, not application code.

**Show the owner the script and the dry-run output. Wait for approval. Then run.**

### 6.2 Prices to create

Recurring monthly: $197, $497, $1,097. One-time: $297 (Starter), $297 (Growth), $697 (Enterprise). Per D20 also recurring yearly: $1,970, $4,970, $10,970.

Reuse the existing Product objects. Do not create new ones; nothing requires it and it would fragment reporting.

### 6.3 `app/lib/plans.ts`

Currently only Starter has an `onboardingPriceId` (lines 15-32), because Growth and Enterprise were $0. Add onboarding price ids for Growth and Enterprise, and annual monthly-equivalents per D20. `PlanConfig` (lines 5-10) needs the annual field; consider `{ monthlyPriceId, annualPriceId, onboardingPriceId }` and have the caller select by period.

Note `monthlyPriceId` uses a non-null assertion (`!`) while `onboardingPriceId` does not. Keep that distinction: a missing monthly price is a broken deployment, a missing onboarding price was historically legitimate. Now that all three tiers charge one, consider making them all required and failing loudly, which is better than silently not charging $297.

### 6.4 `app/api/checkout/route.ts`

Lines 89-94 already push the onboarding fee as a second line item when configured, so one session collects both charges. That satisfies the brief. Verify by reading that it now fires for all three tiers, and extend for the annual period so an annual selection uses `annualPriceId` with the onboarding fee still charged once.

`allow_promotion_codes: true` (line 136) stays: the owner chose annual-plus-promo flexibility over removing discount surfaces.

### 6.5 Env vars (D18)

New: `STRIPE_PRICE_GROWTH_ONBOARDING`, `STRIPE_PRICE_ENTERPRISE_ONBOARDING`, plus three annual vars. Add to `.env.example`, set in `.env.local`, **and set in the Vercel project**. Production regressions here are reliably vars that only ever existed in `.env.local`, and nothing changes in production until a redeploy.

Existing names to reuse: `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_ENTERPRISE_MONTHLY`, `STRIPE_PRICE_STARTER_ONBOARDING`.

### 6.6 Archiving old prices (D19)

**After** everything else is green: grep the repo for each old price id and env var, confirm zero references, then archive. `app/api/portal/consolidate/route.ts:61` references `STRIPE_PRICE_ENTERPRISE_MONTHLY`; that var persists, only its value changes. Report what you archived.

---

## Phase 7: Web-only and annual, recorded off-menu

Per brief §5 and §6.4, neither goes on the public pricing page except the D20 toggle.

Record the web-only variant where sales can reach it: `C:\Users\Xander\Desktop\sales-scripts`. Capture the price ($197/mo + $297 onboarding), the deliberate reasoning (identical to Starter so it is never the economically attractive choice), the trigger (offered **only** when a prospect explicitly refuses AI on their phone line), and the mechanism (`receptionistMode: "declined"`, no number, no agent, no call log).

If `sales-scripts` holds a file with step or objection ids, note the known trap: track step ids and objection ids must be globally unique or the branch hinting mislabels, and `tsc` will not catch a collision.

Annual prepay: two months free, available on request and now also self-serve per D20. Note that the agreement text needs an annual variant.

---

## Phase 8: Verification and delivery (D23)

### 8.1 Mechanical checks

```
cd ops/jdd-schema          && npm run build && npm test
cd ops/juneau-digital-designs && npx tsc --noEmit && npm run build
```

Both repos clean. `npm run build` on the agency app must **not** run over a live dev server; stop any `next dev` first. If a CSS edit appears to be ignored, delete `.next` rather than restarting, and do not use `--turbo` on the console.

Em-dash check across touched files:

```
grep -rn '—' app --include=*.ts --include=*.tsx
```

Judge each hit: comments and code prose are acceptable, anything inside a rendered string is not. Fix with `Edit`, never a PowerShell round-trip (§0.2).

### 8.2 Acceptance checklist (from the brief, plus owner decisions)

- [ ] Monthly prices $197 / $497 / $1,097 everywhere
- [ ] Onboarding fees $297 / $297 / $697 everywhere
- [ ] No `$117`, and no `$297` as a *monthly* price, anywhere on the public site
- [ ] Every tier's features show the AI receptionist and the post-call text brief
- [ ] Growth leads with the 60-second callback, not minutes
- [ ] Minutes are a secondary line item on every card, never a headline
- [ ] "The AI never answers before you do" present on the pricing page
- [ ] Web-only **not** visible on public pricing
- [ ] No minimum-term, contract, or early-termination language anywhere
- [ ] Guarantee present, worded "onboarding fee", with the D8 metric and activation condition
- [ ] Activation step present with a working decline path, choice persisted and readable
- [ ] Checkout collects onboarding fee plus first month in one session, all three tiers
- [ ] Zero em-dashes in rendered strings in touched files
- [ ] SEO removed from cards and MSA; two content edits and portal access retained
- [ ] Site-swap fee removed
- [ ] Enterprise upsell no longer claims a cost saving
- [ ] Annual toggle works end to end (deviation, see §0.4)
- [ ] `npx tsc --noEmit` and `npm run build` both clean
- [ ] Schema `npm test` green, pins bumped in all three consumers

### 8.3 Manual verification

Read the rendered agreement for **all three plans** at `/agreement`, end to end. It is generated prose assembled from conditionals; a plan-filtered document is exactly where a stale ternary hides. Specifically confirm: the guarantee reads correctly, no notice period survives, Starter now carries the voice-agent sections, and section cross-references still resolve (an unknown id renders `[?]` rather than throwing, so a broken ref is visible only by reading).

If verifying in the browser pane, note it runs with `visibilityState=hidden`: screenshots, framer-motion, and CSS transitions all freeze. Verify via the DOM, and inject `transition: none` to read settled values.

### 8.4 Delivery

Branch `feat/pricing-2026-10` off `ea48459`. Commit in reviewable chunks, roughly one per phase. Then:

```
vercel deploy --yes
```

from the agency repo, and return the bare `https://` preview URL. **No production deploy.** The owner reviews and promotes.

### 8.5 Report

State plainly: what shipped, the three deviations from §0.4, anything deferred, and any price you refused to improvise. If something blocked you, report it rather than inventing a number. That instruction is in the brief and it is the one rule that matters most here.

---

## Out of scope (do not do, even if you notice)

- Changing the site's design, layout, or components
- Per-service-page add-on product (planned, not approved)
- Portal or console work beyond what D1, D2, and D22 strictly require
- Removing `@vercel/speed-insights` (real issue, separate task)
- Upgrading the Vercel plan (real issue, separate task)
- Migrating, counting, or surfacing the ~20 test-mode fixture subscriptions
