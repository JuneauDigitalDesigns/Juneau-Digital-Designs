import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import ServiceClose from "@/app/components/services/ServiceClose";
import ServiceRail from "@/app/components/services/ServiceRail";
import SvcIcon from "@/app/components/services/SvcIcon";
import { WEBSITE_PLAN } from "@/app/lib/service-prices";
import { HOSTING_DESCRIPTION, HOSTING_TITLE, hostingJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/website-hosting", HOSTING_TITLE, HOSTING_DESCRIPTION);

/**
 * /website-hosting: "Website hosting and maintenance for local service businesses."
 *
 * Built to the round-3 mockup Xander approved word for word on 24 Nov 2026
 * (https://claude.ai/artifact/KqRJeYPSZdpVs4XdsWDWsM#hosting). `test/service-pages.test.mjs` pins it.
 *
 * Every fact is the plan summary's (hosting on Vercel, SSL, daily backups, uptime monitoring, the
 * domain in the client's own Cloudflare account, two edits, one-business-day support) or the
 * portal's own words (its site bar and its three speed lines).
 *
 * THE MONEY-BACK GUARANTEE. Xander approved "A 30-day money-back guarantee.*" and its small print
 * (24 Nov 2026), and is changing the Terms to match: Terms of Service v6 say every fee is
 * non-refundable, and the refund arrives in v7 (the terms-of-service session's draft). It ships
 * with or after v7; the small print follows that draft: the first month's fee back, the onboarding
 * fee kept.
 */
export default function HostingPage() {
    return (
        <main className="svc-page">
            <JsonLd data={hostingJsonLd()} />

            <div className="svc-gut">
                <div className="svc-inner">
                    <div className="svc-hero">
                        <div>
                            <p className="svc-kicker">Hosting + maintenance</p>
                            <h1 className="svc-h1">
                                Website hosting and maintenance for <span className="svc-em">local service businesses.</span>
                            </h1>
                            <p className="svc-intro">Once your site is live, we keep it running. Hosting, security, backups and your edits are on us.</p>
                            <div className="svc-acts">
                                <Link href="/contact" className="btn primary">
                                    Get Started
                                </Link>
                                <Link href="/pricing" className="btn ghost">
                                    View plans + pricing
                                </Link>
                            </div>
                        </div>
                        <div>
                            {/* The portal's site bar (components/portal/HealthStrip.tsx), its real labels and
                                wording, with example values. Its fifth box, Receptionist, is left off here. */}
                            <div className="svc-pcard" role="img" aria-label="Example: the site bar at the top of the client portal">
                                <div className="svc-pcard-top">
                                    <b>Your site</b> yourbusinessco.com <span className="svc-tag">Example</span>
                                </div>
                                <div className="svc-health">
                                    <Seg label="Site" value="Live" detail="184 ms response" />
                                    <Seg label="Last deploy" value="2 days ago" detail="Updated opening hours" />
                                    <Seg label="Domain" value="yourbusinessco.com" detail="Verified · HTTPS active" />
                                    <Seg label="Speed" value="97" detail="PageSpeed · Good" />
                                </div>
                            </div>
                            <p className="svc-eg" style={{ marginTop: 12, textAlign: "center" }}>
                                Your portal&apos;s site bar. Example business, example numbers.
                            </p>
                        </div>
                    </div>
                    <ServiceRail current="/website-hosting" />
                </div>
            </div>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-receipt-wrap">
                        <div className="svc-head" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                            <h2 className="svc-h2">
                                Every month, <span className="svc-em">included.</span>
                            </h2>
                            <p className="svc-lede">No separate hosting bill, no plugin updates, no renewals to remember. It&apos;s all on the one monthly bill.</p>
                        </div>
                        <div className="svc-receipt" aria-label="What hosting and maintenance includes each month">
                            <p className="svc-receipt-h">
                                <span>Hosting + maintenance</span>
                                <span>Every month</span>
                            </p>
                            <ul>
                                {RECEIPT.map((line) => (
                                    <li key={line}>
                                        <span>{line}</span>
                                        <span>Included</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="svc-receipt-t">
                                <span>Extra to pay</span>
                                <span>$0</span>
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            Two edits <span className="svc-em">a month.</span>
                        </h2>
                        <p className="svc-lede">
                            Ask for a change to your words or your colours, twice a month, and we make it. Bigger changes, like a new layout or an extra page, are quoted first.
                        </p>
                    </div>
                    <EditMonth />
                    <div className="svc-quote-row">
                        <p>
                            <b>2 a month</b> words and colours
                        </p>
                        <p>
                            <b>Quoted first</b> layout, design, extra pages
                        </p>
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-head">
                        <h2 className="svc-h2">
                            Fast pages, <span className="svc-em">checked.</span>
                        </h2>
                        <p className="svc-lede">We check your site&apos;s speed, and your portal tells you how it&apos;s doing in plain words.</p>
                    </div>
                    {/* The three lines are the portal's speed page's own (PerformanceSection.tsx). The bars are
                        a drawing, not data. */}
                    <ol className="svc-meters">
                        <Meter heading="Shows up quickly." body="The main part of the page appears fast on a phone." />
                        <Meter heading="Reacts straight away." body="Taps and clicks respond in under a tenth of a second." />
                        <Meter heading="Nothing jumps around." body="Text and buttons stay put while the page loads." />
                    </ol>
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            If you ever <span className="svc-em">leave.</span>
                        </h2>
                        <p className="svc-lede">There is no minimum term, no commitment period, and no cancellation fee on any plan. It&apos;s month to month.</p>
                    </div>
                    <div className="svc-box-out">
                        <SvcIcon name="box" className="svc-box-ic" />
                        <ul className="svc-take">
                            <li>
                                <SvcIcon name="browser" />
                                <span>
                                    <b>Your website</b>, as a project you can host anywhere.
                                </span>
                            </li>
                            <li>
                                <SvcIcon name="file" />
                                <span>
                                    <b>Your call log and website inquiries</b>, as a PDF.
                                </span>
                            </li>
                            <li>
                                <SvcIcon name="globe" />
                                <span>
                                    <b>Your domain</b>, already in your own Cloudflare account.
                                </span>
                            </li>
                            <li>
                                <SvcIcon name="check" />
                                <span>
                                    Everything keeps running <b>through the end of the month you&apos;ve paid for.</b>
                                </span>
                            </li>
                            <li className="guar">
                                <SvcIcon name="shield" />
                                <span>
                                    <b>A 30-day money-back guarantee.*</b> Change your mind in your first 30 days and you get that month&apos;s fee back.
                                </span>
                            </li>
                        </ul>
                    </div>
                    <p className="svc-small">
                        * Cancel within 30 days of your first payment and we refund the subscription fee you paid for that first month. The onboarding fee paid at sign-up isn&apos;t refunded: it covers the work of setting up your website.
                    </p>
                </div>
            </section>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <ServiceClose
                        price={<>Hosting and maintenance come with every plan, from ${WEBSITE_PLAN.monthlyPrice} a month.</>}
                        next={{ lead: "Next in the system", href: "/ai-receptionist", label: "AI receptionist" }}
                    />
                </div>
            </section>
        </main>
    );
}

/** The plan summary's hosting lines, in plain words. */
const RECEIPT = [
    "Hosting on enterprise-grade infrastructure (Vercel)",
    "SSL certificate and secure HTTPS",
    "Daily backups",
    "Uptime monitoring",
    "Your domain, registered and renewed in your own Cloudflare account",
    "2 content edits (words and colours)",
    "Site statistics and speed checks",
    "Support within one business day",
];

function Seg({ label, value, detail }: { label: string; value: string; detail: string }) {
    return (
        <div className="svc-seg">
            <p className="svc-seg-l">
                <i />
                {label}
            </p>
            <p className="svc-seg-v">{value}</p>
            <p className="svc-seg-d">{detail}</p>
        </div>
    );
}

function Meter({ heading, body }: { heading: string; body: string }) {
    return (
        <li className="svc-meter">
            <span className="svc-meter-bar" aria-hidden="true">
                <i />
            </span>
            <h3>{heading}</h3>
            <p>{body}</p>
        </li>
    );
}

/** An example month with its two edits on it. The edits are examples. */
function EditMonth() {
    const days: (number | null)[] = [null, null, ...Array.from({ length: 31 }, (_, i) => i + 1), null, null];
    const edits: Record<number, [number, string]> = { 7: [1, "New holiday hours"], 22: [2, "Add a service to the list"] };
    return (
        <div className="svc-month" role="img" aria-label="Example month with two edit requests: new holiday hours on the 7th, and a service added to the list on the 22nd">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <span key={d} className="dn" aria-hidden="true">
                    {d}
                </span>
            ))}
            {days.map((d, i) =>
                d === null ? (
                    <span key={`x${i}`} className="d x" aria-hidden="true" />
                ) : edits[d] ? (
                    <span key={d} className="d e" aria-hidden="true">
                        {d}
                        <span className="tk">
                            <small>Edit {edits[d][0]}</small>
                            {edits[d][1]}
                        </span>
                    </span>
                ) : (
                    <span key={d} className="d" aria-hidden="true">
                        {d}
                    </span>
                ),
            )}
        </div>
    );
}
