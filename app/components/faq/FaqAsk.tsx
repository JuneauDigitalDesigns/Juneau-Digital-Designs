"use client";

import { useState } from "react";
import ClosingAsk from "../home/ClosingAsk";
import LeadPanel from "../home/LeadPanel";

/** The /faq page's closing ask: the homepage's two asks, with the same lead form behind Get Started. */
export default function FaqAsk() {
  const [formOpen, setFormOpen] = useState(false);
  return (
    <>
      <ClosingAsk onOpenForm={() => setFormOpen(true)} className="faq-ask" />
      {formOpen && <LeadPanel onClose={() => setFormOpen(false)} />}
    </>
  );
}
