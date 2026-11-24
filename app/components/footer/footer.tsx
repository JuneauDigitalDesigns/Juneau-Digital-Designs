import Link from "next/link"
import Image from "next/image"
import { CONTACT } from "@/app/data/contact"
import { TRADE_PAGES } from "@/app/data/trade-pages"
import { ORLANDO_PAGE, SERVICE_PAGES } from "@/app/data/service-pages"

export default function Footer() {
    const year = new Date().getFullYear()

    return (
        <footer
            className="relative w-full overflow-hidden"
            style={{
                background: "var(--bg)",
                borderTop: "1px solid var(--rule)",
                color: "var(--fg)",
            }}
        >
            <div
                className="relative mx-auto w-full max-w-7xl px-4 sm:px-6"
                style={{ padding: "64px max(24px, 4vw) 36px" }}
            >
                {/* 6-column grid: brand, Pages, Services, Trades, Legal, Contact (Services added
                    24 Nov 2026). One column on a phone, two on a tablet, six from 1024px. The short
                    lists are narrower and Contact wider, so the email address fits on one line
                    instead of breaking mid-word. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.7fr_1fr_0.7fr_0.85fr_1.45fr] gap-9">
                    {/* Col 1 — brand */}
                    <div>
                        <Link href="/" aria-label="Go to home page" className="inline-flex items-center mb-5">
                            <Image src="/JDD_mark.webp" alt="Juneau Digital Designs home" width={1774} height={887} className="h-18 w-auto" />
                        </Link>
                        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.6 }}>
                            Websites built to get you found and called, with a 24/7 AI receptionist for when you can&apos;t pick up.
                        </p>
                    </div>

                    {/* Col 2 — Pages */}
                    <div>
                        <div className="kicker" style={{ marginBottom: 14 }}>Pages</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            <li><Link href="/" className="footer-link">Home</Link></li>
                            <li><Link href="/about" className="footer-link">About</Link></li>
                            <li><Link href="/pricing" className="footer-link">Pricing</Link></li>
                            <li><Link href="/faq" className="footer-link">FAQ</Link></li>
                            <li><Link href="/contact" className="footer-link">Contact</Link></li>
                            {/* The one location page lives here, not in the nav (Xander, 24 Nov 2026). */}
                            <li><Link href={ORLANDO_PAGE.href} className="footer-link">{ORLANDO_PAGE.label}</Link></li>
                        </ul>
                    </div>

                    {/* Col 3 — Services. `SERVICE_PAGES`, shared with the nav's Services menu. */}
                    <div>
                        <div className="kicker" style={{ marginBottom: 14 }}>Services</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            {SERVICE_PAGES.map(service => (
                                <li key={service.href}><Link href={service.href} className="footer-link">{service.label}</Link></li>
                            ))}
                        </ul>
                    </div>

                    {/* Col 4 — Trades. One page per trade, each added once Xander has approved
                        its wording (HVAC first, 19 Nov 2026). The list is `TRADE_PAGES`, shared
                        with the nav's Trades menu, so a new page shows up in both at once. */}
                    <div>
                        <div className="kicker" style={{ marginBottom: 14 }}>Trades</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            {TRADE_PAGES.map(trade => (
                                <li key={trade.href}><Link href={trade.href} className="footer-link">{trade.label}</Link></li>
                            ))}
                        </ul>
                    </div>

                    {/* Col 5 — Legal */}
                    <div>
                        <div className="kicker" style={{ marginBottom: 14 }}>Legal</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            <li><Link href="/privacy-policy" className="footer-link">Privacy Policy</Link></li>
                            <li><Link href="/sms-terms" className="footer-link">SMS Terms</Link></li>
                            {/* /terms is the service agreement each plan signs, not a general
                                terms page, so it is named for that and can't be mistaken for the
                                SMS Terms above it. Approved by Xander, 9 Nov 2026. */}
                            <li><Link href="/terms" className="footer-link">Terms of Service</Link></li>
                        </ul>
                    </div>

                    {/* Col 6: Contact (Xander, 2026-11-12). Footer only, not the nav. Plain <a>,
                        not <Link>: tel: and mailto: leave the site. */}
                    <div>
                        <div className="kicker" style={{ marginBottom: 14 }}>Contact</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            <li><a href={CONTACT.phoneHref} className="footer-link">{CONTACT.phoneDisplay}</a></li>
                            <li><a href={CONTACT.emailHref} className="footer-link" style={{ overflowWrap: "anywhere" }}>{CONTACT.email}</a></li>
                        </ul>
                    </div>
                </div>

                {/* Copyright bar */}
                <div
                    style={{
                        marginTop: 56,
                        paddingTop: 22,
                        borderTop: "1px solid var(--rule)",
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                        color: "var(--fg-3)",
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                    }}
                >
                    <span>&copy; {year} Juneau Digital Designs. All rights reserved.</span>
                    {/* Each word links to its service page (Xander, 24 Nov 2026). */}
                    <span>
                        <Link href="/website-design" className="footer-link">WEBSITES</Link> /{" "}
                        <Link href="/website-hosting" className="footer-link">HOSTING</Link> /{" "}
                        <Link href="/ai-receptionist" className="footer-link">AI RECEPTIONIST</Link> /{" "}
                        <Link href="/crm" className="footer-link">PORTAL + CRM</Link>
                    </span>
                </div>
            </div>
        </footer>
    )
}
