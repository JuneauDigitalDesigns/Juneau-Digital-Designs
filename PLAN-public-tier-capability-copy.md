# PLAN — Public-site copy for the new tier capabilities

**Repo:** `juneau-digital-designs`
**Branch:** `feat/pricing-2026-10` (commit here; large uncommitted CRM tree stays untouched)
**Date:** 2026-10-29
**Derived from:** `HANDOFF-tier-capability-copy.md` + scoping Q&A
**Status:** plan approved pending wording sign-off (see §7 Gates)

---

## 1. Scope — locked

Four surfaces. Everything else on the site is explicitly **out**.

| In scope | Files |
|---|---|
| Compliance / SMS | `app/lib/sms-consent-text.ts`, `app/sms-terms/page.tsx` |
| Agreement | `app/lib/legal/schedules.ts` (`included` + `feeTable`), `app/components/agreement/AgreementClient.tsx` (verify only) |
| Public marketing | `app/components/home/homepageclient.tsx`, `app/components/pricing/pricingpageclient.tsx`, `app/components/pricing/UpsellEnterprise.tsx` |
| Onboarding wizard | `app/components/onboarding/onboardingpageclient.tsx` — tier accuracy, lead-capture story, decline path, **plus an A2P step copy spec (words only, no code)** |

**Out of scope — do not edit:** `LeadPanel.tsx`, `SiteToCallPanel.tsx`, `footer.tsx`, all portal copy
(`FeatureState.tsx`, `GrowthProvisioning.tsx`, tour steps), `terms-v5.ts`, `privacy-policy/`.

**The A2P identity step — copy spec only.** The step does not exist today: zero references to
A2P / 10DLC / EIN / registration across all 2,049 lines of `onboardingpageclient.tsx`. Its build is
a separate workstream specified by `HANDOFF-a2p-onboarding-identity-step.md`, and it is **not a copy
task** — it carries a new API route, surgery on the wizard's autosave path, an `@jdd/schema` field,
and a preventive test. This pass delivers only the step's **wording**, as a spec the builder drops
in. See §8 for the boundary and what the build inherits.

---

## 2. Decisions locked in Q&A

| # | Decision |
|---|---|
| 1 | Spine is the *tells-you / acts-for-you* **idea, reworded** — including rewording the existing homepage lines that already use it verbatim |
| 2 | `/sms-terms` gets a **full rewrite now**: one page, two explicitly separated programs |
| 3 | The `/agreement` opt-in checkbox stays **Account-lane only** |
| 4 | Two-way texting + review requests are listed as **post-launch, gated on carrier approval of the client's business registration** |
| 5 | **No week estimates anywhere public.** "Day ~20" / "2–3 weeks" never appears in site copy |
| 6 | Web-only gets a **quiet mention as one pricing FAQ entry** — never a tier, never priced |
| 7 | The consent **string changes**, so `SMS_CONSENT_TEXT_VERSION` bumps in the same commit |
| 8 | `/sms-terms` **imports** the consent constant instead of hardcoding it |
| 9 | Portal spillover from the string change is **accepted** (no portal copy written) |
| 10 | Matrix divergence is **noted**, not synced |
| 11 | **Single commit** in this repo (+ one separate commit in `jdd-ops`, different repo) |
| 12 | A2P is **copy spec only** this pass; the build is its own workstream |
| 13 | A Growth client with no EIN gets the **`SOLE_PROPRIETOR` path**; **Enterprise requires an EIN** (Sole Prop allows one number per campaign, Enterprise runs 2–3) |
| 14 | The wizard's **autosave retention review travels with the A2P build**, not this pass and not a separate task |

---

## 3. Facts the plan rests on (verified, not assumed)

- `app/lib/legal/schedules.ts` is already correct on prices/minutes and is **authoritative**. All
  figures derive from it. `homepageclient.tsx:20` already does this (`SCHEDULES.starter.monthlyPrice`).
- `homepageclient.tsx:998` already reads "Starter tells you." and `:1004` "Growth acts for you."
  (shipped in `be8079e`). These are the lines to reword.
