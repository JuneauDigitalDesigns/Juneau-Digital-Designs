"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useReducedMotion, AnimatePresence, motion } from "framer-motion";
import { ArrowCounterClockwise, ArrowDown, Pause, Play } from "@phosphor-icons/react";
import { FILM_COPY, FILM_OWNER_LINK, FILM_OWNER_NOTE, FILM_OWNER_TEXT, FILM_SITE, type CallScenario } from "@/app/data/switchboard-calls";
import { PORTAL_SECTION_ID } from "@/app/data/portal-demo";
import { createDemoClock, type DemoClock } from "./demo-clock";
import { lineMs } from "./film-timing";
import { playStory, REPRESENTS_SEC, SITE_START, T, scenarioFor, type FilmActor, type Mode, type Screen, type SiteState, type Side } from "./film-script";

/**
 * The receptionist film, retold on 12 Nov 2026 (Xander, storyboard approved word for word).
 *
 * It plays the Starter story first, because that is what every plan does:
 *   their phone: Dave on Your HVAC Co.'s site (the real growth template, the laptop's site) taps
 *   the call button; your phone: it rings, you're busy; normally that is voicemail; instead the
 *   receptionist answers on his phone, with subtitles; back on your phone, the post-call alert.
 * It ends by offering the Growth story, the one thing Starter does not do: the same site, a
 * callout on the number (customers can still call), the form filled in, a callout on the form,
 * then "About a minute later" the receptionist rings him back, and the same alert. That one ends
 * by pointing down the page at the portal section, where this lead is captured.
 *
 * Why this order: the old film opened on the form and the callback with an "On Growth" tag, under
 * a heading every plan gets. The callback is Growth only, so the film now leads with the call
 * every plan answers, and names its plan on its first card ("Every plan" / "On Growth").
 *
 * Load-bearing:
 * 1. The site is the real capture, and every tap, keystroke and tick lands on its own fields
 *    (`FILM_SITE`, measured from the live page).
 * 2. The owner's text is the real text's shape (`FILM_OWNER_TEXT`, held to the real builders by a
 *    test). The film never shows a nicer message than the one the owner gets.
 * 3. Click to pause (12 Nov 2026): every pause in the script is a wait on a pausable clock
 *    (`demo-clock.ts`), the CSS animations hold through `data-paused`, and the page scroll is
 *    pinned mid-move. The next click carries on from exactly there.
 * 4. Subtitles are timed by length (`film-timing.ts`), not a flat 2s: they were too fast to read.
 * 5. Since 2026-11-18 there is no cursor (phones have none: every press is a tap), and every
 *    screen change moves forward. The script is in `film-script.ts`, where both are tested.
 */


