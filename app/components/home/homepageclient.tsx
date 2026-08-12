"use client";
/* Z-index constants: navbar 50 | grain 60 | modals 70 */

import { useState, useEffect, useRef } from "react";
import { Info } from "@phosphor-icons/react";
import SiteToCallPanel from "./SiteToCallPanel";
import DemoSiteFrame from "./DemoSiteFrame";
import FeaturedSites from "./FeaturedSites";
import LeadPanel from "./LeadPanel";

const DEMO_TEL = "tel:+19302221343";
const DEMO_TEL_DISPLAY = "(930) 222-1343";

/* ── Scroll reveal ──────────────────────────────────────────── */
function useReveal(options: IntersectionObserverInit = {}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.unobserve(el);
          }
        }),
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px", ...options }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({
  children,
  delay = 0,
  className = "",
  style,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
}) {
  const ref = useReveal();
  return (
    <Tag ref={ref} className={`reveal ${className}`} data-delay={delay || undefined} style={style}>
      {children}
    </Tag>
  );
}

/* ── Hero ───────────────────────────────────────────────────── */
function Hero({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section
      className="hero-grid"
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "clamp(64px,7vw,124px) clamp(18px,4vw,56px) clamp(64px,6vw,104px)",
      }}
    >
      {/* copy (first in DOM → appears above panel on mobile) */}
      <div>
        <h1 style={{ fontWeight: 900, fontSize: "clamp(40px,10vw,84px)", lineHeight: 0.95, letterSpacing: ".005em", textTransform: "uppercase" }}>
          Get found.<br />Get called.<br /><span style={{ color: "var(--accent-2)" }}>Get booked.</span>
        </h1>
        <p style={{ fontSize: "clamp(17px,1.6vw,21px)", lineHeight: 1.55, color: "var(--fg-2)", margin: "28px 0 32px" }}>
          Two things, one bill: a website built to turn visitors into phone calls, and a 24/7 receptionist that answers them when you can&apos;t. Your whole front door, handled.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="hero-cta">
            {/* The ring-pulse animation stays with the phone CTA in <DialCTA> at the
                bottom of the page — on a button that opens a form it would be promising
                a call that isn't coming. */}
            <button type="button" onClick={onOpenForm} className="btn primary lg hero-cta-btn" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>Get Started</button>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--fg-3)" }}>Five quick questions. About 30 seconds.</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DemoSiteFrame />
        {/* Says "could look like" rather than claiming it's live — it's a captured
            screenshot, and the old "running live" line stopped being true the moment
            the iframe became an image. */}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", color: "var(--fg-3)", lineHeight: 1.5 }}>
          What your website could look like. Built on the same architecture as JuneauDigitalDesigns.com
        </span>
      </div>
    </section>
  );
}

