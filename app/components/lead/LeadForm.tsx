"use client";

import { useEffect, useRef, useState } from "react";
import {
  LEAD_FORM_NOT_VERIFIED,
  LEAD_FORM_TOO_MANY,
  turnstileSiteKey,
  useTurnstile,
} from "@jdd/ui/turnstile";
import { PLAN_LABELS } from "@jdd/schema";
import { DEMO_TEL } from "@/app/data/demo-line";

/**
 * The interest form body: fields, the human check, and the POST to `/api/lead`.
 *
 * Lifted out of the old Get Started slide-over on 19 Nov 2026 so the /contact page could show the
 * same form without a second copy. The slide-over is gone since the homepage redesign (Xander, 19
 * Nov 2026: every Get Started goes to /contact); the form now sits on two pages, /contact and the
 * homepage hero, and both send the visitor to /contact/thank-you. The abuse check (Cloudflare
 * Turnstile → `/api/lead`) and every approved word live here once.
 *
 * `onSuccess` is handed the business name the visitor typed, for the message that follows.
 * `autoFocus` puts the cursor in the first field on mount; it defaults off, since a form on a page
 * the visitor scrolled to should not steal the cursor.
 * `look` picks the drawing. "panel" is the boxed fields /contact has always had. "slip" is the
 * homepage hero's (approved from the homepage mockup): ruled blanks and the three plans in one row,
 * styled by `.hp-slip` in globals.css. The words, fields and behaviour are identical in both.
 */

/* The hints were written before the 2026-10 reprice and said the opposite of the product
   twice: that Starter has no receptionist, and that its leads arrive by email. Every plan
   has the receptionist and every lead lands in the portal; what Growth adds is the
   callback, the calendar and texting (copy batch H5, 2026-11-25: the pipeline moved down to
   Starter + AI). The `starter` option's name is PLAN_LABELS', never the id: the id `starter`
   is shown as "Starter + AI Receptionist". */
const PLANS: { slug: "starter" | "growth" | "enterprise"; label: string; hint: string }[] = [
  { slug: "starter", label: PLAN_LABELS.starter.name, hint: "Site, receptionist, lead inbox" },
  { slug: "growth", label: "Growth", hint: "+ callbacks, calendar and texting" },
  { slug: "enterprise", label: "Enterprise", hint: "Multiple locations" },
];

