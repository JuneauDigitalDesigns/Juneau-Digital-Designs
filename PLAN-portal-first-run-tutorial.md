# PLAN — Portal first-run interactive tutorial

**Status:** Ready for execution (Sonnet)
**Branch base:** `feat/pricing-2026-10`
**Repo:** `juneau-digital-designs` (portal only)
**Date drafted:** 2026-10-29
**Depends on:** the CRM + review-SMS feature (`PLAN-portal-crm-review-sms.md`) — the tour's climax is the "Request a review" action, and it spotlights the review-link setting. Build the tour **after** those elements exist (or stub the selectors behind feature flags).

Derived from a 16-question intake. Decisions below are **locked** unless marked _(verify)_.

---

## 0. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Format | **Spotlight coachmarks** (dim screen, highlight one real element at a time) |
| 2 | Library | **driver.js** (tiny, dependency-free, themeable, accessible) |
| 3 | Primary goal | **Teach the review-request loop** — for **all tiers, Starter included** (not a Growth-only feature) |
| 4 | Trigger | **First login, resumable** — auto-launch on first portal visit; resumable if dismissed; replayable from a Help button |
| 5 | Completion state | **Clerk user `publicMetadata`** (`tourCompleted`, `tourStep`) |
| 6 | Scope of state | **Per user** (not per account) — every staff login gets taught once |
| 7 | Tour stops | Call log + open a call → Organize calls (pipeline) → Send a review request (the climax). **Note:** the review *link* is admin-set (console/onboarding), so there is no "set your review link" step — if the link is unset the review step explains it's handled by JDD. |
| 8 | Tone | **Warm, encouraging coach** |
| 9 | Empty data | **Seeded demo call** for the tour so "open a call" / "send a review request" steps work on an empty account; clearly marked as an example, non-destructive |
| 10 | Interruptibility | **Skip + back/next + progress** ("3 of 5"); dismissing is remembered as resumable |
| 11 | No review link yet | Review link is **admin-set** (console/onboarding), never editable in-portal. If unset when the tour reaches the review step, the popover says "Your review link is set up by Juneau Digital Designs — reach out if it's missing" and the composer's send stays disabled. No inline add field. |
| 12 | Mobile | **Mobile-adapted coachmarks** — reposition tooltips, spotlight the mobile card/list UI (not the desktop board), bottom-sheet step style |
| 13 | Ongoing reinforcement | **Contextual one-time hint** on review-ready calls ("Happy customer? Ask them for a review") — in-UI, not outbound (consistent with "no nudges" from the CRM plan) |
| 14 | Visual style | **Branded + smooth motion** (match portal theme tokens; `framer-motion` is already in the shared `ui` package) |
| 15 | Replay access | **Persistent Help (?) button in the desktop left rail, above the Clerk UserButton**; on **mobile, in the Settings section** |
| 16 | Analytics | **None in v1** |

---

## 1. Tour state (Clerk `publicMetadata`)

Store on the Clerk user:
```ts
publicMetadata.tour = {
  completed: boolean;
  lastStepIndex: number;   // for resume
  updatedAt: string;
}
```

- **Read (server):** in the dashboard layout (`app/portal/(dash)/layout.tsx`), read `auth()` / `currentUser()` publicMetadata and pass `tourCompleted` + `lastStepIndex` into the chrome so the client knows whether to auto-launch. Reading server-side avoids a flash of the tour for users who've already finished (same reasoning as the `railCollapsed` server-read cookie in `PortalChrome.tsx`).
- **Write:** new route `app/api/portal/tour/route.ts` → `POST { completed?, lastStepIndex? }` updates the current Clerk user's `publicMetadata` via the Clerk backend SDK (`clerkClient.users.updateUserMetadata`). `publicMetadata` is **client-readable but server-only-writable**, which is exactly what we want — the browser can't forge completion.
- Rate-limit with `getPortalRatelimit()`.

---

## 2. Tour engine

