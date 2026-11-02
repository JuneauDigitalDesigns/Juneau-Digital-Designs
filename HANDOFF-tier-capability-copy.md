# HANDOFF — Public-site copy for the new tier capabilities

**Repo:** `juneau-digital-designs` (agency site)
**Branch base:** `feat/pricing-2026-10`
**Date:** 2026-10-29
**Status:** context only — no work started

---

## ⚠️ Scope: do NOT rewrite copy across the site

**The operator will tell you which copy to change, surface by surface.** This document exists to give
you the *capability facts* and a *file inventory* so that when you are pointed at a section you
already know what is true. It is not a mandate to sweep the site.

Three rules for this work:

1. **Wait to be told which surface.** If you have not been given a specific page, section or
   component, ask. "The tiers changed so I updated the homepage, pricing page and footer" is the
   failure mode to avoid.
2. **One exception, flagged below:** `app/sms-terms/page.tsx` contains a factual claim that is about
   to become false. That is a compliance document, not marketing copy, and it should be raised
   proactively rather than waited on.
3. **Never restate prices or minute allowances from memory.** `app/lib/legal/schedules.ts` is the
   authoritative source — it is the contract. Derive from it or quote it; do not hardcode a second
   copy that can drift.

---

## 1. Why copy needs to change at all

Two separate shifts landed:

**The 2026-10-12 reprice.** Every tier now includes the AI receptionist. Tiers differ by
*capability*, not by whether a receptionist exists. Prices are $197 / $497 / $1,097 with onboarding
fees of $297 / $297 / $697 (`app/lib/legal/schedules.ts`). Any copy implying Starter is
"website-only" or that call tracking is a Growth feature is stale — commit `be8079e` already fixed
the homepage tier cards, so check before assuming a surface is wrong.

**The lead-capture + two-way messaging work** (`jdd-ops/PLAN-portal-form-capture.md`). Web forms now
land in the client's portal instead of an email inbox, and Growth/Enterprise gain two-way texting
and review requests. This is new capability that no public copy describes yet.

The product line that came out of it, and the one worth writing to:

> **Starter tells you. Growth acts for you.**

The boundary is *acting* on a lead, not receiving one. Starter captures every web form into the
portal and texts the owner when one arrives — it just never messages the customer and has no
pipeline board.

---

## 2. The capability matrix — the canonical statement

This is the source of truth for any capability claim. It is also in
`~/Desktop/JDD-cost-analysis-2026-10-29.html` (§"What a client actually gets, and when") and
`jdd-ops/PLAN-portal-form-capture.md` §1a. If you change it, change it in all three.

| Capability | Web-only $197 | Starter $197 | Growth $497 | Enterprise $1,097 |
|---|---|---|---|---|
| Website + web form | Day 1 | Day 1 | Day 1 | Day 1 · 3 sites |
| Portal lead capture | Day 1 | Day 1 | Day 1 | Day 1 |
| New-lead SMS alert to owner | Day 1 | Day 1 | Day 1 | Day 1 |
| Inbound calls + human-first forward | — | Day 1 | Day 1 | Day 1 |
| AI receptionist | — | Day 1 · 100 min | Day 1 · 350 min | Day 1 · 1,050 pooled |
| Call log → portal | — | Day 1 | Day 1 | Day 1 |
| Post-call SMS brief to owner | — | Day 1 | Day 1 | Day 1 |
| CRM pipeline board | — | — | Day 1 | Day 1 |
| Retell lead callback from the form | — | — | Day 1 | Day 1 |
| **Two-way texting from the portal** | — | — | **Day ~20** | **Day ~20** |
| **Google review request SMS** | — | — | **Day ~20** | **Day ~20**  |

### Using this for copy, carefully

The matrix is useful for feature lists and comparison tables, but **it is an internal artifact and
should not be transcribed verbatim into public copy.** Two reasons:

- **"Day ~20" is not a sales promise.** Two-way texting and review requests wait on the client's own
  A2P 10DLC carrier registration: 3–5 business days for the brand, 10–15 for the campaign. Public
  copy should not print a number we do not control. Prefer framing like *"activates once the mobile
  carriers approve your business registration — usually two to three weeks after launch"*, and say
  it at the point of sale rather than burying it. A Growth client who discovers the delay *after*
  paying has a legitimate complaint; one who was told up front does not.
- **Web-only is not a plan.** It is `plan: "starter"` + `receptionistMode: "declined"`, priced
  identically to Starter and offered only when a client refuses AI on their line. It must never
  appear as a fourth public tier. It is in the matrix because it is a distinct *cost and capability*
  shape internally.

---

## 3. The one thing to raise proactively

`app/sms-terms/page.tsx:91-93` currently reads:

> The program is available to Juneau Digital Designs clients who use our AI receptionist, and only
> for the mobile number that client provides. We do not send marketing or promotional messages
> through this program, and **we never message your customers.**

That last clause becomes **false** the moment two-way texting or review requests ship.
`app/lib/sms-consent-text.ts` carries the matching consent string, and its header notes that string
is submitted to Twilio as the campaign's opt-in language — so these two files, the live campaign
registration and the actual behaviour all have to agree.

