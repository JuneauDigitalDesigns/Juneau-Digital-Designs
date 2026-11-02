# PLAN — Portal CRM pipeline + Google-review SMS

> ## ⚠️ SUPERSEDED (2026-10-29) by `PLAN-portal-crm-v2-customers-messaging.md`
>
> This plan built the CRM **on top of the call log** (pipeline state auto-attached to every
> caller). That model is being replaced by a real customer CRM: the call log becomes a triage
> **Inbox**, and customers are created by **deliberate promotion** or manual add.
>
> Also obsoleted here by the A2P ISV runbook: customer-facing SMS now rides a **per-client**
> Messaging Service and campaign, gated on `a2pStatus === "verified"`, not the shared service
> this plan assumed.
>
> **Still accurate and carried forward:** the compliance posture for review requests (§3.3),
> one-per-number hard block, STOP handling, the status-callback webhook, and the admin-only
> `googleReviewUrl` decision (§5, shipped in `@jdd/schema` v1.29.0).
>
> Read the v2 plan instead. Kept for the decision history only.

**Status:** Superseded — see above
**Branch base:** `feat/pricing-2026-10` (pricing/entitlements are being reworked on this branch — see §0)
**Repos touched:** `juneau-digital-designs` (portal, primary), `jdd-schema` (shared schema), `jdd-ops/console` (admin manage route + onboarding)
**Date drafted:** 2026-10-29

This plan was derived from a 16-question intake. Every decision below is **locked** unless marked _(verify)_.

---

## 0. Context & locked decisions