function fmtTimer(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ── the website ─────────────────────────────────────────────── */

type Box = { x: number; y: number; w: number; h: number };

/**
 * A callout on the site: the thing it is about ringed in coral, a line drawn from it, and a box
 * with the words. In the site's own 390px coordinates, relative to the screen (not the page).
 */
function Callout({ target, side, text }: { target: Box; side: "below" | "above"; text: string }) {
  return (
    <>
      <span className="film-callout-ring" style={{ left: target.x - 5, top: target.y - 5, width: target.w + 10, height: target.h + 10 }} />
      <div
        className="film-callout"
        data-side={side}
        style={side === "below" ? { top: target.y + target.h + 5 } : { top: target.y - 5 }}
      >
        <i className="film-callout-line" />
        <p className="film-callout-box">{text}</p>
      </div>
    </>
  );
}

/** The growth site on the customer's phone at its real 390px layout, scaled to the screen. */
function SiteScreen({ st }: { st: SiteState }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0.72, h: 750 });

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setFit({ scale: w / FILM_SITE.width, h: el.clientHeight / (w / FILM_SITE.width) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const box = (b: Box): React.CSSProperties => ({ left: b.x, top: b.y, width: b.w, height: b.h });
  const onScreen = (b: Box): Box => ({ ...b, y: b.y - st.scroll });

  return (
    <div ref={screenRef} className="film-site">
      <div className="film-site-vp" style={{ transform: `scale(${fit.scale})`, height: fit.h }}>
        <div className="film-site-page" style={{ transform: `translateY(${-st.scroll}px)` }}>
          {/* Plain <img>, not next/image: the overlays map 1:1 onto the capture's 390px
              geometry, and the optimizer would resample it. The asset is a sized webp. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FILM_SITE.src} alt="" width={FILM_SITE.width} height={FILM_SITE.height} draggable={false} />
          <span className="film-press" data-on={st.pressed === "call"} style={box(FILM_SITE.heroCall)} />
          <span className="film-press" data-on={st.pressed === "hero"} style={box(FILM_SITE.heroEstimate)} />
          <span className="film-typed" data-focus={st.focus === "name"} style={box(FILM_SITE.name)}>{st.name}</span>
          <span className="film-typed" data-focus={st.focus === "phone"} style={box(FILM_SITE.phone)}>{st.phone}</span>
          <span className="film-tick" data-on={st.ticked} style={box(FILM_SITE.consent)} />
          <span className="film-press" data-on={st.pressed === "submit"} style={box(FILM_SITE.submit)} />
        </div>
        {st.callout === "call" && <Callout target={onScreen(FILM_SITE.heroCall)} side="below" text={FILM_COPY.callNumber} />}
        {st.callout === "form" && <Callout target={onScreen(FILM_SITE.formFields)} side="above" text={FILM_COPY.fillForm} />}
        {/* A tap, not a cursor (2026-11-18): phones have no pointer. Keyed on the tap count, so
            each tap replays its ripple where the finger landed. */}
        {st.tap && <span key={st.tap.n} className="film-tap" style={{ left: st.tap.x, top: st.tap.y }} />}
      </div>
    </div>
  );
}

/* ── phone screens ───────────────────────────────────────────── */

const DARK: React.CSSProperties = {
  background: "linear-gradient(165deg, #1d2430 0%, #131820 100%)",
  color: "#fff",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

function Avatar({ label, pulse }: { label: string; pulse?: boolean }) {
  return (
    <div
      className={pulse ? "phone-ring-pulse" : undefined}
      style={{ width: 84, height: 84, borderRadius: 999, background: "#b4472b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 27, fontWeight: 700, color: "#fff", flexShrink: 0 }}
    >
      {label}
    </div>
  );
}

function CallButtons({ decline }: { decline?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 52, paddingBottom: 34 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 999, background: "rgba(255,59,48,0.9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 24 }}>✕</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Decline</div>
      </div>
      {!decline && (
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 999, background: "rgba(52,199,89,0.9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 24 }}>☎</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Accept</div>
        </div>
      )}
    </div>
  );
}

/** Their phone, Starter: the call to the number on the site, ringing out. */
function DialingScreen({ scenario }: { scenario: CallScenario }) {
  return (
    <div style={DARK}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <Avatar label="YH" />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>{scenario.businessName}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 5 }}>{FILM_COPY.calling}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 34 }}>
        <div style={{ width: 60, height: 60, borderRadius: 999, background: "rgba(255,59,48,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✕</div>
      </div>
    </div>
  );
}

/** Your phone, Starter: Dave's call ringing in, then the beep that says you can't take it. */
function OwnerRingScreen({ scenario, busy }: { scenario: CallScenario; busy: boolean }) {
  return (
    <div style={{ ...DARK, position: "relative" }}>
      <AnimatePresence>
        {busy && (
          <motion.div
            key="busy"
            className="film-busy"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="film-busy-beep" aria-hidden="true" />
            {FILM_COPY.busy}
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <Avatar label={scenario.caller.initials} pulse={!busy} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>{scenario.ownerMessage.callback}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 5 }}>Incoming Call</div>
        </div>
      </div>
      <CallButtons />
    </div>
  );
}

/** Their phone, Growth: the business ringing him back. */
function CallbackScreen({ scenario }: { scenario: CallScenario }) {
  return (
    <div style={DARK}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <Avatar label="YH" pulse />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>{scenario.businessName}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 5 }}>Incoming Call</div>
        </div>
      </div>
      <CallButtons />
    </div>
  );
}

