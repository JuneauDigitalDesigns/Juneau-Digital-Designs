import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import ServiceClose from "@/app/components/services/ServiceClose";
import SvcIcon, { type SvcIconName } from "@/app/components/services/SvcIcon";
import TownPages from "@/app/components/services/TownPages";
import { CONTACT } from "@/app/data/contact";
import { ORLANDO_DESCRIPTION, ORLANDO_TITLE, orlandoJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/orlando", ORLANDO_TITLE, ORLANDO_DESCRIPTION);

/**
 * /orlando: "Website design and an AI receptionist in Orlando."
 *
 * Xander's one location page, built to the round-3 mockup he approved word for word on
 * 24 Nov 2026 (https://claude.ai/artifact/KqRJeYPSZdpVs4XdsWDWsM#orlando). `test/service-pages.test.mjs`
 * pins it.
 *
 * What makes it local is true: he lives in Winter Garden (as /about says), the business number is
 * a 407 number and he answers it himself, and every client site gets a page per town it works in,
 * shown with a real demo site's town pages. He doesn't meet clients in person, so nothing offers
 * to. Unlike the trade and service pages, this page may name Florida (his call, 24 Nov 2026), in
 * the intro and in its structured data. No client, town or result is claimed.
 */
const BASICS: { icon: SvcIconName; label: string; title: string; detail: string }[] = [
    {
        icon: "browser",
        label: "Your website",
        title: "A custom 4+ page site",
        detail: "Home, Services, About and Contact, plus pages for your services and the towns you work in, built from the details you give us.",
    },
    {
        icon: "phone",
        label: "Your phone",
        title: "It rings you first",
        detail: "If you don’t pick up, the AI receptionist answers, 24/7, in English or Spanish. You get a summary of every call.",
    },
    {
        icon: "tray",
        label: "Your leads",
        title: "One inbox for every lead",
        detail: "Every call and web inquiry lands in your portal, and you get a text the moment a new one arrives.",
    },
];

export default function OrlandoPage() {
    return (
        <main className="svc-page">
            <JsonLd data={orlandoJsonLd()} />

            <div className="svc-gut">
                <div className="svc-inner">
                    <div className="svc-hero">
                        <div>
                            <p className="svc-kicker">Orlando</p>
                            <h1 className="svc-h1">
                                Website design and an AI receptionist <span className="svc-em">in Orlando.</span>
                            </h1>
                            <p className="svc-intro">I&apos;m Xander Juneau. I live in Winter Garden, Florida, and I work with the local trades in and around Orlando.</p>
                            <div className="svc-acts">
                                <Link href="/contact" className="btn primary">
                                    Get Started
                                </Link>
                                <Link href="/about" className="btn ghost">
                                    Meet the owner
                                </Link>
                            </div>
                        </div>
                        <div className="svc-num">
                            <p className="svc-kicker">Call me</p>
                            <a href={CONTACT.phoneHref} className="svc-dial">
                                <SvcIcon name="phone" className="svc-ringer" />
                                <span className="svc-dial-n">{CONTACT.phoneDisplay.replace(" ", " ")}</span>
                            </a>
                            <p>A 407 number, answered by the person who builds your site.</p>
                        </div>
                    </div>
                </div>
            </div>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            For Orlando&apos;s <span className="svc-em">trades.</span>
                        </h2>
                        <p className="svc-lede">
                            We build you a website that gets you found and noticed. Then we go a step further and replace your voicemail with a 24/7 receptionist. Every lead lands in one place.
                        </p>
                    </div>
                    <ul className="svc-three">
                        {BASICS.map((b) => (
                            <li key={b.label}>
                                <SvcIcon name={b.icon} />
                                <p className="svc-three-k">{b.label}</p>
                                <h3>{b.title}</h3>
                                <p>{b.detail}</p>
                            </li>
                        ))}
                    </ul>
                    <p className="svc-trades">
                        Built for <Link href="/hvac">HVAC</Link>, <Link href="/plumbing">plumbing</Link>, roofing, <Link href="/lawn-care">lawn care</Link>, pressure washing and auto detailing businesses.
                    </p>
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <div className="svc-head">
                        <h2 className="svc-h2">
                            Your towns, <span className="svc-em">page by page.</span>
                        </h2>
                        <p className="svc-lede">Listed on the site, with a page for a town when there&apos;s something real to say about it.</p>
                    </div>
                    <div className="svc-metro">
                        <div>
                            <MetroMap />
                            <div className="svc-key">
                                <span>
                                    <i className="dot" />
                                    Listed on the site
                                </span>
                                <span>
                                    <i className="dot c" />
                                    Has its own page
                                </span>
                            </div>
                        </div>
                        <TownPages />
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <ServiceClose second={{ href: "/about", label: "Meet the owner" }} />
                </div>
            </section>
        </main>
    );
}

/**
 * The eight towns the demo site lists (its "Serving the whole area" section), placed roughly where
 * they are around Orlando; the three with their own page are in coral. A drawing, not a survey,
 * and no town on it is a claim that we have a client there.
 */
function MetroMap() {
    const ink = "var(--fg)";
    const coral = "var(--accent-2)";
    const listed: [number, number, string, number, number, "start" | "middle" | "end"][] = [
        [250, 105, "Altamonte Springs", 240, 92, "end"],
        [120, 215, "Winter Garden", 120, 245, "middle"],
        [170, 265, "Windermere", 183, 285, "start"],
        [275, 350, "Kissimmee", 288, 355, "start"],
    ];
    const paged: [number, number, string, number, number][] = [
        [300, 130, "Maitland", 318, 126],
        [318, 168, "Winter Park", 336, 176],
        [425, 150, "Oviedo", 443, 155],
    ];
    return (
        <svg viewBox="0 0 520 400" role="img" aria-label="The towns one demo site lists around Orlando, with the three that have their own page marked">
            <rect x="0" y="0" width="520" height="400" rx="8" fill="var(--elev-1)" />
            <g fill="none" stroke="var(--wash)" strokeWidth="10" strokeLinecap="round">
                <path d="M60 300 C150 270 230 240 290 215 S400 150 490 90" />
                <path d="M285 20 C290 120 280 260 300 390" />
            </g>
            <g fill="var(--wash)">
                <ellipse cx="360" cy="120" rx="20" ry="12" />
                <ellipse cx="200" cy="300" rx="28" ry="16" />
                <ellipse cx="150" cy="170" rx="24" ry="18" />
            </g>
            <g fontSize="15" fill="var(--fg-2)">
                {listed.map(([cx, cy, name, tx, ty, anchor]) => (
                    <g key={name}>
                        <circle cx={cx} cy={cy} r="6" fill={ink} />
                        <text x={tx} y={ty} textAnchor={anchor}>
                            {name}
                        </text>
                    </g>
                ))}
            </g>
            <g fontSize="16" fill={coral}>
                {paged.map(([cx, cy, name, tx, ty]) => (
                    <g key={name}>
                        <circle cx={cx} cy={cy} r="7" fill={coral} />
                        <circle cx={cx} cy={cy} r="13" fill="none" stroke={coral} strokeWidth="2" opacity=".45" />
                        <text x={tx} y={ty}>
                            {name}
                        </text>
                    </g>
                ))}
            </g>
            <circle cx="285" cy="220" r="11" fill={ink} />
            <text x="304" y="240" fontSize="24" fill={ink}>
                Orlando
            </text>
        </svg>
    );
}
