# HANDOFF — A2P identity collection in the onboarding wizard

**For:** the agent owning per-client A2P 10DLC registration
**From:** the CRM v2 session (`PLAN-portal-crm-v2-customers-messaging.md`)
**Repo:** `juneau-digital-designs` (the agency site — the wizard lives here, not in `jdd-ops`)
**Date:** 2026-10-29
**Source of truth for the registration flow itself:** `JDD-a2p-isv-runbook.html`
(Phase 1.1 / 1.2) and `PLAN-portal-form-capture.md` §1b (EIN zero-retention)

---

## 0. Scope — what this handoff is and isn't

**In scope:** the onboarding-wizard step that collects the business identity details Twilio
TrustHub needs, and the submit-and-consume route behind it.

**Out of scope here** (owned by the runbook / `jdd-ops`): the nine-call TrustHub chain,
`lib/a2p-register.js`, the brand/campaign creation, the daily status poller, and the Messaging
Service per client.

**Explicitly NOT the CRM plan's job.** The CRM v2 plan *reads* `site.a2pStatus` to gate messaging
and nothing else. It never writes it and never collects identity data. The one place the two
touch is the schema field declaration — see §7.

---

## 1. Why this exists

Growth/Enterprise clients each need their own A2P brand + `CUSTOMER_CARE` campaign so their
number sends as *their* business. Registration takes **13–20 business days** and cannot start
until we have the business's legal identity. The onboarding wizard is the only moment we have the
client's attention and a reason to ask.

Starter and web-only clients **never register** (they send no customer-facing messages), so this
step must not appear for them.

---

## 2. What must be collected

From the runbook's gap table — the current intake has almost none of it:

| Field | TrustHub target | Status today |
|---|---|---|
| Legal business name (exactly as on the EIN letter) | Business EndUser | only trade name |
| Business type — LLC / Corporation / Partnership / Sole Prop | Business EndUser | missing |
| **EIN** (`business_registration_number`) | Business EndUser | missing |
| Business industry — **TCR enum, not freeform** | Business EndUser | freeform only |
| Website URL | Business EndUser | derivable from canonical |
| Street / city / region / postal / country — **separate fields** | Address resource | one freeform string |
| Authorized rep: first name, last name | Representative EndUser | partial |
| Authorized rep: job position + business title | Representative EndUser | missing |
| Authorized rep: direct email + phone | Representative EndUser | business email/phone only |

Three input rules that prevent multi-day rejections:
- **Decompose the address.** Do not parse the existing freeform `brand.address`; a mis-parsed
  region fails the compliance evaluation with no useful error.
- **Industry is a `<select>` of TCR enum values**, not text. _(verify)_ which enums map to the
  verticals actually sold (plumbing, lawn care, car detailing, HVAC, roofing).
- **Format-check the EIN client-side** (`NN-NNNNNNN`). A typo costs a brand rejection and a
  restart, which is days.

`business_name` must match the IRS record character-for-character. *"Arthur's Plumbing LLC"* vs
*"Arthurs Plumbing, LLC"* is a rejection.

---

## 3. ⚠️ The blocker nobody has flagged yet — the wizard autosaves everything

This is the most important section. **I verified it in the code; the runbook and the form-capture
plan both assume a clean slate that does not exist.**

The onboarding wizard persists its entire `formData` object to **two** places:

1. **Redis**, via `POST /api/portal/onboarding/draft` → `app/lib/onboarding-draft-store.ts`.
   `saveDraft()` writes `{ data: Record<string, unknown> }` to
   `jdd:onboarding-draft:{clerkUserId}:{siteRef}` with a **30-day TTL**
   (`DRAFT_TTL_SECONDS = 60*60*24*30`).
2. **`localStorage`** in the browser — see the draft-restore logic in
   `app/components/onboarding/onboardingpageclient.tsx` (~line 629 and the restore effect at
   ~line 678). This one has **no TTL at all** and sits on the client's own machine.

So if the A2P identity step is built as an ordinary wizard step, **the EIN is written to Redis for
30 days and to the client's browser forever.** That is a direct violation of the zero-retention
requirement in `PLAN-portal-form-capture.md` §1b, and retrofitting it later means auditing every
draft, backup and browser that ever held one.

**The step must bypass the draft mechanism entirely.** Concretely:
- Keep the A2P fields **out of `formData`**. Hold them in local component state that the autosave
  effect does not read.
- If that is impractical, maintain an explicit denylist in the autosave path and strip the A2P keys
  before both the `fetch` to `/draft` and the `localStorage.setItem`. Prefer the first — a denylist
  is one careless rename away from leaking.
- Add a test asserting the draft payload never contains an EIN-shaped value (§6).

---

## 4. Architecture — submit-and-consume

The EIN is needed for **exactly one API call, once**: `business_registration_number` on the
`customer_profile_business_information` EndUser. Everything downstream references the **EndUser
SID** (`IT…`), never the number again.

```
client types EIN
  → POST /api/onboarding/a2p-identity      one request, TLS
  → POST https://trusthub.twilio.com/v1/EndUsers   EIN in the body, in memory only
  → persist ONLY A2P_BUSINESS_ENDUSER_SID = IT…
  → request ends; plaintext unreachable from that moment
  → response: { ok: true }                 never echoes the value back
```

**The structural constraint:** the EIN field's submit handler *is* the registration call.
Collecting it at one step and using it at a later one requires somewhere to hold it between
requests, and serverless memory does not survive invocations — so "somewhere" becomes storage.
This also means the step **cannot** sit before anything that would split collection from use.

