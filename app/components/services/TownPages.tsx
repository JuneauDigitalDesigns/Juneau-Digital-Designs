"use client";

import Image from "next/image";
import { DEMO_TOWN_SITE } from "./CarryFrame";
import { useRotator } from "./useRotator";

/**
 * /orlando, "Your towns, page by page": one demo site, its three real town pages, in one browser
 * window with a tab each, the address bar showing each page's address (Xander, 24 Nov 2026: "frame
 * it as one site ... but we still show the link"). Shot from the Autobridge test site at desktop
 * width on 24 Nov 2026, from the top of each page.
 */
const AREAS: { town: string; slug: string; img: string }[] = [
    { town: "Winter Park", slug: "winter-park", img: "/services/area-winter-park.webp" },
    { town: "Maitland", slug: "maitland", img: "/services/area-maitland.webp" },
    { town: "Oviedo", slug: "oviedo", img: "/services/area-oviedo.webp" },
];

export default function TownPages() {
    const [shown, pick] = useRotator(AREAS.length, 3600);
    return (
        <div>
            <div className="svc-frame">
                <div className="svc-frame-tabs" role="tablist" aria-label="The demo site's town pages">
                    {AREAS.map((a, i) => (
                        <button key={a.slug} type="button" role="tab" aria-selected={shown === i} onClick={() => pick(i)}>
                            {a.town}
                        </button>
                    ))}
                </div>
                <div className="svc-frame-bar" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    {/* On a phone the host gives way, so the town's own address always shows. */}
                    <span>
                        <em className="svc-host">{DEMO_TOWN_SITE.replace(/^https:\/\//, "")}</em>
                        <b>/areas/{AREAS[shown].slug}</b>
                    </span>
                </div>
                <div className="svc-frame-view svc-area-view">
                    {AREAS.map((a, i) => (
                        <Image
                            key={a.slug}
                            src={a.img}
                            alt={shown === i ? `The demo site's ${a.town} page: Car Detailing in ${a.town}, and its services there.` : ""}
                            aria-hidden={shown === i ? undefined : true}
                            width={800}
                            height={609}
                            sizes="(max-width: 1000px) 100vw, 640px"
                            className={shown === i ? "on" : undefined}
                        />
                    ))}
                </div>
            </div>
            <div className="svc-frame-cap">
                <span className="svc-eg">One demo site, three of its town pages.</span>
                <a href={`${DEMO_TOWN_SITE}/areas/${AREAS[shown].slug}`} target="_blank" rel="noopener noreferrer">
                    Visit site ↗
                </a>
            </div>
        </div>
    );
}
