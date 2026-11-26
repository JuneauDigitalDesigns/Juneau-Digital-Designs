"use client";

import { useEffect, useRef } from "react";
import RfIcon from "./RfIcon";

/**
 * "Your phone": the top of the owner's handset with the text they get when a lead lands, as on the
 * homepage's "And nothing slips" section. It buzzes once as it is scrolled into view. The words are
 * the first two lines of the real post-call text. Approved from the mockup (Xander, 25 Nov 2026).
 */
export default function RfPhone() {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver !== "function") return;
        if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const seen = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        el.classList.add("buzz");
                        seen.disconnect();
                    }
                });
            },
            { threshold: 0.8 },
        );
        seen.observe(el);
        return () => seen.disconnect();
    }, []);

    return (
        <div className="rf-fone" ref={ref} role="img" aria-label="Example: the text you get, shown on your phone">
            <p className="rf-fone-lbl">Your phone</p>
            <i className="rf-arc l" />
            <i className="rf-arc l2" />
            <i className="rf-arc r" />
            <i className="rf-arc r2" />
            <div className="rf-fone-body">
                <div className="rf-fone-top" aria-hidden="true">
                    <span>6:48</span>
                    <i />
                    <span className="rf-fone-sig">
                        <b />
                        <b />
                        <b />
                    </span>
                </div>
                <div className="rf-sms">
                    <span className="rf-sms-app">
                        <RfIcon name="msg" />
                    </span>
                    <p className="rf-sms-l1">
                        <span>Messages</span>
                        <span>now</span>
                    </p>
                    <p className="rf-sms-l2">
                        <b>New call lead in your portal</b>Name: Dave Kowalski&hellip;
                    </p>
                </div>
            </div>
        </div>
    );
}
