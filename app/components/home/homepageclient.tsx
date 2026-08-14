"use client";
/* Z-index constants: navbar 50 | grain 60 | modals 70 */

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion";
import { Info } from "@phosphor-icons/react";
import SiteToCallPanel from "./SiteToCallPanel";
import DemoSiteFrame from "./DemoSiteFrame";
import FeaturedSites from "./FeaturedSites";
import LeadPanel from "./LeadPanel";
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
   The scroll journey's own entrance, deliberately louder than <Reveal>: further travel,
   a slight scale, and roughly a third longer. These are the marquee sections, and at
   `translateY(20px)` they read as page furniture settling rather than content arriving.
   `delay` is in stagger steps, not seconds — copy is step 0, the visual beside it step 1,
   so the reader is told what they're looking at just before it lands. */
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
      initial={reduceMotion ? false : { opacity: 0, y: 56, scale: 0.97 }}
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

/* ── The pinned stage ───────────────────────────────────────────
   From the Website section on, the page stops travelling. The three journey sections
   become three panels stacked in one frame that is pinned to the viewport, and scrolling
   swaps which one is on top instead of moving the page past them. Each arrives by fading
   and rising ~48px in place; the one it replaces is not animated at all, it is simply
   covered by an opaque panel above it.

   The scroll budget comes from the VIEWPORT, never from content. Panels are absolutely
   positioned inside a fixed-height stage, so nothing inside one — including the
   calculator, which changes size as it is used — can affect the track height or the pace.

   Below 1024px, or with reduced motion, `display: contents` erases the stage and panel
   boxes in CSS and the three sections fall back into ordinary document flow with their
   existing <JourneyReveal> entrances. One set of markup, no second implementation. */
const JOURNEY_PANELS = 3;
/* Stage-heights of dwell after the last panel settles. Without it the calculator would
   become active at the exact instant the stage starts unpinning. */
const JOURNEY_TAIL = 1;
const JOURNEY_DENOM = JOURNEY_PANELS - 1 + JOURNEY_TAIL;
/* Entrance occupies the last 45% of a stage-height before the settle point, so the
   animation *finishes* on the snap marker rather than running through it. */
const ENTER_SPAN = 0.45;
const PANEL_RISE = 48;
/* navbar is `h-16` + a 1px rule, and it is sticky — the stage has to pin below it. */
const NAV_H = 65;

/* Server snapshot is `false`, so SSR and the first client render agree and the pinned
   branch can never cause a hydration mismatch. */
function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

function JourneyPanel({
  index,
  progress,
  pinned,
  active,
  children,
}: {
  index: number;
  progress: MotionValue<number>;
  pinned: boolean;
  active: number;
  children: React.ReactNode;
}) {
  /* Panel 0's range starts negative, so it clamps to 1 across the whole track and needs
     no special case. The outgoing panel is never touched — being covered is its exit. */
  const start = (index - ENTER_SPAN) / JOURNEY_DENOM;
  const end = index / JOURNEY_DENOM;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const y = useTransform(progress, [start, end], [PANEL_RISE, 0]);

  return (
    <motion.div
      className="journey-panel no-scrollbar"
      /* A panel at opacity 0 still hit-tests, so without this the calculator would
         swallow clicks meant for the receptionist underneath it. Also keeps covered
         panels out of the tab order. */
      inert={pinned && index !== active}
      style={pinned ? { opacity, y } : undefined}
    >
      {children}
    </motion.div>
  );
}

