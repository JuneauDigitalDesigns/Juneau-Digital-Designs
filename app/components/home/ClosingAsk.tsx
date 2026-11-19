import Link from "next/link";
import { DEMO_TEL, DEMO_TEL_DISPLAY } from "@/app/data/demo-line";

/**
 * A page's last ask: buy, or hear it first.
 *
 * Open, not boxed (9 Nov 2026): a rule above, then two halves, each with its own line of
 * copy, divided by a hairline; stacked and centred below 860px. The two actions are not the
 * same ask: one is "buy", the other is "check first". Sat side by side as bare buttons they read
 * as a primary and its fallback, and the fallback is the more persuasive of the two for anyone
 * still unsure, so each gets a sentence saying who it's for.
 *
 * Get Started goes to /contact, as every Get Started on the site does since the homepage
 * redesign (Xander, 19 Nov 2026); until then it opened a slide-over form.
 *
 * Shared by /faq, /about and /hvac through `PageAsk`. The homepage draws its own close
 * (`ClosingSection` in homepageclient.tsx). Layout is `.rail-cta*` in globals.css.
 */
export default function ClosingAsk({ className = "" }: { className?: string }) {
  return (
    <div className={`rail-cta ${className}`} id="cta">
      <div className="rail-cta-half">
        <p className="rail-cta-copy">
          <span className="rail-cta-lead">Get started.</span> Contact us now.
        </p>
        <div className="rail-cta-pair">
          <Link href="/contact" className="btn primary lg rail-cta-btn" style={{ boxShadow: "0 0 32px var(--accent-glow)" }}>
            Get Started
          </Link>
          <a href="/pricing" className="btn ghost rail-cta-btn">View plans + pricing</a>
        </div>
      </div>

      <div className="rail-cta-rule" aria-hidden="true" />

      <div className="rail-cta-half">
        <p className="rail-cta-copy">
          <span className="rail-cta-lead">Need to hear it first?</span> Call the demo.
        </p>
        {/* Keeps the ring pulse. Dialling the demo is still the single best thing a sceptic can
            do, and this is the last place on the page to offer it. */}
        <a href={DEMO_TEL} className="btn amber anim-ringpulse-slow rail-cta-tel">
          &#9742; {DEMO_TEL_DISPLAY}
        </a>
      </div>
    </div>
  );
}
