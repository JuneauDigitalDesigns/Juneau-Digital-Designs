"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useReducedMotion, AnimatePresence, motion } from "framer-motion";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { FILM_CALL, FILM_SITE, type CallScenario } from "@/app/data/switchboard-calls";

/**
 * The two-act film, retold on 9 Nov 2026 (approved by Xander from a mockup).
 *
 * Act 1 is what the customer experiences: Dave is on Your HVAC Co.'s website (the real growth
 * template, the same site the laptop above shows), taps "Book a Free Estimate", fills in the
 * form, ticks the call consent and sends it. About a minute later, on Growth, the AI rings
 * him back. Act 2 is the owner's side: the post-call text, then the lead waiting in the Inbox.
 *
 * Three things are load-bearing:
 *
 * 1. It opens on the website, the real one. Every keystroke, tick and click lands on the
 *    screenshot's own fields (positions in `FILM_SITE`, measured from the live page).
 * 2. The callback is a Growth feature, and the film says so: the card between the form and
 *    the call reads "About a minute later" with an "On Growth" tag. "About a minute" matches
 *    the Growth card and the contract's "typically within sixty (60) seconds". Don't drop the
 *    tag: this section sits under "Then someone picks up.", which every plan gets.
 * 3. Act 2 shows real messages and real places, never invented ones. The text is the
 *    post-call brief in its actual shape (see `postCallBrief`), from JDD's notification
 *    sender, arriving after the call ends — which is when it sends. And the film ends in
 *    the Inbox, not on the pipeline: in CRM v2 a lead only becomes a pipeline card when the
 *    owner promotes them, so a lead landing on the board by itself would be a claim the
 *    product doesn't keep.
 *
 * It used to open on a drawn mock site, rotate five made-up businesses per replay, and show
 * the owner's phone ringing unanswered before the AI picked up. A web form doesn't ring the
 * owner, so that beat went with the switch to the form.
 */

type Phase =
  | "idle"
  | "act1card"
  | "browse"
  | "later"
  | "ringIn"
  | "call"
  | "act2card"
  | "text"
  | "portalcard"
  | "inbox"
  | "recap";

/* ~34s total. The pauses are what make it read as real — resist tightening them. The pause
   after the form is sent (`SITE_DONE` to the end of `browse`, then the "later" card) was asked
   for: the callback arriving instantly read as too quick. */
const T = {
  act1card: 1600,
  browse: 10600,
  later: 2200,
  ringIn: 2600,
  callLine: 2000,
  callRest: 1200,
  act2card: 1800,
  text: 4000,
  portalcard: 1400,
  inbox: 1800,
};

/* The call beat runs ~7s but represents a real call of about a minute and a half. Driving the
   on-screen timer from progress rather than wall clock keeps the clock believable. */
const CALL_REPRESENTS_SEC = 94;

const CUSTOMER_PHASES: Phase[] = ["idle", "act1card", "browse", "later", "ringIn", "call"];

