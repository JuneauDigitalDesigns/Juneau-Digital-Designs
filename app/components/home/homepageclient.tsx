"use client";
/* Z-index constants: navbar 50 | grain 60 | modals 70 */

import { useState, useEffect, useRef } from "react";
import { Info } from "@phosphor-icons/react";
import LiveSwitchboardPanel from "./LiveSwitchboardPanel";
import LeadPanel from "./LeadPanel";

const DEMO_TEL = "tel:+19302221343";
const DEMO_TEL_DISPLAY = "(930) 222-1343";
const TRADES = ["Plumbers rely on it", "HVAC crews use it", "Roofers trust it", "Contractors book with it", "Electricians run on it", "Landscapers love it"];

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
        <h1 style={{ fontWeight: 900, fontSize: "clamp(44px,12vw,92px)", lineHeight: 0.95, letterSpacing: ".005em", textTransform: "uppercase" }}>
          Every missed call<br /><span style={{ color: "var(--accent-2)" }}>is a lost job.</span>
        </h1>
        <p style={{ fontSize: "clamp(17px,1.6vw,21px)", lineHeight: 1.55, color: "var(--fg-2)", margin: "28px 0 32px" }}>
          We build your website and run a 24/7 AI receptionist on your number. When you can&apos;t pick up, it does — books the job, answers questions, and texts you a summary.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="hero-cta">
            {/* The ring-pulse animation stays with the phone CTA in <DialCTA> at the
                bottom of the page — on a button that opens a form it would be promising
                a call that isn't coming. */}
            <button type="button" onClick={onOpenForm} className="btn primary lg hero-cta-btn" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>Get Started</button>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--fg-3)" }}>Tell us your trade — takes two minutes</span>
        </div>
      </div>

      <LiveSwitchboardPanel />
    </section>
  );
}

