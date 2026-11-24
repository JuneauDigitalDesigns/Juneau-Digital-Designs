"use client";

import { useEffect, useState } from "react";
import SvcIcon from "./SvcIcon";
import { TEXT_PREVIEW } from "@/app/components/home/LeadLands";

/**
 * /crm: the top of the owner's handset, labelled "Your phone", buzzing each time a lead lands.
 * The text on it is the homepage's `TEXT_PREVIEW`, the first two lines of the real lead text, so
 * it can never read nicer than the one the owner gets.
 */
export default function LeadPhone() {
    const [buzz, setBuzz] = useState(0);
    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const t = window.setInterval(() => setBuzz((n) => n + 1), 5200);
        return () => window.clearInterval(t);
    }, []);
    return (
        <div key={buzz} className={`svc-fone${buzz ? " buzz" : ""}`}>
            <p className="svc-fone-lbl">Your phone</p>
            <span className="svc-arc l" aria-hidden="true" />
            <span className="svc-arc r" aria-hidden="true" />
            <span className="svc-arc l2" aria-hidden="true" />
            <span className="svc-arc r2" aria-hidden="true" />
            <div className="svc-fone-body">
                <div className="svc-fone-top" aria-hidden="true">
                    <span>9:41</span>
                    <i />
                    <span className="svc-fone-sig">
                        <b />
                        <b />
                        <b />
                    </span>
                </div>
                <div className="svc-sms" role="img" aria-label={`Example text to your phone: ${TEXT_PREVIEW.title}. ${TEXT_PREVIEW.line}`}>
                    <span className="svc-sms-app">
                        <SvcIcon name="msg" />
                    </span>
                    <p className="svc-sms-l1">
                        <span>Messages</span>
                        <span>now</span>
                    </p>
                    <p className="svc-sms-l2">
                        <b>{TEXT_PREVIEW.title}</b>
                        {TEXT_PREVIEW.line}
                    </p>
                </div>
            </div>
        </div>
    );
}