function fmtTimer(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ── Act 1 · the website, and the form ───────────────────────── */

type Box = { x: number; y: number; w: number; h: number };
const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

interface SiteState {
  scroll: number;
  cursor: { x: number; y: number; on: boolean };
  clicks: number;
  pressed: "hero" | "submit" | null;
  focus: "name" | "phone" | null;
  name: string;
  phone: string;
  ticked: boolean;
}

const SITE_START: SiteState = {
  scroll: 0,
  cursor: { x: 320, y: 760, on: false },
  clicks: 0,
  pressed: null,
  focus: null,
  name: "",
  phone: "",
  ticked: false,
};

/**
 * The growth site on the customer's phone, at its real 390px layout, scaled to the screen.
 *
 * `play` runs the sequence once: the cursor clicks the hero's "Book a Free Estimate", the page
 * scrolls to the form, the name and number are typed in, consent is ticked, and the form is
 * sent. It ends on the sent form; the panel's own timeline moves on from there.
 */
function SiteFormScreen({ play }: { play: boolean }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0.72, h: 750 });
  const [st, setSt] = useState<SiteState>(SITE_START);

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

  useEffect(() => {
    if (!play) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const set = (patch: Partial<SiteState> | ((s: SiteState) => Partial<SiteState>)) =>
      setSt((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
    const moveTo = (p: { x: number; y: number }) => set((s) => ({ cursor: { x: p.x, y: p.y - s.scroll, on: true } }));
    const click = () => set((s) => ({ clicks: s.clicks + 1 }));
    const type = (field: "name" | "phone", text: string, start: number) => {
      at(start - 200, () => set({ focus: field }));
      for (let i = 1; i <= text.length; i++) at(start + i * 70, () => set({ [field]: text.slice(0, i) } as Partial<SiteState>));
      at(start + text.length * 70 + 300, () => set({ focus: null }));
    };
    const hero = centre(FILM_SITE.heroEstimate);
    const name = centre(FILM_SITE.name);
    const phone = centre(FILM_SITE.phone);
    const consent = centre(FILM_SITE.consent);
    const submit = centre(FILM_SITE.submit);

    setSt(SITE_START);
    at(500, () => moveTo(hero));
    at(1500, () => { click(); set({ pressed: "hero" }); });
    at(1900, () => set({ pressed: null }));
    // The cursor stays where it is on screen while the page moves under it.
    at(2100, () => set({ scroll: FILM_SITE.formScroll }));
    at(3300, () => moveTo({ x: name.x - 45, y: name.y }));
    at(4100, click);
    type("name", FILM_CALL.caller.name, 4300);
    at(5500, () => moveTo({ x: phone.x - 45, y: phone.y }));
    at(6200, click);
    type("phone", FILM_CALL.ownerMessage.callback, 6400);
    at(7700, () => moveTo(consent));
    at(8400, () => { click(); set({ ticked: true }); });
    at(8900, () => moveTo(submit));
    at(9600, () => { click(); set({ pressed: "submit" }); });
    at(10100, () => set({ pressed: null }));
    at(10400, () => set((s) => ({ cursor: { ...s.cursor, on: false } })));
    return () => timers.forEach(clearTimeout);
  }, [play]);

  const box = (b: Box): React.CSSProperties => ({ left: b.x, top: b.y, width: b.w, height: b.h });

  return (
    <div ref={screenRef} className="film-site">
      <div className="film-site-vp" style={{ transform: `scale(${fit.scale})`, height: fit.h }}>
        <div className="film-site-page" style={{ transform: `translateY(${-st.scroll}px)` }}>
          {/* Plain <img>, not next/image: the overlays map 1:1 onto the capture's 390px
              geometry, and the optimizer would resample it. The asset is a sized webp. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FILM_SITE.src} alt="" width={FILM_SITE.width} height={FILM_SITE.height} draggable={false} />
          <span className="film-press" data-on={st.pressed === "hero"} style={box(FILM_SITE.heroEstimate)} />
          <span className="film-typed" data-focus={st.focus === "name"} style={box(FILM_SITE.name)}>{st.name}</span>
          <span className="film-typed" data-focus={st.focus === "phone"} style={box(FILM_SITE.phone)}>{st.phone}</span>
          <span className="film-tick" data-on={st.ticked} style={box(FILM_SITE.consent)} />
          <span className="film-press" data-on={st.pressed === "submit"} style={box(FILM_SITE.submit)} />
        </div>
        <span className="film-cursor" data-on={st.cursor.on} style={{ left: st.cursor.x, top: st.cursor.y }}>
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
            <path d="M4 2.5 L4 19 L8.6 14.8 L11.6 21.5 L14.4 20.3 L11.5 13.7 L17.8 13.7 Z" fill="#0d1117" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          {/* Keyed on the click count, so each click replays the ring. */}
          {st.clicks > 0 && <i key={st.clicks} className="film-cursor-ring" />}
        </span>
      </div>
    </div>
  );
}

/* ── Act 1 · the business rings him back ─────────────────────── */
function CallbackScreen({ scenario }: { scenario: CallScenario }) {
  return (
    <div style={{ background: "linear-gradient(165deg, #1d2430 0%, #131820 100%)", color: "#fff", height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div className="phone-ring-pulse" style={{ width: 84, height: 84, borderRadius: 999, background: "#b4472b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 27, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          YH
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>{scenario.businessName}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 5 }}>Incoming Call</div>
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

/* ── Act 2 · the text ────────────────────────────────────────── */

/**
 * The post-call brief, in the shape the real one has.
 *
 * Template from /sms-terms ("A typical call summary reads"), which is kept byte-identical
 * to what the Make post-call scenario sends:
 *   Juneau Digital Designs call alert: Callback requested. New lead Maria Alvarez,
 *   callback (930) 555-0117. Reply STOP to opt out.
 * If that sample changes, this changes with it. The film shows the message the owner
 * actually gets, never a nicer one.
 */
function postCallBrief(sc: CallScenario): string {
  return `Juneau Digital Designs call alert: ${sc.ownerMessage.reason}. New lead ${sc.caller.name}, callback ${sc.ownerMessage.callback}. Reply STOP to opt out.`;
}

/* The sender is JDD, not "AI Receptionist": the brief is an account-lane message from
   JDD's notification number to the owner (Program One on /sms-terms). */
const SENDER = "Juneau Digital Designs";

function OwnerTextScreen({ scenario }: { scenario: CallScenario }) {
  return (
    <div style={{ background: "#f2f2f7", height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ background: "rgba(242,242,247,0.97)", padding: "38px 16px 10px", borderBottom: "0.5px solid rgba(0,0,0,0.15)", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#000" }}>{SENDER}</div>
        <div style={{ fontSize: 11, color: "#007AFF", marginTop: 1 }}>text message</div>
      </div>

      <div style={{ flex: 1, padding: "18px 16px 24px", display: "flex", flexDirection: "column" }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, maxWidth: "88%" }}
        >
          <div style={{ background: "#e5e5ea", borderRadius: "18px 18px 18px 4px", padding: "11px 14px", color: "#000", fontSize: 13, lineHeight: 1.45 }}>
            {postCallBrief(scenario)}
          </div>
          <div style={{ fontSize: 10, color: "rgba(0,0,0,0.33)", paddingLeft: 4 }}>
            {SENDER} · {scenario.callTime}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Act 2 · the Inbox ───────────────────────────────────────── */

/**
 * Where the brief points: the portal's Inbox on the owner's phone, with this lead on top.
 *
 * The Inbox rather than the pipeline, because that is where a lead lands on every plan;
 * the pipeline only holds leads the owner has promoted. The new row carries the website
 * form's icon, since that is how Dave came in (the portal demo below shows him the same
 * way). The two rows under it are deliberately blank bars with a source icon, so the beat
 * says "every door leads here" without inventing a second customer to read.
 */
function InboxScreen({ scenario }: { scenario: CallScenario }) {
  const ghost = (icon: string, key: string) => (
    <div key={key} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 12px", borderBottom: "1px solid rgba(20,18,12,0.07)", opacity: 0.55 }}>
      <div style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(20,18,12,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ height: 7, width: "48%", borderRadius: 4, background: "rgba(20,18,12,0.14)" }} />
        <div style={{ height: 6, width: "78%", borderRadius: 4, background: "rgba(20,18,12,0.08)" }} />
      </div>
    </div>
  );

  return (
    <div style={{ background: "#f6f3ea", color: "#14120c", height: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ padding: "40px 14px 10px", display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid rgba(20,18,12,0.1)" }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Inbox</div>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7a715a" }}>Your portal</div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 12px", background: "#fffdf5", borderBottom: "1px solid rgba(20,18,12,0.1)", boxShadow: "inset 3px 0 0 #d2542f" }}
      >
        <div style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(20,18,12,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>✉</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{scenario.caller.name}</span>
            <span style={{ fontSize: 9.5, color: "#7a715a" }}>{scenario.callTime}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#43402c", marginTop: 2 }}>{scenario.ownerMessage.summary}</div>
          <div style={{ fontSize: 10.5, color: "#7a715a", marginTop: 2 }}>{scenario.ownerMessage.reason} · {scenario.ownerMessage.callback}</div>
        </div>
      </motion.div>

      {ghost("☎", "call")}
      {ghost("✉", "web")}
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
export default function SiteToCallPanel() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [lineIdx, setLineIdx] = useState(-1);
  const [seconds, setSeconds] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenario = FILM_CALL;
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

  /* Nothing but a click calls this. An effect that started the film ran it on every mount
     under StrictMode, so the film played itself with nobody having pressed anything. */
  const run = useCallback(() => {
    clearAll();
    setLineIdx(-1);
    setSeconds(0);

    const lines = scenario.transcript.length;
    const callMs = lines * T.callLine + T.callRest;
    let t = 0;

    setPhase("act1card");

    t += T.act1card;
    at(() => setPhase("browse"), t);

    t += T.browse;
    at(() => setPhase("later"), t);

    t += T.later;
    at(() => setPhase("ringIn"), t);

    t += T.ringIn;
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
    at(() => setPhase("text"), t);

    t += T.text;
    at(() => setPhase("portalcard"), t);

    t += T.portalcard;
    at(() => setPhase("inbox"), t);

    t += T.inbox;
    at(() => setPhase("recap"), t);
  }, [at, clearAll, scenario]);

  function start() {
    if (reduce) { setPhase("recap"); return; }
    run();
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
                  <SiteFormScreen play={false} />
                </div>
              </motion.div>
            )}

            {(phase === "browse" || phase === "later") && (
              <motion.div key="browse" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <SiteFormScreen play />
              </motion.div>
            )}

            {phase === "ringIn" && (
              <motion.div key="ringIn" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <CallbackScreen scenario={scenario} />
              </motion.div>
            )}

            {phase === "call" && (
              <motion.div key="call" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <CallScreen scenario={scenario} lineIdx={lineIdx} seconds={seconds} />
              </motion.div>
            )}

            {(phase === "text" || phase === "portalcard") && (
              <motion.div key="text" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <OwnerTextScreen scenario={scenario} />
              </motion.div>
            )}

            {(phase === "inbox" || phase === "recap") && (
              <motion.div key="inbox" className="phone-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
                <InboxScreen scenario={scenario} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === "act1card" && <StageCard key="c1" label="What your customer sees" />}
            {/* Approved word for word. The tag is load-bearing: see point 2 at the top. */}
            {phase === "later" && <StageCard key="c2" label="About a minute later" sub="On Growth" />}
            {phase === "act2card" && <StageCard key="c3" label="Meanwhile, on your phone" sub={`Same call · ${scenario.callTime}`} />}
            {phase === "portalcard" && <StageCard key="c4" label="In your portal" />}
          </AnimatePresence>
        </div>

        {/* Whose phone this is, readable before the card is even parsed. A switch naming
            both, with the one on screen lit, rather than a lone caption: it tells the
            visitor up front that the story has two sides. Always rendered, so it costs no
            height when it changes; nothing is lit before the film starts. */}
        <p className="film-switch">
          <span aria-current={phase !== "idle" && isCustomerPhone ? "true" : undefined}>Their phone</span>
          <span aria-current={phase !== "idle" && !isCustomerPhone ? "true" : undefined}>Your phone</span>
        </p>

        {/* Both controls live in `.film-gate`, which is `position: absolute; inset: 0`
            and therefore contributes NO height. That is the whole point: the stage is the
            same height at idle, mid-film and at the end. If you reintroduce anything
            post-film, it has to be an overlay, not a sibling. */}
        {phase === "idle" && (
          <div className="film-gate">
            <div className="film-gate-stack">
              {/* Explains why a film about a phone receptionist opens on a website. */}
              <p className="film-gate-line">A customer finds you online.</p>
              <button type="button" onClick={start} className="btn primary lg film-gate-btn" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>
                Show me how it works
              </button>
            </div>
          </div>
        )}

        {/* Bottom-anchored, not centred like the gate: the final screen is the Inbox with
            the new lead at the top, which is the payoff the film exists to deliver.
            Centring this would cover it. */}
        {showRecap && (
          <div className="film-gate film-gate--replay">
            <button type="button" onClick={start} className="btn ghost film-replay-btn">
              <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
              Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
