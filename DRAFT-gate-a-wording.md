# DRAFT — Gate A wording for approval

**Repo:** `juneau-digital-designs` · **Branch:** `feat/pricing-2026-10` · **Date:** 2026-10-29
**Gate:** A (wording approval). **No site file has been changed.** Nothing here is written until approved.
**Plan:** `PLAN-public-tier-capability-copy.md`

---

## ⚠️ Read this first — one item should not ship as planned

The plan called for rewriting the `schedules.ts` lead-capture bullets to describe **portal lead
capture** and a **new-lead SMS alert to the owner**. Having read the code, I am not drafting that
contract language, because **neither capability is built**:

| Claim | Actual state |
|---|---|
| Portal lead capture | `LEAD_DELIVERY_MODE=portal` is **actively rejected** — `console/src/lib/envFields.ts` declares `options: ['email','callback']` and enforces it. It cannot be provisioned today |
| New-lead SMS alert | **No implementation.** `sendSms` has exactly two callers in this repo: the review-request route and the double-opt-in confirmation in `checkout-fulfillment.ts`. The body is still a proposal in `PLAN-portal-form-capture.md` (~`:850`) |
| The JDD notification number that would send it | Not provisioned — `PLAN-portal-form-capture.md` §1c is a list of manual setup steps, not a record of completed ones |
| Whether web-only even gets the alert | Still open — `PLAN-portal-form-capture.md` (~`:960`) marks it *(decide)* |

The day-one matrix in both handoffs is a **target state**, not current state. The form-capture
document is a plan, and its own verification pass (2026-10-29) corrected four claims that "sounded
right and were not."

`schedules.ts` renders into the **signed agreement**. Putting these in `included` would promise, in
a contract, capability that cannot be delivered on signing day. That is a materially worse failure
than stale marketing copy — and note the existing Starter bullet, *"Email lead capture from the
website contact form,"* **is accurate today** (`/api/contact` sends via Resend).

**My recommendation:** leave the lead-delivery bullets alone this pass. Change them in the commit
that ships portal capture, where the claim becomes true. See §3 for the options.

This does not block the other two items. The consent string and `/sms-terms` are about the
*messaging program*, where describing scope ahead of traffic is normal and in fact required — you
need consent on file before the first message, not after.

---

## 1. The consent string — `app/lib/sms-consent-text.ts`

### Current (v1)

> Yes, text me call summaries and service alerts from Juneau Digital Designs at the mobile number
> above. Consent is not a condition of purchase. Message and data rates may apply. Message frequency
> varies based on call volume. Reply STOP to opt out, HELP for help. See SMS Terms and Privacy Policy.

### Proposed (v2)

> Yes, text me call summaries, new-lead alerts, and service alerts about my own Juneau Digital
> Designs account at the mobile number above. Consent is not a condition of purchase. Message and
> data rates may apply. Message frequency varies based on call and lead volume. Reply STOP to opt
> out, HELP for help. See SMS Terms and Privacy Policy.

### Why each change

| Change | Reason |
|---|---|
| "about my own Juneau Digital Designs account" | Four words that do the whole lane-scoping job. Makes it unambiguous that this consent covers JDD→owner messages only, and never messages to the client's customers. The detail lives in `/sms-terms`, which the string links to — a checkbox is the wrong place for a two-lane explanation |
| added "new-lead alerts" | Consent must precede sending. Adding it now means the first new-lead alert is covered when it ships, rather than needing a second bump and a re-consent campaign |
| "call and lead volume" | Frequency basis has to match what actually drives volume once lead alerts exist |
| everything else unchanged | "Consent is not a condition of purchase", msg & data rates, STOP/HELP and both link phrases are TCR-required or load-bearing |

**Mechanical checks done:** `splitConsentText()` matches the literal substrings `SMS Terms` and
`Privacy Policy`; both appear exactly once in the proposed text, so the links still render.

**Version:** `SMS_CONSENT_TEXT_VERSION` `"sms-consent-v1"` → `"sms-consent-v2"`, same commit. Old
consent events keep their v1 hash and stay provable against the words those clients actually saw.

### Two things this triggers outside the repo

1. **The live campaign's opt-in language must be updated with Twilio/TCR.** The registered
   `ACCOUNT_NOTIFICATION` campaign currently carries the v1 wording. Code and registration
   disagreeing is exactly what a carrier complaint review surfaces. **Not something I can do from
   here — needs an owner.**