/* ── Missed Calls Revenue Calculator (kept; restyled to tokens) ── */
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

  /* The figures stay hidden until the user asks for them. Gating turns the card
     from a toy that reacts to every drag into a transaction with one answer —
     which is what earns the held pause before the CTA speaks. After the first
     calculation the sliders go live and the gate button retires. */
  const [calculated, setCalculated] = useState(false);
  const [open, setOpen] = useState(false); // drops overflow clipping once the grow lands
  const [growTo, setGrowTo] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function handleCalculate() {
    if (calculated) return;
    // Below 1024px the card grows downward. Animating to the measured height
    // rather than the CSS cap keeps the easing honest — against a generous cap
    // the growth finishes in ~90ms and then sits still for the rest of the beat.
    const stacked = window.innerWidth < 1024;
    if (stacked && resultsRef.current) setGrowTo(resultsRef.current.scrollHeight);
    setCalculated(true);
    if (stacked) {
      timers.current.push(
        window.setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120)
      );
    }
    timers.current.push(window.setTimeout(() => setOpen(true), 700));
  }

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
    <section style={{ position: "relative", padding: "clamp(56px,7vw,120px) 0", overflow: "hidden" }}>
      <div className="aurora-grid" />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ marginTop: 16, marginBottom: 12, textTransform: "uppercase" }}>
            How much are missed calls <span style={{ color: "var(--accent-2)" }}>costing you?</span>
          </h2>
          <p style={{ color: "var(--fg-2)", fontSize: 16, maxWidth: "50ch", margin: "0 auto", lineHeight: 1.6 }}>
            Move the sliders to match your business. Then hit calculate.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <div ref={cardRef} className={`calc-layout${calculated ? " is-calculated" : ""}${open ? " is-open" : ""}`}>
            {/* LEFT: sliders */}
            <div className="calc-inputs" style={{ display: "flex", flexDirection: "column", gap: 30 }}>
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

              <div className="calc-gate">
                <button
                  type="button"
                  onClick={handleCalculate}
                  className="btn primary lg"
                  style={{ width: "100%", boxShadow: "0 0 32px var(--accent-glow)" }}
                  aria-expanded={calculated}
                >
                  Calculate
                </button>
              </div>
            </div>

            {/* RIGHT: results — hidden until Calculate, then the card grows to fit them */}
            <div
              className="calc-results"
              ref={resultsRef}
              inert={!calculated}
              /* dropped once `open` lands so the CSS `max-height: none` takes over
                 and the accordion can expand past the measured height */
              style={growTo !== null && !open ? { maxHeight: growTo } : undefined}
            >
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }} aria-live="polite">
                <div className="calc-reveal" style={{ transitionDelay: "480ms" }}>
                  <div className="kicker" style={{ marginBottom: 12 }}>Revenue Left on the Table</div>
                  {/* tokenized — was a hardcoded white→transparent gradient (invisible in light) */}
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", fontWeight: 900, lineHeight: 1, letterSpacing: "var(--tracking-tightest)", color: "var(--fg)" }}>
                    {revenueFormatted}
                  </div>
                  <div className="kicker" style={{ marginTop: 8 }}>per year</div>
                </div>

                <div className="calc-reveal" style={{ transitionDelay: "560ms", width: "100%", height: 1, background: "var(--rule)" }} />

                <div className="calc-reveal" style={{ transitionDelay: "620ms" }}>
                  <div className="kicker" style={{ marginBottom: 12 }}>Recoverable via AI Receptionist</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", fontWeight: 900, lineHeight: 1, letterSpacing: "var(--tracking-tightest)", color: "var(--accent-2)", textShadow: "0 0 40px var(--accent-glow)" }}>
                    {formatDollars(recoverableRevenue)}
                  </div>
                  <div className="kicker" style={{ marginTop: 8 }}>per year</div>
                </div>

                {/* The held ~800ms gap after the figures settle is the whole effect:
                    it reads as someone looking at your number, then remarking on it. */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>
                  <p
                    className="calc-reveal"
                    style={{ transitionDelay: "1840ms", fontWeight: 700, fontSize: "clamp(19px,1.8vw,24px)", lineHeight: 1.3, color: "var(--fg)", margin: 0 }}
                  >
                    {/* At 100% recovery the figure is exactly $0, and "those callers
                        called the next guy" becomes a confident falsehood. */}
                    {revenueOnTable < 1 ? (
                      <>Nothing on the table at 100%. Almost nobody is at 100%.</>
                    ) : (
                      <>{revenueFormatted}{" "}a year &mdash; if those callers did what most callers do: hang up without leaving a message and try someone else.</>
                    )}
                  </p>
                  {/* wrapper, not the button itself — .calc-reveal's transform/transition
                      would otherwise override .btn.primary:hover's lift */}
                  <div className="calc-reveal" style={{ transitionDelay: "2260ms" }}>
                    <button
                      type="button"
                      onClick={onOpenForm}
                      className="btn primary lg"
                      style={{ boxShadow: "0 0 32px var(--accent-glow)" }}
                    >
                      Get Started
                    </button>
                  </div>
                </div>

              <details className="calc-accordion calc-reveal" style={{ transitionDelay: "760ms" }}>
                <summary>
                  <Info size={16} weight="duotone" style={{ color: "var(--accent-2)", flexShrink: 0 }} />
                  How we calculate this
                </summary>
                <div className="calc-accordion-content">
                  <p style={{ marginBottom: 12, color: "var(--fg-2)", fontSize: 13, lineHeight: 1.6 }}>
                    Based on your inputs, published research where it exists, and one assumption of our own — all four steps shown below. Results vary by market and business.
                  </p>
                  <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      <strong style={{ color: "var(--fg)" }}>{missedPerWeek} calls/week × 52</strong> = {Math.round(annualMissed).toLocaleString()} missed/year
                    </li>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      × <strong style={{ color: "var(--fg)" }}>37% are new-business leads</strong> (Invoca, 2025) = {Math.round(annualLeadCalls).toLocaleString()} lead calls
                    </li>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      × <strong style={{ color: "var(--fg)" }}>{Math.round((1 - currentRecovery / 100) * 100)}% unrecovered</strong> = {Math.round(unrecoveredLeads).toLocaleString()} lost leads
                    </li>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      × <strong style={{ color: "var(--fg)" }}>46% of leads convert on the call</strong> (Invoca, 2025) × avg job value = {formatDollars(revenueOnTable)}
                    </li>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      × <strong style={{ color: "var(--fg)" }}>50% recovered</strong> — our own estimate, deliberately conservative = {formatDollars(recoverableRevenue)}
                    </li>
                  </ol>
                </div>
              </details>

                <p className="calc-reveal" style={{ transitionDelay: "840ms", fontSize: 11, color: "var(--fg-3)", lineHeight: 1.5, margin: 0 }}>
                  Illustrative estimates only. Actual results vary by market, business model, and execution.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Two Operators, One Line ────────────────────────────────── */
function TwoOperators() {
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,56px)" }}>
      <Reveal>
        <h2 className="two-op-heading" style={{ fontWeight: 800, fontSize: "clamp(34px,5vw,64px)", letterSpacing: ".01em", textTransform: "uppercase", marginBottom: "clamp(28px,3vw,44px)" }}>
          You get two things. Both work while you don&apos;t.
        </h2>
      </Reveal>
      {/* Asymmetric on purpose: the website is the product being bought, so it gets the
          bigger half. Hierarchy comes from size — the receptionist keeps `surface-invert`
          because inverting the website card too would flatten both back to equal weight. */}
      <div className="two-op-grid">
        {/* Operator 01 — Website. Carries the three beats of the H1. */}
        <Reveal as="article" style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: "clamp(28px,3.4vw,46px)", display: "flex", flexDirection: "column", gap: 20, background: "var(--panel)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--accent)" }}>OPERATOR 01 // THE WEBSITE</div>
          <h3 style={{ fontWeight: 700, fontSize: "clamp(28px,3.6vw,46px)", lineHeight: 0.98, textTransform: "uppercase" }}>Built to turn visitors into calls.</h3>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "var(--fg-2)", maxWidth: "52ch" }}>
            Most small business sites are a business card that happens to be online. Yours is built to do a job: get in front of people searching for your trade, and make calling you the easiest thing on the page.
          </p>

          <div className="two-op-beats">
            <div>
              <div className="two-op-beat-label">Get found</div>
              <p className="two-op-beat-copy">Fast, structured for search, and pointed at the people already looking for what you do.</p>
            </div>
            <div>
              <div className="two-op-beat-label">Get called</div>
              <p className="two-op-beat-copy">Click-to-call on every screen. Nobody has to hunt for your number or fill out a form to reach you.</p>
            </div>
            <div>
              <div className="two-op-beat-label">Get booked</div>
              <p className="two-op-beat-copy">Built to look like the outfit you actually are, so the call you get is one that trusts you already.</p>
            </div>
          </div>

          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 8 }}>
            <span>&rarr; Live in about a week</span>
            <span>&rarr; Hosting, backups + updates included</span>
            <span>&rarr; We write the copy — you answer questions</span>
          </div>
        </Reveal>

        {/* Operator 02 — Receptionist. Teases the film below rather than arguing in full. */}
        <Reveal as="article" delay={1} className="surface-invert" style={{ border: "1px solid", borderRadius: 8, padding: "clamp(26px,3vw,38px)", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--invert-accent)" }}>OPERATOR 02 // THE RECEPTIONIST</div>
          <h3 style={{ fontWeight: 700, fontSize: "clamp(24px,2.6vw,34px)", lineHeight: 0.98, textTransform: "uppercase", color: "var(--invert-fg)" }}>Then something has to answer it.</h3>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--invert-fg-2)" }}>A site that makes the phone ring is only half the job. When you can&apos;t pick up, this does — answers their questions, finds out what they need, and texts you the whole thing before they hang up.</p>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--invert-fg-2)", display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
            <span>&rarr; Answers 24/7 — nights, weekends, holidays</span>
            <span>&rarr; Qualifies the caller before it reaches you</span>
            <span>&rarr; Texts you a full summary of every call</span>
            <span>&rarr; English &amp; Spanish AI agents available</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── The handoff ────────────────────────────────────────────────
   Leads with the stakes, not the mechanism. The film underneath starts on the
   website, so this section argues for both halves at once — it shows the handoff
   instead of claiming it. */