The architecture that resolves it (from `jdd-ops/PLAN-portal-form-capture.md` §1a) is **two lanes**:

| Lane | Traffic | Campaign | Sender |
|---|---|---|---|
| **Account** | Post-call briefs, new-lead alerts — JDD → the business owner | JDD's existing `ACCOUNT_NOTIFICATION` | a dedicated JDD notification number |
| **Customer** | Lead replies, review requests — the business → its own customer | the client's **own** `CUSTOMER_CARE` campaign | the client's provisioned number |

So the honest statement is no longer "we never message your customers" but closer to: *JDD's own
program messages only account holders; messages to a client's customers are sent under that
client's own carrier registration, from that client's own number.* **Those are two different
messaging programs and `/sms-terms` may need to describe both, or split into two documents.**

**Do not draft this alone.** It is a carrier-reviewable disclosure, `SMS_CONSENT_TEXT_VERSION` must
be bumped in the same commit as any wording change, and old consent events keep their own hash so
they stay provable against the words actually shown. Flag it, propose wording, get it approved.

---

## 4. File inventory — where tier and capability copy lives

Offered so you can locate a surface quickly when pointed at one. **Not a work list.**

### Public marketing
| File | Carries |
|---|---|
| `app/components/home/homepageclient.tsx` | Tier cards, hero, value props. Partially fixed in `be8079e` |
| `app/components/home/LeadPanel.tsx` | Lead-capture value prop — most likely to need the new story |
| `app/components/home/SiteToCallPanel.tsx` | The site→call narrative |
| `app/components/pricing/pricingpageclient.tsx` | Pricing page. **Currently modified in the working tree** — read the diff before editing |
| `app/components/pricing/UpsellEnterprise.tsx` | Enterprise upsell |
| `app/components/footer/footer.tsx` | Footer tier/feature mentions |

### Legal & compliance — higher bar, changes need approval
| File | Carries |
|---|---|
| `app/lib/legal/schedules.ts` | **Authoritative** prices, minutes, onboarding fees, overage, `maxSites`. Already correct — derive from it |
| `app/lib/legal/terms-v5.ts` | Terms of service |
| `app/sms-terms/page.tsx` | SMS program disclosure — see §3 |
| `app/lib/sms-consent-text.ts` | The hashed consent string — bump the version with any edit |
| `app/components/agreement/AgreementClient.tsx` | Agreement page, renders the schedules |
| `app/privacy-policy/` | Will need the EIN handling disclosure (`JDD-a2p-isv-runbook.html` §EIN) |

### Onboarding & portal
| File | Carries |
|---|---|
| `app/components/onboarding/onboardingpageclient.tsx` | Wizard copy. Also where the **A2P identity step** will be added — coordinate |
| `app/components/portal/tour/steps.ts` | First-run tour. See `PLAN-portal-first-run-tutorial.md` |
| `app/components/portal/ui/FeatureState.tsx` | Renders `pending-build` / `connecting` / `not-on-plan` states — **this is where the "A2P pending" copy belongs** |
| `app/components/portal/GrowthProvisioning.tsx` | "Your receptionist is being set up". `PLAN-portal-starter-tier-copy-fix.md` wants this renamed off its plan assumption |

---

## 5. Read these first

| Document | Why |
|---|---|
| `PLAN-portal-starter-tier-copy-fix.md` *(this repo)* | **Overlaps directly.** Covers portal-side Starter copy + the plan-detection bug. This handoff is the *public site*; that one is the portal. Do not duplicate |
| `PLAN-portal-crm-review-sms.md` *(this repo)* | The CRM board — built but **uncommitted** on this branch |
| `PLAN-portal-first-run-tutorial.md` *(this repo)* | Tour copy |
| `jdd-ops/PLAN-portal-form-capture.md` | The lead-capture architecture and the two-lane SMS split |
| `~/Desktop/JDD-a2p-isv-runbook.html` | Per-client A2P registration, the ~20-day timeline, EIN handling |
| `~/Desktop/JDD-cost-analysis-2026-10-29.html` | Unit economics + the day-one matrix |

---

## 6. Traps

- **`feat/pricing-2026-10` has a large uncommitted working tree**, including the entire CRM feature.
  Run `git status` first. Do not rebase or stash without asking.
- **Tailwind v4 auto-detects content sources from the git root.** A markdown file containing `C:` +
  backslash + `Users` fails the build with "Invalid code point" blamed on `globals.css:1:1`. Use
  forward slashes in any path you write into a doc in these repos.
- **Portal UI must be built inside `.portal-scope`** (`globals.css` ~line 3041), not global `:root`.
  Product blue `--accent #2563eb`; the agency teal/coral are *not* portal tokens.
- **Never claim a capability the gate does not grant.** `siteFeature(site, "calls")` returns
  `not-on-plan` only for web-only — a Starter *with* a receptionist does get the call log. Copy that
  contradicts the gate produces support tickets.
- **`tsc --noEmit` must stay clean.** Verify before handing back.