/** Their phone: connected, with subtitles. */
function CallScreen({ scenario, lineIdx, seconds, paused }: { scenario: CallScenario; lineIdx: number; seconds: number; paused: boolean }) {
  const line = lineIdx >= 0 ? scenario.transcript[lineIdx] : null;
  const callerFirst = scenario.caller.name.split(" ")[0].toUpperCase();

  return (
    <div style={DARK}>
      <div style={{ padding: "34px 20px 0", textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2 }}>{scenario.businessName}</div>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 13, color: "#4ade80", marginTop: 5, letterSpacing: "0.04em" }}>
          {fmtTimer(seconds)}
        </div>
      </div>

      {/* voice bars, which say audio rather than chat. Still while paused. */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }} aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <motion.span
            key={i}
            animate={paused ? { height: 7 + (i % 3) * 4 } : { height: [7, 20 + (i % 3) * 9, 7] }}
            transition={paused ? { duration: 0.2 } : { duration: 0.85 + (i % 3) * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 }}
            style={{ width: 3, borderRadius: 999, background: line?.role === "AI" ? "#60a5fa" : "rgba(255,255,255,0.4)" }}
          />
        ))}
      </div>

      {/* subtitles: one line at a time, speaker-labelled */}
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


/* The sender is JDD, not "AI Receptionist": the brief is an account-lane message from
   JDD's notification number to the owner (Program One on /sms-terms). */
const SENDER = "Juneau Digital Designs";

