"use client";

import { useEffect, useRef } from "react";
import PwIcon from "./PwIcon";

/**
 * "Your phone": the top of the owner's handset with the text they get when a lead lands, as on the
 * homepage's "And nothing slips" section. It buzzes once as it is scrolled into view. The words are
 * the first two lines of the real post-call text. Approved from the mockup (Xander, 25 Nov 2026).
 */
export default function PwPhone() {
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
        <div className="pw-fone" ref={ref} role="img" aria-label="Example: the text you get, shown on your phone">
            <p className="pw-fone-lbl">Your phone</p>
            <i className="pw-arc l" />
            <i className="pw-arc l2" />
            <i className="pw-arc r" />
            <i className="pw-arc r2" />
            <div className="pw-fone-body">
                <div className="pw-fone-top" aria-hidden="true">
                    <span>11:02</span>
                    <i />
                    <span className="pw-fone-sig">
                        <b />
                        <b />
                        <b />
                    </span>
                </div>
                <div className="pw-sms">
                    <span className="pw-sms-app">
                        <PwIcon name="msg" />
                    </span>
                    <p className="pw-sms-l1">
                        <span>Messages</span>
                        <span>now</span>
                    </p>
                    <p className="pw-sms-l2">
                        <b>New call lead in your portal</b>Name: Dave Kowalski&hellip;
                    </p>
                </div>
            </div>
        </div>
    );
}