function TheHandoff({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,56px)" }}>
      {/* Centred, full width — constrain the paragraph rather than the whole block,
          the same way the calculator's header does it. Capping the wrapper instead
          pins the heading into a narrow left-hand column. */}
      <Reveal style={{ textAlign: "center", marginBottom: "clamp(28px,3vw,44px)" }}>
        <div className="kicker" style={{ marginBottom: 16 }}>The handoff</div>
        <h2 style={{ fontWeight: 800, fontSize: "clamp(32px,4.6vw,60px)", lineHeight: 0.98, letterSpacing: ".01em", textTransform: "uppercase", maxWidth: "18ch", margin: "0 auto" }}>
          Your hands are full. The phone rings anyway.
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--fg-2)", margin: "20px auto 0", maxWidth: "44ch" }}>
          Here&apos;s the same two minutes from both ends — theirs, then yours.
        </p>
      </Reveal>

      <Reveal delay={1}>
        <SiteToCallPanel onOpenForm={onOpenForm} />
      </Reveal>
    </section>
  );
}

/* ── Before you call ────────────────────────────────────────────
   The page argues value hard (calculator) but barely argues trust.
   Handing your business number to an AI is a high bar — these are the four
   questions that actually stop people, answered before the demo CTA closes. */
/* Answers are sourced from the Master Services Agreement so the marketing copy and the
   contract can't drift apart — section refs noted per answer. Two of these used to
   overstate the MSA and were corrected; where the honest answer is more complicated than
   "yes", it's given in full. A buyer who finds the limit themselves at month six is a
   worse outcome than one who reads it here. */
