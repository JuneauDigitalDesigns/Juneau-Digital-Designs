"use client";
/* Z-index constants: navbar 50 | grain 60 | modals 70 — this is a modal surface. */

import { useEffect, useState } from "react";
import LeadForm from "../lead/LeadForm";
import { DEMO_TEL } from "@/app/data/demo-line";

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
 *
 * The form itself is `LeadForm` (shared with the /contact page since 19 Nov 2026), so the
 * fields, the Cloudflare human check and every approved word live there once. This file is the
 * slide-over around it: the backdrop, the scroll lock, the close button, and the "We'll be in
 * touch" state a successful send shows here in place (the /contact page sends the visitor to a
 * thank-you page instead — that is the one thing the two do differently).
 */

export default function LeadPanel({ onClose }: { onClose: () => void }) {
  const [done, setDone] = useState(false);
  const [doneBusiness, setDoneBusiness] = useState("");

  // Mount at translateX(100%) then flip on the next frame, so the panel animates in
  // rather than appearing already open.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    /* Don't let the page scroll behind the panel. On <html>, not <body>: globals.css gives
       <html> `overflow-x: hidden`, which makes it the page's scroller, so a lock on <body>
       never held — the page scrolled behind the backdrop all along. Locking <html> also
       pauses Lenis, which watches that element's overflow (`autoToggle` in SmoothScroll). */
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
    };
  }, [onClose]);

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
        /* The sheet scrolls itself. Without this Lenis takes the wheel over it and scrolls
           the page behind the panel instead. */
        data-lenis-prevent
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
          overflowX: "hidden",
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
                Someone will reach out about {doneBusiness || "your business"} shortly.
                In the meantime, the fastest way to understand what we do is to hear it.
              </p>
              <a href={DEMO_TEL} className="btn primary" style={{ marginRight: 10 }}>
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

              <LeadForm
                autoFocus
                onSuccess={(business) => {
                  setDoneBusiness(business);
                  setDone(true);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
