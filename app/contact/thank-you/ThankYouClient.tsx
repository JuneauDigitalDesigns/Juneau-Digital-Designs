"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONTACT_STEPS } from "@/app/data/contact-steps";
import { DEMO_TEL, DEMO_TEL_DISPLAY } from "@/app/data/demo-line";
import { fireLeadConversion, takeLeadMarker } from "@/app/lib/lead-conversion";

/**
 * /contact/thank-you — where a sent form lands, and where the Google Ads lead conversion fires.
 *
 * Every word here was approved by Xander with the page (19 Nov 2026). The business name comes
 * from the marker the form left in the browser, never from the URL; someone who opens this page
 * without having sent the form sees "your business" and no conversion is counted.
 */
export default function ThankYouClient() {
  // Render the page the same for everyone first (server and first client paint), then fill in
  // the business name once the browser-only marker has been read. Reading it in an effect keeps
  // the markup identical across the hydration boundary.
  const [business, setBusiness] = useState<string | null>(null);

  useEffect(() => {
    const marker = takeLeadMarker();
    if (marker) {
      // The marker lives in sessionStorage, which can't be read during SSR, so the page first
      // paints "your business" for everyone (server and client markup match) and updates here.
      // The rule guards against cascading renders; a single mount read is the documented exception.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBusiness(marker.businessName || null);
      // Count the lead once. A no-op until the Ads tag is configured (app/data/google-ads.ts);
      // taking the marker above guarantees a refresh or a return visit never fires it again.
      fireLeadConversion();
    }
  }, []);

  return (
    <main className="contact-page">
      {/* 1 · The stamp and the message — the Get Started panel's own "We'll be in touch." words. */}
      <div className="ty-shell">
        <div className="ty-head">
          <span className="ty-stamp" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="ty-stamp-ic">
              <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="kicker ty-kicker">Got it</p>
          <h1 className="ty-h1">
            We&apos;ll be <span className="contact-coral">in touch.</span>
          </h1>
          <p className="ty-lede">
            Someone will reach out about <b>{business || "your business"}</b> shortly. In the meantime,
            the fastest way to understand what we do is to hear it.
          </p>
        </div>
      </div>

      {/* 2 · Where the visitor is in the sequence, the first step already done. */}
      <section className="wash">
        <div className="contact-shell">
          <div className="ty-here">
            <div>
              <h2 className="contact-h2">
                You&apos;re <span className="contact-coral">here.</span>
              </h2>
              <ol className="ty-track">
                <li className="ty-track-done">
                  <p className="ty-track-when">Done</p>
                  <h3 className="ty-track-h">You sent the form</h3>
                </li>
                {CONTACT_STEPS.map((step, i) => (
                  <li key={step.title} className={i === 0 ? "ty-track-next" : undefined}>
                    <p className="ty-track-when">{i === 0 ? "Next" : step.when ?? " "}</p>
                    <h3 className="ty-track-h">{step.title}</h3>
                    {i < 3 && <p>{step.detail}</p>}
                  </li>
                ))}
              </ol>
            </div>
            <div className="ty-wait">
              <h2 className="contact-h2">
                While you wait, <span className="contact-coral">hear it.</span>
              </h2>
              <p className="contact-lede">
                Call the demo line. The AI receptionist picks up, the way it would for your customers.
              </p>
              <a className="ty-demo" href={DEMO_TEL}>
                <span className="contact-wave" aria-hidden="true">
                  <i /><i /><i /><i /><i />
                </span>
                {DEMO_TEL_DISPLAY}
              </a>
              <div className="ty-onward">
                <a className="btn primary lg" href={DEMO_TEL}>
                  &#9742; Call the agent
                </a>
                <Link className="btn ghost lg" href="/">
                  Back to the homepage
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
