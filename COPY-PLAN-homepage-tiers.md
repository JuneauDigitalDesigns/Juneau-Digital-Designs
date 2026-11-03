# PLAN — Homepage and tier copy: Growth is the system

**Repo:** `juneau-digital-designs`
**Date:** 2026-11-02
**Status:** shape approved by the operator in Q&A. No copy drafted yet; nothing in `app/` edited.
**Builds on:** `PLAN-public-tier-capability-copy.md` (its approval-gated rule still governs) and the
31 Oct review, `jdd-copy-updates-review.html` (Desktop, outside the repo).

---

## 1. What the page argues

**Run like a team.** The reader is a solo operator. Growth is the product: a system that does the
parts of the job a team would — answers the phone, calls the web lead back, keeps every lead in one
place, and gives the owner somewhere to work it. Starter is the way in: same stack, it reports, and
it shows what the system can do before the owner takes on the rest of it.

The site today argues something older. Its pricing eyebrow is literally "Two tools, one monthly
bill," and the only place a lead goes, anywhere on the homepage, is a text message. The words
portal, inbox and CRM do not appear on it.

---

## 2. Decisions locked in Q&A

| # | Question | Decision |
|---|---|---|
| 1 | Write to today's truth, or the finished system? | **The finished system.** The new-lead alert and the post-call sender fix will land; the copy describes the system as it will be. |
| 1a | Features that wait on the client's own carrier registration | **Named, with an approval-gated clause and no timeframe.** Applies to portal→customer texting and the one-click Google review request only. |
| 2 | What is Starter? | **The way in, not a demo.** Growth is the product. Starter is for someone who wants to see how the system works before taking all of it, and staying on it is fine. The word "demo" is not used. |
| 3 | Where does the portal/CRM go? | **Its own section**, after the receptionist and before the calculator. The pinned `ScrollJourney` goes; Lenis smooth scroll with scroll-triggered reveals replaces it (separate workstream, §7). |
| 3a | The call film | **Ends in the CRM**: after the "new lead in your portal" text, it shows the lead sitting in the CRM. |
| 4 | Shape of `/pricing` | **Shared stack first, then the differences.** One block of what every plan gets, then cards carrying only what differs. |
| 5 | The signed agreement | **In this plan.** Only the email lead-delivery bullets, rewritten for portal capture. |
| 6 | Who is the reader? | **The solo operator, sold the version of the business where nothing slips.** The existing reader, not a bigger one. |
| 7 | The tier line | **A new pair written from "run like a team"**, not a return to "Starter tells you / Growth acts for you" and not the shipped hearing/chasing pair. Constraint: Starter reports; Growth works the lead *and* gives you the workspace. |

On 7: "acts for you" describes the callback, which is only half of Growth now. The CRM is where the
owner acts. A tier line about the callback alone would sell the half that is not the product.

---

## 3. Truth rules for every surface

- **Present tense:** the website, the receptionist (rings the owner first, picks up on no-answer),
  the Growth web-form callback, the new-lead text to the owner, every lead landing in the portal,
  the CRM.
- **Approval-gated, no timeframe:** portal→customer texting and the review request. The wording
  says they switch on once the carriers approve the business's registration. It never says how long
  that takes.
- **The contract is different.** `schedules.ts` renders into the agreement clients sign, so it is a
  promise, not a description, and does not get the future-state latitude. It changes only for what
  has shipped. Portal capture has. The new-lead alert and the two gated features go into the
  contract in the commit that ships each one, not before.
- **Starter and Growth differ in exactly three ways**, and the copy never implies a fourth:
  1. web form — Starter drops it in the portal; Growth calls the submitter back first, then drops
     the result in the portal;
  2. CRM — Growth and Enterprise only;
  3. minutes — 100 vs 350, stated as a footnote, never a headline (the reprice rule).
- **No lead arrives by email**, on any tier. Anything implying it is pre-portal.
- **Web-only stays an FAQ answer**, never a card or a price (unchanged from the last plan).
- Prices and minutes keep deriving from `SCHEDULES`. No figure typed into copy.