export default function LeadForm({
  onSuccess,
  autoFocus = false,
  look = "panel",
}: {
  onSuccess: (businessName: string) => void;
  autoFocus?: boolean;
  look?: "panel" | "slip";
}) {
  const slip = look === "slip";
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [planInterest, setPlanInterest] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstile = useTurnstile(turnstileSiteKey());
  /* The widget is invisible for nearly everyone, an empty block in a column spaced by `gap`, which
     would double the space above Send. Pulled up by one gap while empty; given it back when
     Cloudflare shows its checkbox. */
  const [widgetShown, setWidgetShown] = useState(false);
  const turnstileSlot = turnstile.containerRef;
  useEffect(() => {
    const el = turnstileSlot.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidgetShown(el.offsetHeight > 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, [turnstileSlot]);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) firstFieldRef.current?.focus();
  }, [autoFocus]);

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
      // No token in time, or a widget that couldn't run, still sends: the lead is kept, marked
      // unverified. With no site key (local development) the form sends exactly as it did.
      const { token: turnstileToken, widgetError } = await turnstile.takeToken();
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessName,
          phone,
          planInterest,
          note,
          ...(turnstileToken ? { turnstileToken } : {}),
          ...(!turnstileToken && (widgetError || !turnstileSiteKey()) ? { turnstileStatus: "error" } : {}),
        }),
      });
      if (!res.ok) {
        // Cloudflare accepts each token once: the next try needs a fresh one.
        turnstile.reset();
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 403 && data.error === "not-verified") setError(LEAD_FORM_NOT_VERIFIED);
        else if (res.status === 429 && data.error === "too-many") setError(LEAD_FORM_TOO_MANY);
        else setError(data.error || "Something went wrong. Try again, or just call us.");
        return;
      }
      onSuccess(businessName.trim());
    } catch {
      turnstile.reset();
      setError("Couldn't reach us just now. Try again, or give us a call.");
    } finally {
      setBusy(false);
    }
  }

  const label = (text: string) => (
    <span className="kicker" style={slip ? undefined : { display: "block", marginBottom: 7 }}>
      {text}
    </span>
  );

  const fieldStyle: React.CSSProperties | undefined = slip
    ? undefined
    : {
        boxSizing: "border-box",
        width: "100%",
        padding: "12px 14px",
        borderRadius: 8,
        border: "1px solid",
        fontSize: 15,
        fontFamily: "inherit",
      };
  /* The slip look draws each field with `.hp-slip` classes instead of the panel's inline styles. */
  const fieldClass = slip ? "hp-field" : undefined;
  const inputClass = slip ? "hp-in" : undefined;

  return (
    <form onSubmit={submit} className={slip ? "hp-form" : undefined} style={slip ? undefined : { display: "flex", flexDirection: "column", gap: 18 }}>
      <div className={fieldClass}>
        {label("Your name")}
        <input
          ref={firstFieldRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alex Juneau"
          autoComplete="name"
          maxLength={120}
          className={inputClass}
          style={fieldStyle}
        />
      </div>

      <div className={fieldClass}>
        {label("Business name")}
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Juneau Plumbing & Heating"
          autoComplete="organization"
          maxLength={120}
          className={inputClass}
          style={fieldStyle}
        />
      </div>

      <div className={fieldClass}>
        {label("Best number to reach you")}
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 123-4567"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          className={inputClass}
          style={fieldStyle}
        />
      </div>

      <div className={fieldClass}>
        {label("Interested in")}
        <div className={slip ? "hp-plans" : undefined} style={slip ? undefined : { display: "flex", flexDirection: "column", gap: 8 }}>
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
                className={slip ? "hp-plan" : undefined}
                style={slip ? undefined : {
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
                <span style={slip ? undefined : { fontWeight: 700 }}>{p.label}</span>
                <span style={slip ? undefined : { fontSize: 13, color: "var(--fg-3)" }}>{p.hint}</span>
              </button>
            );
          })}
        </div>
        <p className={slip ? "hp-skip" : undefined} style={slip ? undefined : { fontSize: 12, color: "var(--fg-3)", marginTop: 8 }}>
          Not sure? Skip it. We&apos;ll figure it out together.
        </p>
      </div>

      <div className={fieldClass}>
        {label("Anything else? (optional)")}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="How many calls do you miss in a week?"
          rows={slip ? 2 : 3}
          maxLength={1000}
          className={inputClass}
          style={slip ? undefined : { ...fieldStyle, resize: "vertical" }}
        />
      </div>

      {/* The human check. Empty for nearly everyone; a visitor Cloudflare is unsure of
          sees one checkbox here, worded by Cloudflare. */}
      <div ref={turnstile.containerRef} style={{ marginTop: widgetShown ? 0 : slip ? -15 : -18 }} />

      {error && (
        <p style={{ fontSize: 14, color: "var(--accent-2)", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn primary lg"
        disabled={busy}
        style={{ width: "100%", opacity: busy ? 0.6 : 1, ...(slip ? { boxShadow: "0 0 32px var(--accent-glow)" } : {}) }}
      >
        {busy ? "Sending…" : "Send"}
      </button>

      <p className={slip ? "hp-agent" : undefined} style={slip ? undefined : { fontSize: 12, color: "var(--fg-3)", textAlign: "center", margin: 0 }}>
        Rather just hear it work?{" "}
        <a href={DEMO_TEL} style={slip ? undefined : { color: "var(--accent-2)" }}>
          Call the agent
        </a>
        .
      </p>
    </form>
  );
}