- `pricingpageclient.tsx:94` holds a `FAQS: { q, a }[]` array — the home for the web-only entry.
- `onboardingpageclient.tsx` already models `receptionistMode: "forwarded" | "published" | "declined"`
  (options ~231–248, declined branch ~1890). The decline path exists; only its copy needs work.
- `SMS_CONSENT_TEXT` has **five** consumers:
  `AgreementClient.tsx:686`, `SettingsSection.tsx:586` (portal), `lib/sms-consent.ts:92` (hashing),
  `api/agreement/route.ts:182` (version stamp), and a **hardcoded duplicate** at
  `app/sms-terms/page.tsx:190-193`.
- `splitConsentText()` matches on the literal substrings `"SMS Terms"` and `"Privacy Policy"`.
  Any new string **must still contain both phrases verbatim** or the links silently stop rendering.
- `/sms-terms` is a server component and `sms-consent-text.ts` is client-safe (no `node:crypto`),
  so importing it there is safe.
- Scripts available: `next build`, `eslint`. No typecheck script — use `npx tsc --noEmit`.
- The wizard **autosaves its entire `formData` to two stores**: Redis via
  `/api/portal/onboarding/draft` (`onboarding-draft-store.ts`, 30-day TTL) and `localStorage` with
  **no TTL** (restore logic ~`:629` / `:678`). This matters to the A2P build, not to copy — but it
  is the reason an EIN can never be an ordinary wizard field.
- The wizard builds its step list conditionally (~`:957`), so an A2P step gated on
  growth/enterprise follows an existing pattern.

---

## 4. Phases

### Phase 0 — Pre-flight

1. **Record a `npx tsc --noEmit` baseline before touching anything.** The uncommitted CRM tree may
   already carry errors; without a baseline there is no way to prove this pass kept it clean.
2. Read each target region in full before editing. No blind edits.
3. No `git add -A`, no `stash`, no `rebase`. Stage copy files by explicit path only.

### Phase 1 — Compliance core (highest risk, do first)

**1a. `app/lib/sms-consent-text.ts`**
- Reword `SMS_CONSENT_TEXT` to scope it explicitly to **account** alerts (JDD → the business owner),
  so it cannot be read as covering messages to the client's customers.
- Must retain every TCR-required element: consent not a condition of purchase, message & data rates,
  frequency varies, STOP to opt out / HELP for help, and the literal phrases `SMS Terms` and
  `Privacy Policy`.
- Bump `SMS_CONSENT_TEXT_VERSION` → `sms-consent-v2` **in the same commit**, per the file's own
  contract. Old consent events keep their v1 hash and stay provable.

**1b. `app/sms-terms/page.tsx` — full rewrite**

One page, two clearly separated programs, explicit that they are different programs:

| Program | Traffic | Campaign | Sender | Consent collected by |
|---|---|---|---|---|
| **Account alerts** (JDD → owner) | post-call briefs, new-lead alerts, service alerts | JDD's `ACCOUNT_NOTIFICATION` | a dedicated JDD notification number | JDD, on `/agreement` |
| **Customer messaging** (business → its own customers) | lead replies, Google review requests | the **client's own** `CUSTOMER_CARE` | the client's provisioned number | the client, from its customers |

- **Delete the false clause.** "we never message your customers" is replaced by the honest
  statement: JDD's own program messages only account holders; messages to a client's customers are
  sent under that client's own carrier registration, from that client's own number.
- Replace the hardcoded consent blockquote with a render of `splitConsentText()`.
- State Customer-lane availability as gated on carrier approval of the business registration — no
  timeframe.
- Update the effective date (currently `August 13, 2026`). **Needs a date from the operator.**
- **Do not invent sample message bodies.** The file's doc comment requires samples to stay
  byte-identical to what the sender actually sends. Pull the review-request body from
  `app/lib/review-request.ts` (currently untracked) and the post-call body from the Make scenario
  before writing any sample.

### Phase 2 — Agreement & schedules

**2a. `app/lib/legal/schedules.ts`** — this is **contract text**; wording needs sign-off.
- Starter `included`: "Email lead capture from the website contact form" is now wrong. Web forms land
  in the portal and the owner gets an SMS alert. Reword.