### `app/components/portal/tour/` (new)
- `driver` dependency (`npm i driver.js`). Import its CSS once and **override with `.portal-scope` tokens** (globals.css ~line 3041) so the popover matches `PORTAL-DESIGN.md`: white surface (`--elev-1 #ffffff`), graphite text (`--fg`/`--fg-2`), `--rule` borders, Cabinet Grotesk/Inter (`--font-display`/`--font-body`), portal radius, and **product blue `--accent #2563eb`** for the Next button / progress accent (this is the portal's real accent — use it). Agency teal/coral are not portal tokens and must not appear. Decision #14: add smooth transitions; driver.js animates the spotlight natively, layer `framer-motion` only if the popover needs extra polish.
- `TourController.tsx` (client) — owns the driver.js instance, the step definitions, progress ("3 of 5"), Skip/Back/Next, and persistence (`POST /api/portal/tour` on each step change + on complete/skip). Mounted inside `PortalChrome`'s `<main>` subtree so it has access to the live portal DOM and the data provider.
- `steps.ts` — step definitions keyed by **stable `data-tour` attributes** (see §3), not CSS classes (classes churn). Each step: `{ element: '[data-tour="calls-row"]', title, body, side, align }`.

### Auto-launch logic
`TourController` launches on mount **iff** `!tourCompleted` and the user is on the portal. If `lastStepIndex > 0`, resume there. Respects `prefers-reduced-motion` (reduce animation, keep the tour).

### Resume vs replay
- **Resume:** auto, from `lastStepIndex`, only while `!completed`.
- **Replay:** Help button (§5) calls `tour.start(0)` regardless of `completed`, and does **not** reset `completed` to false (replaying shouldn't re-arm auto-launch).

---

## 3. Anchor points (`data-tour` attributes)

Add stable hooks to existing/new elements. These are the contract between `steps.ts` and the UI — keep them even through refactors.

| Step | `data-tour` | Lives in | Mobile variant |
|------|-------------|----------|----------------|
| 1. Call log | `calls-section` | `CallsSection.tsx` table/list wrapper | spotlight the mobile cards block |
| 1b. Open a call | `calls-row` (first row/card) | `CallsSection.tsx` | first mobile card |
| 2. Organize calls | `crm-board` / `crm-stage-select` | `CrmBoard.tsx` (from CRM plan) | the mobile stage dropdown |
| 3. Send a review request | `review-request-button` | `ReviewRequestDialog` trigger in ContactDetail | same |

(No "set review link" stop — admin-set field, not in the portal.)

**Mobile adaptation (decision #12):** `steps.ts` exports two step arrays (or one array with per-step `mobileElement`), chosen via `useMediaQuery` (`app/components/portal/ui/useMediaQuery.ts`). On mobile, steps that point at the desktop Kanban instead point at the list/dropdown; popover `side` flips to top/bottom sheet-style.

---

## 4. Empty-account seeded demo call (decision #9)

A brand-new client has an empty call log, so "open a call" / "send a review" have nothing to point at.

- In `CrmBoard`/`CallsSection`, when the tour is active **and** the real log is empty, render **one clearly-labeled example contact** ("Example — Jane from Oak St", badge: "Sample"). It is render-only, never written to KV, never textable (the Request-review button in demo mode shows the composer but blocks actual send with "This is a sample — your real calls will work here").
- Gate this behind a `tourDemoMode` flag passed from `TourController` so it never leaks into normal use.
- Reuse the existing demo-call shapes if helpful (`app/data/switchboard-calls.ts`, `app/lib/demo-call-ingest.ts`) — _verify_ these fit; otherwise a single inline fixture is simpler.

---

## 5. Help (?) button (decision #15)

- **Desktop:** add to `PortalChrome.tsx` `portal-rail-foot` (currently holds `<UserButton/>` + email) — a `Lifebuoy`/`Question` Phosphor icon button **above** the `UserButton`. On click → relaunch tour. (Note: a `support`/Lifebuoy tab already exists in `PORTAL_TABS`; this Help button is distinct — it's a tour-replay control. Pick a different icon, e.g. `Question`, to avoid confusion, or fold "Replay tour" into a small popover.)
- **Mobile:** add a "Replay tutorial" row in `SettingsSection` (the rail foot isn't present on mobile; the More drawer is for nav). Keep it discoverable.
- Both call the same `tour.start(0)`.

---

## 6. Ongoing reinforcement (decision #13)

After the tour completes, show a **one-time contextual hint** on calls/contacts that look review-ready (e.g. stage `won`, or any contact with a valid mobile number and no review sent yet): a small inline tooltip/chip "Happy customer? Ask them for a review →" that opens the composer. Dismissed permanently per user via a separate `publicMetadata.reviewHintDismissed` flag (or reuse the tour metadata object). In-UI only — no outbound nudges, consistent with the CRM plan's "no nudges in v1."

Keep this lightweight; it's a nudge, not a second tour.

---

## 7. Copy (warm coach tone) — starting draft

1. **Welcome / Call log:** "👋 Welcome in! This is your call log — every call your receptionist answers shows up here. Tap one to see who rang and what they wanted."
2. **Organize:** "Keep your jobs moving. Drag a call from New → Callback → Won as you work it, so nothing slips through."
3. **Send a review request:** "⭐ Here's the magic: after a happy job, send a quick text asking for a Google review. More reviews → more calls → more work. Come back and do this often!" _(If the review link is unset: "Your review link is set up by Juneau Digital Designs — reach out if you don't see it working.")_
4. **Finish:** "That's it! You're ready. Tap the (?) anytime to replay this."

Final wording owned by the user / `/copywriting` skill if desired. Climax is step 4 (the loop), per decision #3.

---

## 8. Accessibility & edge cases

- `prefers-reduced-motion` → reduce/disable spotlight animation, keep flow.
- Keyboard: driver.js supports Esc to close, arrow/enter to advance — ensure Skip is focusable.
- Don't auto-launch on `/portal/sign-in` or `/portal/sign-up`, only inside the authenticated dash.
- If the user navigates away mid-tour (clicks a real nav link), persist `lastStepIndex` and let it resume; don't trap them.
- Multi-site accounts: tour is per-user, not per-site — don't relaunch on site switch.

---

## 9. Execution order

1. **State plumbing** — `publicMetadata.tour` read in dash layout + `POST /api/portal/tour` write route.
2. **Anchors** — add `data-tour` attributes to the real elements (depends on CRM plan elements existing; stub if needed).
3. **Engine** — `driver.js` + themed `TourController` + `steps.ts` (desktop + mobile arrays), auto-launch/resume.
4. **Demo mode** — seeded example contact behind `tourDemoMode`.
5. **Help button** — desktop rail foot + mobile Settings row.
6. **Reinforcement hint** — one-time review-ready nudge.
7. **Copy + a11y pass.**

No analytics in v1 (decision #16). Typecheck + portal tests green per phase.
