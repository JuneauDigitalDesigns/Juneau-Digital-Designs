"use client";

import Link from "next/link";
import { useState } from "react";
import LeadPanel from "../home/LeadPanel";

/**
 * /hvac's first two asks, under the heading: the same Get started form every page opens, and the
 * pricing page. The page's last asks are `PageAsk`, as on /about and /faq.
 */
export default function HvacStart() {
    const [formOpen, setFormOpen] = useState(false);
    return (
        <>
            <div className="hvac-acts">
                <button type="button" onClick={() => setFormOpen(true)} className="btn primary lg">
                    Get started
                </button>
                <Link href="/pricing" className="btn ghost lg">
                    View plans + pricing
                </Link>
            </div>
            {formOpen && <LeadPanel onClose={() => setFormOpen(false)} />}
        </>
    );
}