const ANSWERS: { q: string; a: string }[] = [
  {
    q: "What if I already have a website?",
    a: "Doesn't matter where you're starting. Nothing at all, a builder site you set up years ago, something an agency made, or one a friend put together that nobody can update now — we build you a new one and bring over the content worth keeping. You don't start from scratch and you don't chase anyone for access.",
  },
  {
    q: "Do I own it?",
    a: "Your content is yours — your name, logo, photos, and copy, always. The site itself runs on our platform while you're with us. If you leave, ask within 30 days and we hand over a full static export of the site, your content as a file, and your call log. You'd need new hosting, but you walk away with your site, not a screenshot of it.", // MSA §14
  },
  {
    q: "Will I show up on Google?",
    a: "We do the technical side properly — page speed, titles and descriptions, structured data, sitemaps, the things that decide whether Google can read your site at all. What we won't do is promise you a ranking. Nobody controls Google's results, and anyone who tells you they do is selling something.", // MSA §SEO
  },
  {
    q: "Do I have to write the content?",
    a: "No. You answer some questions about your business and we write it. Most people are done in one sitting — the writing is the part that stalls everyone for six months, so we took it off your plate.",
  },
  {
    q: "Will it sound like a robot?",
    a: "Call the number at the bottom of this page and decide for yourself. That's why it's there — we'd rather you hear it than take our word for it.",
  },
  {
    q: "What if it can't answer something?",
    a: "It takes their details and texts you. It doesn't guess, and it doesn't make things up about your business.",
  },
  {
    q: "Do I have to give up my number?",
    a: "No. You get a new dedicated business number and forward your existing line to it whenever you're ready. That number lives on our telephony account while you're a client. If you leave and want to keep it, tell us within 30 days and we'll port it to your carrier for a $50 fee — otherwise it goes back into the pool.", // MSA §11
  },
];

