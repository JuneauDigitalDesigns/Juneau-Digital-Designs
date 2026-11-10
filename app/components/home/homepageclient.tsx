"use client";
/* Z-index constants: navbar 50 | grain 60 | modals 70 */

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Info, Browser, Phone, Tray, CaretDown } from "@phosphor-icons/react";
import SiteToCallPanel from "./SiteToCallPanel";
import DemoSiteFrame from "./DemoSiteFrame";
import FeaturedSites from "./FeaturedSites";
import LeadPanel from "./LeadPanel";
import PortalDemo from "./PortalDemo";
import ClosingAsk from "./ClosingAsk";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { MISSED_CALLS_ID } from "@/app/data/portal-demo";

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
   "And nothing slips."

   Since 9 Nov 2026 (approved by Xander from a ten-round mockup) nothing around words on this
   page has a border, a fill or a shadow: only the product is framed — the laptop, the phone
   film, the portal demo. Colour arrives as ground (`.wash`), lists are split by hairlines,
   and scale does the hierarchy. See "The homepage, without cards" in globals.css. Every
   section fills the same 1320px content width (`.home-section`). */

/* ── 01 · The website ─────────────────────────────────────────
   The heading and its line split across the width, then the laptop, taking the whole
   column, scrolling the growth template (`DemoSiteFrame`). Copy approved word for word,
   9 Nov 2026. The caption that sat under the laptop ("What yours could look like.") went in
   the same pass. */
function WebsiteSection() {
  return (
    <section>
      <div className="home-section">
        <JourneyReveal className="home-split">
          {/* Leads with the outcome and hands straight off to section 02, which answers it
              with "Then someone picks up." */}
          <h2 className="home-display">A website that makes the phone ring.</h2>
          <div>
            <p className="home-lede">
              You answer a few questions. We write it, build it and host it. After that, there&apos;s nothing for you to do.
            </p>
            {/* The promise: the writing, which is what stalls owners for months, and the one
                thing the line above doesn't already say. */}
            <p className="home-promise">Written for your trade</p>
          </div>
        </JourneyReveal>
        <JourneyReveal delay={1} className="home-stage">
          <DemoSiteFrame />
        </JourneyReveal>
      </div>
    </section>
  );
}

/* ── 02 · The receptionist ──────────────────────────────────────
   On the wash: the heading and one paragraph on the left, the film on the right (stacked,
   centred, on a phone). The paragraph is the three lines that used to be a numbered, ruled
   list, now run together as copy; the line above them ("You're with a customer, or it's two
   in the morning. Either way, it picks up.") was removed in the same pass. "24/7" still
   appears in the hero and under "Every plan starts here.", so the page keeps its
   any-hour claim. Deliberately industry-neutral: this page sells to any service business. */
function ReceptionistSection() {
  return (
    <section className="wash">
      <div className="home-section home-duo">
        <JourneyReveal>
          {/* The sequel to section 01's heading, and the middle of the sentence the three
              journey headings make. */}
          <h2 className="home-display">Then someone picks up.</h2>
          {/* The last sentence is where the lead goes: into the portal on every plan, with a
              text telling the owner it is there. */}
          <p className="home-lede">
            It asks the questions you&apos;d ask, in English or in Spanish. It captures the lead&apos;s name, number and what the job is. Then the lead goes straight into your portal, and you get a text saying it&apos;s there.
          </p>
        </JourneyReveal>
        {/* No CTA beside the film by design. The calculator and the closing section carry the
            asks. */}
        <JourneyReveal delay={1}>
          <SiteToCallPanel />
        </JourneyReveal>
      </div>
    </section>
  );
}

/* ── 03 · The portal ────────────────────────────────────────────
   Where the lead the film just delivered actually lives. Until this section existed the
   words portal, inbox and CRM appeared nowhere on the homepage, so the page sold a website
   and a receptionist whose output was a text message — the product before leads were
   recorded anywhere.

   It carries the only sentence on the page that separates the plans before the price
   cards, and it does it by what Growth adds rather than by what Starter lacks: Starter is
   the way in, the same system with the follow-up left to the owner.

   Since 9 Nov 2026 (Xander's layout, approved word for word) the demo is the section:
   heading, a quiet cue pointing down at the window, the window, its five-step rail, then
   that one line. The paragraph and the three outcomes that used to sit above the demo went;
   the demo shows all three. The carrier-gated features still say what they wait on: the
   Message and Review steps carry CARRIER_LINE in their tour cards. */
