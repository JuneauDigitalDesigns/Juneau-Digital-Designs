"use client";
import { useState, useEffect, useRef } from "react";
import { useReducedMotion, AnimatePresence, motion } from "framer-motion";
import { SCENARIOS, CallScenario } from "@/app/data/switchboard-calls";

// ── Timing (ms) — ~25s per scenario: 4s ring + ~11s transcript + 9s owner + 0.7s fade
const PHASE_RING_MS = 4000;
const LINE_REVEAL_MS = 2000;
const TRANSCRIPT_REST_MS = 3000;
const PHASE_OWNER_MS = 9000;
const FADE_MS = 700;

function fmtClock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

// ── iOS status bar shown inside the phone
function StatusBar({ clock, dark }: { clock: string | null; dark?: boolean }) {
  const color = dark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.4)";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px 4px", fontSize: 12, fontWeight: 600, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", color }}>
      <span>{clock ?? "9:41"}</span>
      <span style={{ fontSize: 10, letterSpacing: 2 }}>●●● ▲ ▮</span>
    </div>
  );
}

// ── Phase 0: Incoming call screen
function IncomingCallScreen({ scenario, clock }: { scenario: CallScenario; clock: string | null }) {
  return (
    <div style={{ background: "linear-gradient(160deg, #1c1c2e 0%, #2a1a3e 60%, #1a2a3e 100%)", color: "#fff", height: "100%", display: "flex", flexDirection: "column" }}>
      <StatusBar clock={clock} dark />

      {/* Caller info */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div className="phone-ring-pulse" style={{ width: 88, height: 88, borderRadius: 999, background: scenario.caller.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, color: "#fff", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", flexShrink: 0 }}>
          {scenario.caller.initials}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 600, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", letterSpacing: -0.4 }}>{scenario.caller.name}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 5, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
            Incoming Call · {scenario.callTime}
          </div>
        </div>
      </div>

      {/* Decline / Accept */}
      <div style={{ display: "flex", justifyContent: "center", gap: 56, paddingBottom: 36 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "rgba(255,59,48,0.9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 26 }}>✕</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>Decline</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "rgba(52,199,89,0.9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 26 }}>☎</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>Accept</div>
        </div>
      </div>
    </div>
  );
}

// ── Phase 1: Call transcript
function TranscriptScreen({ scenario, clock, linesRevealed }: { scenario: CallScenario; clock: string | null; linesRevealed: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [linesRevealed]);

  return (
    <div style={{ background: "#f2f2f7", height: "100%", display: "flex", flexDirection: "column" }}>
      <StatusBar clock={clock} />

      {/* Nav bar */}
      <div style={{ padding: "4px 16px 10px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "0.5px solid rgba(0,0,0,0.15)", position: "relative" }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", color: "#000" }}>{scenario.businessName}</div>
      </div>

      {/* Transcript label */}
      <div style={{ padding: "8px 16px 4px", fontFamily: "var(--font-mono), 'DM Mono', monospace", fontSize: 9, letterSpacing: "0.10em", color: "rgba(0,0,0,0.38)", textTransform: "uppercase" }}>
        Transcript · {scenario.tradeTag} · {scenario.callTime}
      </div>

      {/* Lines */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 16px 20px", display: "flex", flexDirection: "column", gap: 10, scrollbarWidth: "none" }}>
        {scenario.transcript.slice(0, linesRevealed).map((line, i) => (
          <div
            key={i}
            className="transcript-line"
            style={{ display: "flex", flexDirection: line.role === "AI" ? "row" : "row-reverse", gap: 7, alignItems: "flex-start" }}
          >
            <span style={{ fontFamily: "var(--font-mono), 'DM Mono', monospace", fontSize: 8.5, letterSpacing: "0.07em", color: line.role === "AI" ? "#007AFF" : "rgba(0,0,0,0.32)", flexShrink: 0, marginTop: 3, whiteSpace: "nowrap" }}>
              {line.role === "AI" ? "AI /" : `/ ${scenario.caller.name.split(" ")[0].toUpperCase()}`}
            </span>
            <span style={{ fontSize: 12.5, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", color: "#000", lineHeight: 1.45, flex: 1, textAlign: line.role === "AI" ? "left" : "right" }}>
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Phase 2: Owner SMS notification
function OwnerTextScreen({ scenario, clock }: { scenario: CallScenario; clock: string | null }) {
  return (
    <div style={{ background: "#f2f2f7", height: "100%", display: "flex", flexDirection: "column" }}>
      <StatusBar clock={clock} />

      {/* Messages header */}
      <div style={{ background: "rgba(242,242,247,0.97)", padding: "4px 16px 10px", borderBottom: "0.5px solid rgba(0,0,0,0.15)", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", color: "#000" }}>AI Receptionist</div>
        <div style={{ fontSize: 11, color: "#007AFF", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", marginTop: 1 }}>text message</div>
      </div>

      {/* Chat bubble area */}
      <div style={{ flex: 1, padding: "18px 16px 24px", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, maxWidth: "88%" }}
        >
          {/* Gray received bubble */}
          <div style={{ background: "#e5e5ea", borderRadius: "18px 18px 18px 4px", padding: "11px 14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", color: "#000", lineHeight: 1.45 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 7 }}>{scenario.ownerMessage.headline}</div>
            {scenario.ownerMessage.lines.map((line, i) => (
              <div key={i} style={{ fontSize: 12.5, color: i === 0 ? "#000" : "rgba(0,0,0,0.6)" }}>{line}</div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.33)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", paddingLeft: 4 }}>
            AI Receptionist · {scenario.callTime}
          </div>
        </motion.div>

        {/* Owner reply */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.55 }}
          style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, maxWidth: "72%", marginTop: 10 }}
        >
          <div style={{ background: "#007AFF", borderRadius: "18px 18px 4px 18px", padding: "11px 14px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", color: "#fff", fontSize: 13, lineHeight: 1.45 }}>
            Got it, thanks!
          </div>
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.33)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", paddingRight: 4 }}>
            {scenario.businessName}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Main component
export default function LiveSwitchboardPanel() {
  const reduce = useReducedMotion();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [linesRevealed, setLinesRevealed] = useState(0);
  const [fading, setFading] = useState(false);
  const [clock, setClock] = useState<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  function addTimer(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }

  // Live clock
  useEffect(() => {
    setClock(fmtClock(new Date()));
    const clk = setInterval(() => setClock(fmtClock(new Date())), 15000);
    return () => clearInterval(clk);
  }, []);

  // Animation orchestration
  useEffect(() => {
    if (reduce) return;

    clearTimers();

    const scenario = SCENARIOS[scenarioIdx];
    const lineCount = scenario.transcript.length;

    // Phase 0 → Phase 1
    addTimer(() => {
      setPhase(1);
      setLinesRevealed(0);

      // Reveal lines one by one
      for (let i = 0; i < lineCount; i++) {
        addTimer(() => setLinesRevealed(i + 1), (i + 1) * LINE_REVEAL_MS);
      }

      // Phase 1 → Phase 2 after all lines + rest
      addTimer(() => {
        setPhase(2);

        // Phase 2 → fade → next scenario
        addTimer(() => {
          setFading(true);
          addTimer(() => {
            setScenarioIdx(idx => (idx + 1) % SCENARIOS.length);
            setPhase(0);
            setLinesRevealed(0);
            setFading(false);
          }, FADE_MS);
        }, PHASE_OWNER_MS);
      }, lineCount * LINE_REVEAL_MS + TRANSCRIPT_REST_MS);
    }, PHASE_RING_MS);

    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioIdx, reduce]);

  const scenario = SCENARIOS[scenarioIdx];

  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
      {/* Fade-to-black overlay */}
      <AnimatePresence>
        {fading && (
          <motion.div
            key="fade"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FADE_MS / 1000 }}
            style={{ position: "absolute", inset: 0, background: "#000", zIndex: 10, borderRadius: 44, pointerEvents: "none" }}
          />
        )}
      </AnimatePresence>

      {/* Phone frame */}
      <div className="phone-frame">
        {/* Pill notch */}
        <div className="phone-notch" aria-hidden="true" />

        {/* Screen slides */}
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.div
              key={`ring-${scenarioIdx}`}
              className="phone-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.45 } }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
            >
              <IncomingCallScreen scenario={scenario} clock={clock} />
            </motion.div>
          )}

          {phase === 1 && (
            <motion.div
              key={`transcript-${scenarioIdx}`}
              className="phone-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.5 } }}
              exit={{ x: -40, opacity: 0, transition: { duration: 0.35 } }}
            >
              <TranscriptScreen scenario={scenario} clock={clock} linesRevealed={linesRevealed} />
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key={`owner-${scenarioIdx}`}
              className="phone-screen"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1, transition: { duration: 0.4 } }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
            >
              <OwnerTextScreen scenario={scenario} clock={clock} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