2. The portal's `SettingsSection.tsx:586` renders this string and will show v2 immediately. Accepted
   (plan decision 9).

---

## 2. `/sms-terms` — proposed structure and copy

One page, two programs, the difference stated before either is described.

### 2.1 Opening — new section, sits above everything else

**Heading:** Two different text programs

> This page covers two separate text messaging programs. They have different senders, different
> registrations, and different people on the receiving end — so read the one that applies to you.
>
> | | Who sends it | Who receives it | Covered by |
> |---|---|---|---|
> | **Account alerts** | Juneau Digital Designs | the business owner who signed up | this program, and the box you ticked on our agreement page |
> | **Your customer messages** | your business, from your own number | your business's own customers | your business's own carrier registration |
>
> Only the first is a Juneau Digital Designs program. The second is your business's program; we
> build and operate the tools, but your business is the sender and the registrant.

### 2.2 Program One — Juneau Digital Designs Call Alerts

Keeps the current page's sections, with these changes:

**"What this program is"** — the false clause goes. Replacement for the final paragraph:

> The program is available to Juneau Digital Designs clients who use our AI receptionist, and only
> for the mobile number that client provides. We do not send marketing or promotional messages
> through this program.
>
> This program messages **account holders only** — the business owner who signed up. It never
> messages your customers. When your business texts its own customers, that happens under your
> business's own registration and from your own number: see Program Two below.

The message-type list gains a third item alongside Call summaries and Service alerts:

> **New-lead alerts.** When someone fills in the contact form on your website, a short text tells
> you a new lead arrived so you can open your portal and follow up.

**Samples — unchanged, deliberately.** Both existing sample bodies stay byte-identical, per the
file's own contract that they match what the Make scenario actually sends:

> Juneau Digital Designs call alert: Callback requested. New lead Maria Alvarez, callback (930) 555-0117. Reply STOP to opt out.

> Juneau Digital Designs service alert: you have used 90% of your included minutes this billing period. Reply STOP to opt out.

⚠️ **No new-lead sample is included, and that is a decision for you.** The proposed body in
`PLAN-portal-form-capture.md` is *"New lead from {name} — open your portal."* but nothing sends it
yet, so quoting it as "a typical message" would be describing traffic that does not exist. Options:
describe the alert without quoting a body (what I have drafted), or quote the proposed body and
accept that it must stay byte-identical once built.

**"How to opt in"** — the hardcoded consent blockquote is replaced by a render of
`splitConsentText()`, so it can never drift from the hashed text again.

⚠️ **Double opt-in is undocumented and may be live.** `SMS_DOUBLE_OPTIN === "true"` turns on a
confirmation step (`checkout-fulfillment.ts:175`) that texts:

> Juneau Digital Designs: reply YES to confirm you want a text summary after each call. Msg & data rates may apply. Reply STOP to opt out, HELP for help.

The current page says alerts begin once the box is ticked and payment completes — with no mention
of replying YES. If that flag is on in production, the opt-in flow we describe is not the one
clients experience, which is the kind of gap a carrier review is built to find. **Need to know
whether it is on.** If yes, the section gains a sentence; if no, I would still add one conditional
line so turning it on later doesn't silently falsify the page.

### 2.3 Program Two — Messages your business sends to its customers

**Heading:** Messages your business sends to its customers

> On the Growth and Enterprise plans, your portal can text your own customers in two specific ways:
> replying to someone who contacted you, and asking a customer for a Google review after you have
> done the work. Starter and website-only plans never send customer-facing messages at all.
>
> **Your business is the sender.** These messages go out from your own business number, under your
> own business's carrier registration, which we help you complete during onboarding. They are not
> part of the Juneau Digital Designs Call Alerts program described above, and the consent you gave
> us for account alerts does not cover them.
>
> **When it turns on.** Customer messaging activates once the mobile carriers approve your business
> registration. Calls, the receptionist, lead capture and account alerts all work from day one and
> do not wait on it.
>
> **Review requests are one per customer, ever.** A customer who has already been asked is never
> asked again, and a customer who replies STOP is never texted again. Both are enforced in the
> software, not by policy.
>
> **Replies and STOP.** Every message carries "Reply STOP to opt out." STOP is honoured by the
> carrier and recorded on our side as well.
>
> **Your responsibility as the sender.** Because your business is the registrant, you are
> responsible for having a proper basis to text each customer — in practice, someone who just
> contacted you or whom you just did work for.

