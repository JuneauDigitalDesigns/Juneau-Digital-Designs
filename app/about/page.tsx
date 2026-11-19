import type { Metadata } from "next";
import JsonLd from "@/app/components/JsonLd";
import PageAsk from "@/app/components/PageAsk";
import { aboutJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata(
    "/about",
    "About Xander Juneau | Juneau Digital Designs",
    "Meet the owner of Juneau Digital Designs: Xander Juneau, in Winter Garden, Florida, building websites, AI receptionists and automations for Central Florida trades.",
);

/**
 * /about — "Meet the owner."
 *
 * Every word on this page is Xander's own, approved word for word on 19 Nov 2026 from the
 * fourth round of a mockup (https://claude.ai/artifact/1WFZcoBHdvT7rrkfPmU6jz). Nothing here
 * may be edited, embellished or "tightened" without a fresh approval: it is his biography, and
 * the credentials, dates and institutions in it are checkable facts about a real person.
 *
 * The page exists because the agency site had no page about who runs it, and because the
 * search check on 19 Nov 2026 found the site never named a trade, a region or a person. It is
 * also the only page that names Florida.
 *
 * Why it does not look like the rest of the site's pages: Xander's note on the first mockup was
 * that every section read the same. So each section here carries its own device — a split hero,
 * staggered pull quotes, a story beside a timeline, a two-column ledger, a centred close — while
 * the type, colour and hairlines stay the site's. Styles are `.about-*` in globals.css.
 *
 * Written in the first person on purpose. The rest of the site says "we"; this page is the one
 * place that says "I", because it is one person talking about himself.
 */

/**
 * Xander's portrait. He is supplying one later (19 Nov 2026).
 *
 * Until then the hero is a single column rather than a column beside an empty frame: a dashed
 * placeholder on a live page reads as a broken image. Set this to the file and its real pixel
 * size, and the two-column hero and the name caption appear with no other change.
 */
/**
 * Xander's photo, and what a screen reader reads in its place.
 *
 * Approved word for word by Xander on 19 Nov 2026. It describes a real person, so it is not to
 * be reworded, embellished or "improved" without a fresh approval. It deliberately does not say
 * where the photo was taken, because nobody here knows and a guess about a real person's
 * whereabouts is not something to invent.
 */
const PORTRAIT_ALT = "Xander Juneau, the owner of Juneau Digital Designs";

/** Where the eight files live. Built by the script recorded in the PR, from his original JPEG. */
const PHOTO = "/about/about-xander";

/** What I've learned, and the matching line on what a client's site actually gets. */
const LESSONS: { heading: string; learned: string; site: string }[] = [
    {
        heading: "Speed comes first",
        learned: "A page should load in under three seconds. People don't wait around for a slow one.",
        site: "Pages are built ahead of time, images are sized for each screen in modern formats, and fonts are served with the site.",
    },
    {
        heading: "Real content",
        learned: "A page needs real information about what you do and where you do it. That's what people came to read.",
        site: "Pages for your services and the towns you work in, written from the details you give me.",
    },
    {
        heading: "Good design builds trust",
        learned: "For most people, a good-looking site is a sign of quality. A pleasant experience on your website suggests a pleasant experience working with you.",
        site: "A design made for your trade, in your colours, that works on a phone.",
    },
    {
        heading: "Everyone has to be able to read it",
        learned: "Light text on a light background looks sharp to a designer and unreadable to a customer in the sun.",
        site: "Text colours are checked for contrast against accessibility standards, and every image carries a text description.",
    },
    {
        heading: "Google needs it spelled out",
        learned: "A search engine can't guess what a page is about. You have to tell it, on every page.",
        site: "A title, description and address for every page, a sitemap, and structured data that describes your business and services.",
    },
    {
        heading: "Security isn't optional",
        learned: "HTTPS everywhere, forms that screen out bots, and requests that get checked before they're accepted.",
        site: "HTTPS on every page, a bot check on the contact form, and known scraper bots turned away.",
    },
];

/** The road to JDD, oldest first. */
const TIMELINE: { when: string; what: string; detail: string }[] = [
    {
        when: "Valencia College, 2019",
        what: "A.S., Electronics Engineering Technology",
        detail: "The plan: design computer systems for spacecraft.",
    },
    {
        when: "About 12 years",
        what: "Hospitality",
        detail: "Where I learned to take care of people, and to lead and get results.",
    },
    { when: "2020", what: "COVID-19", detail: "Furloughed, with no opportunities in sight." },
    {
        when: "June to November 2022",
        what: "Back to school",
        detail: "Engineering Immersion Program, Thinkful (a Chegg service). Full-stack web development.",
    },
    {
        when: "Since then",
        what: "Client work",
        detail: "Two websites for a client, who now runs them on their own.",
    },
    {
        when: "Now",
        what: "Juneau Digital Designs",
        detail: "Websites, AI receptionists and automations for the trades.",
    },
];

export default function AboutPage() {
    return (
        <main className="about-page">
            <JsonLd data={aboutJsonLd()} />

            {/* 1 · Hero. Left-aligned, unlike the centred headings elsewhere: the page is a
                person introducing himself, not a section header. */}
            <section className="about-shell about-hero">
                <div className="about-hero-copy">
                    <h1 className="about-h1">
                        Meet the <span className="about-coral">owner.</span>
                    </h1>
                    <p className="about-intro">I&apos;m Xander Juneau. I built this for the trades.</p>
                    <p className="about-where">
                        I live in Winter Garden, Florida, and I work with the local trades in and around Central
                        Florida: HVAC, plumbing, roofing, lawn care, pressure washing and detailing businesses.
                    </p>
                </div>
                {/* Two crops of one photo, not one crop squeezed two ways: a tall 4:5 from
                    801px up, the frame as shot below it (Xander, 19 Nov 2026 — "the portrait
                    looks better on larger screens, but the frame as a shot looks better on
                    mobile"). 801px is where `.about-hero` stops being two columns, so the
                    picture changes with the layout instead of on a breakpoint of its own.

                    A <picture> rather than next/image, which can change a picture's size at a
                    breakpoint but not the picture itself. Each source offers AVIF then WebP at
                    1x and 2x, so a browser downloads exactly one file: 27KB at the very
                    largest, against the 163KB JPEG it came from. Crop and scale only — no
                    filter, no retouching, no AI alteration.

                    Not lazy-loaded: it is in the hero, on screen the moment the page opens. */}
                <div className="about-hero-portrait">
                    <div className="about-portrait">
                        <picture>
                            <source
                                media="(min-width: 801px)"
                                type="image/avif"
                                srcSet={`${PHOTO}-portrait-340.avif 340w, ${PHOTO}-portrait-680.avif 680w`}
                                sizes="336px"
                            />
                            <source
                                media="(min-width: 801px)"
                                type="image/webp"
                                srcSet={`${PHOTO}-portrait-340.webp 340w, ${PHOTO}-portrait-680.webp 680w`}
                                sizes="336px"
                            />
                            <source
                                type="image/avif"
                                srcSet={`${PHOTO}-square-300.avif 300w, ${PHOTO}-square-600.avif 600w`}
                                sizes="300px"
                            />
                            <img
                                src={`${PHOTO}-square-600.webp`}
                                srcSet={`${PHOTO}-square-300.webp 300w, ${PHOTO}-square-600.webp 600w`}
                                sizes="300px"
                                alt={PORTRAIT_ALT}
                                width={600}
                                height={609}
                                fetchPriority="high"
                                decoding="async"
                            />
                        </picture>
                    </div>
                    <p className="about-portrait-cap">
                        <b>Xander Juneau</b>
                        Owner, Juneau Digital Designs
                        <br />
                        Winter Garden, Florida
                    </p>
                </div>
            </section>

            {/* 2 · Why. The two lines Xander wrote are quotes from him, staggered rather than
                stacked: the first a bare pull quote, the second a blurb with a tail. */}
            <section className="wash">
                <div className="about-shell">
                    <h2 className="about-h2">
                        Why I started <span className="about-coral">JDD.</span>
                    </h2>
                    <div className="about-why">
                        <div className="about-quotes">
                            <figure className="about-q about-q1">
                                <blockquote>I saw the problem on the job.</blockquote>
                                <figcaption>Xander Juneau, owner of Juneau Digital Designs</figcaption>
                            </figure>
                            <figure className="about-q about-q2">
                                <blockquote>
                                    Small businesses need a digital presence that does more for them, at a price that
                                    makes sense.
                                </blockquote>
                                <figcaption>Xander Juneau, owner of Juneau Digital Designs</figcaption>
                            </figure>
                        </div>
                        <div className="about-story">
                            <p>
                                I&apos;ve been on the job with contractors and home service providers, some of them
                                running their own business. I saw firsthand how hard it is to keep up with new business
                                while the calls, texts, messages and emails keep coming in.
                            </p>
                            <p>
                                A lot of them were being offered websites that weren&apos;t built to get found on
                                Google, or even to get their point across: hard to navigate, and hard to find what you
                                came for. Others were being sold marketing before they had a proper online presence to
                                send anyone to.
                            </p>
                            <p className="about-story-last">So I built one that does the job.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3 · Background. Story on the left, the road to here on the right. */}
            <section className="about-shell">
                <div className="about-centre">
                    <p className="kicker">My background</p>
                    <h2 className="about-h2">
                        Twelve years taking care of people.
                        <br />
                        <span className="about-coral">And an engineer&apos;s mindset.</span>
                    </h2>
                </div>
                <div className="about-bg">
                    <div className="about-story">
                        <p className="about-story-lead">
                            I spent about 12 years in the hospitality industry, and that&apos;s where I learned how to
                            take care of people. You approach them with empathy, respect and understanding.
                        </p>
                        <p>
                            I gained a lot of leadership experience there too. I wasn&apos;t only learning how to take
                            care of people. I was learning how to lead and get results.
                        </p>
                        <p>That&apos;s how I treat my clients now: like friends or family.</p>
                        <p>
                            I went to college first and earned an Associate in Science degree in Electronics
                            Engineering Technology from Valencia College in 2019. My plan was a career designing
                            computer systems for spacecraft. Then COVID-19 happened. I was furloughed from my job, and
                            the opportunities weren&apos;t there.
                        </p>
                        <p>
                            After a few years of trying to make it work, I went back to school to learn full-stack web
                            development. I&apos;ve been building ever since.
                        </p>
                        <p>
                            I still think like an engineer: work out how the thing should run, then build it properly.
                        </p>
                    </div>
                    <ol className="about-tl">
                        {TIMELINE.map((step, i) => (
                            <li key={step.what} className={i === TIMELINE.length - 1 ? "about-tl-now" : undefined}>
                                <p className="about-tl-when">{step.when}</p>
                                <h3 className="about-tl-what">{step.what}</h3>
                                <p className="about-tl-detail">{step.detail}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 4 · What I've learned, each lesson against what it means for a client's site. */}
            <section className="wash">
                <div className="about-shell">
                    <div className="about-split-head">
                        <h2 className="about-h2">
                            What makes a website <span className="about-coral">actually work.</span>
                        </h2>
                        <p>
                            Six things I&apos;ve learned about websites. Each one is built into every site I make for a
                            client.
                        </p>
                    </div>
                    <div className="about-ledger">
                        <div className="about-ledger-cols" aria-hidden="true">
                            <span />
                            <span>What I learned</span>
                            <span>How it shows up on your site</span>
                        </div>
                        {LESSONS.map((lesson, i) => (
                            <div key={lesson.heading} className="about-row">
                                <span className="about-row-n" aria-hidden="true">
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <div>
                                    <h3 className="about-row-h">{lesson.heading}</h3>
                                    <p>{lesson.learned}</p>
                                </div>
                                <div className="about-row-site">
                                    <p className="about-row-lbl">On your site</p>
                                    {lesson.site}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 5 · The same two asks every other page closes on. */}
            <section className="about-shell about-close">
                <div className="about-centre">
                    <h2 className="about-h2 about-close-h">
                        Level up your business.
                        <br />
                        <span className="about-coral">Start here.</span>
                    </h2>
                    <p className="about-close-copy">
                        Whether you&apos;re growing your business or starting your online presence, this is the place
                        for you.
                    </p>
                </div>
                <PageAsk className="about-ask" />
            </section>
        </main>
    );
}
