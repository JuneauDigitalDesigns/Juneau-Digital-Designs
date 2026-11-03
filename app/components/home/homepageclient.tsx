"use client";
/* Z-index constants: navbar 50 | grain 60 | modals 70 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Info } from "@phosphor-icons/react";
import SiteToCallPanel from "./SiteToCallPanel";
import DemoSiteFrame from "./DemoSiteFrame";
import FeaturedSites from "./FeaturedSites";
import LeadPanel from "./LeadPanel";
import PortalPreview from "./PortalPreview";
import { SCHEDULES } from "@/app/lib/legal/schedules";

const DEMO_TEL = "tel:+19302221343";
const DEMO_TEL_DISPLAY = "(930) 222-1343";

/* Prices come from Schedule A, never typed in by hand — the same rule the pricing page
   follows. A number written into marketing copy is a number that can eventually contradict
   the signed agreement. */
const GROWTH_PRICE = SCHEDULES.growth.monthlyPrice;
const STARTER_PRICE = SCHEDULES.starter.monthlyPrice;
const ENTERPRISE_PRICE = SCHEDULES.enterprise.monthlyPrice;

/* The one easing curve on the page. Matches `.reveal`'s cubic-bezier in globals.css, so
   the CSS-driven reveals and the Framer-driven ones decelerate identically. */
const EASE = [0.16, 1, 0.3, 1] as const;

/* The IntersectionObserver-based `useReveal`/`<Reveal>` pair lived here. Every section
   on this page now enters through <JourneyReveal> below, so both were unused. The
   `.reveal` rules they drove are still in globals.css for any page that wants them. */

/* ── Journey reveal ─────────────────────────────────────────────
   The page's one entrance, deliberately louder than <Reveal>: further travel, a slight
   scale, and roughly a third longer. These are the marquee sections, and at
   `translateY(20px)` they read as page furniture settling rather than content arriving.
   `delay` is in stagger steps, not seconds — copy is step 0, the visual beside it step 1,
   so the reader is told what they're looking at just before it lands.

   This used to sit beside a pinned stage that held the website, receptionist and
   calculator in one frame and swapped them on scroll. That went when the page moved to
   Lenis (see <SmoothScroll> in MarketingChrome): every section now travels with the
   document, and arrives through this as it comes into view. */
const JOURNEY_STAGGER = 0.15;

