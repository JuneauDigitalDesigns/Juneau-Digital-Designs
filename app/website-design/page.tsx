import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import CarryFrame from "@/app/components/services/CarryFrame";
import SearchResult from "@/app/components/services/SearchResult";
import ServiceClose from "@/app/components/services/ServiceClose";
import ServiceRail from "@/app/components/services/ServiceRail";
import { WEBSITE_PLAN } from "@/app/lib/service-prices";
import { WEBSITE_DESIGN_DESCRIPTION, WEBSITE_DESIGN_TITLE, pageMetadata, websiteDesignJsonLd } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/website-design", WEBSITE_DESIGN_TITLE, WEBSITE_DESIGN_DESCRIPTION);

/**
 * /website-design: "Website design for local service businesses."
 *
 * Built to the round-3 mockup Xander approved word for word on 24 Nov 2026
 * (https://claude.ai/artifact/KqRJeYPSZdpVs4XdsWDWsM#website-design). Nothing here may be
 * reworded without a fresh approval; `test/service-pages.test.mjs` pins the sentences.
 *
 * Each section has its own drawing: a site map, a timeline, the six points beside real screens,
 * a search result taken apart, and questions with their answers hanging off them. No region is
 * named and no single trade is (Xander: "pretty ambiguous, but clear"); the search rotates
 * through six. The price is the cheapest website plan's, from the plan list. Styles: `.svc-*`.
 */
export default function WebsiteDesignPage() {
    return (
        <main className="svc-page">
            <JsonLd data={websiteDesignJsonLd()} />

            <div className="svc-gut">
                <div className="svc-inner">
                    <div className="svc-hero">
                        <div>
                            <p className="svc-kicker">Website design</p>
                            <h1 className="svc-h1">
                                Website design for <span className="svc-em">local service businesses.</span>
                            </h1>
                            <p className="svc-intro">
                                You answer a few questions. We write it, build it and host it. After that, there&apos;s nothing for you to do.
                            </p>
                            <div className="svc-acts">
                                <Link href="/contact" className="btn primary">
                                    Get Started
                                </Link>
                                <Link href="/pricing" className="btn ghost">
                                    View plans + pricing
                                </Link>
                            </div>
                        </div>
                        <SiteMap />
                    </div>
                    <ServiceRail current="/website-design" />
                </div>
            </div>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            From a few answers to a <span className="svc-em">live site.</span>
                        </h2>
                    </div>
                    <ol className="svc-tl">
                        <li>
                            <span className="svc-tl-when">Day one</span>
                            <span className="svc-tl-pt" aria-hidden="true" />
                            <h3>You answer a few questions</h3>
                            <p>Most people are done in one sitting.</p>
                        </li>
                        <li>
                            <span className="svc-tl-when">Then</span>
                            <span className="svc-tl-pt" aria-hidden="true" />
                            <h3>We write it</h3>
                            <p className="svc-m-cut">The writing is what stalls everyone for six months, so we took it off your plate.</p>
                        </li>
                        <li>
                            <span className="svc-tl-when">Within 72 hours</span>
                            <span className="svc-tl-pt" aria-hidden="true" />
                            <h3>Your preview site</h3>
                            <p>Within 72 hours of sending your onboarding form back.</p>
                        </li>
                        <li>
                            <span className="svc-tl-when">Within a week</span>
                            <span className="svc-tl-pt" aria-hidden="true" />
                            <h3>You&apos;re live</h3>
                            <p className="svc-m-cut">Your site, your receptionist, your portal, and the texts we send you about new leads.</p>
                        </li>
                    </ol>
                </div>
            </section>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-head">
                        <h2 className="svc-h2">
                            What every site <span className="svc-em">carries.</span>
                        </h2>
                        <p className="svc-lede">Built from the details you give us, in your name, your colours, your services and your towns.</p>
                    </div>
                    <CarryFrame />
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <div className="svc-head">
                        <h2 className="svc-h2">
                            Built to be <span className="svc-em">found.</span>
                        </h2>
                        <p className="svc-lede">
                            Under all of it: page titles and descriptions, a sitemap, structured data, and fast pages that work on phones.
                        </p>
                    </div>
                    <div className="svc-found">
                        <SearchResult />
                        <div>
                            <ol className="svc-under">
                                <li><b>1</b><span>A page title for every page</span></li>
                                <li><b>2</b><span>A description written for every page</span></li>
                                <li><b>3</b><span>A sitemap, so every page gets found</span></li>
                                <li><b>4</b><span>Structured data, so search engines read your business right</span></li>
                                <li><b>5</b><span>Fast pages that work on phones</span></li>
                            </ol>
                            <p className="svc-honest">
                                We do the technical side properly: page speed, titles and descriptions, structured data, sitemaps.{" "}
                                <strong>What we won&apos;t do is promise you a ranking.</strong>{" "}
                                Nobody controls Google&apos;s results, and anyone who says otherwise is selling something.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            Before you <span className="svc-em">ask.</span>
                        </h2>
                    </div>
                    <ol className="svc-qa">
                        <QA q="What if I already have a website?">
                            We build you a new one and bring over the content worth keeping. You won&apos;t have to start from scratch.
                        </QA>
                        <QA q="Do I have to write the content?">
                            No. You answer some questions about your business and we write it. Most people are done in one sitting.
                        </QA>
                        <QA q="Do I own my website?">
                            Your content is yours: name, logo and photos, always. Your onboarding fee also buys you a permanent licence to use your website.{" "}
                            <span className="svc-m-cut">When you leave, we send it to you as a project you can host anywhere.</span>
                        </QA>
                    </ol>
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <ServiceClose
                        price={<>Websites start at ${WEBSITE_PLAN.monthlyPrice} a month. Month to month, no contract.</>}
                        next={{ lead: "Next in the system", href: "/website-hosting", label: "Hosting + maintenance" }}
                    />
                </div>
            </section>
        </main>
    );
}

