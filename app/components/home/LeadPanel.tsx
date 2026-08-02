"use client";
/* Z-index constants: navbar 50 | grain 60 | modals 70 — this is a modal surface. */

import { useEffect, useRef, useState } from "react";

/**
 * The hero's interest form, as a slide-over.
 *
 * A panel rather than a centered modal on purpose: the page stays visible behind it, so
 * submitting this reads as "adding a note to the conversation you were already having"
 * rather than being yanked out of the page. The hero pitch is still on screen while they
 * type, which is the thing that convinced them to open it.
 *
 * It only submits a lead. It does NOT ring anyone — the demo agent is a separate CTA the
 * visitor dials themselves at the bottom of the page.
 */

const PLANS: { slug: "starter" | "growth" | "enterprise"; label: string; hint: string }[] = [
  { slug: "starter", label: "Starter", hint: "Site + email leads" },
  { slug: "growth", label: "Growth", hint: "+ AI receptionist" },
  { slug: "enterprise", label: "Enterprise", hint: "Multiple locations" },
];

export default function LeadPanel({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [planInterest, setPlanInterest] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  // Mount at translateX(100%) then flip on the next frame, so the panel animates in
  // rather than appearing already open.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    firstFieldRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Don't let the page scroll behind the panel.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!name.trim() || !businessName.trim() || !phone.trim()) {
      setError("Name, business, and a phone number, please.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, businessName, phone, planInterest, note }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || "Something went wrong. Try again, or just call us.");
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't reach us just now. Try again, or give us a call.");
    } finally {
      setBusy(false);
    }
  }

  const label = (text: string) => (
    <span className="kicker" style={{ display: "block", marginBottom: 7 }}>
      {text}
    </span>
  );

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 15,
    fontFamily: "inherit",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70 }} aria-hidden={false}>
      {/* Backdrop — click to dismiss. */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(10, 9, 6, 0.55)",
          backdropFilter: "blur(3px)",
          opacity: shown ? 1 : 0,
          transition: "opacity 260ms ease",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tell us about your business"
        className="no-scrollbar"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(460px, 100vw)",
          background: "var(--bg)",
          borderLeft: "1px solid var(--rule)",
          boxShadow: "-24px 0 64px rgba(0,0,0,.28)",
          overflowY: "auto",
          transform: shown ? "translateX(0)" : "translateX(100%)",
          transition: "transform 320ms cubic-bezier(.22,1,.36,1)",
        }}
      >
        <div style={{ padding: "clamp(24px,4vw,38px)" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              background: "none",
              border: "none",
              color: "var(--fg-3)",
              fontSize: 26,
              lineHeight: 1,
              cursor: "pointer",
              padding: 4,
            }}
          >
            &times;
          </button>

          {done ? (
            <div style={{ paddingTop: 40 }}>
              <p className="kicker" style={{ color: "var(--accent-2)", marginBottom: 18 }}>
                Got it
              </p>
              <h2
                style={{
                  fontWeight: 900,
                  fontSize: "clamp(30px,5vw,44px)",
                  lineHeight: 0.95,
                  textTransform: "uppercase",
                  marginBottom: 18,
                }}
              >
                We&apos;ll be
                <br />
                in touch.
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--fg-2)", marginBottom: 30 }}>
                Someone will reach out about {businessName.trim() || "your business"} shortly.
                In the meantime, the fastest way to understand what we do is to hear it.
              </p>
              <a href="tel:+19302221343" className="btn primary" style={{ marginRight: 10 }}>
                &#9742; Call the agent
              </a>
              <button type="button" onClick={onClose} className="btn ghost">
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="kicker" style={{ color: "var(--accent-2)", marginBottom: 14 }}>
                Tell us about you
              </p>
              <h2
                style={{
                  fontWeight: 900,
                  fontSize: "clamp(28px,4.6vw,40px)",
                  lineHeight: 0.95,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                Let&apos;s talk.
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--fg-2)", marginBottom: 26 }}>
                A few details and we&apos;ll come back to you with what this would look like for
                your business. No obligation, no pressure.
              </p>

              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  {label("Your name")}
                  <input
                    ref={firstFieldRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Juneau"
                    autoComplete="name"
                    maxLength={120}
                    style={fieldStyle}
                  />
                </div>

                <div>
                  {label("Business name")}
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Juneau Plumbing & Heating"
                    autoComplete="organization"
                    maxLength={120}
                    style={fieldStyle}
                  />
                </div>

                <div>
                  {label("Best number to reach you")}
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    style={fieldStyle}
                  />
                </div>

                <div>
                  {label("Interested in")}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {PLANS.map((p) => {
                      const active = planInterest === p.slug;
                      return (
                        <button
                          key={p.slug}
                          type="button"
                          // Second click clears it — nobody should be stuck having picked
                          // a tier they were only curious about.
                          onClick={() => setPlanInterest(active ? null : p.slug)}
                          aria-pressed={active}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 10,
                            width: "100%",
                            textAlign: "left",
                            padding: "11px 14px",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 15,
                            color: active ? "var(--accent-2)" : "var(--fg)",
                            background: active ? "var(--accent-glow)" : "var(--surface)",
                            border: `1px solid ${active ? "var(--accent-2)" : "var(--rule-strong)"}`,
                            transition: "all 140ms ease",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{p.label}</span>
                          <span style={{ fontSize: 13, color: "var(--fg-3)" }}>{p.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 8 }}>
                    Not sure? Skip it — we&apos;ll figure it out together.
                  </p>
                </div>

                <div>
                  {label("Anything else? (optional)")}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="How many calls do you miss in a week?"
                    rows={3}
                    maxLength={1000}
                    style={{ ...fieldStyle, resize: "vertical" }}
                  />
                </div>

                {error && (
                  <p style={{ fontSize: 14, color: "var(--accent-2)", margin: 0 }} role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn primary lg"
                  disabled={busy}
                  style={{ width: "100%", opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? "Sending…" : "Send it over"}
                </button>

                <p style={{ fontSize: 12, color: "var(--fg-3)", textAlign: "center", margin: 0 }}>
                  Rather just hear it work?{" "}
                  <a href="tel:+19302221343" style={{ color: "var(--accent-2)" }}>
                    Call the agent
                  </a>
                  .
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