**Review-request shape** — accurate to `composeReviewMessage()`, which appends the link and STOP
tail server-side and cannot be edited away:

> {your message}
>
> {your Google review link}
> Reply STOP to opt out.

---

## 3. `schedules.ts` — options, not a draft

Per §0 I am not drafting bullets that promise unbuilt capability. Three ways forward:

| Option | What it means |
|---|---|
| **A — leave lead delivery alone** (recommended) | Keep the accurate "Email lead capture…" bullets. Change them in the commit that ships portal capture. The reprice copy was never the problem here |
| **B — write it as future capability** | Add the bullets with an explicit activation condition, the same treatment as two-way texting. Honest, but it puts "coming later" language into a signed contract for a day-one-marketed feature |
| **C — write it as day one** | What the plan originally said. **I would not do this** — it is a contract promise of something that cannot be provisioned today |

What I *can* draft safely once you pick, and which is independent of the above:

- **The two-way texting / review-request bullets for Growth + Enterprise**, with the
  approval-gated wording you chose. These are genuinely future capability and would read as such.
- **The `feeTable` rows** for the same, plus a "Not included" row for Starter/web-only.
- **The `schedules.ts:196` doc comment fix** — it says web-only is "Never shown on public pricing,"
  which your pricing-FAQ entry contradicts. Reword to: never priced or listed as a public tier,
  acknowledged only as an FAQ answer.

---

## 4. Two code problems found while drafting — not mine to fix, but someone's

Neither is copy, and neither is in this pass's scope. Both are in the uncommitted CRM work.

### 4.1 Review requests currently route through the wrong SMS lane

`app/lib/twilio.ts` `sendSms()` reads `process.env.TWILIO_MESSAGING_SERVICE_SID` for **every** send.
Per `PLAN-portal-form-capture.md` §1d, that variable is **JDD's Account-lane service carrying
`ACCOUNT_NOTIFICATION`**; the client's own `CUSTOMER_CARE` campaign is meant to live in a separate
`CLIENT_MESSAGING_SERVICE_SID`. So a review request — Customer-lane traffic by definition — would
send through JDD's account campaign.

It is latent today only because `resolveReviewConfig` finds no `googleReviewUrl` (not in
`@jdd/schema` yet) and every send is blocked with `no-review-link`. **If the schema release lands
`googleReviewUrl` before the per-client messaging service is wired, review requests start sending
under the wrong registrant** — which the plan itself calls "a different registrant and a different
legal basis" (~`:1149`). It is also precisely what `/sms-terms` Program Two would be telling
customers does not happen.

Worth a guard that refuses to send Customer-lane traffic through the Account-lane service, rather
than relying on ordering.

### 4.2 The default review template offers an incentive for a review

`ReviewRequestDialog.tsx:52-59` seeds the editor with:

> Hi {firstName}, thanks for choosing {businessName}! If we did a great job, would you leave us a
> quick Google review? It really helps us out.
>
> As a thank-you, show us your review for 10% off your next service.

**Google's review policies prohibit offering incentives in exchange for reviews.** The risk lands
on the client, not on us: review removal, and at worst a penalty on their Business Profile — for a
business whose Google presence is much of what they are paying for. The dialog's own comment notes
the discount line is deletable, but it ships **pre-filled**, so the default behaviour is the
non-compliant one.

I would drop that line from the default and let a client add it if they insist. Flagging rather
than changing it, since it is the CRM workstream's file and mid-rewrite.

---

## 5. What I need from you

| # | Decision |
|---|---|
| 1 | Consent string v2 — approve, edit, or reject (§1) |
| 2 | `/sms-terms` structure and copy — approve, or mark what to change (§2) |
| 3 | New-lead sample: describe without quoting, or quote the proposed body (§2.2) |
| 4 | Is `SMS_DOUBLE_OPTIN` on in production? (§2.2) |
| 5 | `schedules.ts` lead delivery: option A, B or C (§3) |
| 6 | Effective date for the rewritten `/sms-terms` — current page says August 13, 2026 |
| 7 | Who updates the live campaign opt-in language with Twilio/TCR (§1) |
| 8 | Should §4.1 and §4.2 go to the CRM/A2P workstream as their own items? |

---

# ADDENDUM — 2026-10-30, after "option A"

Option A is recorded: the lead-delivery bullets stay as they are, and change in the commit that
ships portal capture. §3's remaining three items are now unblocked, and drafting them surfaced the
same problem one size smaller.

