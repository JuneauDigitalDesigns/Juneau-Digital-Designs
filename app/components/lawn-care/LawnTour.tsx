"use client";

import { useState } from "react";

/**
 * "What's on your lawn care website": one picture of the real design, and four points under it.
 *
 * On a computer the picture stays put and slides to whichever part you pick, so the design is seen
 * whole rather than as a row of thumbnails. On a phone the frame is dropped and each point carries
 * its own picture, because a picture you cannot reach the controls for is no use.
 *
 * The picture is one capture of the approved lawn care design (public/lawn-care-site.webp,
 * 1280×5360), scrolled by `background-position`; `POINTS[].at` is that section's top as a share of
 * the scrollable height, so a point always lands on its own section.
 *
 * The design's stock photos are not stored with the design file, so the capture shows it without
 * them. Xander approved it that way and asked for a recapture if the photo set turns up.
 */
const POINTS = [
    {
        at: "0",
        tag: "The first screen",
        head: "They pick how often",
        copy: "Weekly, every other week or a one-time cleanup, picked right beside the quote form. On Growth, the receptionist calls them back within about a minute.",
        alt: "The top of the lawn care design: a How often picker beside the quote form",
    },
    {
        at: "17.17%",
        tag: "Your year",
        head: "Season by season",
        copy: "Spring, summer, fall and winter, each with the work you do in it, so people see you're there all year.",
        alt: "The lawn care design's Your year with us section: spring, summer, fall and winter",
    },
    {
        at: "27.09%",
        tag: "Services",
        head: "Six services, from mowing to edging",
        copy: "Mowing, fertilization, aeration, leaf removal, weed control and edging. A service gets its own page when you've told us enough to fill one.",
        alt: "The services section of the lawn care design: six service cards",
    },
    {
        at: "40%",
        tag: "Neighbourhoods",
        head: "Where you already mow",
        copy: "Your neighbourhoods and towns, one by one, with a page for a town when there's something real to say about it.",
        alt: "The coverage section of the lawn care design: the neighbourhoods mowed every week",
    },
] as const;

export default function LawnTour() {
    const [shown, setShown] = useState(0);

    return (
        <div className="lawn-tour">
            <div className="lawn-frame">
                <div className="lawn-frame-bar" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <span>yourlawncareco.com</span>
                </div>
                <div
                    className="lawn-view"
                    style={{ backgroundPositionY: POINTS[shown].at }}
                    role="img"
                    aria-label={POINTS[shown].alt}
                />
            </div>
            <div className="lawn-parts">
                {POINTS.map((p, i) => (
                    <button
                        key={p.tag}
                        type="button"
                        className={`lawn-part${i === shown ? " is-on" : ""}`}
                        aria-pressed={i === shown}
                        onClick={() => setShown(i)}
                    >
                        {/* Phones only: the frame above is hidden there, so each point shows its own. */}
                        <span className="lawn-shot" style={{ backgroundPositionY: p.at }} role="img" aria-label={p.alt} />
                        <span className="lawn-part-tag">{p.tag}</span>
                        <span className="lawn-part-h">{p.head}</span>
                        <span className="lawn-part-p">{p.copy}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
