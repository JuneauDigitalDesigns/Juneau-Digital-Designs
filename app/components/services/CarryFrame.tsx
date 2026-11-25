"use client";

import Image from "next/image";
import { useRotator } from "./useRotator";

/**
 * /website-design, "What every site carries": the homepage's six points as a list you pick from,
 * with the real screen beside it in a browser frame.
 *
 * The screens are the Autobridge test site (a demo, with sample details), shot at desktop width on
 * 24 Nov 2026. The questions screen is shot with its answers closed: the first answer gives the
 * demo's street address with its state in it. The six headings and bodies are the homepage's,
 * word for word (point 01 without its Growth line, as approved).
 */
const POINTS: { heading: string; body: string; img: string; alt: string }[] = [
    {
        heading: "A form on the first screen",
        body: "Name and phone number, nothing else to fill in.",
        img: "/services/site-form.webp",
        alt: "The demo site's first screen, with a short form under the headline.",
    },
    {
        heading: "Your number, everywhere",
        body: "In the header, on the first screen and in the footer. On a phone, one tap calls you.",
        img: "/services/site-number.webp",
        alt: "The demo site's first screen, with the phone number on the main button and a call button in the header.",
    },
    {
        heading: "Your services, page by page",
        body: "A service gets its own page when you've told us enough to fill one.",
        img: "/services/site-services.webp",
        alt: "The demo site's services section, one card per service.",
    },
    {
        heading: "The towns you work in",
        body: "Listed on the site, with a page for a town when there's something real to say about it.",
        img: "/services/site-towns.webp",
        alt: "The demo site's service area, listing the towns the business works in.",
    },
    {
        heading: "Proof that's yours",
        body: "Photos from your real jobs and your business, your reviews, your certifications. We don't write reviews, and a section with nothing real in it stays off your site.",
        img: "/services/site-proof.webp",
        alt: "The demo site's reviews section, with sample reviews.",
    },
    {
        heading: "Your customers' questions",
        body: "Answered in your words, from what you tell us.",
        img: "/services/site-questions.webp",
        alt: "The demo site's questions section.",
    },
];

export const DEMO_TOWN_SITE = "https://autobridgedetailing.vercel.app";

export default function CarryFrame() {
    const [shown, pick] = useRotator(POINTS.length, 4200);
    return (
        <div className="svc-carry">
            <ol className="svc-carry-list" role="tablist" aria-label="What every site carries">
                {POINTS.map((p, i) => (
                    <li key={p.heading}>
                        <button type="button" role="tab" aria-selected={shown === i} onClick={() => pick(i)}>
                            <span className="svc-carry-n" aria-hidden="true">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>
                                <b>{p.heading}</b>
                                <span className="svc-carry-body">{p.body}</span>
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
            <div className="svc-carry-shot">
                <div className="svc-frame">
                    <div className="svc-frame-bar" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <span>{DEMO_TOWN_SITE.replace(/^https:\/\//, "")}</span>
                    </div>
                    <div className="svc-frame-view">
                        {POINTS.map((p, i) => (
                            <Image
                                key={p.img}
                                src={p.img}
                                alt={shown === i ? p.alt : ""}
                                aria-hidden={shown === i ? undefined : true}
                                width={800}
                                height={600}
                                sizes="(max-width: 1000px) 100vw, 640px"
                                className={shown === i ? "on" : undefined}
                            />
                        ))}
                        <span className="svc-frame-n" aria-hidden="true">
                            {String(shown + 1).padStart(2, "0")}
                        </span>
                    </div>
                </div>
                <div className="svc-frame-cap">
                    <span className="svc-eg">A demo site, with sample details.</span>
                    <a href={DEMO_TOWN_SITE} target="_blank" rel="noopener noreferrer">
                        Visit site ↗
                    </a>
                </div>
            </div>
        </div>
    );
}