/** A question, quoted large, with our answer hanging off it. */
function QA({ q, children }: { q: string; children: React.ReactNode }) {
    return (
        <li>
            <h3>{q}</h3>
            <div className="svc-ans">
                <p className="svc-ans-by">
                    <span className="svc-ans-mk" aria-hidden="true">
                        JDD
                    </span>
                    Our answer
                </p>
                <p>{children}</p>
            </div>
        </li>
    );
}

/** The hero drawing: the pages every site starts with, and the ones added as there's enough to fill them. */
function SiteMap() {
    const ink = "var(--fg)";
    const coral = "var(--accent-2)";
    return (
        <div>
            <svg className="svc-map" viewBox="0 0 400 300" role="img" aria-label="A site map: Home, then Services, About and Contact, with a page for each service and each town added when there's enough to fill one.">
                <g fill="none" stroke={ink} strokeWidth="2">
                    <path d="M200 52v26M50 78h300M50 78v20M150 78v20M250 78v20M350 78v20" />
                </g>
                <g fill="none" stroke={coral} strokeWidth="2" strokeDasharray="5 5">
                    <path d="M50 140v96M50 186h14M50 236h14" />
                    <path d="M350 140v96M350 186h-14M350 236h-14" />
                </g>
                <rect x="145" y="8" width="110" height="44" rx="3" fill={ink} />
                <text x="200" y="37" textAnchor="middle" fontSize="19" fill="var(--bg)">
                    Home
                </text>
                <g fill="var(--elev-1)" stroke={ink} strokeWidth="2">
                    <rect x="8" y="98" width="84" height="42" rx="3" />
                    <rect x="108" y="98" width="84" height="42" rx="3" />
                    <rect x="208" y="98" width="84" height="42" rx="3" />
                </g>
                <rect x="308" y="98" width="84" height="42" rx="3" fill="none" stroke={coral} strokeWidth="2" strokeDasharray="6 4" />
                <g fontSize="15" fill={ink} textAnchor="middle">
                    <text x="50" y="124">Services</text>
                    <text x="150" y="124">About</text>
                    <text x="250" y="124">Contact</text>
                </g>
                <text x="350" y="124" textAnchor="middle" fontSize="15" fill={coral}>
                    Your towns
                </text>
                <g fill="none" stroke={coral} strokeWidth="2" strokeDasharray="6 4">
                    <rect x="64" y="168" width="118" height="36" rx="3" />
                    <rect x="64" y="218" width="118" height="36" rx="3" />
                    <rect x="218" y="168" width="118" height="36" rx="3" />
                    <rect x="218" y="218" width="118" height="36" rx="3" />
                </g>
                <g fontSize="13.5" fill={coral} textAnchor="middle">
                    <text x="123" y="191">A service</text>
                    <text x="123" y="241">A service</text>
                    <text x="277" y="191">A town</text>
                    <text x="277" y="241">A town</text>
                </g>
                <g fontSize="12" fill="var(--fg-3)" textAnchor="middle">
                    <text x="123" y="285" className="svc-map-note">+ one per service</text>
                    <text x="277" y="285" className="svc-map-note">+ one per town</text>
                </g>
            </svg>
            <div className="svc-key">
                <span>
                    <i />
                    Every site starts here
                </span>
                <span>
                    <i className="d" />
                    Added when there&apos;s enough to fill one
                </span>
            </div>
        </div>
    );
}