function JourneyReveal({
  children,
  delay = 0,
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduceMotion = !!useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      /* Constant, never branched on `reduceMotion`. `useReducedMotion()` reads
         matchMedia, so it is `false` during SSR and `true` on a reduced-motion client —
         branching `initial` on it made the server emit `opacity: 0` where the client
         emitted nothing, which React reports as a hydration mismatch. Reduced motion is
         handled by collapsing the duration instead, so the element still starts hidden
         and simply snaps visible the moment it intersects. */
      initial={{ opacity: 0, y: 56, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -6% 0px" }}
      transition={{
        duration: reduceMotion ? 0 : 1.05,
        ease: EASE,
        delay: reduceMotion ? 0 : delay * JOURNEY_STAGGER,
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Hero ───────────────────────────────────────────────────────
   Copy only. The screenshot moved down into <WebsiteSection>, where it has a column to
   itself and copy that argues for it, and the three-item offer strip went with it — the
   journey below now says all three of those things at length. What's left is the claim
   and the one action, centred, with nothing beside it to share the eye. */
function Hero({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "clamp(72px,8vw,140px) clamp(18px,4vw,56px) clamp(48px,5vw,80px)",
        textAlign: "center",
      }}
    >
      {/* The third line is the spine of the page: the first two are what the website and
          the receptionist do, this is what the whole system adds up to. It replaced "Do
          Business.", which any agency could promise.

          Every term of the clamp is set by that third line, which has to hold one line at
          every width. Measured in Big Shoulders 900 it is 6.99× its font size wide — 28%
          wider than "Do Business." (5.44×), which the old clamp(46px, 13vw, 120px) was
          tuned for. Against the box it sits in (the section's 900px max, less its gutter):
            · cap 108px → 755px, inside the 788px box at ≥1400px wide (120px was 839px and
              wrapped "TEAM." onto a fourth line);
            · rate 12.4vw → 0.87vw of text in 0.92vw of box through the mid range;
            · floor 39px → 273px at 320px wide, inside the 284px box with room for a
              fallback font that renders a hair wide.
          Re-measure before changing the line, or any of the three numbers. */}
      <h1 style={{ fontWeight: 900, fontSize: "clamp(39px,12.4vw,108px)", lineHeight: 0.9, letterSpacing: ".005em", textTransform: "uppercase" }}>
        Get found.<br />Get called.<br /><span style={{ color: "var(--accent-2)" }}>Run like a team.</span>
      </h1>
      {/* The third clause is true on every plan, Starter included, so the hero never sells
          something one tier lacks. "24/7" stays: it is one of only two availability claims
          on the page, the other being the receptionist's "two in the morning". */}
      <p style={{ fontSize: "clamp(17px,1.6vw,21px)", lineHeight: 1.55, color: "var(--fg-2)", margin: "28px auto 32px", maxWidth: "46ch" }}>
        A website that gets you called, a 24/7 receptionist that answers when you can&apos;t, and one place where every lead waits for you. The front office you never had to hire.
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        {/* The ring-pulse animation stays with the phone CTA in <RailCTA> at the bottom
            of the page — on a button that opens a form it would be promising a call
            that isn't coming. */}
        <button type="button" onClick={onOpenForm} className="btn primary lg hero-cta-btn" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>Get Started</button>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--fg-3)" }}>Five quick questions. About 30 seconds.</span>
      </div>
    </section>
  );
}

/* ── The journey ────────────────────────────────────────────────
   Three sections that each take one part of the system and spend a screen on it: the
   website, the receptionist, then the portal where every lead lands. Their headings read
   as one sentence — "A website that makes the phone ring." / "Then someone picks up." /
   "Then nothing slips." Copy and visual alternate sides at ≥900px and always stack
   copy-first below it — see `.journey-grid` in globals.css, which flips the columns with
   `order` rather than DOM position so the mobile reading order survives the flip. */

function JourneySection({
  heading,
  body,
  outcomes,
  visual,
  visualFirst = false,
  footnote,
}: {
  heading: string;
  body: string;
  outcomes: string[];
  visual: React.ReactNode;
  visualFirst?: boolean;
  /** A line under the outcomes, set apart from them. Only the portal section uses it, for
   *  the one sentence on the page that separates the plans before the price cards. */
  footnote?: React.ReactNode;
}) {
  return (
    <section className="journey-section">
      <div className={`journey-grid${visualFirst ? " journey-grid--flip" : ""}`}>
        {/* Copy is always first in DOM: it is what should be read first when the grid
            collapses to one column, and it is step 0 of the stagger either way. */}
        {/* No kicker. Both headings now name their own subject, so a label reading "The
            Website" above "A website that makes the phone ring" was saying it twice. */}
        <JourneyReveal delay={0}>
          <h2 style={{ fontWeight: 800, fontSize: "clamp(30px,4.2vw,54px)", lineHeight: 0.98, letterSpacing: ".01em", textTransform: "uppercase", maxWidth: "16ch" }}>
            {heading}
          </h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--fg-2)", maxWidth: "48ch", marginTop: 18 }}>
            {body}
          </p>
          {/* Was `.journey-bullets`: 13px mono at --fg-3, the dimmest token on the page,
              carrying the most specific facts we have. The hierarchy was inverted against
              the value of the content, so these are now full-contrast sentences. */}
          <div className="journey-outcomes">
            {outcomes.map((o) => (
              <span key={o} className="journey-outcome">
                {o}
              </span>
            ))}
          </div>
          {footnote && (
            <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--fg-2)", maxWidth: "48ch", marginTop: 20 }}>
              {footnote}
            </p>
          )}
        </JourneyReveal>

        <JourneyReveal delay={1} className="journey-visual">
          {visual}
        </JourneyReveal>
      </div>
    </section>
  );
}

/* ── 01 · The website ───────────────────────────────────────── */
function WebsiteSection() {
  return (
    <JourneySection
      /* Leads with the outcome and hands straight off to section 02, which answers it with
         "Then someone picks up." The old heading described how we work; this one describes
         what the reader gets. */
      heading="A website that makes the phone ring."
      /* The body used to restate the heading ("we build it, host it, keep it current")
         before adding anything. It now answers the objection that actually stalls buyers,
         which until this pass only existed in the FAQ below. */
      /* A plain string prop, not JSX text, so a typographic apostrophe rather than an
         entity: `&apos;` here rendered on the page as the six literal characters. */
      body="We write it, build it, and host it. No coding or maintenance on your part, and it’s always up to date."
      outcomes={[
        "You answer a few questions.",
        "It goes live in less than a week.",
        "Never again worry about your website.",
      ]}
      visualFirst
      visual={
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DemoSiteFrame />
          {/* Says "could look like" rather than claiming it's live — it's a captured
              screenshot, and the old "running live" line stopped being true the moment
              the iframe became an image. */}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--fg-3)", lineHeight: 1.5 }}>
            What yours could look like.
          </span>
        </div>
      }
    />
  );
}

/* ── 02 · The receptionist ──────────────────────────────────────
   The film that used to sit in its own <TheHandoff> section now argues for the
   receptionist directly, beside the copy that names it. It showed the handoff there and
   it shows the handoff here; what it lost was a heading that restated the section it
   was already inside. */