## 6. The two-way texting bullets carry the same risk

The plan was to add two-way texting and review requests to Growth/Enterprise `included`, worded as
gated on carrier approval. Having now read the code for §4.1, that gate is **not the only one**:

| Gate | Status |
|---|---|
| Carrier approval of the client's registration | real, and the one we agreed to describe |
| `googleReviewUrl` in `@jdd/schema` | **not released.** `resolveReviewConfig` reads null, every send blocks with `no-review-link` |
| Per-client `CLIENT_MESSAGING_SERVICE_SID` wired | **not done** (§4.1) |
| Lead-reply texting | **not built** |

So a contract bullet saying *"activates once the carriers approve your registration"* tells a
Growth client that carrier approval is the last thing standing between them and the feature. It
isn't. A client who signs today, gets approved in three weeks, and still has no texting has a
bullet in their signed agreement that was not met — and the stated condition will have been
satisfied.

This is the same failure as §0, with a fig leaf. Two honest ways to write it:

**Option 1 — omit from the contract (my recommendation).** Keep two-way texting and review requests
out of `schedules.ts` until they ship. Describe them in marketing copy, where a roadmap claim is
ordinary and no one has signed it. Add them to the contract in the commit that makes them real.

**Option 2 — state both gates.** If they go in now, the condition has to be complete:

> Two-way texting with customers from the client portal, and Google review requests, each available
> once the Client's own carrier registration is approved and the feature has been enabled on the
> Client's portal.

"and the feature has been enabled on the Client's portal" is the clause that keeps it honest. It
reads as hedging because it is hedging — which is the argument for option 1.

### `feeTable` rows, if they go in at all

| Tier | Row |
|---|---|
| Growth / Enterprise | `["Portal texting and review requests", "Included once registration is approved and the feature is enabled"]` |
| Starter | `["Portal texting and review requests", "Not included on this plan"]` |
| Web-only | `["Portal texting and review requests", "Not included on this plan"]` |

## 7. The doc comment fix — no blocker, ready to apply

`schedules.ts` ~`:196` currently opens:

> **Never shown on public pricing.** It is a sales concession, and it is priced identically to
> Starter on purpose so it is never the economically attractive choice.

Proposed:

> **Never priced or listed as a public tier.** It is a sales concession, priced identically to
> Starter on purpose so it is never the economically attractive choice. The pricing page
> acknowledges it only as an FAQ answer — "can I get the website without the receptionist?" — and
> never as a fourth card with a price.

This is the one `schedules.ts` edit with no correctness question attached. It stops the code from
contradicting the site the moment the FAQ entry lands.

## 8. Double opt-in — wording that is true either way

`SMS_DOUBLE_OPTIN` is absent from both `.env.local` and `.env.example`, so it is off locally and
was never documented as a flag. Production is a Vercel dashboard value, so that is not proof.

Rather than block, the opt-in section can be written to hold either way. Replacing the current
final paragraph of "How to opt in":

> Alerts begin only after both the box is checked and your purchase is completed. If we send you a
> confirmation text asking you to reply YES, alerts begin once you reply. If you sign but never
> complete payment, the opt-in expires on its own and no message is ever sent.

The conditional "if we send you a confirmation text" is accurate whether the step is on or off, and
stays accurate if it is switched on later — which is the actual risk, since a flag flipped in a
dashboard will not remind anyone to revisit this page. **Still worth confirming the production
value**, because if it is on I would rather describe the step directly than conditionally.

## 9. Updated decision list

| # | Decision | Status |
|---|---|---|
| 1 | Consent string v2 (§1) | **open** |
| 2 | `/sms-terms` structure and copy (§2) | **open** |
| 3 | New-lead sample: describe, or quote the proposed body (§2.2) | **open** |
| 4 | Is `SMS_DOUBLE_OPTIN` on in production? (§8) | open — §8 wording holds either way meanwhile |
| 5 | `schedules.ts` lead delivery | **decided — option A** |
| 6 | Two-way texting in the contract: omit, or state both gates (§6) | **open** |
| 7 | Effective date for `/sms-terms` — current page says August 13, 2026 | **open** |
| 8 | Who updates the live campaign opt-in language with Twilio/TCR (§1) | **open — needs an owner** |
| 9 | Route §4.1 / §4.2 to the CRM/A2P workstream | **open** |
