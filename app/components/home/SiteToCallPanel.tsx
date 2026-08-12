"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useReducedMotion, AnimatePresence, motion } from "framer-motion";
import { SCENARIOS, CallScenario } from "@/app/data/switchboard-calls";

/**
 * The two-act film.
 *
 * Act 1 is what the customer experiences: they're on the site, they tap the call bar,
 * and someone picks up. Act 2 rewinds to the *same window* and shows the owner's phone
 * ringing unanswered, then the text arriving.
 *
 * Two things are load-bearing:
 *
 * 1. It opens on the website. This section argues for the website too — it shows the
 *    handoff rather than asserting it.
 * 2. The asymmetry is the argument. Act 1 is long; Act 2 is a ring nobody answers and
 *    one text. That imbalance is the pitch, so don't "balance" the two acts.
 *
 * Act 2 is a FLASHBACK, not a sequel — in real time the owner's phone rings before the
 * AI picks up, because the unanswered ring is what triggers the forward. The
 * "MEANWHILE, ON YOUR PHONE" card is what keeps the timeline legible. Do not retitle it
 * to anything sequential.
 */

type Phase =
  | "idle"
  | "act1card"
  | "browse"
  | "dialing"
  | "call"
  | "act2card"
  | "ring"
  | "missed"
  | "later"
  | "text"
  | "recap";

/* ~30s total. The pauses are what make it read as real — resist tightening them. */
const T = {
  act1card: 1600,
  browse: 3800,
  dialing: 2600,
  callLine: 2000,
  callRest: 1200,
  act2card: 1800,
  ring: 3000,
  missed: 2000,
  later: 1600,
  text: 4000,
};

/* The call beat runs ~9s but represents a ~2 minute call — Act 2's "2 MINUTES LATER"
   depends on that. Driving the on-screen timer from progress rather than wall clock
   keeps the two consistent; a literal 0:09 would contradict the interstitial. */
const CALL_REPRESENTS_SEC = 118;

const CUSTOMER_PHASES: Phase[] = ["idle", "act1card", "browse", "dialing", "call"];

function fmtTimer(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ── Act 1 · the stylized site ───────────────────────────────── */
function MockSiteScreen({ scenario, scrolled }: { scenario: CallScenario; scrolled: boolean }) {
  const { site, businessName, tradeTag } = scenario;
  const block = (h: number, w: string, o: number) => (
    <div style={{ height: h, width: w, borderRadius: 3, background: `rgba(0,0,0,${o})` }} />
  );

  return (
    <div style={{ background: "#fff", height: "100%", position: "relative", overflow: "hidden" }}>
      <motion.div
        animate={{ y: scrolled ? -104 : 0 }}
        transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
        style={{ padding: "14px 14px 0" }}
      >
        {/* site header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: site.accent, letterSpacing: "-0.01em", fontFamily: "system-ui, sans-serif" }}>
            {businessName}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2.5 }} aria-hidden="true">
            {[0, 1, 2].map((i) => <div key={i} style={{ width: 13, height: 1.5, background: "rgba(0,0,0,0.5)" }} />)}
          </div>
        </div>

        {/* hero block */}
        <div style={{ background: site.accent, borderRadius: 6, padding: 12, marginBottom: 10 }}>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 7, letterSpacing: "0.14em", color: "rgba(255,255,255,0.75)", marginBottom: 7 }}>
            {tradeTag}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ height: 9, width: "88%", borderRadius: 3, background: "rgba(255,255,255,0.92)" }} />
            <div style={{ height: 9, width: "62%", borderRadius: 3, background: "rgba(255,255,255,0.92)" }} />
            <div style={{ height: 5, width: "74%", borderRadius: 3, background: "rgba(255,255,255,0.5)", marginTop: 3 }} />
          </div>
        </div>

        {/* body blocks — variant changes the silhouette between replays */}
        {site.variant === 1 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 5, padding: 9, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ height: 14, width: 14, borderRadius: 4, background: site.accent, opacity: 0.85 }} />
                  {block(4, "80%", 0.16)}
                  {block(4, "58%", 0.09)}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ height: 8, width: 8, borderRadius: 999, background: site.accent, opacity: 0.7, flexShrink: 0 }} />
                  {block(4, `${72 - i * 9}%`, 0.13)}
                </div>
              ))}
            </div>
          </>
        )}

        {site.variant === 2 && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ flex: 1, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 5, padding: "9px 7px", display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                  <div style={{ height: 8, width: "62%", borderRadius: 3, background: site.accent, opacity: 0.85 }} />
                  {block(3.5, "80%", 0.1)}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 5, padding: 9, display: "flex", gap: 9, alignItems: "center" }}>
                  <div style={{ height: 22, width: 22, borderRadius: 4, background: site.accent, opacity: 0.16, flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    {block(4, "70%", 0.16)}
                    {block(4, "44%", 0.09)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {site.variant === 3 && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ width: "42%", height: 54, borderRadius: 5, background: site.accent, opacity: 0.18 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, justifyContent: "center" }}>
                {block(4, "88%", 0.16)}
                {block(4, "70%", 0.11)}
                {block(4, "52%", 0.11)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {block(4, `${58 - i * 6}%`, 0.14)}
                  <div style={{ height: 6, width: 6, borderRadius: 999, background: site.accent, opacity: 0.6 }} />
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* sticky call bar — the one element that must be unmistakable */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "9px 12px 14px", background: "linear-gradient(to top, #fff 62%, rgba(255,255,255,0))" }}>
        <div
          style={{
            background: site.accent, borderRadius: 999, padding: "10px 16px", textAlign: "center",
            fontSize: 12.5, fontWeight: 700, color: "#fff",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
          }}
        >
          ☎ {site.ctaLabel}
        </div>
      </div>
    </div>
  );
}