function ReceptionistSection() {
  return (
    <JourneySection
      /* The sequel to section 01's heading, and the middle of the sentence the three
         journey headings make. The old heading said "Books the job. Texts you.", which the
         body and two bullets then said again. */
      heading="Then someone picks up."
      /* LOAD-BEARING TAIL. "Or it's two in the morning" is this section's only
         availability claim, since the outcomes carry none. Remove it and the section never
         says the thing people buy this for. (An earlier "Nights and weekends too" went
         missing exactly that way, with this warning left standing over nothing.) The hour
         matches the film's 2:13 AM HVAC call.

         Deliberately industry-neutral: this page sells to any service business, so no
         ladders, roofs or vans. */
      body="You’re with a customer, or it’s two in the morning. Either way, it picks up."
      /* The third outcome is where the lead goes. It used to end at a text with the
         details; the lead now lands in the portal on every plan, and the text tells the
         owner it is there. */
      outcomes={[
        "It asks the questions you'd ask, in English or in Spanish.",
        "It captures the lead's name, number and what the job is.",
        "Then the lead goes straight into your portal, and you get a text saying it’s there.",
      ]}
      /* No CTA on this panel by design. The calculator and the pricing rail carry the
         asks; the film's own Get Started went with the recap block it lived in. */
      visual={<SiteToCallPanel />}
    />
  );
}

/* ── 03 · The portal ────────────────────────────────────────────
   Where the lead the film just delivered actually lives. Until this section existed the
   words portal, inbox and CRM appeared nowhere on the homepage, so the page sold a website
   and a receptionist whose output was a text message — the product before leads were
   recorded anywhere.

   It carries the only sentence on the page that separates the plans before the price
   cards, and it does it by what Growth adds rather than by what Starter lacks: Starter is
   the way in, the same system with the follow-up left to the owner. */
function PortalSection() {
  return (
    <JourneySection
      /* Ends the sentence the journey headings make. */
      heading="Then nothing slips."
      body="Every call and every web enquiry lands in your portal, with who it was and what they need. Open it on your phone between jobs and you know exactly who’s waiting."
      /* The third outcome is the one place on this page the two carrier-gated features
         appear. It names them and says what they wait on, never how long: approval is the
         carriers' to grant, so a timeframe here would be ours promising theirs. */
      outcomes={[
        "Calls and website enquiries in one inbox, newest first, with a summary of each.",
        "Move each lead from Lead to Won, and spot the ones going stale before they go cold.",
        "Text a customer back from your business number, or ask for a Google review in one tap. Both switch on once the carriers approve your business registration.",
      ]}
      footnote={
        <>
          Every plan gets the inbox.{" "}
          <strong style={{ color: "var(--fg)" }}>
            Growth adds the pipeline, the texting and the reviews: the part a team would do.
          </strong>
        </>
      }
      visualFirst
      visual={<PortalPreview />}
    />
  );
}

/* ── Missed Calls Revenue Calculator ─────────────────────────── */
type CalcView = "sliders" | "results" | "breakdown";

/* Strictly sequential: the outgoing view clears before the incoming one starts, so the
   two are never on screen together at half opacity. Out is quicker than in — the state
   you asked to leave should get out of the way promptly, the one you asked for can
   afford to arrive. Mirrored in `.calc-view` / `.calc-view.is-leaving`. */
const CALC_OUT_MS = 250;