/* ── Trades ticker ──────────────────────────────────────────── */
function TradesTicker() {
  const items = [...TRADES, ...TRADES, ...TRADES];
  return (
    <div className="ticker-bar" aria-hidden="true">
      <div className="ticker-track" style={{ paddingLeft: 28 }}>
        {items.map((t, i) => (
          <span key={i} style={{ display: "inline-flex", gap: 28, alignItems: "center" }}>
            {t}
            <span>&bull;</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Missed Calls Revenue Calculator (kept; restyled to tokens) ── */
function MissedCallsCalculator() {
  const MISSED_MIN = 1, MISSED_MAX = 50;
  const RECOVERY_MIN = 1, RECOVERY_MAX = 100;
  const JOB_SLIDER_MIN = 0, JOB_SLIDER_MAX = 100;

  const LEAD_RATE = 0.47;
  const CLOSE_RATE = 0.46;
  const AI_RECOVERY_RATE = 0.73;

  function sliderToJobValue(pos: number): number {
    return Math.round(50 * Math.pow(10000, pos / 100));
  }
  function jobValueToSlider(val: number): number {
    return (Math.log(val / 50) / Math.log(10000)) * 100;
  }

  const [missedPerWeek, setMissedPerWeek] = useState(10);
  const [jobSliderPos, setJobSliderPos] = useState(() => jobValueToSlider(800));
  const [currentRecovery, setCurrentRecovery] = useState(20);

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

  return (
    <section style={{ position: "relative", padding: "clamp(56px,7vw,120px) 0", overflow: "hidden" }}>
      <div className="aurora-grid" />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ marginTop: 16, marginBottom: 12, textTransform: "uppercase" }}>
            How much are missed calls <span style={{ color: "var(--accent-2)" }}>costing you?</span>
          </h2>
          <p style={{ color: "var(--fg-2)", fontSize: 16, maxWidth: "50ch", margin: "0 auto", lineHeight: 1.6 }}>
            Move the sliders to match your business. See your real numbers instantly.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <div className="glass calc-layout" style={{ padding: "40px 36px", borderRadius: 22, position: "relative", overflow: "hidden" }}>
            {/* accent top bar — tokenized (was hardcoded purple) */}
            <div style={{ position: "absolute", inset: "0 0 auto 0", height: 2, borderRadius: "22px 22px 0 0", background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />

            {/* LEFT: sliders */}
            <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                  <span className="kicker">Missed calls / week</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--fg)", letterSpacing: "var(--tracking-tight)" }}>{missedPerWeek}</span>
                </div>
                <input
                  type="range"
                  className="calc-slider"
                  min={MISSED_MIN}
                  max={MISSED_MAX}
                  step={1}
                  value={missedPerWeek}
                  onChange={(e) => setMissedPerWeek(Number(e.target.value))}
                  style={{ "--pct": `${missedPct}%` } as React.CSSProperties}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.1em" }}>
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                  <span className="kicker">Avg job value</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--fg)", letterSpacing: "var(--tracking-tight)" }}>
                    {avgJobValue >= 1000 ? `$${(avgJobValue / 1000).toFixed(avgJobValue >= 100000 ? 0 : 1)}K` : `$${avgJobValue.toLocaleString()}`}
                  </span>
                </div>
                <input
                  type="range"
                  className="calc-slider"
                  min={JOB_SLIDER_MIN}
                  max={JOB_SLIDER_MAX}
                  step={0.5}
                  value={jobSliderPos}
                  onChange={(e) => setJobSliderPos(Number(e.target.value))}
                  style={{ "--pct": `${jobPct}%` } as React.CSSProperties}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.1em" }}>
                  <span>$50</span>
                  <span>$500K</span>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                  <span className="kicker">Lead calls you currently recover</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: currentRecovery >= 90 ? "var(--accent-2)" : "var(--fg)", letterSpacing: "var(--tracking-tight)", transition: "color 0.2s ease" }}>{currentRecovery}%</span>
                </div>
                <input
                  type="range"
                  className="calc-slider"
                  min={RECOVERY_MIN}
                  max={RECOVERY_MAX}
                  step={1}
                  value={currentRecovery}
                  onChange={(e) => setCurrentRecovery(Number(e.target.value))}
                  style={{ "--pct": `${recoveryPct}%` } as React.CSSProperties}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.1em" }}>
                  <span>1%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* RIGHT: results */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>
              <div>
                <div className="kicker" style={{ marginBottom: 12 }}>Revenue Left on the Table</div>
                {/* tokenized — was a hardcoded white→transparent gradient (invisible in light) */}
                <div key={revenueFormatted} style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", fontWeight: 900, lineHeight: 1, letterSpacing: "var(--tracking-tightest)", color: "var(--fg)" }}>
                  {revenueFormatted}
                </div>
                <div className="kicker" style={{ marginTop: 8 }}>per year</div>
              </div>

              <div style={{ width: "100%", height: 1, background: "var(--rule)" }} />

              <div>
                <div className="kicker" style={{ marginBottom: 12 }}>Recoverable via AI Receptionist</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", fontWeight: 900, lineHeight: 1, letterSpacing: "var(--tracking-tightest)", color: "var(--accent-2)", textShadow: "0 0 40px var(--accent-glow)" }}>
                  {formatDollars(recoverableRevenue)}
                </div>
                <div className="kicker" style={{ marginTop: 8 }}>per year</div>
              </div>

              <details className="calc-accordion">
                <summary>
                  <Info size={16} weight="duotone" style={{ color: "var(--accent-2)", flexShrink: 0 }} />
                  How we calculate this
                </summary>
                <div className="calc-accordion-content">
                  <p style={{ marginBottom: 12, color: "var(--fg-2)", fontSize: 13, lineHeight: 1.6 }}>
                    Estimates based on your inputs and published industry research. Results vary by market and business.
                  </p>
                  <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      <strong style={{ color: "var(--fg)" }}>{missedPerWeek} calls/week × 52</strong> = {Math.round(annualMissed).toLocaleString()} missed/year
                    </li>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      × <strong style={{ color: "var(--fg)" }}>47% new-business leads</strong> (Invoca 2025) = {Math.round(annualLeadCalls).toLocaleString()} lead calls
                    </li>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      × <strong style={{ color: "var(--fg)" }}>{Math.round((1 - currentRecovery / 100) * 100)}% unrecovered</strong> = {Math.round(unrecoveredLeads).toLocaleString()} lost leads
                    </li>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      × <strong style={{ color: "var(--fg)" }}>46% close rate</strong> × avg job value = {formatDollars(revenueOnTable)}
                    </li>
                    <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                      × <strong style={{ color: "var(--fg)" }}>73% AI recovery</strong> = {formatDollars(recoverableRevenue)}
                    </li>
                  </ol>
                </div>
              </details>

              <p style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.5, margin: 0 }}>
                Illustrative estimates only. Actual results vary by market, business model, and execution.
              </p>
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
          The website and the receptionist.
        </h2>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
        {/* Operator 01 — Website */}
        <Reveal as="article" style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: "clamp(26px,3vw,38px)", display: "flex", flexDirection: "column", gap: 18, background: "var(--panel)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--accent)" }}>OPERATOR 01 // THE WEBSITE</div>
          <h3 style={{ fontWeight: 700, fontSize: "clamp(26px,3vw,38px)", lineHeight: 0.98, textTransform: "uppercase" }}>Built once. Runs forever.</h3>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--fg-2)" }}>Fast, findable on Google, and made to look like the real you. We build it, host it, back it up and keep it current. Your only job is to keep doing the job.</p>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
            <span>&rarr; live in ~2 weeks</span>
            <span>&rarr; hosting + updates included</span>
            <span>&rarr; click-to-call everywhere</span>
          </div>
        </Reveal>

        {/* Operator 02 — Receptionist (inverted, premium) */}
        <Reveal as="article" delay={1} className="surface-invert" style={{ border: "1px solid", borderRadius: 8, padding: "clamp(26px,3vw,38px)", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".12em", color: "var(--invert-accent)" }}>OPERATOR 02 // THE RECEPTIONIST</div>
          <h3 style={{ fontWeight: 700, fontSize: "clamp(26px,3vw,38px)", lineHeight: 0.98, textTransform: "uppercase", color: "var(--invert-fg)" }}>Picks up in two rings. Books the job. Texts you.</h3>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--invert-fg-2)" }}>When you can&apos;t pick up, it does. Answers questions, books the job, and texts you the details before the caller hangs up. 3am, Sunday, holidays. Always on.</p>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--invert-fg-2)", display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
            <span>&rarr; 24/7, every single day</span>
            <span>&rarr; books into your calendar</span>
            <span>&rarr; texts you every summary</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Outcomes strip (replaces LogoMarquee) ──────────────────── */
