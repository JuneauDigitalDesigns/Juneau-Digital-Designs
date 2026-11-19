"use client";

import { useState } from "react";
import ClosingAsk from "./home/ClosingAsk";
import LeadPanel from "./home/LeadPanel";

/**
 * A page's closing ask: the homepage's two asks, with the same lead form behind Get Started.
 *
 * Was `components/faq/FaqAsk.tsx`, which only /faq used. /about closes on the same two asks, so
 * the one component now takes the class its page styles it with rather than being copied.
 */
export default function PageAsk({ className }: { className: string }) {
  const [formOpen, setFormOpen] = useState(false);
  return (
    <>
      <ClosingAsk onOpenForm={() => setFormOpen(true)} className={className} />
      {formOpen && <LeadPanel onClose={() => setFormOpen(false)} />}
    </>
  );
}