The portal call log is **read-only** today: `GET /api/portal/calls` → `app/lib/airtable-calls.ts` reads an Airtable **"Call Log"** table per client base. Field sets vary per base (some have `Outcome`/`Priority`, some don't), so **nothing new may assume an Airtable column exists**. Caller numbers are stored **unmasked** on purpose.

Twilio is already wired: `app/lib/twilio.ts#sendSms()` sends through an **A2P 10DLC Messaging Service** (`TWILIO_MESSAGING_SERVICE_SID`); `jdd-ops/onboard.js` buys each client a **local** number and joins it to that service's sender pool. Inbound keywords (STOP/HELP/YES) land at `app/api/webhooks/twilio-sms/route.ts` (built, not yet wired to a number).

**Locked decisions from intake:**

| # | Decision | Choice |
|---|----------|--------|
| 1 | CRM state storage | **Portal KV/Redis** (Upstash), keyed by account scope + site + contact. No Airtable write-back, no new DB. |
| 2 | Pipeline stages | **New → Callback → Quoted → Won → Lost** |
| 3 | Interaction model | **List (status dropdown) on mobile + Kanban board on desktop** |
| 4 | Entity model | **Contact/lead grouping** — calls from the same phone number collapse into one contact carrying one pipeline state + call history |
| 5 | Review SMS consent | **Transactional follow-up** model: single message, STOP/HELP included, no resends. Document the TCPA/A2P risk in code + RUNBOOK. |
| 6 | Review SMS trigger | **Manual one-click**, **decoupled from pipeline state** (sent well after a job is won). Editable message, pre-filled template with fill-in blanks; suggest a discount line. |
| 7 | Send-from number | **Client's own provisioned local number** (not the shared pool) |
| 8 | Review link source | **`@jdd/schema` field** on the site, captured at onboarding, editable in **console manage route + onboarding ONLY** — **not** editable in the portal (admin-handled to ensure correctness) |
| 9 | Template blanks | Caller first name, Business name, Discount/offer line, Review link (auto-appended) |
| 10 | Resend guard | **Hard block** — once a review request is sent to a number, that number can never be sent another |
| 11 | Delivery feedback | **Sent event + Twilio delivery status callback + STOP handling** via the existing inbound webhook |
| 12 | Plan gating | **All plans** get call log + CRM + review SMS (pricing reworked this branch — do NOT re-gate behind Growth) |
| 13 | Annotations | **Freeform notes** + **callback due date/reminder** per contact |
| 14 | Follow-up nudges | **None in v1** |
| 15 | Analytics | **Conversion funnel (win rate, stage breakdown) + review-request sent/delivered stats** |

**⚠️ Pricing/entitlements reconciliation (do first):** This branch changes pricing and "all plans get CRM." `PortalChrome.tsx` and `app/api/portal/calls/route.ts` currently gate `calls` via `siteFeature(ctx.site, "calls")` with a `not-on-plan` state. Before building, **read the current `@jdd/schema` `entitlements.ts` / `siteFeature` logic** and confirm whether `calls` is now granted to all tiers. The CRM + review features must follow whatever gate `calls` resolves to (they live inside the Calls section). Do not invent a new gate.

---

## 1. Data model (Portal KV / Upstash Redis)

All keys go in a new `app/lib/portal-crm.ts` (`server-only`), following the key conventions in `app/lib/portal-kv.ts`. **Every key carries `acctScope`** (`accountScope(account.email)`), per the invariant in `portal-kv.ts`.

### Contact identity
A contact is identified by **normalized E.164 caller number** (reuse `normalizeE164` from `app/lib/phone.ts`). Calls with no usable number fall back to the Airtable record id as the contact id (they can't be grouped or texted).

```
contactId = normalizeE164(callerNumber) ?? `rec:${airtableRecordId}`
```

### Keys
```ts
// Pipeline + annotation state for one contact, one site.
crmContactKey(acctScope, slug, contactId)  // portal:crm:contact:v1:{acctScope}:{slug}:{contactId}

// Index of contactIds that have any CRM state for this site (so the board can list them
// without SCANning). A Redis SET.
crmIndexKey(acctScope, slug)               // portal:crm:index:v1:{acctScope}:{slug}

// Review-request send log, keyed by E.164 number (account-wide, NOT site — a number is a
// person; the hard-block must hold across a client's sites). Append-only list + a fast
// "already sent" flag.
reviewSentKey(acctScope, e164)             // portal:review:sent:v1:{acctScope}:{e164}
```

### Shapes
```ts
export type PipelineStage = "new" | "callback" | "quoted" | "won" | "lost";

export interface CrmContact {
  contactId: string;
  stage: PipelineStage;              // defaults to "new" (not persisted until first change)
  note: string | null;              // freeform
  callbackDueAt: string | null;     // ISO date, drives the Callback surfacing
  updatedAt: string;
  updatedBy: string;                // clerk user id, for audit
}

export interface ReviewSendRecord {
  e164: string;
  sentAt: string;
  sentBy: string;                   // clerk user id
  siteSlug: string;
  messageSid: string | null;        // Twilio SID, filled once the send returns
  deliveryStatus: "queued" | "sent" | "delivered" | "undelivered" | "failed" | "unknown";
  optedOut: boolean;                // flipped true if this number later replies STOP
}
```

**Default stage rule:** a contact with no stored record is implicitly `"new"`. Only persist on first mutation. This keeps the index small (only actioned contacts) while the board still shows everything (unactioned calls render as `new`).

---

## 2. Server: CRM state read/write

### `app/lib/portal-crm.ts` (new)
- `getContactStates(acctScope, slug): Promise<Map<contactId, CrmContact>>` — read the index set, `mget` all contact keys.
- `setContactState(acctScope, slug, contactId, patch, clerkUserId)` — merge-write + add to index set. No TTL (state, not cache — mirror the `lastVisitKey` reasoning in `portal-kv.ts`, use a long backstop expiry e.g. 400 days).
- `getReviewSend(acctScope, e164)` / `recordReviewSend(...)` / `markReviewDelivery(...)` / `markReviewOptOut(...)`.

### `app/lib/crm-contacts.ts` (new) — the grouping layer
Pure function that takes the `CallRecord[]` from `airtable-calls.ts` + the `Map<contactId, CrmContact>` and produces grouped contacts:
```ts
export interface Contact {
  contactId: string;
  displayName: string | null;       // most recent non-null callerName
  phone: string | null;             // E.164 if resolvable
  phoneDisplay: string;             // fmtPhone()
  email: string | null;             // most recent non-null
  calls: CallRecord[];              // all calls from this number, newest first
  callCount: number;
  lastCallAt: string | null;
  stage: PipelineStage;             // from CrmContact or "new"
  note: string | null;
  callbackDueAt: string | null;
  reviewSent: ReviewSendRecord | null;  // null = can still send; non-null = hard-blocked
}
```
Unit-test this grouping (it's the core of the feature). Follow the `@jdd/schema` test style (`node --test`).

### `app/api/portal/crm/route.ts` (new)
- `GET` — resolve via `resolvePortalRequest` (same pattern as `calls/route.ts`), fetch calls + CRM states, return grouped `Contact[]`. Cache lightly or not at all (CRM state must feel live; calls already cache at 120s upstream).
- `PATCH` — body `{ contactId, stage?, note?, callbackDueAt? }`. Rate-limited via `getPortalRatelimit()`. Writes through `setContactState`. Returns updated contact. Invalidate any CRM GET cache key.

**Security:** reuse `resolvePortalRequest` so the site is validated against the account's own sites. Never trust `contactId` to read another account's data — it's only ever composed under the caller's own `acctScope`.

---

## 3. Server: review-request SMS

### `app/lib/review-request.ts` (new, `server-only`)
- `buildReviewMessage({ callerFirstName, businessName, discountLine, reviewUrl })` — assembles the final body from the client-edited template; **always appends** the review URL and the mandatory `Reply STOP to opt out` tail. Enforce single-segment-friendly length where practical; hard-cap length.
- `canSendReview(acctScope, e164)` — returns `{ allowed: boolean; reason?: "already-sent" | "opted-out" | "no-number" | "no-review-link" }`. This is the **hard block** (decision #10).

### `app/api/portal/review-request/route.ts` (new)
`POST` body: `{ contactId, messageBody }` (client-edited text; server re-validates and re-appends the link + STOP tail — never trust the client to include them).
Flow:
1. `resolvePortalRequest` → account + site.
2. Resolve the contact's E.164 from `contactId`. Reject if not a valid mobile number.
3. Resolve `reviewUrl` from the site schema (`site.googleReviewUrl`, §5). Reject with a clear message if unset ("Your review link isn't set up yet — contact Juneau Digital Designs"). The portal does **not** offer an edit field (admin-only, §5).
4. `canSendReview` hard-block check → 409 if already sent / opted out.
5. Send via **the client's own number**. Current `sendSms()` sends via `MessagingServiceSid` only (sender auto-selected). **Extend `sendSms()`** to accept an optional `from` (the client's provisioned number) — Twilio allows `From` + `MessagingServiceSid` together to pin the sender within the service. The client's number comes from the site record (confirm where onboard.js stores the purchased number — likely on the account/site; _verify_ in `jdd-ops/onboard.js` around the `incomingPhoneNumbers.create` block near line 1254 and in `@jdd/schema` `site.ts`/`account.ts`). If the per-site number isn't available to the portal yet, that is a prerequisite sub-task (see §7).
6. Pass Twilio a `StatusCallback` pointing at a new webhook (§3.1) so delivery status lands.
7. `recordReviewSend(...)` with the returned `messageSid`. This is what enforces the permanent hard-block.

### 3.1 Delivery status webhook — `app/api/webhooks/twilio-status/route.ts` (new)
Validate the Twilio signature (reuse `validateTwilioSignature` + `publicWebhookUrl` from `app/lib/twilio.ts`). Map `MessageStatus` → `markReviewDelivery`. Needs `TWILIO_STATUS_CALLBACK_URL` env (mirror `SMS_WEBHOOK_URL` handling).

### 3.2 STOP handling for review recipients
The existing inbound webhook (`app/api/webhooks/twilio-sms/route.ts`) only knows about the owner-alert consent log. Extend its STOP branch to **also** flip `markReviewOptOut(acctScope, from)`. Problem: that webhook doesn't know which account a random caller belongs to. **Resolution:** maintain a reverse index `portal:review:number-owner:v1:{e164} → acctScope` written at send time, so an inbound STOP can find the right review record. Add this to §1 keys. (Advanced Opt-Out at the Messaging Service still auto-honors STOP at the carrier level; this just keeps our records truthful — same rationale as the existing webhook's STOP note.)

### 3.3 Compliance documentation (required, not optional)
Add a block comment in `review-request.ts` and a section in `jdd-ops/RUNBOOK.md` stating: review requests are single, transactional, business-relationship follow-ups; one per number ever; STOP/HELP honored; no marketing cadence. This is the paper trail that backs decision #5.

---

## 4. UI: Calls → CRM

The CRM **board is the primary experience** of the Call Log section — it's what we want clients living in. The existing analytics/log table becomes a **secondary "Log" view**.

### 4.0 View model — Board default, Log secondary
- The Calls section renders a **Board / Log toggle** (top-right of the section header, styled like the existing period/filter controls). **Board is the default** on first load.
- Persist the last-chosen view in the URL (`?view=board|log`, default `board`) so it's linkable and survives refresh — consistent with how filters already live in the URL in `CallsSection.tsx`.
- `Log` view = today's `CallsSection` table/charts, unchanged. `Board` view = the new `CrmBoard`. The stat/funnel row (§4.4) sits above both.

### 4.1 Contacts board/list
New `app/components/portal/CrmBoard.tsx`:
- **Desktop (≥1024px):** Kanban — five columns (New / Callback / Quoted / Won / Lost), contact cards drag between columns (use `@dnd-kit/core` — lightweight, accessible; add dep). Drop → `PATCH /api/portal/crm`. Optimistic update + rollback on failure.
- **Mobile (<1024px):** list of contact cards, each with a **stage dropdown** (reuse the `Select` pattern already in `CallsSection.tsx`) and a horizontal stage filter. No drag.
- Use `useMediaQuery` (`app/components/portal/ui/useMediaQuery.ts`) to switch, consistent with the existing mobile/desktop split in `CallsSection`.

### 4.1a Board filtering controls (crowding)
A busy board gets dense fast, so the board carries its own filter bar (URL-backed, same pattern as the existing call-log filters). Filtering **narrows which cards show in each column** — it never moves cards between columns.
- **Search** — name / phone / note substring (reuse the existing search box styling).
- **Needs callback** — toggle to show only contacts with a `callbackDueAt` (optionally "due this week").
- **Review-ready** — toggle to show only `won` contacts with a valid mobile number and no review sent yet (the growth-loop shortlist).
- **Date range / period** — reuse the existing `DateRangePicker` + period selector so the board can be scoped to a billing period or custom window, exactly like the Log view.
- A **Clear** affordance when any board filter is active (mirror the existing `filtersActive` "Clear" control).
- All counts (column headers + the pipeline bars in §4.4) reflect the **filtered** set, so the numbers always describe what's on screen.

### 4.2 Contact detail (extend the existing Drawer)
The current `CallDetail` opens one call in a `Drawer`. Replace with a **ContactDetail** that shows: stage selector, **notes** textarea (debounced `PATCH`), **callback due** date picker, the grouped **call history** (each call's summary/recording/duration — reuse existing `CallDetail` rendering per call), and the **"Request a review"** button (§4.3).

### 4.2 Contact detail (extend the existing Drawer)
The current `CallDetail` opens one call in a `Drawer`. Replace with a **ContactDetail** that shows: stage selector, **notes** textarea (debounced `PATCH`), **callback due** date picker, the grouped **call history** (each call's summary/recording/duration — reuse existing `CallDetail` rendering per call), and the **"Request a review"** button (§4.3).

### 4.3 Review request composer
New `app/components/portal/ReviewRequestDialog.tsx`:
- Pre-fills the template (copy in §6) with caller first name + business name resolved, a suggested discount line the client can edit or delete, and the review link shown as a locked/auto-appended chip.
- If `reviewSent` is non-null → show "Review request already sent on {date}" and **disable** the button (hard block, decision #10).
- If no `googleReviewUrl` on the site → disable send, show "Your review link isn't set up yet — contact Juneau Digital Designs" (no edit field; admin-handled per §5).
- On send → `POST /api/portal/review-request`, toast result, update the contact's `reviewSent`.

### 4.4 Analytics — pipeline bar (decision #15)
A compact **pipeline bar** sits in the stat row above the board:
- **One bar per stage**, in pipeline order (New / Callback / Quoted / Won / Lost).
- **Each bar is labelled with its stage name directly underneath it** (not a shared legend), and shows its **percentage of total contacts on the bar itself** (e.g. a bar reading "34%").
- Heights/percentages are computed from the **currently filtered** contact set and **recompute live** whenever a card's stage changes (the same optimistic update that drives §4.1's drag also updates these numbers) — no refetch required.
- Also surface **win rate** (default `won / total`; _confirm denominator_) and **review stats** (requests sent, delivered) as plain stat tiles beside the bar.
- Stage/status colours use the **portal's own chart tokens** (see mockup): `--st`/chart green `#16a34a` (won), red `#dc2626` (lost), amber `#d97706` (callback), slate `#94a3b8` (new), purple `#7c3aed` (quoted). Pipeline bars are neutral slate fills with a coloured stage dot under each label.

> **Styling rule (applies to all CRM UI):** build inside the **`.portal-scope`** theme (globals.css ~line 3041), NOT the global `:root`. That means: white cards (`--elev-1 #ffffff`) on `#f6f7f9`, graphite ink (`--fg #0d1117` / `--fg-2` / `--fg-3`), shallow neutral shadows, **Cabinet Grotesk / Inter / JetBrains Mono** (via `--font-display`/`--font-body`/`--font-mono`), and **product blue `--accent #2563eb`** for the primary button, links, active state, focus ring, and review-prompt accents — this is the portal's real interactive colour, so USE it. The agency teal/coral are **not** portal tokens; they appear only inside `--brand-band #f8ebd5`, the cream band behind the JDD lockup. Never introduce the beige global theme (`#f4ecd8`/teal/coral) into portal UI. Reuse the existing `Card`, `CardLabel`, `StatTile`, `Drawer`, `StatusDot`, `chartTheme.ts` primitives so the CRM inherits all of this for free.

---

## 5. Cross-repo: review link in `@jdd/schema` + console + onboarding

This mirrors the pending `forwardingNumber` cross-repo gap (see memory + `jdd-ops/PLAN-forwarding-sms-numbers.md`). Treat it the same way.

1. **`jdd-schema/src/site.ts`** — add optional `googleReviewUrl?: string` (and optionally `googlePlaceId?: string`) to the site type + zod schema. Bump the schema version, `npm run build`, re-pin in both consumers (the repo has a history of `chore(deps): pin @jdd/schema vX` commits — follow it).
2. **Onboarding capture** — add a field to the signing/onboarding flow that captured `forwardingNumber` (recent commit `8b5cc16`/Phase 7 added a "Proof & details" step — _locate it_ and add the review link there). Carry it through the intake envelope / `onboard.js`.
3. **Console manage route** — in `jdd-ops/console` client-manage UI, add an editable "Google review link" field so an admin can set/fix it for clients who lack a reviews page. (`grep` the console for the manage route; it's a Next.js app under `console/src/app`.)

> **Portal is read-only for this field.** Per the user: the review link is **admin-handled** (console + onboarding only) so it gets set correctly. The portal must **not** expose an edit control for it. The portal only *reads* `site.googleReviewUrl` to build the review message, and when it's unset the Review composer shows "Your review link isn't set up yet — contact Juneau Digital Designs" rather than an edit field. (This also means the tutorial's "set your review link" step becomes "here's where your review link lives once we've set it up" — see the tutorial plan.)

---

## 6. Copy — review request template (starting point)

```
Hi {firstName}, thanks for calling {businessName}! If we did a great job,
would you leave us a quick Google review? It really helps us out: {reviewLink}
{optionalDiscountLine}
Reply STOP to opt out.
```
Suggested (editable, deletable) discount line placeholder:
```
As a thank-you, show us your review for {DISCOUNT} off your next service.
```
Server always appends `{reviewLink}` and the `Reply STOP to opt out.` tail regardless of client edits.

---

## 7. Prerequisites / open verifications

- _(verify)_ **Per-site sending number available to the portal.** Confirm the client's purchased Twilio number is stored somewhere the portal can read (schema `site`/`account`, or KV). If not, add it — this is required for decision #7. Check `onboard.js` ~line 1254 and the account/site schema.
- _(verify)_ Current `calls` entitlement gate after the pricing rework (§0).
- _(verify)_ Win-rate denominator for analytics (§4.4).
- _(verify)_ `@dnd-kit` acceptable as a new dependency, or prefer a lighter hand-rolled drag.

---

## 8. Execution order (phased)

1. **Schema + prerequisites** — `@jdd/schema` `googleReviewUrl`, confirm per-site number, re-pin. (Blocks review SMS.)
2. **CRM data layer** — `portal-crm.ts`, `crm-contacts.ts` + tests, `GET/PATCH /api/portal/crm`.
3. **CRM UI** — `CrmBoard` (list + board), ContactDetail drawer, wire into Calls section. Ship this first; it's usable without SMS.
4. **Review SMS backend** — extend `sendSms` (`from`), `review-request.ts`, `POST /api/portal/review-request`, status webhook, STOP extension + reverse index.
5. **Review SMS UI** — `ReviewRequestDialog`, hard-block states, unset-link empty state (read-only; no portal edit field).
6. **Analytics** — funnel + review stats.
7. **Console + onboarding** — manage-route field, onboarding capture (cross-repo, can parallelize with 2–6).
8. **Compliance docs** — code comments + RUNBOOK section.

Each phase: typecheck + any existing portal test suite green before moving on.