const OUTCOMES = [
  { stat: "<1.4s", label: "average answer time" },
  { stat: "99.9%", label: "website always live" },
  { stat: "24/7", label: "no days off" },
  { stat: "100%", label: "of calls answered" },
];
function OutcomesStrip() {
  return (
    <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(32px,4vw,56px) clamp(18px,4vw,56px)" }}>
      <Reveal style={{ marginBottom: "clamp(24px,3vw,40px)" }}>
        <h2 style={{ fontWeight: 800, fontSize: "clamp(28px,4vw,52px)", letterSpacing: ".01em", textTransform: "uppercase" }}>By the numbers.</h2>
      </Reveal>
      <div className="outcomes-grid">
        {OUTCOMES.map((o, i) => (
          <div key={i} style={{ padding: "28px 22px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(36px,5vw,64px)", lineHeight: 0.85, color: "var(--accent-2)" }}>{o.stat}</div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 10, lineHeight: 1.4 }}>{o.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Dial It Yourself CTA (replaces Contact) ────────────────── */
function DialCTA() {
  return (
    <section id="cta" style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(56px,7vw,112px) clamp(18px,4vw,56px)", textAlign: "center" }}>
      <Reveal>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent-2)", marginBottom: 22 }}>Best way to believe it</p>
      </Reveal>
      <Reveal delay={1}>
        <h2 style={{ fontWeight: 900, fontSize: "clamp(48px,9vw,128px)", lineHeight: 0.84, textTransform: "uppercase", marginBottom: 26 }}>
          Dial it<br />yourself.
        </h2>
      </Reveal>
      <Reveal delay={2}>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--fg-2)", maxWidth: "44ch", margin: "0 auto 38px" }}>
          Call the number and hear exactly what your customers hear when they call you. No sign-up. No card. Just the sound of a lead getting caught.
        </p>
      </Reveal>
      <Reveal delay={3}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <a href={DEMO_TEL} className="btn amber anim-ringpulse-slow" style={{ fontSize: "clamp(24px,4vw,40px)", padding: "18px 40px" }}>
            &#9742; {DEMO_TEL_DISPLAY}
          </a>
          <a href="/pricing" className="btn ghost">View plans + pricing</a>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Page (final section order) ─────────────────────────────── */
export default function HomePageClient() {
  // Lives here rather than inside <Hero> so the panel renders above every section
  // instead of being clipped by the hero's own stacking context.
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div style={{ width: "100%", background: "var(--bg)" }}>
      <Hero onOpenForm={() => setFormOpen(true)} />
      <TwoOperators />
      <TradesTicker />
      <MissedCallsCalculator />
      <OutcomesStrip />
      <DialCTA />
      {formOpen && <LeadPanel onClose={() => setFormOpen(false)} />}
    </div>
  );
}