---

## 4. Page order

hero → website → receptionist (film ends in the CRM) → **portal/CRM** (new) → calculator →
featured sites → FAQ → pricing

The calculator stays, as an ordinary section after the portal. It is the one section about the
reader's business rather than the system, so it follows the loop and prices the cost of not having
it.

---

## 5. Surfaces and what changes

| Surface | File | Today | Change |
|---|---|---|---|
| Hero sub-line | `app/components/home/homepageclient.tsx:328` | "A website that gets you called, and a 24/7 receptionist…" — two tools | Argue the whole system. The H1 ("Get found. Get called. Do Business.") is reviewed against the spine, not assumed to stay |
| Receptionist outcomes | `homepageclient.tsx:457-459` | Ends "Finally it texts you the details, so you can call them back." | Ends with the lead landing in the portal and the owner told it's there |
| Call film | `app/components/home/SiteToCallPanel.tsx` (`OwnerTextScreen` ~:337-360) | Sender "AI Receptionist"; the text carries the whole lead brief | Sender becomes JDD (the account lane, matching Program One on `/sms-terms`); the text points to the portal; a short CRM beat follows (§7 constraint) |
| Portal/CRM section | new, in `homepageclient.tsx` | Does not exist | Monitor, manage, act on leads. Inbox on every plan; pipeline on Growth; texting and review request gated per §3 |
| FAQ | `homepageclient.tsx:862` | "It takes their details and texts you." | Details land in the portal; owner is told |
| Home pricing eyebrow | `homepageclient.tsx:991` | "Two tools, one monthly bill." | Replaced; it is the old product's thesis in five words |
| Home pricing cards | `homepageclient.tsx:998`, `:1004` | Hearing / chasing pair | New tier line (decision 7) |
| `/pricing` structure | `app/components/pricing/pricingpageclient.tsx` | Three cards; Starter reads as a shorter list | Shared-stack block above the cards; cards carry only the three differences |
| `/pricing` taglines | `pricingpageclient.tsx:46`, `:61` | "Starter tells you who called…" / "Growth acts for you…" | New tier line |
| `/pricing` Starter list | `pricingpageclient.tsx:52` | "Lead email with the caller's name, number, and reason" | The lead lands in your portal |
| `/pricing` Starter list | `pricingpageclient.tsx:54` | "Client portal to check your site and your calls" | Kept (true on Starter), widened to say web-form leads land there too |
| `/pricing` Growth list | `pricingpageclient.tsx` Growth `features` | No CRM anywhere | CRM as a headline item alongside the callback; gated features listed per §3 |
| `/pricing` meta | `app/pricing/page.tsx:6` | "…pricing for web design and digital support." | Describe the system |
| `/pricing` FAQ | `pricingpageclient.tsx` `FAQS` | Not yet read in full against the new spine | Read every answer at draft time; fix only what contradicts §3 |
| Get Started form | `app/components/home/LeadPanel.tsx:19-20` | Starter "4-page site + email leads"; Growth "+ AI receptionist" | Wrong twice: says Starter has no receptionist and gets email. Rewrite both hints. This is the form the hero CTA opens |
| Contract | `app/lib/legal/schedules.ts:65`, `:90`, `:229` | "A lead email with…" / "Email lead capture from the website contact form" (Starter and web-only) | Rewritten for portal capture only. Wording approved separately (Gate B) |

`LeadPanel.tsx` and `SiteToCallPanel.tsx` were out of scope in the last pass. They are in scope here
because both state the old product to a prospect.

---

## 6. Verified while planning, not assumed

- Lead recorded to the client's portal on every tier is live: `app/api/ingest/lead/route.ts` calls
  `recordLead` from `app/lib/portal-leads.ts`. The ops session confirmed it end to end on 2026-11-02.
- The owner text on a new web-form lead is not built: the ingest route has no SMS path. The post-call
  brief sends from the client's own number with no messaging service, which fails `30034` for a real
  client. Both are the dependencies in §7; this plan's copy assumes they land.
