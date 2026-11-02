# PLAN — Portal CRM v2: customers, messaging, and tier gating

**Status:** Ready for execution (Sonnet), phased
**Supersedes:** `PLAN-portal-crm-review-sms.md` (v1 — CRM built on top of the call log)
**Related:** `JDD-a2p-isv-runbook.html` (per-client A2P registration — separate workstream),
`PLAN-portal-form-capture.md` (web-form → portal leads — **another Claude session owns this**)
**Repos:** `juneau-digital-designs` (primary), `jdd-schema` (gates + fields), `jdd-ops` (number index, console)
**Date drafted:** 2026-10-29

Derived from a 28-question intake. Decisions are **locked** unless marked _(verify)_ or _(decide)_.

---

## 0. What changes and why

v1 built a CRM **on top of the call log**: every caller automatically became a pipeline card. That
is a call tracker with stages, not a CRM. v2 inverts it:

- The call log becomes an **Inbox** — raw inbound (calls **and** web-form leads) awaiting triage.
- A client **promotes** an inbox item into a **Customer**. Customers are deliberate, not automatic.
- The CRM manages **customers**: pipeline, notes, tasks, tags, value, files, and a **two-way SMS
  conversation**.
- **Starter does not get the CRM.** Starter gets the Inbox (calls + form leads). Growth and
  Enterprise get the CRM + messaging + review requests.

### Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Core entity | **Lead → Customer promotion.** Inbox items are leads; promotion creates a Customer |
| 2 | Record creation | **Promote from Inbox** + **manual "Add customer"**. No auto-create, no CSV import in v2 |
| 3 | Call log's role | **Becomes the Inbox** (triage surface), on every tier |
| 4 | Stages | **Lead → Contacted → Quoted → Scheduled → Won → Lost** (6) |
| 5 | Default view | **Kanban board**, with a searchable table as a secondary view |
| 6 | Card face | **Stale/aging indicator** + **unread-message indicator** (value/next-action live on the record, not the card) |
| 7 | Detail surface | **Wide drawer (~680px), two-column**: details left, activity timeline right. Not a modal — see §4.1 |
| 8 | CRM gate | `crm` = site **live** + plan **growth/enterprise**. Deliberately **not** `airtableBaseId` |
| 9 | Leads gate | `leads` = site **live**. All tiers, including web-only |
| 10 | Messaging gate | `messaging` = `crm` + **`a2pStatus === "verified"`** |
| 11 | Nav | **Inbox** + **Customers**. Starter sees Inbox only |
| 12 | Starter upsell | driver.js-powered **"Show me what Growth does for me"** showcase over a ghost CRM, ending on **"Are you ready to grow?"** + upgrade CTA |
| 13 | A2P registration | **Separate workstream — not this plan's work.** Registration, the TrustHub chain, the poller, **and the onboarding-wizard identity step** all belong to the A2P owner: see `HANDOFF-a2p-onboarding-identity-step.md`. This plan's *only* involvement is **reading** `site.a2pStatus` to gate messaging (decision #10) and to render the 3-week wait. It never writes it and never collects identity data |
| 14 | sendSms | **Per-lane resolution.** Lane is a required argument |
| 15 | CRM sources | **Calls + web leads**, unified by normalized phone |
| 16 | Chat scope | **SMS + web-form submissions in one thread.** Replies always send as SMS |
| 17 | Reply alerts | **SMS notification to the owner's cell** (a notification, *not* the message body) + **in-portal unread badges** |
| 18 | Inbound routing | **General `number→site` index in KV** |
| 19 | Outbound policy | Client may start a thread with **anyone who contacted them**; always reply-able; opted-out blocked; **no bulk send anywhere** |
| 20 | Extra features | **Job value + won-revenue total, tasks/reminders, tags, file/photo attachments** |
| 21 | Timeline | Everything (calls, forms, SMS, review requests, stage changes, notes) — but **digestible, uncrowded, legible to a non-technical user** |
| 22 | Scale | **Table view, global search, bulk actions (never bulk text), archive** |
| 23 | Multi-site | **Per-site**, follows the existing `?site=` switcher |
| 24 | Review action | **Customer record** + a **Review-ready filter**. One deliberate click each |
| 25 | Mobile | **Full parity; phone-first for messaging** |
| 26 | Existing v1 state | **Rewrite, no migration.** New `v2` key namespace |
| 27 | Tutorial | **Rework + split by tier**, and **extended to teach the customer drawer**, not just the board — see §4.9 |
| 28 | Delivery | **Phased, each phase shippable**, each gated on an approved mockup |

---

## 1. Hard dependencies and coordination risks

**Read this before touching anything.**

### 1.1 Customer-facing SMS is blocked ~13–20 business days per client
Per the A2P runbook, each Growth/Enterprise client needs their **own** brand + `CUSTOMER_CARE`
campaign. Until it verifies, **review requests and customer chat cannot send**. Two consequences:

- Phase 3 (messaging) cannot be validated end-to-end without a verified client, or a Twilio test
  setup. Build it behind the `messaging` gate and test the UI against a stubbed send.
- The portal must render the wait as **progress**, not breakage — reuse `siteFeature` vocabulary.
  Copy: *"Texting your customers turns on once the carriers approve your business registration —
  usually about two more weeks. Calls and leads are unaffected."*

### 1.2 The current campaign would filter review texts
JDD's existing campaign is registered `HasEmbeddedLinks=false`. A review request **is** a Google
URL. Even with `googleReviewUrl` set (shipped in v1.29.0), sending today risks filtering. This is
why decision #10 gates on `a2pStatus`, not merely on the link being present.

### 1.3 `@jdd/schema` is contended — another session is editing it
`PLAN-portal-form-capture.md` §8 step 1 also adds `leads`/`crm` gates and
`twilioNumber`/`messagingServiceSid` to `PortalSite`. **Do not blindly re-add them.**

> **Procedure:** before editing `jdd-schema`, `git pull` and check whether the fields/gates already
> exist. If they do, consume them. If they don't, add them and cut **one** release covering both
> needs. Never cut two competing releases.

#### ⚠️ The consumers are currently split — fix this as part of the next release
Source is at **v1.29.0**, but that release was cut incompletely (my error, this session):

| Consumer | Pinned | Installed |
|---|---|---|
| `jdd-ops` | `#v1.28.0` | 1.28.0 |
| `jdd-ops/console` | `#v1.28.0` | 1.28.0 |
| `juneau-digital-designs` | `#v1.29.0` | 1.29.0 |

This is load-bearing, not cosmetic:
- **`onboard.js` writes `a2pStatus`** and lives in `jdd-ops` at 1.28.0 — it cannot reference a type
  it does not have.
- The **console manage route** is where `googleReviewUrl` gets populated (the remaining half of the
  v1.29.0 work), and it is also a version behind — so that field is currently unreachable from the
  only surface allowed to set it.

**The repo convention is to re-pin every consumer in the release commit** — see `97b7eb0`
*"align @jdd/schema v1.27.0 with console and ops root"* and `b11f586` *"re-pin @jdd/schema to
v1.28.0"*. A release is not done when the tag is pushed; it is done when all three `package.json`
pins and all three `node_modules` agree.

**Release checklist (use for the next one):**
1. Edit `src/`, `npm run build`, `npm test` in `jdd-schema`
2. Bump `package.json`, commit, tag `vX.Y.Z`, push **commit and tag**
3. Re-pin **all three** consumers: `juneau-digital-designs`, `jdd-ops`, `jdd-ops/console`
4. `npm install` in each (a plain `npm install` may serve the git dep from cache — verify the
   installed version, and use `npm install "github:JuneauDigitalDesigns/jdd-schema#vX.Y.Z" --force`
   if it is stale)
5. Verify: installed version matches the pin in all three
6. `tsc --noEmit` clean in the agency site, `npm test` green in `jdd-ops` and `jdd-ops/console`

#### Two decisions where this plan deliberately diverges from the form-capture plan
Both were decided by the owner in this session's intake, **after** that plan was drafted. They are
not oversights, and the form-capture plan should be updated to match rather than the reverse.

| | Form-capture plan | **This plan (authoritative)** | Why |
|---|---|---|---|
| `crm` gate | `airtableBaseId` **and** growth/enterprise (§5) | **live** + growth/enterprise | The v2 CRM holds **web leads as well as calls**. A Growth site that is live but whose Airtable base isn't wired yet would report `connecting` and hide a CRM the client could already use for form leads. Gating on an Airtable id is the exact mistake that plan's own §5 warns about for `leads` |
| Navigation | "One nav item, two capability levels — not two sections" (§5) | **Two items: Inbox + Customers** | Triage and pipeline are different jobs. Starter gets Inbox only; Growth gets both. A single item that silently changes shape by tier makes the Starter upsell (decision #12) much harder to place |

**Action for the other session:** expose `portal-leads.ts` + `GET /api/portal/leads` and stop
there. Do **not** implement a Leads *UI*, and do **not** wire leads "into the existing CRM board"
(its §8 step 5) — that board is being rewritten (§7). The Inbox in Phase 1 is the consumer.

### 1.4 The Inbox depends on the other session for web leads
Calls come from Airtable (exists). Web-form leads come from `portal:lead:*` KV, built by the other
session. **Phase 1 must tolerate the leads source being absent** — render calls only, and light up
form leads when `portal-leads.ts` lands. Do not block on it.

The contract is settled (form-capture plan §3), so build against it:
```ts
leadKey(acctScope, slug, leadId)   // portal:lead:v1:{acctScope}:{slug}:{leadId}
leadIndexKey(acctScope, slug)      // sorted set by timestamp

interface WebLead {
  leadId: string;          // ULID, sortable by creation time
  slug: string;
  name: string | null;
  phone: string | null;    // E.164 when parseable
  phoneRaw: string | null;
  email: string | null;
  message: string | null;
  fields: Record<string, string>;
  createdAt: string;
  readAt: string | null;   // ← the Inbox's read/unread state. Reuse it; don't invent a second one
  source: "web-form";
  callbackPlaced: boolean; // Growth/Ent: did the Retell callback fire
}
```

### 1.5 One form submission can produce two Inbox items
On Growth/Enterprise, `/api/contact` **always records a `WebLead`** *and* fires the Retell
callback, which (if answered) later writes an **Airtable call row**. Both carry the same E.164, so
the Inbox would show the same event twice, minutes apart.

**Required handling in Phase 1:** collapse them. When a call's number matches a `WebLead` from the
preceding window _(decide: 60 min default)_, render **one** Inbox item — the form submission, with
the callback attached beneath it ("We called them back — 2m 41s"). `callbackPlaced` is the hint
that a call should be expected. Promotion then creates one customer with both activities on the
timeline.

Never show the raw pair as two unrelated items: to the client it was one enquiry, and a lead list
that double-counts is a lead list they stop trusting.

---

## 2. Schema changes (`jdd-schema`)

Subject to §1.3. Target one release, e.g. **v1.30.0**.

### 2.1 Fields on `PortalSite`
```ts
/** The client's provisioned Twilio number, E.164. Written by onboard.js at provisioning. */
twilioNumber?: string | null;
/**
 * The client's OWN Messaging Service, carrying their CUSTOMER_CARE campaign.
 *
 * Mirrors `CLIENT_MESSAGING_SERVICE_SID` in `clients/{slug}/.env.local` — deliberately NOT the
 * same name as the master `TWILIO_MESSAGING_SERVICE_SID`, which stays JDD's Account-lane service.
 * The portal cannot read a client's .env.local, which is why the value has to land here.
 */
messagingServiceSid?: string | null;
/**
 * A2P registration state. "not-applicable" is a real terminal state for Starter/web-only —
 * state it, never infer it from the plan (same lesson as `receptionistMode`).
 */
a2pStatus?:
  | "not-applicable" | "none"
  | "profile-pending" | "profile-approved"
  | "brand-pending" | "brand-approved"
  | "campaign-pending" | "verified" | "failed";
```

### 2.2 Gates (`entitlements` / `account.ts`)
```ts
export type PortalFeature =
  | "calls" | "traffic" | "performance"   // existing
  | "leads"      // Inbox — all tiers, needs only a live site
  | "crm"        // Customers — live + growth/enterprise
  | "messaging"; // customer SMS — crm + a2pStatus === "verified"
```

`FEATURE_REQUIREMENT` currently maps every feature to a `keyof PortalSite`. `leads` and `crm` have
no required id, so **make the map value optional** rather than inventing a fake requirement —
inventing one is exactly how `calls` ended up gating on an Airtable id.

```ts
export function siteFeature(site: PortalSite, feature: PortalFeature): FeatureAvailability {
  if (feature === "calls" && isWebOnly(site)) return { state: "not-on-plan" };
  if (feature === "crm" || feature === "messaging") {
    if (site.plan === "starter") return { state: "not-on-plan" };
  }
  if (feature === "messaging") {
    // `failed` deliberately maps to `connecting`, NOT a new `error` state — see §9a gap 4.
    // The client sees "still being set up"; the operator sees the real failure in the console.
    if (site.a2pStatus !== "verified") return { state: "connecting" };
  }
  if (site.status !== "live") return { state: "pending-build" };
  // …existing required-id check, now skipped when the requirement is undefined (§9a gap 6)
}
```
**Verified:** `FeatureAvailability` (`account.ts:585`) is exactly
`ready | not-on-plan | pending-build | connecting` — there is no `error` state and the plan does
not add one.

Unit-test the matrix: starter/growth/enterprise × web-only × each `a2pStatus` × each site status.

---

## 3. Data model (portal KV)

New **`v2`** namespace. v1 `portal:crm:v1:*` keys are abandoned, not migrated (decision #26). All
keys carry `acctScope` per the `portal-kv.ts` invariant.

```ts
customerKey(acct, slug, customerId)  // portal:crm:v2:customer:{acct}:{slug}:{id}
customerIndex(acct, slug)            // SET of customerIds
phoneIndex(acct, slug, e164)         // → customerId  (promotion dedupe)
activityKey(acct, slug, customerId)  // LIST, append-only
threadKey(acct, slug, customerId)    // LIST of messages
unreadIndex(acct, slug)              // SET of customerIds with unread inbound
taskKey(acct, slug, taskId)          // task record
taskIndex(acct, slug)                // SET (or sorted set by dueAt)
promotedIndex(acct, slug)            // SET of source ids already promoted (inbox dedupe)
numberOwnerKey(e164)                 // → { acctScope, slug }  — GLOBAL, see §6.2
```

```ts
export type PipelineStage =
  | "lead" | "contacted" | "quoted" | "scheduled" | "won" | "lost";

export interface Customer {
  customerId: string;          // ULID; phoneIndex maps E.164 → this
  name: string | null;
  phone: string | null;        // E.164
  email: string | null;
  address: string | null;
  stage: PipelineStage;
  value: number | null;        // job value, minor units or plain dollars — pick one and comment it
  tags: string[];
  note: string | null;
  archived: boolean;
  /** How this customer entered the CRM. */
  source: "call" | "web-form" | "manual";
  sourceRef: string | null;    // Airtable record id or leadId
  createdAt: string;
  updatedAt: string;
  updatedBy: string;           // clerk user id
  stageChangedAt: string;      // drives the stale indicator
  lastContactAt: string | null;
  reviewSent: ReviewSendRecord | null;  // carried over from v1
}

export type ActivityKind =
  | "call" | "web-form" | "sms-out" | "sms-in"
  | "review-request" | "stage-change" | "note" | "task" | "file";

export interface Activity {
  id: string;
  kind: ActivityKind;
  at: string;                  // ISO
  /** One plain-language line. The timeline renders this, never raw field dumps. */
  summary: string;
  /** Kind-specific extras (recordingUrl, durationSeconds, body, fromStage/toStage…). */
  meta?: Record<string, unknown>;
  actor: "customer" | "client" | "system";
}

export interface Task {
  taskId: string;
  customerId: string;
  title: string;
  dueAt: string | null;
  done: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  direction: "in" | "out";
  body: string;
  at: string;
  messageSid: string | null;
  status: "queued" | "sent" | "delivered" | "undelivered" | "failed" | "received";
  sentBy?: string;             // clerk user id for outbound
}
```

**Staleness** is derived, never stored: `now - stageChangedAt > threshold`, with per-stage
thresholds (e.g. lead 3d, contacted 5d, quoted 7d, scheduled 14d; won/lost never stale).
_(decide)_ Whether thresholds are fixed or per-account configurable — default fixed.

**Attachments** use `@vercel/blob` (already a dependency). Store blob URL + filename + size +
uploader on an `Activity` of kind `file`. Cap size and validate content type server-side.

---

## 4. UI/UX

> **Every phase below is gated on an approved mockup. See §8.**

### 4.1 Why a drawer, not a modal
Research is consistent: for data-dense workspace apps, **side-sheets/drawers beat modals** for
record detail because the board stays visible and the user keeps their place; modals are for
destructive confirmation and critical alerts. The v1 problem was that the drawer was **~380px and
overstuffed**, not that it was a drawer. v2 widens it to **~680px with a two-column layout**.

### 4.2 Navigation
| Nav item | Gate | Starter | Growth / Enterprise |
|---|---|---|---|
| **Inbox** | `leads` | ✅ calls + form leads | ✅ calls + form leads, with **Promote** |
| **Customers** | `crm` | 🔒 ghost + showcase | ✅ board / table |

The existing "Call Log" nav item is **renamed to Inbox**; `/portal/calls` keeps working
(`/portal/customers` is new). Keep the old route as a redirect so existing links survive.

### 4.3 Inbox
A chronological triage list of inbound items (calls, form leads) for the selected site.
- Row: who, when, source icon, one-line summary, duration (calls) or message (forms).
- Click → detail (call summary/recording, or form message).
- Primary action: **Promote to customer**. Prefills name/phone/email, dedupes on normalized phone
  — if a customer already exists for that number, the item **links to** that customer instead of
  creating a second (and says so).
- Promoted items get a quiet "In your customers →" affordance; they are not removed from the Inbox
  (it is a log, not a queue to empty). _(decide)_ a "hide promoted" toggle, default off.
- **Form + callback collapse** (§1.5): a form submission and the Retell callback it triggered render
  as one item, the call nested beneath the enquiry.
- **Read state** uses `WebLead.readAt` for form leads (set on open). Do not invent a parallel
  read-state store; calls get an equivalent marker in the v2 namespace.
- Starter sees this exactly as Growth does, minus Promote.

### 4.4 Customers — board
- Six columns. **Six is wide**: allow horizontal scroll, let **Won/Lost collapse** to a narrow
  summary column, and remember collapse state. Do not let the board force a cramped 6-up grid.
- Card: name, phone, **stale dot**, **unread badge**, tags (max 2 + overflow), note snippet.
- Drag between columns (keyboard-accessible alternative required — the stage select in the drawer
  satisfies this).
- Filter bar: search, stage, tag, **Needs follow-up** (overdue task), **Review-ready**,
  **Stale**, archived toggle.

### 4.5 Customers — table (secondary view)
Sortable columns: name, stage, value, last contact, next task, tags, unread. Bulk select →
change stage, add tag, archive. **No bulk messaging — ever.**

### 4.6 Customer drawer (~680px, two columns)
- **Left:** identity (name/phone/email/address, inline-editable), stage selector, value, tags,
  tasks (add/complete), note, attachments, and the **Request a review** button.
- **Right:** the **activity timeline**.

**Timeline legibility is a hard requirement** (decision #21 — must be digestible for a
non-technical user):
- One row per activity: small kind icon, **one plain-language line**, relative time. Nothing else
  by default.
- Expand a row for detail (full call summary + recording player, full message body, stage diff).
- Group by day with light date separators.
- Collapse consecutive same-kind events ("3 messages" → expand).
- Default filter chips: **All / Messages / Calls / Notes**.
- Copy is human: *"Jane called — 3m 12s"*, *"You texted Jane"*, *"Review request sent"*,
  *"Moved to Quoted"*. Never `sms-out` or raw field names.

### 4.7 Messaging (Growth/Enterprise, gated on `messaging`)
- Thread lives in the drawer's right column under a **Messages** tab, and gets a full-screen
  phone-first view on mobile (decision #25).
- Composer disabled with the A2P wait copy when `a2pStatus !== "verified"`; disabled with an
  opt-out explanation when the customer has sent STOP.
- Inbound messages mark the customer unread → badge on card, nav, and thread list.
- Web-form submissions render inline in the thread as a distinct entry kind (decision #16) so the
  conversation reads chronologically; replies always go out as SMS.

### 4.8 Tutorial scope — the drawer needs teaching too (revision to decision #27)

The v1 tour pointed at a board and stopped. The v2 customer drawer is where the actual work
happens, and it carries eight distinct controls (stage, contact, value, tags, follow-ups, notes,
files, review) plus a timeline with its own filter chips. A client who is shown the board but not
the drawer will use this as a list of names.

So the Growth tour gains a **second act, inside the drawer**, driven by the same driver.js
instance. Tour stops become:

1. **Inbox** — "every call and web enquiry lands here"
2. **Promote** — "when it's a real job, make them a customer"
3. **Board** — "drag them along as the job moves"
4. → *opens a customer* → **drawer stops:**
   - a. **Stage + contact** — "everything about this person in one place"
   - b. **Follow-ups** — "set a reminder so nobody goes cold"
   - c. **Timeline** — "every call, text and note, newest first"
   - d. **Request a review** — the climax, same as before
5. **Help button** — "replay this any time"

Implementation notes:
- Opening the drawer mid-tour means a step has to **trigger UI state**, not just highlight an
  element. driver.js supports `onNextClick` for this — open the drawer, wait for it to mount, then
  advance. Do not assume the element exists on the next tick; reuse the anchor-polling helper
  already written in `TourController`.
- Drawer anchors need their own `data-tour` attributes (`crm-drawer-stage`, `crm-drawer-tasks`,
  `crm-drawer-timeline`, `crm-drawer-review`).
- On **mobile** the drawer is full-screen, so steps 4a–4d run against the sheet; the board step is
  replaced by the stage-filtered list.
- The **Starter** tour still ends at the Inbox and hands off to the showcase (§4.9) — but the
  showcase itself should now walk the *drawer* too, since "what Growth does for me" is mostly what
  the drawer does.
- Tour length is a real risk at 8+ stops. Make it **resumable mid-drawer** (the existing
  `lastStepIndex` persistence already supports this) and keep every popover to one or two short
  sentences.

### 4.9 Starter showcase ("Show me what Growth does for me")
Reuses the **driver.js** infrastructure from the tutorial (decision #12).
- The Customers nav item is visible to Starter with a lock.
- The panel shows a **ghost CRM** (reuse `GhostPreview`) behind a primary button:
  **"Show me what Growth does for me."**
- Clicking runs a guided showcase over **fake but realistic** demo data: triage an inbox item →
  promote → move through the pipeline → text the customer → **ask for a Google review** (with a
  beat explaining *why* reviews drive more calls).
- Final step is a question — **"Are you ready to grow?"** — with the upgrade CTA. An upgrade CTA
  also sits on the ghost panel itself for anyone who skips the showcase.
- Demo data is clearly labelled as an example and never written anywhere.

---

## 5. Server/API

```
GET    /api/portal/inbox          calls (+ web leads when available), newest first
POST   /api/portal/customers      promote-from-inbox OR manual create
GET    /api/portal/customers      list (+ filters), with unread + stale derived
PATCH  /api/portal/customers      stage / value / tags / note / archive / identity
POST   /api/portal/customers/bulk bulk stage|tag|archive (never messaging)
GET    /api/portal/customers/[id] full record + timeline + thread
POST   /api/portal/tasks          create / complete
POST   /api/portal/messages       send an SMS to a customer   (gated: messaging)
POST   /api/portal/review-request existing route, + a2p gate  (gated: messaging)
POST   /api/portal/attachments    blob upload handshake
```

Every route: `resolvePortalRequest` (auth + rate limit + site validation), then an **explicit
feature-gate check** — never rely on the UI having hidden a button.

Reuse from v1 where behaviour is unchanged: `recordReviewSend` / one-per-number hard block,
`markReviewOptOut`, the status-callback webhook, and `composeReviewMessage` (link + STOP appended
server-side).

---

## 6. Twilio changes

### 6.1 `sendSms()` — per-lane (decision #14)
Lane becomes a **required** argument so customer traffic can never accidentally ride the account
campaign. This matches the form-capture plan §1d exactly, including its reasoning: *"An optional
parameter here means the wrong default is one forgotten argument away, and the failure is silent."*

```ts
type SmsLane =
  | { lane: "account" }                                   // JDD → owner
  | { lane: "customer"; messagingServiceSid: string; from: string }; // client → their customer
```
- **account**: master `TWILIO_MESSAGING_SERVICE_SID` + `TWILIO_NOTIFICATION_NUMBER`. Works day
  one, every tier, no A2P dependency.
- **customer**: the site's own `messagingServiceSid` + its `twilioNumber`. Requires
  `a2pStatus === "verified"`; throw loudly otherwise.

**Two existing callers must be updated in the same commit** — the compiler will find them once
the argument is required:
- `checkout-fulfillment.ts` → `{ lane: "account" }`
- `ReviewRequestDialog`'s route (`/api/portal/review-request`) → `{ lane: "customer", … }`
  (named explicitly in the form-capture plan §1d as the already-built caller that would otherwise
  inherit the wrong lane by default)

Never add an env-var fallback inside `sendSms`. Resolution is the caller's job, because only the
caller knows the lane.

### 6.2 Inbound routing (decision #18)
The runbook sets a **service-level** `InboundRequestUrl` with `UseInboundWebhookOnNumber=false`,
so one webhook serves every client and must resolve the client from the **`To`** number.

Generalize v1's review-only reverse index into `portal:number-owner:v1:{e164} → {acctScope, slug}`:
- Written at provisioning (jdd-ops) and on repair; also written on first outbound send as a
  self-heal.
- `/api/webhooks/twilio-sms` then: validate signature → resolve owner from `To` → classify
  (STOP/HELP keyword vs conversational) → append to that customer's thread → mark unread →
  notify the owner.
- Keep the existing consent-keyword behaviour for the **owner-alert** program intact; the two
  concerns now share one route and must not be conflated. STOP from a customer blocks customer
  sending; STOP from an owner revokes owner alerts.
- _(verify)_ Whether an unknown `To` (number not in the index) should 200-and-log or alarm.
  Recommend: log loudly, return 200 so Twilio stops retrying.

### 6.3 Owner notification on inbound (decision #17)
Send a **notification, not the content**: *"You have a new message from Jane D. in your portal."*
with a link. Account lane, works day one, no A2P dependency. Honour existing `sms:consent:*`.
Coalesce — at most one notification per customer per N minutes _(decide: 15 min default)_ so a
chatty customer doesn't spam the owner.

---

## 7. What happens to the v1 code

| File | Action |
|---|---|
| `app/lib/portal-crm.ts` | **Rewrite** to the v2 customer model. Keep `ReviewSendRecord`, `markReviewOptOut`, `markReviewDeliveryByNumber` |
| `app/lib/crm-contacts.ts` | **Repurpose** → inbox grouping + promotion dedupe helpers |
| `app/api/portal/crm/route.ts` | **Replace** with `/inbox` + `/customers` |
| `app/components/portal/CrmBoard.tsx` | **Rewrite** (customers, 6 stages, new card face, filters) |
| `app/components/portal/CrmView.tsx`, `ViewToggle.tsx` | **Replace** — board/table toggle lives inside Customers; Inbox is its own route |
| `ReviewRequestDialog.tsx` | **Keep**, re-anchor to the customer record + add the `messaging` gate |
| `app/lib/review-request.ts` | **Keep**; `resolveReviewConfig` now reads the real typed fields; add the a2p gate |
| `app/lib/twilio.ts` | **Extend** — per-lane (§6.1). `reconstructPublicUrl` stays |
| `api/webhooks/twilio-status` | **Keep** — runbook points at it |
| `api/webhooks/twilio-sms` | **Extend** — inbound chat + number→site routing |
| Tour (`tour/*`) | **Rework + split by tier** (decision #27) |

---

## 8. Mockups (required gate before each build phase)

Deliver as **self-contained HTML** in `design/crm-v2/`, built on the real **`.portal-scope`**
tokens — white `#ffffff` cards on `#f6f7f9`, graphite ink (`#0d1117`/`#4a5058`/`#767c85`),
**product blue `#2563eb`**, Cabinet Grotesk / Inter / JetBrains Mono, shallow neutral shadows.
Agency teal/coral appear **only** in the cream `--brand-band` behind the JDD mark. No beige
anywhere. (The v1 session burned three iterations getting this wrong — match
`app/globals.css` `.portal-scope`, not `:root`.)

Each mockup is reviewed and approved **before** its phase is built.

| # | Mockup | Must show |
|---|---|---|
| M1 | **Inbox** | Triage list (calls + form leads), **a collapsed form+callback pair**, read vs unread, item detail, **Promote** action, already-promoted state, Starter view (no Promote) |
| M2 | **Customers board** | 6 columns w/ Won/Lost collapsed, card face (stale dot, unread badge, tags), filter bar, empty state |
| M3 | **Customer drawer** | 680px two-column, left panel (identity/stage/value/tags/tasks/note/files/review button), right timeline **in its digestible form** — collapsed rows, day grouping, filter chips, one expanded row |
| M4 | **Messages** | Thread in the drawer, composer, **A2P-pending disabled state** w/ copy, opted-out state, mobile full-screen thread |
| M5 | **Table view + bulk** | Sortable table, selection, bulk action bar, archive |
| M6 | **Starter showcase** ✅ *drafted* | Locked Customers panel, ghost CRM, "Show me what Growth does for me", 2–3 showcase steps, final "Are you ready to grow?" + CTA |
| M7 | **Mobile** | Inbox list, board-as-filtered-list, record sheet, thread |

A single tabbed HTML file per mockup group is fine (as in the v1 session), one tab per screen.

---

## 9. Phases (each independently shippable)

**Phase 0 — schema + mockups + primitives**
Coordinate `jdd-schema` per §1.3 (fields + gates + tests, one release; the v1.28/v1.29 split is now
closed — all three consumers are on **v1.29.0**). Draft **M1–M3**, get approval. Then land the
primitive changes the rest of the plan depends on (§9a gaps):
- `Drawer`: `width` prop, `padded` prop, surface decision
- `PORTAL_TABS` + `MOBILE_BAR_TABS` + `TAB_ICON`: rename Call Log → Inbox, add Customers
- `FEATURE_REQUIREMENT` → `Partial<...>` + guarded lookup

Nav then shows Inbox/Customers, with Customers locked for Starter.

**Phase 1 — Inbox + promotion** *(gate: M1)*
`/api/portal/inbox`, Inbox UI, promote → customer, dedupe by phone, manual add, **form+callback
collapse (§1.5)**, read state via `WebLead.readAt`. Tolerates the web leads source being absent
(§1.4). Rename Call Log → Inbox, keep `/portal/calls` redirecting.

**Phase 2 — Customers CRM** *(gate: M2, M3)*
v2 KV model, customers API, board + wide drawer + timeline, tasks/tags/value/notes/attachments,
stale logic. Review request re-anchored to the record + Review-ready filter (still gated on
`messaging`, so it stays disabled until A2P verifies).

**Phase 3 — Messaging** *(gate: M4; blocked on A2P §1.1)*
Per-lane `sendSms`, `number→site` index, inbound webhook extension, threads, unread, owner
notification, composer with the pending/opted-out states.

**Phase 4 — Scale + Starter showcase** *(gate: M5, M6, M7)*
Table view, global search, bulk actions, archive. Starter showcase. Mobile pass.

**Phase 5 — Tutorial rework** *(gate: reuse M1–M4)*
Split by tier: Growth tour (Inbox → promote → pipeline → message → review), Starter tour (Inbox,
ending in the showcase offer). Re-anchor `data-tour` attributes; update `steps.ts`.

Each phase: `npx tsc --noEmit` clean, `npx eslint` clean on changed files, `npm test` green in
`jdd-schema`, and a manual pass in `npm run dev`.

---

## 9a. Codebase audit — verified against HEAD on 2026-10-29

Every reference below was checked against the actual source. **Treat this as the implementation
contract**; if something here no longer matches, the code moved and the plan is stale.

### Confirmed present (safe to build on)
| Reference | Location | Note |
|---|---|---|
| `.portal-scope` token block | `app/globals.css:3041` | The theme the mockups match. `:root` is the marketing theme — never use it for portal UI |
| `PortalFeature` union | `@jdd/schema` `account.ts:574` | Currently `"calls" \| "traffic" \| "performance"` |
| `FEATURE_REQUIREMENT` | `account.ts:596` | Typed `Record<PortalFeature, keyof PortalSite>` |
| `siteFeature()` | `account.ts:610` | Order: web-only → `status !== "live"` → required-id → ready |
| `isWebOnly()` | `account.ts:316` | `plan === "starter" && receptionistMode === "declined"` |
| `accountScope`, `getPortalRatelimit`, `lastVisitKey` | `app/lib/portal-kv.ts:82, 221, 189` | Key conventions + the long-backstop-expiry precedent cited in §3 |
| `normalizeE164`, `formatUsPhone` | `app/lib/phone.ts` | The shared contact-id function |
| `resolvePortalRequest` | `app/lib/portal-account.ts` | Returns `{ ok, userId, account, site }`; already auth + rate-limits + validates slug |
| `GhostPreview` + `GhostStat/Chart/Table` | `ui/GhostPreview.tsx:19,57,87,110` | For the Starter locked panel (§4.9) |
| `useMediaQuery`, `useIsMobile` | `ui/useMediaQuery.ts:22,43` | |
| `@vercel/blob` | `package.json:18` (`^2.3.3`) | Already a dependency — attachments need no new install |
| `launchTour()`, `TOUR_EVENT` | `tour/TourController.tsx:130,24` | Replay hook |
| Anchor-polling helper | `tour/TourController.tsx:71` | The `begin(tries)` retry loop §4.8 reuses for the drawer step |
| Webhook routes | `api/webhooks/twilio-sms`, `api/webhooks/twilio-status` | Exactly the paths the A2P runbook §4.1 configures |

### ⚠️ Gaps the plan previously assumed away — these are real work
1. **`Drawer` has no width prop.** `ui/Drawer.tsx:132` hardcodes `sm:w-[26rem]` (**416px**) on
   desktop. The plan needs **520px** (Inbox) and **760px** (Customer). Add a `width` prop
   (e.g. `"md" | "lg" | "xl"` mapping to Tailwind widths) rather than overriding from call sites,
   so the mobile sheet branch stays untouched.
2. **`Drawer` forces its own body padding.** `Drawer.tsx:179` wraps children in `px-5 py-5`. The
   customer drawer's two-column layout must reach the edges. Add a `padded = true` prop and pass
   `false` for the customer drawer.
3. **`Drawer` paints `var(--bg)`** (`#f6f7f9`, the page grey — `Drawer.tsx:137,142`), but the
   mockups show **white** drawers against a dimmed board. Either pass a surface override or change
   the drawer to `--elev-1`. _(decide)_ — recommend `--elev-1`, since a drawer is a raised surface
   everywhere else in the portal.
4. **`FeatureAvailability` has no `error` state.** `account.ts:585-593` is exactly
   `ready | not-on-plan | pending-build | connecting`. So §2.2's `a2pStatus === "failed"` branch
   **cannot** return `{ state: "error" }` as drafted. **Resolution: do not widen the union.** Map
   `failed` → `connecting` and differentiate in copy, because every existing consumer
   (`FeatureState`, `PortalChrome` `tabState`, `HealthStrip`) exhaustively switches on these four
   and would need touching for a state only one feature can produce. Surface `failed` to the
   operator through the console, not the client portal.
5. **Nav changes are wider than "rename a label."** `app/portal/types.ts:52` `PORTAL_TABS` drives
   four dependent things:
   - `PortalTabId` (`types.ts:68`) is *derived* from the array — adding `customers` widens it
     automatically, which is good.
   - `MOBILE_BAR_TABS` (`types.ts:82`) literally lists `"calls"` — must be updated, and is capped
     at **four** slots by design (the comment explains why five is the max). Adding Customers means
     **deciding what leaves the bar**. _(decide)_ — recommend `["overview","calls","customers","billing"]`,
     moving Traffic to More.
   - `MOBILE_MORE_TABS` (`types.ts:85`) takes whatever drops out.
   - `TAB_ICON` (`PortalChrome.tsx:47`) is keyed by tab id and indexed unguarded at
     `PortalChrome.tsx:292` — a new id without an icon is a runtime `undefined` component. Add a
     `customers` icon (`Users` from `@phosphor-icons/react`) in the same commit.
   - The `calls` tab's `feature: "calls"` field is what drives the lock marker; the new Customers
     tab takes `feature: "crm"`.
6. **`GhostPreview`'s banner copy is hardcoded to the pending-build case.** `ui/GhostPreview.tsx:40-44`
   literally renders *"This is a preview of what this page will look like once your site is live."*
   For the Starter Customers panel that sentence is **false** — their site is live; the feature is
   simply not on their plan. Add a `banner` (or `variant`) prop so the upsell can say *"…what the
   Customers board looks like on Growth."* The component's three other rules (no numerals, dashed
   hatch, `aria-hidden` with an `sr-only` description) all still apply and must be preserved.
7. **`FEATURE_REQUIREMENT` is `Record<PortalFeature, keyof PortalSite>`** — adding `leads`/`crm`
   forces a value for each. Widen to `Partial<Record<PortalFeature, keyof PortalSite>>` and guard
   the lookup at `account.ts:619`, rather than inventing a fake requirement (which is precisely how
   `calls` ended up gating on an Airtable id).

### Route inventory (what exists vs. what Phase 1–3 adds)
| Route | Status |
|---|---|
| `GET /api/portal/calls` | exists — keep; the Inbox reads calls through `fetchCalls` |
| `GET/PATCH /api/portal/crm` | exists (v1) — **replace** with `/inbox` + `/customers` |
| `POST /api/portal/review-request` | exists — add the `messaging` gate + `{ lane: "customer" }` |
| `POST /api/portal/tour` | exists — reuse for the extended tour |
| `/api/webhooks/twilio-status` | exists — no change |
| `/api/webhooks/twilio-sms` | exists — **extend** for inbound chat + number→site routing |
| `GET /api/portal/inbox` | **new** (Phase 1) |
| `GET/POST/PATCH /api/portal/customers` | **new** (Phase 2) |
| `POST /api/portal/messages` | **new** (Phase 3) |
| `GET /api/portal/leads` | **new — owned by the other session** (§1.4) |

---

## 10. Open verifications

**Resolved by the 2026-10-29 form-capture revision** — no longer open: the `WebLead` shape (§1.4),
the per-client env-var name `CLIENT_MESSAGING_SERVICE_SID` (§2.1), and the `sendSms` required-lane
design (§6.1), which that plan independently reached the same conclusion on.

- ✅ ~~`FeatureAvailability` `error` state~~ — **resolved by the §9a audit**: no such state; `failed`
  maps to `connecting`.
- ✅ ~~`WebLead` shape~~, ~~`CLIENT_MESSAGING_SERVICE_SID` naming~~, ~~`sendSms` lane design~~ —
  resolved by the form-capture revision.
- _(verify)_ Whether the other session has already added `leads`/`crm`/`twilioNumber`/
  `messagingServiceSid` to `jdd-schema`. **Check before editing.** (§1.3)
- _(verify)_ Unknown-`To` behaviour on the inbound webhook. (§6.2)
- _(decide)_ Drawer surface colour — `--bg` (today) vs `--elev-1` (mockups). (§9a gap 3)
- _(decide)_ Which tab leaves `MOBILE_BAR_TABS` to make room for Customers. (§9a gap 5)
- _(verify)_ `getPortalRatelimit()` limits are appropriate for messaging send volume.
- _(verify)_ **Teardown leaves portal KV orphaned.** The form-capture plan §1e flags that
  `lib/teardown-ops.js` knows nothing about TrustHub objects. This plan adds *more* per-client KV —
  `portal:crm:v2:*` (customers, activities, threads, tasks) and `portal:number-owner:v1:*`. A torn
  down client leaves customer PII and SMS transcripts in Redis indefinitely. Teardown needs a portal
  KV purge, and the `number-owner` entry **must** be deleted or a recycled Twilio number would route
  a stranger's inbound SMS into the old client's thread. Treat the latter as a correctness bug, not
  hygiene.
- _(decide)_ Form-submission ↔ callback collapse window (default 60 min). (§1.5)
- _(decide)_ Stale thresholds fixed vs configurable. (§3)
- _(decide)_ Owner-notification coalescing window (default 15 min). (§6.3)
- _(decide)_ "Hide promoted" toggle in the Inbox. (§4.3)
- _(decide)_ `value` units — dollars vs minor units. Pick one, comment it, never mix.

---

## 11. Non-goals

- **No bulk/blast texting**, anywhere, ever. Every customer-facing message is one deliberate action.
- **No CSV import** in v2 (revisit once the model proves out).
- **No customer-facing SMS on Starter or web-only** — a product boundary, and what keeps those
  tiers free of A2P registration entirely.
- **No A2P registration machinery here** — consumed, not built (§1.1).
- **No migration of v1 CRM state** (decision #26).