- `RECEPTIONIST_INCLUDED` / per-tier `included`: add portal lead capture + new-lead SMS alert to owner.
- `WEB_ONLY_SCHEDULE.included`: **also** gets portal lead capture + owner SMS alert (per the matrix,
  web-only has both on day one) and its lead-capture bullet reworded off "email".
- Growth + Enterprise `included`: add two-way texting from the portal and Google review request SMS,
  each marked available after carrier approval of the client's business registration.
- `feeTable` rows: add the new capabilities; Starter/web-only state them as not included.
- **Update the doc comment at ~line 196.** It currently says web-only is "Never shown on public
  pricing," which the new pricing FAQ entry would contradict. Reword to: never priced or listed as a
  public tier, acknowledged only as an FAQ answer.

**2b. `AgreementClient.tsx`** — verify, light touch. The checkbox renders through
`splitConsentText()` so it updates automatically. Check only that surrounding label/helper copy and
the `hasReceptionist` gating still read correctly against the new string.

**2c. `api/agreement/route.ts`** — expected to need no change (it reads the version constant).
Verify, don't edit.

### Phase 3 — Public marketing

**3a. `homepageclient.tsx`**
- Reword the Starter (`:998`) and Growth (`:1004`) card lines with fresh phrasing that keeps the
  distinction: Starter *reports* the lead, Growth *acts* on it.
- Work in the lead-capture story (web form → portal, owner gets a text) without bloating the cards.
- Keep every figure deriving from `SCHEDULES`. Never hardcode a price or minute count.

**3b. `pricingpageclient.tsx`**
- Add the web-only FAQ entry to `FAQS` — roughly "Can I get the website without the AI receptionist?"
  — answered honestly: yes, same price, not a separate plan.
- Add two-way texting + review requests to the Growth/Enterprise feature lists with approval-gated
  wording.
- **Leave the existing working-tree edit alone** (onboarding fee moved inline beside the price).

**3c. `UpsellEnterprise.tsx`** — read it; edit only if it makes a claim the matrix contradicts.

### Phase 4 — Onboarding wizard (3 of 4)

- Tier/capability accuracy sweep: no "Starter = website only", no "receptionist is a Growth feature".
- Lead-capture story: forms land in the portal, owner gets an SMS alert.
- Decline / web-only path copy (~`:1836`, `:1890`): state plainly what a declining client does and
  does not get. **Must match the gate** — `siteFeature(site, "calls")` returns `not-on-plan` only for
  web-only, so a declining client still gets portal lead capture and the owner SMS alert, just no
  calls and no receptionist.
- **A2P step copy spec** (words only, delivered as a spec — no step is wired in this pass). Per
  `HANDOFF-a2p-onboarding-identity-step.md` §5, the copy must:
  - say plainly *why* the details are needed (their number must send as their business);
  - state that **Twilio retains the EIN permanently as registrar**, while JDD never stores it;
  - use the accurate term **zero-retention**, never "zero-knowledge" — the value transits our
    server's memory for one request and the client's browser held it;
  - branch on tier per decision 13: Enterprise requires an EIN; a Growth client without one is
    offered the Sole Proprietor path (one number per campaign, rep OTP verification);
  - carry the resume case from §6 — when identity is already on file, the copy reads *"business
    identity on file with our messaging provider"* rather than asking again;
  - avoid any timeframe promise, consistent with decision 5 (the handoff's internal figure is
    13–20 business days; public-facing copy stays approval-gated).

### Phase 5 — Divergence notes (separate repo, separate commit)

- `jdd-ops/PLAN-portal-form-capture.md` §1a — add a line: public copy deliberately uses
  approval-gated language rather than the internal "Day ~20" estimate, because the delay is the
  carriers' to grant, not ours to promise.
- `JDD-cost-analysis-2026-10-29.html` (on the Desktop, outside any repo) — same note, no commit.
- Use forward slashes in any path written into a markdown file in these repos: Tailwind v4
  auto-detects content sources from the git root, and a Windows-style path breaks the build with
  "Invalid code point" blamed on `globals.css:1:1`.

