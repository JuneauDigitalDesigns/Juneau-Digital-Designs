"use client";

import { useEffect, useRef } from "react";
import DetailIcon from "./DetailIcon";

/**
 * "Your phone": the top of the owner's handset with the text they get when a lead lands, as on the
 * homepage's "And nothing slips" section. It buzzes once as it is scrolled into view. The words are
 * the first two lines of the real post-call text. Approved from the mockup, round 2 (Xander, 25 Nov
 * 2026), in place of the line "Then you get a text saying it's there."
 */
export default function DetailPhone() {
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
        <div className="detail-fone" ref={ref} role="img" aria-label="Example: the text you get, shown on your phone">
            <p className="detail-fone-lbl">Your phone</p>
            <i className="detail-arc l" />
            <i className="detail-arc l2" />
            <i className="detail-arc r" />
            <i className="detail-arc r2" />
            <div className="detail-fone-body">
                <div className="detail-fone-top" aria-hidden="true">
                    <span>2:47</span>
                    <i />
                    <span className="detail-fone-sig">
                        <b />
                        <b />
                        <b />
                    </span>
                </div>
                <div className="detail-sms">
                    <span className="detail-sms-app">
                        <DetailIcon name="msg" />
                    </span>
                    <p className="detail-sms-l1">
                        <span>Messages</span>
                        <span>now</span>
                    </p>
                    <p className="detail-sms-l2">
                        <b>New call lead in your portal</b>Name: Noel Bautista&hellip;
                    </p>
                </div>
            </div>
        </div>
    );
}