- The portal already runs this plan's Starter logic: `app/components/portal/crm/StarterShowcase.tsx`
  never hides the Customers tab, leads with what Starter already has ("every call and web enquiry in
  your Inbox"), and makes the upgrade a guided walkthrough. The public page should say the same
  thing the portal does.
- The film's own header rule: "Act 2 is a ring nobody answers and one text. That imbalance is the
  pitch." A CRM beat lengthens Act 2, so it has to be brief (§7).
- Lenis is not installed. The page runs on `framer-motion` ^12.

---

## 7. Separate workstreams this plan depends on

Not copy, so they are recorded here as requirements, not done inside the copy pass.

| Workstream | What it owes the copy |
|---|---|
| Remove `ScrollJourney`; add Lenis and scroll-triggered reveals | Sections in the §4 order, each arriving on scroll. The reveal treatment is visual direction and belongs with the visual-upgrade work, not this plan |
| Film rework (`SiteToCallPanel.tsx`) | JDD as the text's sender; a CRM beat after the text showing that same lead in the CRM. **The beat is a glance, not a tour**, so Act 2 stays short and the asymmetry the film depends on survives |
| New-lead alert to the owner (ops item 9) | Must exist before the page's "you're told" claim is true. Buildable on JDD's notification number (+1 689 329 2464) on the already-approved account campaign |
| Post-call brief sender fix (ops item 2) | Same: the post-call text has to deliver for a real client's number |
| Portal→customer texting and review requests | Stay gated on the per-client carrier registration. Two defects from the 31 Oct review (customer-lane traffic routed through the account campaign; a default review message offering a discount, which Google prohibits) must be fixed before either feature is real |

---

## 8. Gates

- **Gate A — copy.** All marketing copy (§5, everything except `schedules.ts`) is drafted as a
  before/after review page in the style of the 31 Oct review. The operator approves or marks it up
  before any file in `app/` is edited.
- **Gate B — contract.** The `schedules.ts` bullets are approved word for word on their own,
  separately from Gate A.
- **Gate C — commit.** `npx tsc --noEmit` (baseline first), `npm run build`, `npm run lint`; grep the
  diff for any hard-coded price or minute figure; staged files reviewed by eye.

---

## 9. Gate A outcome — 2026-11-02

The drafted copy is in `jdd-homepage-copy-review.html` (Desktop, outside the repo). The operator
approved every item marked ready and chose:

| Choice | Decision |
|---|---|
| Headline | **"Get found. Get called. Run like a team."** The `h1` font floor is re-measured for the longer third line, not assumed |
| Portal section heading | **"Then nothing slips."** |
| Tier line | **"Starter reports every lead. Growth works them like a team would."** Homepage cards and `/pricing` taglines |
| Contract and the CRM | **Gate B grows by one bullet:** Growth names the CRM pipeline. It is built, so it goes in now under the same rule as portal capture |

**The post-call text is the JDD alert, not the old brief.** After every call the owner gets a text
from JDD's notification number saying a new lead is waiting in the portal. Two consequences:

- `schedules.ts:64` ("A post-call text brief to the Client's phone after every call") is rewritten to
  describe that alert, but **only in the commit that moves the post-call text to the notification
  number** (ops item 2). Today Make sends it from the client's own number, which fails `30034` for a
  real client.
- The web-form alert is built on `claude/owner-lead-alert-385bb1` (`1a84de5`), unmerged, and sends
  nothing until `TWILIO_NOTIFICATION_NUMBER` is set in the Vercel env. The copy that says "you get a
  text" should not deploy before both paths are live.

---

## 10. Out of scope

- How the page looks (type, colour, imagery). Visual-upgrade work.
- `/sms-terms` and the consent string. Settled in the last pass; read only to keep the film's sender
  consistent with Program One.
- Portal copy.
- The onboarding wizard. Not checked against this spine; worth its own pass if it carries "email
  leads" too.