Rules (from form-capture §1b):
- Never to KV, disk, `clients/{slug}/.env.local`, or **`site.ts`** (that file is committed to the
  client's own GitHub repo)
- Never to `console/.state/audit.ndjson` — log *"A2P identity submitted and consumed"* with a
  timestamp, matching the existing key-names-not-values pattern
- Never into a `console.log`. The route must not log its request body, and **error paths must not
  interpolate the payload** — a Twilio 400 echoed verbatim into a log line is the likeliest leak
- Never back to the browser, including inside an error response
- Same treatment for the **authorized representative's** name, direct email and mobile — personal
  data, needed for one call, keep only the `IT…`
- The **business address is the one exception worth persisting** (`provisionTwilioNumber` already
  uses its ZIP for geography-first number search, and it is public in `site.ts`) — though note the
  *registration* address is conceptually distinct from the site's public one

_(verify)_ Whether Vercel request logs can capture a POST body. The design assumes they cannot; if
they can, the route needs explicit log suppression rather than discipline about `console.log`.

---

## 5. Where it sits in the wizard

The wizard builds its step list dynamically — see `onboardingpageclient.tsx` ~line 957:
```js
...(slots ? [{ key: "proof", label: "Proof & details" }] : []),
```
The A2P step follows the same conditional pattern, gated on **plan is growth/enterprise**. Add it
**after** "Proof & details".

Placement tension to resolve: late enough that the client is committed (an EIN prompt early in a
signup flow reads as a scam), but it cannot be *after* anything that would make submit-and-consume
span two steps. _(decide)_

**Copy matters here.** Say plainly why it is needed and that Twilio retains it as registrar — the
form-capture plan is explicit that admitting this is what makes the rest credible. The accurate
term is **zero-retention**, not zero-knowledge: JDD never stores it, but it transits our server's
memory for one request, Twilio keeps it permanently, and the client's browser had it.

---

## 6. Resume, abandonment, and the enforcing test

**Resume — do not unconditionally re-ask.** If the EndUser was created before the client quit, the
SID is on file and the EIN is not needed again; re-asking makes them expose it twice for nothing.
- No EndUser SID → ask (automatic, since nothing was stored)
- EndUser SID present → skip the field, show *"business identity on file with our messaging
  provider"*

**Abandonment.** Nothing was stored on our side, so there is nothing to delete here — but if the
EndUser was created, **Twilio still holds it**. On draft expiry, delete the orphaned TrustHub
objects, guarded on registration never having completed (deleting after brand approval breaks a
live registration). _(verify)_ `DELETE /trusthub/v1/EndUsers/{sid}` is supported; fallback is
overwriting the attributes with placeholders.

**The test (preventive, not regression-driven).** Spy the Redis client across the registration path
and the draft path, and fail on any written value matching `\d{2}-?\d{7}`. This cuts against the
repo convention of testing real bugs — justified because the failure is silent, permanent and
unrecoverable. Extend it to cover the `localStorage` payload too, given §3.

---

## 7. Coordination with the CRM v2 plan

Only one overlap: **`PortalSite.a2pStatus`**.

- The CRM plan **reads** it to gate `messaging` and to render the three-week wait as progress.
- Your workstream **writes** it (`onboard.js` advances it; the poller updates it).
- The field does not exist in `@jdd/schema` yet. **Whoever cuts the next schema release adds it** —
  do not cut two competing releases. See `PLAN-portal-crm-v2-customers-messaging.md` §1.3 for the
  6-step release checklist.

```ts
a2pStatus?:
  | "not-applicable"                       // Starter / web-only — a real terminal state
  | "none"
  | "profile-pending" | "profile-approved"
  | "brand-pending"   | "brand-approved"
  | "campaign-pending" | "verified" | "failed";
```

`not-applicable` matters more than it looks: without it, Starter sits in `none` forever and any
"is registration done?" check reads it as perpetually pending — the same trap as `receptionistMode`
being absent versus explicitly `declined`. **State it, never infer it from the plan.**

**Pin status (just fixed):** all three consumers — `juneau-digital-designs`, `jdd-ops`,
`jdd-ops/console` — are now on `@jdd/schema` **v1.29.0**. Earlier today two of them were stranded
on v1.28.0; that is resolved, so you are building on an aligned base.

One decision already made on the CRM side that affects you: `a2pStatus === "failed"` maps to the
existing `connecting` state in `siteFeature`, **not** a new `error` state —
`FeatureAvailability` has exactly four variants and every consumer switches exhaustively on them.
Surface `failed` to the operator through the console, not the client portal.

---

## 8. Files you will touch

| File | Why |
|---|---|
| `app/components/onboarding/onboardingpageclient.tsx` | the new conditional step; **and the autosave exclusion (§3)** |
| `app/lib/onboarding-draft-store.ts` | verify nothing A2P reaches `saveDraft` |
| `app/api/portal/onboarding/draft/route.ts` | the Redis write path to keep clean |
| `app/api/onboarding/a2p-identity/route.ts` | **new** — submit-and-consume |
| `jdd-schema` `src/account.ts` | `a2pStatus` (coordinate — §7) |

**Do not touch** anything under `app/components/portal/Crm*`, `app/lib/portal-crm.ts`,
`app/lib/crm-contacts.ts`, or `app/api/portal/{crm,customers,inbox,messages}` — those are the CRM
v2 plan's, and several are mid-rewrite.

---

## 9. Open items

- _(verify)_ TCR `business_industry` enum values for the sold verticals
- _(verify)_ Vercel request-log body capture (§4)
- _(verify)_ `DELETE /trusthub/v1/EndUsers/{sid}` support (§6)
- _(decide)_ Exact wizard placement (§5)
- _(decide)_ Whether EIN-less Growth clients get the `SOLE_PROPRIETOR` path (one number per
  campaign, needs rep OTP) or are told an EIN is required. **Enterprise must require an EIN** —
  Sole Proprietor allows one number per campaign and Enterprise runs 2–3.