/* The finger. Travels to the call bar, then taps it. */
function TapIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, top: "52%", left: "58%", scale: 1 }}
      animate={{ opacity: [0, 1, 1, 1, 0], top: ["52%", "88%"], left: ["58%", "50%"], scale: [1, 1, 0.72, 1, 1] }}
      transition={{ duration: 2.6, times: [0, 0.18, 0.72, 0.82, 1], ease: "easeInOut", delay: 0.9 }}
      style={{
        position: "absolute", width: 34, height: 34, marginLeft: -17, marginTop: -17,
        borderRadius: 999, border: "2px solid rgba(0,0,0,0.45)", background: "rgba(255,255,255,0.35)",
        backdropFilter: "blur(2px)", zIndex: 6, pointerEvents: "none",
      }}
    />
  );
}

/* ── Act 1 · dialling out ────────────────────────────────────── */
function DialingScreen({ scenario }: { scenario: CallScenario }) {
  return (
    <div style={{ background: "linear-gradient(165deg, #1d2430 0%, #131820 100%)", color: "#fff", height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 20px", textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
          Calling
        </div>
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.2 }}>{scenario.businessName}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{scenario.businessPhone}</div>
        <div style={{ display: "flex", gap: 5, marginTop: 4 }} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
              style={{ width: 5, height: 5, borderRadius: 999, background: "#fff" }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 34 }}>
        <div style={{ width: 58, height: 58, borderRadius: 999, background: "rgba(255,59,48,0.92)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✕</div>
      </div>
    </div>
  );
}

/* ── Act 1 · connected, with subtitles ───────────────────────── */
function CallScreen({ scenario, lineIdx, seconds }: { scenario: CallScenario; lineIdx: number; seconds: number }) {
  const line = lineIdx >= 0 ? scenario.transcript[lineIdx] : null;
  const callerFirst = scenario.caller.name.split(" ")[0].toUpperCase();

  return (
    <div style={{ background: "linear-gradient(165deg, #1d2430 0%, #131820 100%)", color: "#fff", height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ padding: "34px 20px 0", textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2 }}>{scenario.businessName}</div>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, color: "#4ade80", marginTop: 5, letterSpacing: "0.04em" }}>
          {fmtTimer(seconds)}
        </div>
      </div>

      {/* voice bars — signals audio rather than chat */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.span
            key={i}
            animate={{ height: [7, 20 + (i % 3) * 9, 7] }}
            transition={{ duration: 0.85 + (i % 3) * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 }}
            style={{ width: 3, borderRadius: 999, background: line?.role === "AI" ? "#60a5fa" : "rgba(255,255,255,0.4)" }}
          />
        ))}
      </div>

      {/* subtitles — one line at a time, speaker-labelled */}
      <div style={{ minHeight: 128, padding: "0 16px 22px", display: "flex", alignItems: "flex-end" }}>
        <AnimatePresence mode="wait">
          {line && (
            <motion.div
              key={lineIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              style={{ width: "100%" }}
            >
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 8.5, letterSpacing: "0.1em", color: line.role === "AI" ? "#60a5fa" : "rgba(255,255,255,0.45)", marginBottom: 6 }}>
                {line.role === "AI" ? "AI /" : `/ ${callerFirst}`}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.95)", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
                {line.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Act 2 · the owner's phone rings ─────────────────────────── */
function IncomingCallScreen({ scenario }: { scenario: CallScenario }) {
  return (
    <div style={{ background: "linear-gradient(160deg, #2b2418 0%, #3a2c1c 60%, #241d12 100%)", color: "#fff", height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div className="phone-ring-pulse" style={{ width: 84, height: 84, borderRadius: 999, background: scenario.caller.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 29, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {scenario.caller.initials}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>{scenario.caller.name}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 5 }}>
            Incoming Call · {scenario.callTime}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 52, paddingBottom: 34 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 999, background: "rgba(255,59,48,0.9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 24 }}>✕</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Decline</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 999, background: "rgba(52,199,89,0.9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 24 }}>☎</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Accept</div>
        </div>
      </div>
    </div>
  );
}

/* Held a beat longer than is comfortable. The pause is the old way of doing business. */
function MissedCallScreen({ scenario }: { scenario: CallScenario }) {
  return (
    <div style={{ background: "linear-gradient(160deg, #2b2418 0%, #3a2c1c 60%, #241d12 100%)", color: "#fff", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 18px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: "100%", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", borderRadius: 16, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(255,59,48,0.92)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>✕</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Missed Call</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>
            {scenario.caller.name} · {scenario.callTime}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Act 2 · the text ────────────────────────────────────────── */
function OwnerTextScreen({ scenario }: { scenario: CallScenario }) {
  return (
    <div style={{ background: "#f2f2f7", height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ background: "rgba(242,242,247,0.97)", padding: "38px 16px 10px", borderBottom: "0.5px solid rgba(0,0,0,0.15)", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>AI Receptionist</div>
        <div style={{ fontSize: 11, color: "#007AFF", marginTop: 1 }}>text message</div>
      </div>

      <div style={{ flex: 1, padding: "18px 16px 24px", display: "flex", flexDirection: "column" }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, maxWidth: "88%" }}
        >
          <div style={{ background: "#e5e5ea", borderRadius: "18px 18px 18px 4px", padding: "11px 14px", color: "#000", lineHeight: 1.45 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 7 }}>{scenario.ownerMessage.headline}</div>
            {scenario.ownerMessage.lines.map((line, i) => (
              <div key={i} style={{ fontSize: 12.5, color: i === 0 ? "#000" : "rgba(0,0,0,0.6)" }}>{line}</div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.33)", paddingLeft: 4 }}>
            AI Receptionist · {scenario.callTime}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Interstitial cards ──────────────────────────────────────── */
function StageCard({ label, sub }: { label: string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
      style={{
        position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center",
        background: "var(--bg)", padding: "0 16px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: "clamp(20px,2.4vw,30px)", lineHeight: 1.02, letterSpacing: "0.01em", color: "var(--fg)" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent-2)", marginTop: 12 }}>
            {sub}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Panel ───────────────────────────────────────────────────── */
export default function SiteToCallPanel({ onOpenForm }: { onOpenForm: () => void }) {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lineIdx, setLineIdx] = useState(-1);
  const [seconds, setSeconds] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenario = SCENARIOS[idx];
  const isCustomerPhone = CUSTOMER_PHASES.includes(phase);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
  }, []);

  useEffect(() => clearAll, [clearAll]);

  const at = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  /* Takes the scenario rather than closing over it, so `replay` can start the next
     trade immediately instead of routing through an effect. Nothing but a click calls
     this — see the note on `replay`. */
  const run = useCallback((sc: CallScenario) => {
    clearAll();
    setLineIdx(-1);
    setSeconds(0);
    setScrolled(false);

    const lines = sc.transcript.length;
    const callMs = lines * T.callLine + T.callRest;
    let t = 0;

    setPhase("act1card");

    t += T.act1card;
    at(() => {
      setPhase("browse");
      // scroll first, then the finger arrives — order matters, a tap on a still
      // page reads as a screenshot rather than someone using it
      at(() => setScrolled(true), 250);
    }, t);

    t += T.browse;
    at(() => setPhase("dialing"), t);

    t += T.dialing;
    at(() => {
      setPhase("call");
      const started = Date.now();
      tick.current = setInterval(() => {
        const p = Math.min(1, (Date.now() - started) / callMs);
        setSeconds(Math.floor(p * CALL_REPRESENTS_SEC));
      }, 120);
      for (let i = 0; i < lines; i++) at(() => setLineIdx(i), i * T.callLine);
    }, t);

    t += callMs;
    at(() => {
      if (tick.current) { clearInterval(tick.current); tick.current = null; }
      setSeconds(CALL_REPRESENTS_SEC);
      setPhase("act2card");
    }, t);

    t += T.act2card;
    at(() => setPhase("ring"), t);

    t += T.ring;
    at(() => setPhase("missed"), t);

    t += T.missed;
    at(() => setPhase("later"), t);

    t += T.later;
    at(() => setPhase("text"), t);

    t += T.text;
    at(() => setPhase("recap"), t);
  }, [at, clearAll]);

  function start() {
    if (reduce) { setPhase("recap"); return; }
    run(scenario);
  }

  /**
   * Replay picks the next trade and starts it in the same handler.
   *
   * This used to `setIdx` and let an effect keyed on `idx` call `run`, guarded by a
   * `first` ref so it skipped the initial mount. That guard could not hold: React
   * StrictMode (on by default — `reactStrictMode` is unset in next.config.ts) invokes
   * effects twice per mount, and the ref survives the simulated remount. The first
   * invocation flipped it to false and the second saw false and started the film. So
   * the film played itself on every mount — navigate away, come back, and it ran with
   * nobody having pressed anything.
   *
   * No effect starts the film now. A click is the only path in.
   */
  function replay() {
    // Randomised client-side only — picking during render would mismatch between
    // server and client and throw a hydration error.
    let next = idx;
    while (next === idx) next = Math.floor(Math.random() * SCENARIOS.length);
    setIdx(next);
    // Pass the new scenario explicitly; `idx` state won't have updated yet, and the
    // first beat is a title card with no scenario content, so the swap is invisible.
    if (reduce) { setPhase("recap"); return; }
    run(SCENARIOS[next]);
  }

  const showRecap = phase === "recap";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, width: "100%" }}>
      {/* Stage — height reserved up front so act transitions never reflow the page.
          `aria-hidden` belongs on the device, not the stage: the gate button lives in
          here too, and a focusable control inside an aria-hidden subtree is
          unreachable by screen readers while still being tabbable. */}
      <div className="film-stage">
        <div
          aria-hidden="true"
          className={`film-phone ${isCustomerPhone ? "film-phone--customer" : "film-phone--owner"}`}
        >
          <div className="film-notch" />

          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div key="idle" className="phone-screen" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <div style={{ filter: "blur(7px)", height: "100%", opacity: 0.55 }}>
                  <MockSiteScreen scenario={scenario} scrolled={false} />
                </div>
              </motion.div>
            )}

            {phase === "browse" && (
              <motion.div key="browse" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <MockSiteScreen scenario={scenario} scrolled={scrolled} />
                <TapIndicator />
              </motion.div>
            )}

            {phase === "dialing" && (
              <motion.div key="dialing" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <DialingScreen scenario={scenario} />
              </motion.div>
            )}

            {phase === "call" && (
              <motion.div key="call" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <CallScreen scenario={scenario} lineIdx={lineIdx} seconds={seconds} />
              </motion.div>
            )}

            {phase === "ring" && (
              <motion.div key="ring" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <IncomingCallScreen scenario={scenario} />
              </motion.div>
            )}

            {phase === "missed" && (
              <motion.div key="missed" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <MissedCallScreen scenario={scenario} />
              </motion.div>
            )}

            {(phase === "text" || phase === "recap") && (
              <motion.div key="text" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
                <OwnerTextScreen scenario={scenario} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === "act1card" && <StageCard key="c1" label="What your customer sees" />}
            {phase === "act2card" && <StageCard key="c2" label="Meanwhile, on your phone" sub={`Same call · ${scenario.callTime}`} />}
            {phase === "later" && <StageCard key="c3" label="2 minutes later" />}
          </AnimatePresence>
        </div>

        {/* whose phone this is — readable before the card is even parsed */}
        <AnimatePresence mode="wait">
          {phase !== "idle" && (
            <motion.div
              key={isCustomerPhone ? "lbl-c" : "lbl-o"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="film-device-label"
            >
              {isCustomerPhone ? "Their phone" : "Your phone"}
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "idle" && (
          <div className="film-gate">
            <button type="button" onClick={start} className="btn primary lg film-gate-btn" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>
              Show me how it works
            </button>
          </div>
        )}
      </div>

      {/* Recap — the chain, stated plainly, and the way out */}
      <AnimatePresence>
        {showRecap && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="film-recap"
          >
            <div className="film-chain">
              <span>Your site</span>
              <span className="film-chain-arrow" aria-hidden="true">→</span>
              <span>Their call</span>
              <span className="film-chain-arrow" aria-hidden="true">→</span>
              <span>Your text</span>
            </div>
            <p className="film-recap-copy">
              {scenario.caller.name} called at {scenario.callTime}. Two minutes later you had their
              name, their problem, and their number, without picking up.
            </p>
            <div className="film-recap-actions">
              <button type="button" onClick={onOpenForm} className="btn primary lg" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>
                Get Started
              </button>
              <button type="button" onClick={replay} className="btn ghost">
                Show me another business
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