function ScrollJourney({ panels }: { panels: React.ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduceMotion = !!useReducedMotion();
  const pinned = useMediaQuery("(min-width: 1024px)") && !reduceMotion;

  /* "start 65px" is the exact moment the stage pins under the navbar and "end end" the
     moment it releases, so the progress range needs no measurement. framer-motion 12
     resolves px edges in scroll offsets. Called unconditionally: gating it on `pinned`
     would mount the driver in an effect, and for one frame every panel would sit at
     opacity 1 with the calculator painting on top of the website. */
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: [`start ${NAV_H}px`, "end end"],
  });

  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    let next = 0;
    for (let i = 1; i < JOURNEY_PANELS; i++) {
      // hand over at the halfway point of the incoming panel's fade
      if (v >= (i - ENTER_SPAN / 2) / JOURNEY_DENOM) next = i;
    }
    setActive(next);
  });

  return (
    <div
      ref={trackRef}
      className="journey-track"
      style={{ "--journey-panels": JOURNEY_PANELS, "--journey-tail": JOURNEY_TAIL } as React.CSSProperties}
    >
      {/* Zero-size snap markers at each panel's settled scroll offset. These are the only
          snap areas on the page, which is what lets `scroll-snap-type: proximity` sit on
          the root without affecting the hero, FeaturedSites, the FAQ or the footer. */}
      {panels.map((_, i) => (
        <span key={`snap-${i}`} className="journey-snap" aria-hidden="true" style={{ "--i": i } as React.CSSProperties} />
      ))}

      <div className="journey-stage">
        {panels.map((panel, i) => (
          <JourneyPanel key={i} index={i} progress={scrollYProgress} pinned={pinned} active={active}>
            {panel}
          </JourneyPanel>
        ))}
      </div>
    </div>
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
      {/* Freed from the two-column grid the headline gets the whole measure, so the cap
          goes 84 → 120px (reached at ~923px wide). The 46px floor and 13vw rate are
          deliberately unchanged: at a 52px floor "Do Business." measures 282px inside a
          284px box on a 320px screen, and the first font fallback that renders a hair
          wide clips it. The extra room on desktop was the point; the phone was already
          tuned. */}
      <h1 style={{ fontWeight: 900, fontSize: "clamp(46px,13vw,120px)", lineHeight: 0.9, letterSpacing: ".005em", textTransform: "uppercase" }}>
        Get found.<br />Get called.<br /><span style={{ color: "var(--accent-2)" }}>Do Business.</span>
      </h1>
      <p style={{ fontSize: "clamp(17px,1.6vw,21px)", lineHeight: 1.55, color: "var(--fg-2)", margin: "28px auto 32px", maxWidth: "46ch" }}>
        A website that gets you called, and a 24/7 receptionist that answers when you can&apos;t.
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
   Three sections that each take one of the hero's claims and spend a screen on it:
   the website, the receptionist, then the arithmetic. Copy and visual alternate sides
   at ≥900px and always stack copy-first below it — see `.journey-grid` in globals.css,
   which flips the columns with `order` rather than DOM position so the mobile reading
   order survives the flip. */

function JourneySection({
  kicker,
  heading,
  body,
  bullets,
  visual,
  visualFirst = false,
}: {
  kicker: string;
  heading: string;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  visualFirst?: boolean;
}) {
  /* Padding lives in `.journey-section`, not inline, so the pinned stage can compress it
     — a stylesheet can't beat an inline style without `!important`. 100px a side is right
     in a scrolling column and wrong in an 800px frame. */
  return (
    <section className="journey-section">
      <div className={`journey-grid${visualFirst ? " journey-grid--flip" : ""}`}>
        {/* Copy is always first in DOM: it is what should be read first when the grid
            collapses to one column, and it is step 0 of the stagger either way. */}
        <JourneyReveal delay={0}>
          <div className="kicker" style={{ marginBottom: 14 }}>{kicker}</div>
          <h2 style={{ fontWeight: 800, fontSize: "clamp(30px,4.2vw,54px)", lineHeight: 0.98, letterSpacing: ".01em", textTransform: "uppercase", maxWidth: "16ch" }}>
            {heading}
          </h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--fg-2)", maxWidth: "48ch", marginTop: 18 }}>
            {body}
          </p>
          <div className="journey-bullets">
            {bullets.map((b) => (
              <span key={b}>&rarr; {b}</span>
            ))}
          </div>
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
      kicker="The Website"
      heading="Built once. Runs forever."
      body="Fast, findable on Google, and made to look like the real you. We build it, host it, back it up and keep it current. Your only job is to keep doing the job."
      bullets={[
        "Your website goes live in ~1 week",
        "Hosting + updates included",
        "Click-to-call everywhere",
      ]}
      visualFirst
      visual={
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DemoSiteFrame />
          {/* Says "could look like" rather than claiming it's live — it's a captured
              screenshot, and the old "running live" line stopped being true the moment
              the iframe became an image. */}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--fg-3)", lineHeight: 1.5 }}>
            What your website could look like. Built on the same architecture as JuneauDigitalDesigns.com
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
function ReceptionistSection({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <JourneySection
      kicker="The Receptionist"
      heading="Picks up in two rings. Books the job. Texts you."
      body="When you can't pick up, it does. Answers questions, books the job, and texts you the details before the caller hangs up. 3am, Sunday, holidays. Always on."
      bullets={[
        "Up and running 24/7, every single day",
        "Qualifies your customers",
        "Texts you a summary every time a customer calls",
        "English & Spanish AI agents available",
      ]}
      visual={<SiteToCallPanel onOpenForm={onOpenForm} />}
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

  const missedPct = ((missedPerWeek - MISSED_MIN) / (MISSED_MAX - MISSED_MIN)) * 100;
  const jobPct = jobSliderPos;
  const recoveryPct = ((currentRecovery - RECOVERY_MIN) / (RECOVERY_MAX - RECOVERY_MIN)) * 100;
  const revenueFormatted = formatDollars(revenueOnTable);
  /* Shared by row 02's inline value and its aria-valuetext, so the announced
     figure can never drift from the visible one. */
  const avgJobValueFormatted =
    avgJobValue >= 1000
      ? `$${(avgJobValue / 1000).toFixed(avgJobValue >= 100000 ? 0 : 1)}K`
      : `$${avgJobValue.toLocaleString()}`;

  return (
    <section className="calc-section">
      <div className="aurora-grid" />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
        {/* No kicker here, unlike the two sections above it. Those name a thing we sell;
            this one is about the reader's own business, and labelling it "The Numbers"
            would file it alongside the products as a third thing to buy. */}
        <JourneyReveal style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ marginTop: 16, marginBottom: 12, textTransform: "uppercase" }}>
            Run the numbers. <span style={{ color: "var(--accent-2)" }}>See what you&apos;re leaving.</span>
          </h2>
          <p style={{ color: "var(--fg-2)", fontSize: 16, maxWidth: "50ch", margin: "0 auto", lineHeight: 1.6 }}>
            Move the sliders to match your business. Then hit calculate.
          </p>
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
              <div className="calc-row">
                <span className="calc-row-index" aria-hidden="true">01</span>
                <p className="calc-row-copy">
                  I miss <span className="calc-row-value">{missedPerWeek}</span> calls a week
                </p>
                {/* wrapper carries the radio-dial tick scale above the track */}
                <div className="calc-fader">
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
                </div>
              </div>

              <div className="calc-row">
                <span className="calc-row-index" aria-hidden="true">02</span>
                <p className="calc-row-copy">
                  My average job is worth <span className="calc-row-value">{avgJobValueFormatted}</span>
                </p>
                <div className="calc-fader">
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
                </div>
              </div>

              <div className="calc-row">
                <span className="calc-row-index" aria-hidden="true">03</span>
                <p className="calc-row-copy">
                  Right now I win back{" "}
                  <span
                    className="calc-row-value"
                    style={{ textShadow: currentRecovery >= 90 ? "0 0 40px var(--accent-glow)" : "none" }}
                  >
                    {currentRecovery}%
                  </span>{" "}
                  of those leads
                </p>
                <div className="calc-fader">
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
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => goTo("results")}
                  className="btn primary lg"
                  style={{ width: "100%", boxShadow: "0 0 32px var(--accent-glow)" }}
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
                <div>
                  <div className="kicker">Revenue Left on the Table</div>
                  <div className="calc-figure">{revenueFormatted}</div>
                  <div className="kicker">per year</div>
                </div>
                <div>
                  <div className="kicker">Recoverable via AI Receptionist</div>
                  <div className="calc-figure calc-figure--accent">{formatDollars(recoverableRevenue)}</div>
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
                  <>{revenueFormatted}{" "}a year, if those callers did what most callers do: hang up without leaving a message and try someone else.</>
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
    a: "It takes their details and texts you. It doesn't guess, and it doesn't make things up about your business.",
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

/* ── 03 · The price ─────────────────────────────────────────────
   All three plans, as three cards, but not at equal volume. Growth is the one almost
   everyone should buy, so it is the loudest and sits centre; Starter is a real option at
   full strength beside it; Enterprise is present and honestly priced but visually
   receded, because for the business this page is written for it is a distraction, not a
   choice. Hiding it outright would be worse — a plan you have to go and find reads as a
   plan someone is being cagey about.

   Prices come from Schedule A, never typed in by hand — the same rule the pricing page
   follows. A number written into marketing copy is a number that can eventually
   contradict the signed agreement. */
function PricingSection({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(64px,7vw,120px) clamp(18px,4vw,56px)" }}>
      <JourneyReveal>
        <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-2)", marginBottom: "clamp(32px,3.5vw,52px)" }}>
          Two tools, one monthly bill.
        </p>

        <div className="home-pricing-grid">
          <div className="home-pricing-card">
            <div className="kicker">Starter</div>
            <div className="home-pricing-price">${STARTER_PRICE}<span>/mo</span></div>
            <p>Website only. Live in about a week, built to get you found and called.</p>
          </div>

          <div className="home-pricing-card home-pricing-card--featured">
            <div className="kicker">Growth</div>
            <div className="home-pricing-price">${GROWTH_PRICE}<span>/mo</span></div>
            <p>Website and the 24/7 receptionist. The whole system, month to month.</p>
          </div>

          <div className="home-pricing-card home-pricing-card--muted">
            <div className="kicker">Enterprise</div>
            <div className="home-pricing-price">${ENTERPRISE_PRICE}<span>/mo</span></div>
            <p>
              Up to three sites, more call minutes.{" "}
              <a href="/pricing">See what&apos;s included &rarr;</a>
            </p>
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
     take one third of it and spend a screen proving it — what you get, what answers the
     phone, what it costs you to keep missing calls. Then the work we've shipped, then
     the objections, then the price, then the ask.

     FeaturedSites moved down out of the second slot: real client sites directly under
     the hero interrupted the product explanation to show proof of a thing not yet
     described. It reads as evidence here, after the argument and before the price. */
  return (
    <div style={{ width: "100%", background: "var(--bg)" }}>
      <Hero onOpenForm={openForm} />

      <ScrollJourney
        panels={[
          <WebsiteSection key="website" />,
          <ReceptionistSection key="receptionist" onOpenForm={openForm} />,
          <MissedCallsCalculator key="calculator" onOpenForm={openForm} />,
        ]}
      />

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