function StraightAnswers() {
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,56px)" }}>
      <Reveal>
        <h2 style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,52px)", letterSpacing: ".01em", textTransform: "uppercase", marginBottom: "clamp(28px,3vw,44px)" }}>
          Before you call.
        </h2>
      </Reveal>
      {/* Reference-document layout, not cards: ruled entries in two columns.
          `min(100%, 400px)` is load-bearing — a bare minmax(400px, 1fr) overflows
          at 375px. The 1040 cap is what holds it to two columns; the page's usual
          1320 fits three, which is too many to read. */}
      <div
        style={{
          maxWidth: 1040,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))",
          columnGap: 48,
          rowGap: 0,
        }}
      >
        {ANSWERS.map((item, i) => (
          <Reveal
            as="article"
            key={item.q}
            delay={i % 2}
            style={{ borderTop: "1px solid var(--rule)", padding: "24px 0 28px", display: "flex", flexDirection: "column", gap: 10 }}
          >
            <h3 style={{ fontWeight: 700, fontSize: "clamp(18px,1.9vw,22px)", lineHeight: 1.15, textTransform: "uppercase" }}>{item.q}</h3>
            <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--fg-2)", margin: 0, maxWidth: "46ch" }}>{item.a}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── Dial It Yourself CTA (replaces Contact) ────────────────── */
/* The page closes on the website, because that's what's being bought — but the phone
   demo is still the strongest thing we have, so it keeps the big type and the ring
   pulse and sits directly underneath as its own move. */
function DialCTA({ onOpenForm }: { onOpenForm: () => void }) {
  return (
    <section id="cta" style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(56px,7vw,112px) clamp(18px,4vw,56px)", textAlign: "center" }}>
      <Reveal>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-2)", marginBottom: 22 }}>Live in about a week</p>
      </Reveal>
      <Reveal delay={1}>
        <h2 style={{ fontWeight: 900, fontSize: "clamp(48px,9vw,128px)", lineHeight: 0.84, textTransform: "uppercase", marginBottom: 26 }}>
          Let&apos;s build<br />yours.
        </h2>
      </Reveal>
      <Reveal delay={2}>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--fg-2)", maxWidth: "46ch", margin: "0 auto 38px" }}>
          Five questions about your business and we&apos;ll show you what your site looks like. No card, no call, no pitch on the phone.
        </p>
      </Reveal>
      <Reveal delay={3}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <button type="button" onClick={onOpenForm} className="btn primary lg" style={{ fontSize: "clamp(18px,2.2vw,24px)", padding: "16px 38px", boxShadow: "0 0 32px var(--accent-glow)" }}>
            Get Started
          </button>
          <a href="/pricing" className="btn ghost">View plans + pricing</a>
        </div>
      </Reveal>

      {/* The aside. Deliberately loud for a secondary move — dialling the demo is still
          the single best thing a sceptic can do, and "the sound of a lead getting
          caught" is the best line on the page. */}
      <Reveal delay={4}>
        <div className="dial-aside">
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-2)", marginBottom: 12 }}>
              Want to hear the receptionist first?
            </p>
            <h3 style={{ fontWeight: 900, fontSize: "clamp(30px,4.4vw,54px)", lineHeight: 0.9, textTransform: "uppercase", marginBottom: 14 }}>
              Dial it yourself.
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--fg-2)", maxWidth: "40ch" }}>
              Hear exactly what your customers hear when they call you. No sign-up. No card. Just the sound of a lead getting caught.
            </p>
          </div>
          <a href={DEMO_TEL} className="btn amber anim-ringpulse-slow" style={{ fontSize: "clamp(20px,3vw,32px)", padding: "16px 32px", flexShrink: 0 }}>
            &#9742; {DEMO_TEL_DISPLAY}
          </a>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Page (final section order) ─────────────────────────────── */
export default function HomePageClient({ featuredSites = [] }: { featuredSites?: import("@/app/page").PublishedFeaturedSite[] }) {
  // Lives here rather than inside <Hero> so the panel renders above every section
  // instead of being clipped by the hero's own stacking context.
  const [formOpen, setFormOpen] = useState(false);

  /* Order is the argument: the website is what's being bought, so it lands in full
     before a phone appears. The calculator sits after the film rather than mid-page
     because it argues the receptionist specifically — in its old slot it was the
     largest thing on the page and made the receptionist look like the product. */
  return (
    <div style={{ width: "100%", background: "var(--bg)" }}>
      <Hero onOpenForm={() => setFormOpen(true)} />
      <TwoOperators />
      <FeaturedSites sites={featuredSites} />
      <TheHandoff onOpenForm={() => setFormOpen(true)} />
      <MissedCallsCalculator onOpenForm={() => setFormOpen(true)} />
      <StraightAnswers />
      <DialCTA onOpenForm={() => setFormOpen(true)} />
      {formOpen && <LeadPanel onClose={() => setFormOpen(false)} />}
    </div>
  );
}