function PortalSection() {
  return (
    <section className="journey-section portal-section">
      <JourneyReveal delay={0}>
        {/* Ends the sentence the journey headings make, without a second "Then". */}
        <h2 className="portal-heading">And nothing slips.</h2>
        {/* Not a button: the play button on the window is the one start, and a second one
            here said the same thing twice. The chevrons point at it. */}
        <p className="portal-cue">
          See how the whole system works
          <span className="portal-cue-arrows" aria-hidden="true">
            <CaretDown size={18} weight="bold" />
            <CaretDown size={18} weight="bold" />
            <CaretDown size={18} weight="bold" />
          </span>
        </p>
      </JourneyReveal>
      <JourneyReveal delay={1} className="journey-visual portal-visual">
        <PortalDemo />
        <p className="portal-plans-line">
          Every plan gets the inbox.{" "}
          <strong style={{ color: "var(--fg)" }}>
            Growth adds the pipeline, the texting and the reviews: the part a team would do.
          </strong>
        </p>
      </JourneyReveal>
    </section>
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
    /* `id` is where the portal demo's closing button lands ("What are my missed calls
       worth?"). Lenis glides same-page anchors (see SmoothScroll). */
    <section className="calc-section calc-open wash" id={MISSED_CALLS_ID}>
      {/* On the wash, with no card or panel (9 Nov 2026): the inputs are rows split by
          hairlines and the answer is a pair of numerals set as type. See `.calc-open`. */}
      <div className="home-section">
        {/* No kicker here, unlike the two sections above it. Those name a thing we sell;
            this one is about the reader's own business, and labelling it "The Numbers"
            would file it alongside the products as a third thing to buy. */}
        {/* A question, not an instruction: it puts the reader inside their own numbers
            before they touch a slider. */}
        <JourneyReveal>
          <h2 className="home-display calc-heading">
            How much are your <span>missed calls</span> worth?
          </h2>
          <div className="calc-body">
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
                    closing section; a third solid primary button on one page turns all
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

/* ── Every plan starts here, the plans, the ask ─────────────────
   One closing section, on the wash. "Every plan starts here." and the three parts every plan
   gets on the left; the three plans on the right in one cream panel, rows split by hairlines;
   the asks underneath, open, across the full width. Approved 9 Nov 2026: round five's layout
   with the boxes taken off everything but the plans, which share a single panel instead of
   three cards.

   Growth is the plan this page is written to sell, so it carries the coral edge; Starter is
   a real option at full strength; Enterprise is present and honestly priced but receded.
   Hiding it would be worse: a plan you have to go and find reads as a plan someone is being
   cagey about.

   The two bolded lines are the tier line, and /pricing carries the same pair in its
   taglines. Change one, change both.

   Prices come from Schedule A, never typed in by hand — the same rule the pricing page
   follows. A number written into marketing copy is a number that can eventually
   contradict the signed agreement. Layout is `.closing*` in globals.css. */
const EVERY_PLAN: { Icon: typeof Browser; label: string; title: string; detail: string }[] = [
  {
    Icon: Browser,
    label: "Your website",
    title: "A custom four-page site",
    detail: "Home, Services, About and Contact. Hosting, SSL and maintenance included, plus 2 content edits a month.",
  },
  {
    Icon: Phone,
    label: "Your phone",
    title: "It rings you first",
    detail: "If you don’t pick up, the AI receptionist answers, 24/7, in English or Spanish. You get a summary of every call.",
  },
  {
    Icon: Tray,
    label: "Your leads",
    title: "One inbox for every lead",
    detail: "Every call and web enquiry lands in your portal, and you get a text the moment a new one arrives.",
  },
];

function ClosingSection({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section className="wash">
      <div className="home-section">
        <JourneyReveal>
          <div className="closing">
            <div>
              <h2 className="home-display closing-heading">Every plan starts here.</h2>
              <div className="closing-base">
                {EVERY_PLAN.map(({ Icon, label, title, detail }) => (
                  <div key={label} className="closing-base-item">
                    <p className="closing-base-label">
                      <Icon size={18} aria-hidden="true" />
                      {label}
                    </p>
                    <h3 className="closing-base-title">{title}</h3>
                    <p className="closing-base-detail">{detail}</p>
                  </div>
                ))}
              </div>
              {/* Was "Two tools, one monthly bill." — the old product's thesis in five words. */}
              <p className="closing-bill">One system. One monthly bill.</p>
            </div>

            <div className="closing-plans">
              <div className="closing-plan">
                <div className="kicker">Starter</div>
                <p className="closing-price">${STARTER_PRICE}<span>/mo</span></p>
                {/* "Everything every plan gets", not "Everything you see above": on a desktop
                    the base sits beside the plans, not above them. */}
                <p>Everything every plan gets. This is where it starts. <strong style={{ color: "var(--fg)" }}>Starter reports every lead.</strong></p>
              </div>

              {/* "Within about a minute", matching /pricing and the contract's "typically
                  within sixty (60) seconds" — not "inside a minute", which promises the upper
                  bound. */}
              <div className="closing-plan closing-plan--featured">
                <div className="kicker">Growth</div>
                <p className="closing-price">${GROWTH_PRICE}<span>/mo</span></p>
                <p>Everything in Starter, then it goes to work. Web leads get a call back within about a minute, and your portal becomes a pipeline you run from Lead to Won. <strong style={{ color: "var(--fg)" }}>Growth works them like a team would.</strong></p>
              </div>

              {/* "Two or three", not "up to three": Enterprise starts at two sites. */}
              <div className="closing-plan closing-plan--muted">
                <div className="kicker">Enterprise</div>
                <p className="closing-price">${ENTERPRISE_PRICE.toLocaleString("en-US")}<span>/mo</span></p>
                <p>Two or three sites, each with its own receptionist and phone number, all feeding one portal. One monthly bill. <a href="/pricing">See what&apos;s included &rarr;</a></p>
              </div>
            </div>
          </div>

          <ClosingAsk onOpenForm={onOpenForm} />
        </JourneyReveal>
      </div>
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
     then one closing section: what every plan gets, the price, and the ask. The
     objections live on /faq.

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

      {/* Closes the page: what every plan gets, the plans, then the ask, as one section.
          "Before you call." moved to /faq on 9 Nov 2026. */}
      <ClosingSection onOpenForm={openForm} />

      {formOpen && <LeadPanel onClose={() => setFormOpen(false)} />}
    </div>
  );
}