### Phase 6 — Verification

1. `npx tsc --noEmit` — clean, compared against the Phase 0 baseline.
2. `npm run build`.
3. `npm run lint`.
4. Grep the diff for any newly hardcoded price or minute figure.
5. `git diff --cached --name-only` reviewed by eye before commit — confirm **no** CRM file, no
   `.env`, no portal file is staged.
6. One commit, copy files only. Commit message records the consent version bump and the intentional
   portal spillover.

---

## 5. Risks

| Risk | Handling |
|---|---|
| `schedules.ts` is signed-contract text | Exact bullet wording approved before commit (§7) |
| Consent string is carrier-reviewable and hashed | Version bump in the same commit; wording approved before commit |
| **The live Twilio/TCR campaign carries the old opt-in language** | Changing the string means the registered campaign's opt-in language must be updated too. This is an **ops action outside this repo** — flagged, not performed here |
| Sample message bodies must match what actually sends | Read from `review-request.ts` and the Make scenario; never invented |
| Dirty CRM tree | Baseline tsc; explicit-path staging; no stash/rebase |
| Portal renders the new consent string though portal is out of scope | Accepted by decision 9; noted in the commit message |
| A2P copy could imply a step that does not exist yet | Delivered as a spec, not wired into the wizard. Nothing ships a dead step |

---

## 6. Open items needing operator input

1. **Approval of the exact consent string** and the `/sms-terms` body.
2. **Approval of the `schedules.ts` contract bullet wording.**
3. The **effective date** for the rewritten `/sms-terms`.
4. Confirmation of who updates the **live campaign opt-in language** with Twilio/TCR.

*(The A2P md spec has been received — `HANDOFF-a2p-onboarding-identity-step.md`. It no longer blocks
this pass; see §8.)*

## 7. Gates

- **Gate A** — before any Phase 1 or Phase 2 file is written: operator approves consent string
  wording, `/sms-terms` structure/body, and `schedules.ts` bullet wording.
- **Gate B** — before the commit: Phase 6 verification green and the staged file list reviewed.

---

## 8. The A2P build — out of scope here, boundary recorded

Specified by `HANDOFF-a2p-onboarding-identity-step.md`. **Not part of this copy pass.** Recorded
here only so the boundary is explicit and nothing falls between the two.

**Why it is separate.** It is a different risk class. An EIN written to the wizard's draft stores is,
in the handoff's own words, silent, permanent and unrecoverable. That belongs in its own commit with
its own test and its own review — not inside a single copy commit.

**What the build owns:** the conditional wizard step; `app/api/onboarding/a2p-identity/route.ts`
(submit-and-consume); keeping A2P fields out of `formData` so neither draft store ever sees them;
the preventive Redis/`localStorage` spy test; and `a2pStatus` in `@jdd/schema` — coordinated, since
all three consumers are aligned on **v1.29.0** and the handoff forbids cutting two competing releases.

**What it inherits from this pass:**
- the step's approved copy (Phase 4), including the Sole Proprietor branch per decision 13;
- decision 14 — the wizard autosave retention review travels with this build;
- decision 5 — no timeframe promises in anything client-facing.

**Open items the build must close.** From the handoff §9, plus one gap found while planning:

| Item | Status |
|---|---|
| EIN-less Growth → Sole Prop vs require EIN | **Decided** — Sole Prop for Growth, EIN for Enterprise (decision 13) |
| TCR `business_industry` enum values for the sold verticals | open *(verify)* |
| Whether Vercel request logs capture a POST body | open *(verify)* |
| `DELETE /trusthub/v1/EndUsers/{sid}` support | open *(verify)* |
| Exact wizard placement | open *(decide)* — after "Proof & details", but §4 forbids splitting collection from use |
| **Where `A2P_BUSINESS_ENDUSER_SID` is persisted** | **open — gap in the handoff.** §4 says persist only the SID and forbids KV/disk/`.env.local`/`site.ts` for the EIN, but never names a home for the SID. §6's resume logic needs to read it at wizard load, so it requires one |