function OwnerTextScreen({ scenario, mode }: { scenario: CallScenario; mode: Mode }) {
  return (
    <div style={{ background: "#f2f2f7", height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ background: "rgba(242,242,247,0.97)", padding: "38px 16px 10px", borderBottom: "0.5px solid rgba(0,0,0,0.15)", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>{SENDER}</div>
        <div style={{ fontSize: 11, color: "#007AFF", marginTop: 1 }}>text message</div>
      </div>

      <div style={{ flex: 1, padding: "14px 16px 24px", display: "flex", flexDirection: "column" }}>
        {/* Today's campaign sends neither text as shown (Xander, 2026-11-18: say so). Above the
            message, so the ending panel never covers it. */}
        <div style={{ fontSize: 10.5, color: "rgba(0,0,0,0.5)", textAlign: "center", fontStyle: "italic", marginBottom: 10 }}>
          {FILM_OWNER_NOTE}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, maxWidth: "88%" }}
        >
          <div style={{ background: "#e5e5ea", borderRadius: "18px 18px 18px 4px", padding: "10px 13px", color: "#000", fontSize: 12, lineHeight: 1.4 }}>
            {FILM_OWNER_TEXT[mode].map((l, i) => (
              <div key={i} style={{ wordBreak: "break-word" }}>
                {l.startsWith("View it: ") ? (
                  <>
                    View it: <span style={{ color: "#007AFF", textDecoration: "underline" }}>{FILM_OWNER_LINK}</span>
                  </>
                ) : (
                  l
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.33)", paddingLeft: 4 }}>
            {SENDER} · {scenario.callTime}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── interstitial cards ──────────────────────────────────────── */
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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
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

/* ── the film ────────────────────────────────────────────────── */
export default function SiteToCallPanel() {
  const reduce = useReducedMotion();
  const [screen, setScreen] = useState<Screen>("idle");
  const [side, setSide] = useState<Side>("their");
  const [card, setCard] = useState<{ label: string; sub?: string } | null>(null);
  const [site, setSite] = useState<SiteState>(SITE_START);
  const [busy, setBusy] = useState(false);
  const [lineIdx, setLineIdx] = useState(-1);
  const [seconds, setSeconds] = useState(0);
  const [mode, setMode] = useState<Mode>("starter");
  /** Which ending is up, once a story has finished. */
  const [ended, setEnded] = useState<Mode | null>(null);
  const [paused, setPaused] = useState(false);

  const clockRef = useRef<DemoClock | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  /** Inline styles the freeze overwrote, to put back on resume. */
  const frozen = useRef<{ el: HTMLElement; transform: string; left: string; top: string; transition: string }[]>([]);

  const stopTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clockRef.current?.cancel();
      stopTick();
    },
    [stopTick],
  );

  /** Pins the page scroll where it is mid-move; `thaw` sends it on. */
  const freeze = useCallback(() => {
    const root = phoneRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".film-site-page"));
    frozen.current = els.map((el) => {
      const cs = getComputedStyle(el);
      const saved = { el, transform: el.style.transform, left: el.style.left, top: el.style.top, transition: el.style.transition };
      el.style.transition = "none";
      el.style.transform = cs.transform === "none" ? "" : cs.transform;
      el.style.left = cs.left;
      el.style.top = cs.top;
      return saved;
    });
  }, []);
  const thaw = useCallback(() => {
    const list = frozen.current;
    frozen.current = [];
    for (const f of list) restoreFrozen(f);
  }, []);

  /* Nothing but a click calls this. An effect that started the film ran it on every mount
     under StrictMode, so the film played itself with nobody having pressed anything. */
  const run = useCallback(
    async (m: Mode) => {
      clockRef.current?.cancel();
      stopTick();
      thaw();
      const clock = createDemoClock();
      clockRef.current = clock;
      const wait = (ms: number) => clock.wait(ms);
      // The script is in film-script.ts; this is how it reaches the screen.
      const act: FilmActor = {
        screen: setScreen,
        card: setCard,
        side: setSide,
        site: (p) => setSite((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) })),
        busy: setBusy,
        startCall: (sc) => {
          setLineIdx(-1);
          setSeconds(0);
          setScreen("call");
          const total = sc.transcript.reduce((t, l) => t + lineMs(l.text), 0) + T.callRest;
          const started = clock.elapsed();
          stopTick();
          // Read from the clock, so the timer stands still while the film is paused.
          tickRef.current = setInterval(() => {
            const p = Math.min(1, (clock.elapsed() - started) / total);
            setSeconds(Math.floor(p * REPRESENTS_SEC[m]));
          }, 120);
        },
        line: setLineIdx,
        endCall: () => {
          stopTick();
          setSeconds(REPRESENTS_SEC[m]);
        },
      };

      setMode(m);
      setEnded(null);
      setPaused(false);
      setLineIdx(-1);
      setSeconds(0);
      try {
        await playStory(m, act, wait);
        setEnded(m);
      } catch {
        // Cancelled by a newer run or an unmount, which owns the state from here.
      }
    },
    [stopTick, thaw],
  );

  /** Reduced motion skips the film and shows each story's last frame, its ending up. */
  function start(m: Mode) {
    if (reduce) {
      clockRef.current?.cancel();
      setMode(m);
      setSide("your");
      setCard(null);
      setScreen("text");
      setEnded(m);
      return;
    }
    void run(m);
  }

  function togglePause() {
    const clock = clockRef.current;
    if (!clock || clock.cancelled) return;
    if (clock.paused) {
      thaw();
      clock.resume();
      setPaused(false);
    } else {
      clock.pause();
      freeze();
      setPaused(true);
    }
  }

  const playing = screen !== "idle" && ended === null && !reduce;
  const scenario = scenarioFor(mode);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, width: "100%" }}>
      {/* Stage: height reserved up front so screen changes never reflow the page.
          `aria-hidden` belongs on the device, not the stage: the gate and the pause button
          live in here too, and a focusable control inside an aria-hidden subtree is
          unreachable by screen readers while still being tabbable. */}
      <div className="film-stage" data-paused={paused ? "true" : undefined}>
        <div className="film-device" data-pausable={playing ? "true" : undefined}>
          <div ref={phoneRef} aria-hidden="true" className={`film-phone ${side === "their" ? "film-phone--customer" : "film-phone--owner"}`}>
            <div className="film-notch" />

            <AnimatePresence mode="wait">
              {screen === "idle" && (
                <motion.div key="idle" className="phone-screen" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <div style={{ filter: "blur(7px)", height: "100%", opacity: 0.55 }}>
                    <SiteScreen st={SITE_START} />
                  </div>
                </motion.div>
              )}

              {screen === "site" && (
                <motion.div key={`site-${mode}`} className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <SiteScreen st={site} />
                </motion.div>
              )}

              {screen === "dialing" && (
                <motion.div key="dialing" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <DialingScreen scenario={scenario} />
                </motion.div>
              )}

              {screen === "ownerRing" && (
                <motion.div key="ownerRing" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <OwnerRingScreen scenario={scenario} busy={busy} />
                </motion.div>
              )}

              {screen === "ringIn" && (
                <motion.div key="ringIn" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <CallbackScreen scenario={scenario} />
                </motion.div>
              )}

              {screen === "call" && (
                <motion.div key={`call-${mode}`} className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <CallScreen scenario={scenario} lineIdx={lineIdx} seconds={seconds} paused={paused} />
                </motion.div>
              )}

              {screen === "text" && (
                <motion.div key={`text-${mode}`} className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <OwnerTextScreen scenario={scenario} mode={mode} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>{card && <StageCard key={card.label} label={card.label} sub={card.sub} />}</AnimatePresence>
          </div>

          {/* Click to pause: over the whole phone while a story plays. A real button beside the
              aria-hidden phone, so it is reachable by keyboard and says what it will do. */}
          {playing && (
            <button
              type="button"
              className="film-toggle"
              onClick={togglePause}
              aria-label={paused ? "Play" : "Pause"}
              aria-pressed={paused}
              title={paused ? "Play" : "Pause"}
            >
              <span className="film-toggle-icon" aria-hidden="true">
                {paused ? <Play size={18} weight="fill" /> : <Pause size={18} weight="fill" />}
              </span>
            </button>
          )}
        </div>

        {/* Whose phone this is, readable before the card is even parsed. Always rendered, so it
            costs no height when it changes; nothing is lit before the film starts. */}
        <p className="film-switch">
          <span aria-current={screen !== "idle" && side === "their" ? "true" : undefined}>Their phone</span>
          <span aria-current={screen !== "idle" && side === "your" ? "true" : undefined}>Your phone</span>
        </p>

        {/* Both gates are `position: absolute; inset: 0`, so they contribute NO height: the
            stage is the same height before, during and after. Anything new after the film has to
            be an overlay, not a sibling. */}
        {screen === "idle" && (
          <div className="film-gate">
            <div className="film-gate-stack">
              {/* Explains why a film about a phone receptionist opens on a website. */}
              <p className="film-gate-line">A customer finds you online.</p>
              <button type="button" onClick={() => start("starter")} className="btn primary lg film-gate-btn" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>
                Show me how it works
              </button>
            </div>
          </div>
        )}

        {/* The endings sit low over the phone, so the alert at the top of the screen stays
            readable above them. */}
        {ended === "starter" && (
          <div className="film-gate film-gate--end" role="status">
            <div className="film-end">
              <p className="film-end-line">{FILM_COPY.starterEnd}</p>
              <button type="button" onClick={() => start("growth")} className="btn primary film-end-btn">
                {FILM_COPY.seeGrowth}
              </button>
              <a href={`#${PORTAL_SECTION_ID}`} className="film-end-link">
                {FILM_COPY.skipToPortal}
                <ArrowDown size={14} weight="bold" aria-hidden="true" />
              </a>
            </div>
          </div>
        )}
        {ended === "growth" && (
          <div className="film-gate film-gate--end" role="status">
            <div className="film-end">
              <p className="film-end-line">{FILM_COPY.growthEnd}</p>
              {/* A same-page anchor, so Lenis glides it down to the portal section. */}
              <a href={`#${PORTAL_SECTION_ID}`} className="btn primary film-end-btn">
                {FILM_COPY.showMe}
                <ArrowDown size={16} weight="bold" aria-hidden="true" />
              </a>
              <button type="button" onClick={() => start("starter")} className="btn ghost film-end-btn">
                <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
                {FILM_COPY.replay}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Puts back what `freeze` pinned: the element's own transition, then where it was going. */
function restoreFrozen(f: { el: HTMLElement; transform: string; left: string; top: string; transition: string }) {
  void f.el.offsetWidth;
  f.el.style.transition = f.transition;
  f.el.style.transform = f.transform;
  f.el.style.left = f.left;
  f.el.style.top = f.top;
}