function MissedCallsCalculator({ onOpenForm }: { onOpenForm: () => void }) {
  const MISSED_MIN = 1, MISSED_MAX = 50;
  const RECOVERY_MIN = 1, RECOVERY_MAX = 100;
  const JOB_SLIDER_MIN = 0, JOB_SLIDER_MAX = 100;

  // Invoca, Home Services Call Conversion Benchmarks 2025 (60M+ calls).
  const LEAD_RATE = 0.37;
  const CLOSE_RATE = 0.46;
  // Deliberately conservative and deliberately uncited — this is our own
  // assumption, not published research. No credible "AI revenue recovery rate"
  // figure exists; the 0.73 previously here was ContactBabel's AI call
  // *resolution* rate, a different metric entirely. If this changes, it stays
  // labeled as an estimate in the accordion.
  const AI_RECOVERY_RATE = 0.50;

  function sliderToJobValue(pos: number): number {
    return Math.round(50 * Math.pow(10000, pos / 100));
  }
  function jobValueToSlider(val: number): number {
    return (Math.log(val / 50) / Math.log(10000)) * 100;
  }

  const [missedPerWeek, setMissedPerWeek] = useState(10);
  const [jobSliderPos, setJobSliderPos] = useState(() => jobValueToSlider(800));
  const [currentRecovery, setCurrentRecovery] = useState(20);

  /* The card is one fixed box that swaps its contents, rather than one that grows.
     It used to expand 530x481 → 1125x764 on Calculate and again when the methodology
     opened, which put it past every viewport height we support and made it the one
     panel that couldn't sit in the pinned journey. Three states, one footprint:

       sliders ──Calculate──▶ results ──How we calculate──▶ breakdown
          ◀────Recalculate────┘   ◀────────Back───────────┘

     The figures still stay hidden until asked for. Gating turns the card from a toy
     that reacts to every drag into a transaction with one answer — which is what
     earns the held pause before the remark lands. */
  const [view, setView] = useState<CalcView>("sliders");
  /* The view being left. Non-null only during the 250ms fade-out, which is also what
     makes `goTo` re-entrant-safe: a second click mid-swap is ignored rather than
     queueing a second timer that would swap twice. */
  const [leaving, setLeaving] = useState<CalcView | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function goTo(next: CalcView) {
    if (next === view || leaving) return;
    setLeaving(view);
    timers.current.push(
      window.setTimeout(() => {
        setView(next);
        setLeaving(null);
      }, CALC_OUT_MS)
    );
  }

  /* The view on screen is the one being left while it fades, then the new one. Adding
     `is-active` is what starts the entrance — a class that carries an `animation`
     replays it each time it is applied, so no key or remount is needed. */
  const visible = leaving ?? view;
  const viewClass = (v: CalcView) =>
    `calc-view${v === visible ? " is-active" : ""}${v === leaving ? " is-leaving" : ""}`;

  const avgJobValue = sliderToJobValue(jobSliderPos);
  const annualMissed = missedPerWeek * 52;
  const annualLeadCalls = annualMissed * LEAD_RATE;
  const unrecoveredLeads = annualLeadCalls * (1 - currentRecovery / 100);
  const revenueOnTable = unrecoveredLeads * CLOSE_RATE * avgJobValue;
  const recoverableRevenue = revenueOnTable * AI_RECOVERY_RATE;

  function formatDollars(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
    return `$${Math.round(n).toLocaleString()}`;
  }

  /* Row 02 states its value in three places — the inline figure, the aria-valuetext,
     and the two endpoint labels on its rail — and they have to agree. One function so
     they cannot drift. Separate from `formatDollars` because that one is tuned for
     six-figure annual sums and would render an $800 job as "$800" via a different
     branch than a $500K one. */
  function formatJobValue(n: number): string {
    return n >= 1000
      ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K`
      : `$${n.toLocaleString()}`;
  }

  const missedPct = ((missedPerWeek - MISSED_MIN) / (MISSED_MAX - MISSED_MIN)) * 100;
  const jobPct = jobSliderPos;
  const recoveryPct = ((currentRecovery - RECOVERY_MIN) / (RECOVERY_MAX - RECOVERY_MIN)) * 100;
  const revenueFormatted = formatDollars(revenueOnTable);
  /* Hoisted for the same reason as `formatJobValue` above: this figure is now stated
     twice, in the right-hand column and in the remark that argues it, and the two cannot
     be allowed to drift. */
  const recoverableFormatted = formatDollars(recoverableRevenue);
  const avgJobValueFormatted = formatJobValue(avgJobValue);

  return (
    <section className="calc-section">
      <div className="aurora-grid" />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
        {/* No kicker here, unlike the two sections above it. Those name a thing we sell;
            this one is about the reader's own business, and labelling it "The Numbers"
            would file it alongside the products as a third thing to buy. */}
        {/* A question, not an instruction: it puts the reader inside their own numbers
            before they touch a slider. The sub-line that used to sit here ("Move the
            sliders to match your business. Then hit calculate.") told them to do the two
            things three labelled sliders and a button marked Calculate already make
            obvious, and cost this panel — the tallest of the three — a paragraph plus its
            margin. */}
        <JourneyReveal style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ marginTop: 16, marginBottom: 0, textTransform: "uppercase" }}>
            How much are your <span style={{ color: "var(--accent-2)" }}>missed calls</span> worth?
          </h2>
        </JourneyReveal>

        <JourneyReveal delay={1}>
          {/* All three views stay mounted, stacked in one grid cell. That is what fixes the
              card's size without a magic number: `visibility: hidden` still contributes to
              layout, so the cell is always as tall as the tallest view and the box cannot
              change size when the contents swap. A `min-height` guess drifted 53px on
              desktop and 80px on a phone, because the sliders' height depends on where
              the copy wraps. */}
          <div className="calc-card">
            <div className="calc-stack" aria-live="polite">

            <div className={viewClass("sliders")} inert={view !== "sliders"}>
            <div className="calc-inputs">
              {/* Each row is sentence-left, rail-right. The `--val-w` on the value span is
                  a per-row minimum in `ch`: the figure sits mid-sentence, so without a
                  floor the words after it shift every time the digit count or width
                  changes while dragging. Sized to each row's widest value. */}
              <div className="calc-row">
                <p className="calc-row-copy">
                  I miss{" "}
                  <span className="calc-row-value" style={{ "--val-w": "2ch" } as React.CSSProperties}>
                    {missedPerWeek}
                  </span>{" "}
                  calls a week
                </p>
                {/* The endpoints are aria-hidden: the input already announces its own
                    min and max, and the label is only there for the eye. */}
                <div className="calc-fader">
                  <span className="calc-fader-end" aria-hidden="true">{MISSED_MIN}</span>
                  <input
                    type="range"
                    className="calc-slider"
                    min={MISSED_MIN}
                    max={MISSED_MAX}
                    step={1}
                    value={missedPerWeek}
                    onChange={(e) => setMissedPerWeek(Number(e.target.value))}
                    style={{ "--pct": `${missedPct}%` } as React.CSSProperties}
                    aria-label="Missed calls per week"
                  />
                  <span className="calc-fader-end" aria-hidden="true">{MISSED_MAX}</span>
                </div>
              </div>

              <div className="calc-row">
                <p className="calc-row-copy">
                  My average job is worth{" "}
                  {/* No --val-w: the value ends the sentence, so nothing trails it to be
                      pushed around, and a floor wide enough for "$500K" would leave "$50"
                      floating away from "worth". */}
                  <span className="calc-row-value">{avgJobValueFormatted}</span>
                </p>
                <div className="calc-fader">
                  {/* Formatted from the slider bounds rather than written out, so the
                      labels track the scale if `sliderToJobValue` is ever retuned. */}
                  <span className="calc-fader-end" aria-hidden="true">
                    {formatJobValue(sliderToJobValue(JOB_SLIDER_MIN))}
                  </span>
                  <input
                    type="range"
                    className="calc-slider"
                    min={JOB_SLIDER_MIN}
                    max={JOB_SLIDER_MAX}
                    step={0.5}
                    value={jobSliderPos}
                    onChange={(e) => setJobSliderPos(Number(e.target.value))}
                    style={{ "--pct": `${jobPct}%` } as React.CSSProperties}
                    aria-label="Average job value"
                    /* the raw value is a 0–100 logarithmic position, which is
                       meaningless read aloud — announce the dollar figure instead */
                    aria-valuetext={avgJobValueFormatted}
                  />
                  <span className="calc-fader-end" aria-hidden="true">
                    {formatJobValue(sliderToJobValue(JOB_SLIDER_MAX))}
                  </span>
                </div>
              </div>

              <div className="calc-row">
                {/* "leads", not "calls" or "them". The slider is applied to
                    `annualLeadCalls` — the 37% subset — not to every missed call, so any
                    other noun here would describe a different sum than the one computed. */}
                <p className="calc-row-copy">
                  I win back{" "}
                  {/* 3.8ch, not 3.5: measured, "100%" overran 3.5ch and nudged "of those
                      leads" 2.8px to the right on the last step of the drag. */}
                  <span className="calc-row-value" style={{ "--val-w": "3.8ch" } as React.CSSProperties}>
                    {currentRecovery}%
                  </span>{" "}
                  of those leads
                </p>
                <div className="calc-fader">
                  <span className="calc-fader-end" aria-hidden="true">{RECOVERY_MIN}%</span>
                  <input
                    type="range"
                    className="calc-slider"
                    min={RECOVERY_MIN}
                    max={RECOVERY_MAX}
                    step={1}
                    value={currentRecovery}
                    onChange={(e) => setCurrentRecovery(Number(e.target.value))}
                    style={{ "--pct": `${recoveryPct}%` } as React.CSSProperties}
                    aria-label="Percent of lead calls you recover today"
                    aria-valuetext={`${currentRecovery}%`}
                  />
                  <span className="calc-fader-end" aria-hidden="true">{RECOVERY_MAX}%</span>
                </div>
              </div>

              {/* Shares the rows' column template so the button sits under the rail. Width
                  and glow were inline here and had to go: inline styles beat the stylesheet,
                  and the accent bloom was removed from the slider in the same pass. */}
              <div className="calc-submit">
                <button
                  type="button"
                  onClick={() => goTo("results")}
                  className="btn primary lg"
                >
                  Calculate
                </button>
              </div>
            </div>
            </div>

            <div className={viewClass("results")} inert={view !== "results"}>
            <div className="calc-panel">
              <button type="button" className="calc-back" onClick={() => goTo("sliders")}>
                &larr; Recalculate
              </button>

              {/* Side by side, split by a rule, rather than stacked. Stacking cost ~140px
                  and was the single reason the results couldn't fit the sliders' height —
                  and read as two unrelated numbers rather than one comparison. */}
              <div className="calc-figures">
                {/* "Lost" then "Won Back": an explicit pair. The old labels described the
                    two numbers accurately but in different grammar, so the card read as
                    two facts rather than one before-and-after. */}
                <div>
                  <div className="kicker">Lost to Missed Calls</div>
                  <div className="calc-figure calc-figure--muted">{revenueFormatted}</div>
                  <div className="kicker">per year</div>
                </div>
                <div>
                  <div className="kicker">Won Back With a Receptionist</div>
                  <div className="calc-figure calc-figure--accent">{recoverableFormatted}</div>
                  <div className="kicker">per year</div>
                </div>
              </div>

              {/* The held gap after the figures settle is the whole effect: it reads as
                  someone looking at your number, then remarking on it. */}
              <p className="calc-step calc-remark" style={{ animationDelay: "1150ms" }}>
                {/* At 100% recovery the figure is exactly $0, and "those callers called
                    the next guy" becomes a confident falsehood. */}
                {revenueOnTable < 1 ? (
                  <>Nothing on the table at 100%. Almost nobody is at 100%.</>
                ) : (
                  /* Argues the RECOVERABLE figure, not the loss. This line used to restate
                     `revenueFormatted` and then hand the sentence to the competitor, which
                     meant the loss carried both the bigger treatment and the only words on
                     the card while the number we actually sell — already the loudest thing
                     here, in accent with a glow — went unmentioned. The reader was left in
                     the negative at the exact moment they are most persuadable.

                     The close is the objection, not the pitch: the reflex after a figure
                     this size is "so what do I have to do", and the answer is nothing. */
                  <>{recoverableFormatted}{" "}of that comes back when every call gets answered. You don&apos;t work any harder, you just stop missing them.</>
                )}
              </p>

              <div className="calc-step calc-actions" style={{ animationDelay: "1450ms" }}>
                {/* A link, not a button. The real ask is the CTA at the foot of the
                    pricing section; a third solid primary button on one page turns all
                    three into furniture. */}
                <button type="button" onClick={onOpenForm} className="calc-link calc-link--lead">
                  Get started &rarr;
                </button>
                <button type="button" className="calc-link" onClick={() => goTo("breakdown")}>
                  <Info size={15} weight="duotone" style={{ color: "var(--accent-2)", flexShrink: 0 }} />
                  How we calculate this
                </button>
              </div>
            </div>
            </div>

            <div className={viewClass("breakdown")} inert={view !== "breakdown"}>
            <div className="calc-panel">
              <button type="button" className="calc-back" onClick={() => goTo("results")}>
                &larr; Back to results
              </button>

              <p className="calc-breakdown-intro">
                Based on your inputs, published research where it exists, and one assumption of our own. All five steps are shown below.
              </p>
              <ol className="calc-breakdown">
                <li>
                  <strong>{missedPerWeek} calls/week × 52</strong> = {Math.round(annualMissed).toLocaleString()} missed/year
                </li>
                <li>
                  × <strong>37% are new-business leads</strong> (Invoca, 2025) = {Math.round(annualLeadCalls).toLocaleString()} lead calls
                </li>
                <li>
                  × <strong>{Math.round((1 - currentRecovery / 100) * 100)}% unrecovered</strong> = {Math.round(unrecoveredLeads).toLocaleString()} lost leads
                </li>
                <li>
                  × <strong>46% of leads convert on the call</strong> (Invoca, 2025) × avg job value = {formatDollars(revenueOnTable)}
                </li>
                <li>
                  × <strong>50% recovered</strong>, our own estimate, deliberately conservative = {formatDollars(recoverableRevenue)}
                </li>
              </ol>

              {/* Folded in here rather than sitting under the figures: the only reader who
                  needs the disclaimer is the one scrutinising the maths, and that is
                  exactly who opened this view. */}
              <p className="calc-fineprint">
                Illustrative estimates only. Actual results vary by market, business model, and execution.
              </p>
            </div>
            </div>

            </div>
          </div>
        </JourneyReveal>
      </div>
    </section>
  );
}

/* `TwoOperators` lived here: two cards that re-explained the hero at ~220 words. Its copy
   is back, split across <WebsiteSection> and <ReceptionistSection>, where each half gets
   a screen and a visual instead of sharing a row of cards.

   `TheHandoff` lived here too, wrapping <SiteToCallPanel> in a heading of its own. The
   film now sits inside <ReceptionistSection> beside the copy that names it; the heading
   went because it introduced a section the film was already the whole of. */

/* ── Before you call ────────────────────────────────────────────
   The page argues value hard (calculator) but barely argues trust.
   Handing your business number to an AI is a high bar, so these are the questions that
   actually stop people, answered before the demo CTA closes.

   Five, not seven, and collapsed rather than expanded. "Do I own it?" and "Do I have to
   give up my number?" moved out: both are post-sale contract detail that added friction
   before the sale, and both were already answered on /pricing ("Do I own my website?"
   §14, "Do I get to keep my phone number?" §11). Check there before adding either back. */
/* Answers are sourced from the Master Services Agreement so the marketing copy and the
   contract can't drift apart; section refs are noted per answer. Where the honest answer
   is more complicated than "yes", it's given in full. A buyer who finds the limit
   themselves at month six is a worse outcome than one who reads it here. */
const ANSWERS: { q: string; a: string }[] = [
  {
    q: "What if I already have a website?",
    a: "Doesn't matter where you're starting. We build you a new one and bring over the content worth keeping. You don't start from scratch, and you don't chase anyone for access to the old site.",
  },
  {
    q: "Will I show up on Google?",
    a: "We do the technical side properly: page speed, titles and descriptions, structured data, sitemaps. What we won't do is promise you a ranking. Nobody controls Google's results, and anyone who says otherwise is selling something.", // MSA §SEO
  },
  {
    q: "Do I have to write the content?",
    a: "No. You answer some questions about your business and we write it. Most people are done in one sitting. The writing is what stalls everyone for six months, so we took it off your plate.",
  },
  {
    q: "Will it sound like a robot?",
    a: "Call the number at the bottom of this page and decide for yourself. That's why it's there. We'd rather you hear it than take our word for it.",
  },
  {
    q: "What if it can't answer something?",
    a: "It takes their details, puts the lead in your portal, and texts you that it's there. It doesn't guess, and it doesn't make things up about your business.",
  },
];

function FaqItem({
  q,
  a,
  index,
  open,
  onToggle,
  reduceMotion,
}: {
  q: string;
  a: string;
  index: number;
  open: boolean;
  onToggle: () => void;
  reduceMotion: boolean;
}) {
  const questionId = `faq-question-${index}`;
  const panelId = `faq-panel-${index}`;

  /* No entrance animation of its own: the whole section arrives as one block via the
     <JourneyReveal> around <StraightAnswers>. Staggering the rows inside a container
     that is itself sliding up read as two separate movements fighting each other.
     AnimatePresence below still owns the open/close, which is a different gesture. */
  return (
    <div className="faq-item">
      <button
        type="button"
        className="faq-question"
        id={questionId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        {q}
        <motion.span
          className="faq-icon"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            id={panelId}
            role="region"
            aria-labelledby={questionId}
            className="faq-answer"
            style={{ overflow: "hidden" }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE }}
          >
            <div style={{ paddingBottom: 20 }}>
              <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--fg-2)", margin: 0, maxWidth: "52ch" }}>{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StraightAnswers() {
  const [openSet, setOpenSet] = useState<Set<number>>(() => new Set());
  const reduceMotion = !!useReducedMotion();

  const toggle = (i: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,56px)" }}>
      {/* Heading and rows arrive together, as one block. They used to enter separately —
          the heading on `.reveal`, each row on its own `whileInView` — which put three
          different easings on screen at once in a section whose whole job is to feel
          settled and matter-of-fact. */}
      <JourneyReveal>
        <h2 style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,52px)", letterSpacing: ".01em", textTransform: "uppercase", marginBottom: "clamp(28px,3vw,44px)" }}>
          Before you call.
        </h2>
        {/* Collapsed by default. Expanded, these seven entries ran ~370 words and ate a full
            screen of scroll to answer questions most visitors weren't asking yet. Full width,
            one column: at two columns a row of collapsed summaries reads as a word grid. */}
        <div className="faq-list">
          {ANSWERS.map((item, i) => (
            <FaqItem
              key={item.q}
              q={item.q}
              a={item.a}
              index={i}
              open={openSet.has(i)}
              onToggle={() => toggle(i)}
              reduceMotion={reduceMotion}
            />
          ))}
        </div>
      </JourneyReveal>
    </section>
  );
}

/* ── 04 · The price ─────────────────────────────────────────────
   All three plans, as three cards, but not at equal volume. Growth is the one almost
   everyone should buy, so it is the loudest and sits centre; Starter is a real option at
   full strength beside it; Enterprise is present and honestly priced but visually
   receded, because for the business this page is written for it is a distraction, not a
   choice. Hiding it outright would be worse — a plan you have to go and find reads as a
   plan someone is being cagey about.

   The two bolded lines are the tier line, and /pricing carries the same pair in its
   taglines. Change one, change both, or the two pages drift into describing different
   products — which is how the old "Starter tells you" pair ended up on one page and a
   reworded version on the other.

   Prices come from Schedule A, never typed in by hand — the same rule the pricing page
   follows. A number written into marketing copy is a number that can eventually
   contradict the signed agreement. */
function PricingSection({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(64px,7vw,120px) clamp(18px,4vw,56px)" }}>
      <JourneyReveal>
        {/* Was "Two tools, one monthly bill." — the old product's thesis in five words. */}
        <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-2)", marginBottom: "clamp(32px,3.5vw,52px)" }}>
          One system. One monthly bill.
        </p>

        <div className="home-pricing-grid">
          <div className="home-pricing-card">
            <div className="kicker">Starter</div>
            <div className="home-pricing-price">${STARTER_PRICE}<span>/mo</span></div>
            <p>A four-page site and a receptionist on your line. Every call and web enquiry lands in your portal, and you get a text when one does. <strong style={{ color: "var(--fg)" }}>Starter reports every lead.</strong></p>
          </div>

          {/* "Within about a minute", matching /pricing and the contract's "typically within
              sixty (60) seconds" — not "inside a minute", which promises the upper bound. */}
          <div className="home-pricing-card home-pricing-card--featured">
            <div className="kicker">Growth</div>
            <div className="home-pricing-price">${GROWTH_PRICE}<span>/mo</span></div>
            <p>Everything in Starter, then it goes to work. Web leads get a call back within about a minute, and your portal becomes a pipeline you run from Lead to Won. <strong style={{ color: "var(--fg)" }}>Growth works them like a team would.</strong></p>
          </div>

          {/* "Two or three", not "up to three": Enterprise starts at two sites. */}
          <div className="home-pricing-card home-pricing-card--muted">
            <div className="kicker">Enterprise</div>
            <div className="home-pricing-price">${ENTERPRISE_PRICE}<span>/mo</span></div>
            <p>Two or three sites, each with its own receptionist and phone number, all feeding one portal. One monthly bill. <a href="/pricing">See what&apos;s included &rarr;</a></p>
          </div>
        </div>

        {/* The rail, which used to be its own section below this one. Both blocks were
            making the same two asks back to back — the pricing column had Get Started +
            View plans, and the rail underneath had Get Started + the demo number. Merged,
            the cards state the price and the rail is the single ask that closes both the
            section and the page.

            Two halves, each with its own line of copy, divided by a rule. The two actions
            are not the same ask: one is "buy", the other is "check first". Sat side by
            side as bare buttons they read as a primary and its fallback, and the fallback
            is the more persuasive of the two for anyone still unsure — so each gets a
            sentence saying who it's for. */}
        <div className="rail-cta" id="cta">
          <div className="rail-cta-half">
            <p className="rail-cta-copy">
              <span className="rail-cta-lead">Get started.</span> Contact us now.
            </p>
            {/* `View plans + pricing` moved here from the column this block replaced. It
                still earns its place beside the cards above: those give three prices,
                /pricing gives what is actually in each plan. */}
            <div className="rail-cta-pair">
              <button type="button" onClick={onOpenForm} className="btn primary lg rail-cta-btn" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>
                Get Started
              </button>
              <a href="/pricing" className="btn ghost rail-cta-btn">View plans + pricing</a>
            </div>
          </div>

          <div className="rail-cta-rule" aria-hidden="true" />

          <div className="rail-cta-half">
            <p className="rail-cta-copy">
              <span className="rail-cta-lead">Need to hear it first?</span> Call the demo.
            </p>
            {/* Keeps the ring pulse. Dialling the demo is still the single best thing a
                sceptic can do, and this is the last place on the page to offer it. */}
            <a href={DEMO_TEL} className="btn amber anim-ringpulse-slow rail-cta-tel">
              &#9742; {DEMO_TEL_DISPLAY}
            </a>
          </div>
        </div>
      </JourneyReveal>
    </section>
  );
}

/* ── Page (final section order) ─────────────────────────────── */
export default function HomePageClient({ featuredSites = [] }: { featuredSites?: import("@/app/page").PublishedFeaturedSite[] }) {
  // Lives here rather than inside <Hero> so the panel renders above every section
  // instead of being clipped by the hero's own stacking context.
  const [formOpen, setFormOpen] = useState(false);
  const openForm = () => setFormOpen(true);

  /* Order is the argument. The hero makes the claim; the three journey sections each
     take one part of the system and spend a screen proving it — the website that makes
     the phone ring, the receptionist that picks up, the portal where the lead lands.
     Then the calculator prices the cost of not having it, then the work we've shipped,
     then the objections, then the price, then the ask.

     The calculator follows the portal rather than the receptionist because it is the one
     section about the reader's business instead of the system; it reads as the bill for
     the loop the three before it describe.

     FeaturedSites moved down out of the second slot: real client sites directly under
     the hero interrupted the product explanation to show proof of a thing not yet
     described. It reads as evidence here, after the argument and before the price. */
  return (
    <div style={{ width: "100%", background: "var(--bg)" }}>
      <Hero onOpenForm={openForm} />

      <WebsiteSection />
      <ReceptionistSection />
      <PortalSection />
      <MissedCallsCalculator onOpenForm={openForm} />

      <FeaturedSites sites={featuredSites} />

      {/* PricingSection closes the page: the cards state the price and the rail inside
          it makes the ask. `RailCTA` used to be a fourth section here, repeating the two
          buttons the pricing column had already shown. */}
      <StraightAnswers />
      <PricingSection onOpenForm={openForm} />

      {formOpen && <LeadPanel onClose={() => setFormOpen(false)} />}
    </div>
  );
}
