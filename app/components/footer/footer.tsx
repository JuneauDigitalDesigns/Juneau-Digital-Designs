import Link from "next/link"
import Image from "next/image"

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
                {/* 3-column grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-9">
                    {/* Col 1 — brand */}
                    <div>
                        <Link href="/" aria-label="Go to home page" className="inline-flex items-center mb-5">
                            {/* light mode → JD_dark wordmark · dark mode → JD_light wordmark */}
                            <Image src="/JDD_mark.png" alt="Juneau Digital Designs home" width={886} height={347} className="logo-light h-18 w-auto" />
                            <Image src="/JDD_mark_1.png" alt="Juneau Digital Designs home" width={886} height={347} className="logo-dark h-18 w-auto" />
                        </Link>
                        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.6 }}>
                            Websites, hosting, and a 24/7 AI receptionist — so the phone always gets answered.
                        </p>
                    </div>

                    {/* Col 2 — Pages */}
                    <div>
                        <div className="kicker" style={{ marginBottom: 14 }}>Pages</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            <li><Link href="/" className="footer-link">Home</Link></li>
                            <li><Link href="/pricing" className="footer-link">Pricing</Link></li>
                        </ul>
                    </div>

                    {/* Col 3 — Legal */}
                    <div>
                        <div className="kicker" style={{ marginBottom: 14 }}>Legal</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            <li><Link href="/privacy-policy" className="footer-link">Privacy Policy</Link></li>
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
                    <span>WEBSITES / HOSTING / AI RECEPTIONIST</span>
                </div>
            </div>
        </footer>
    )
}
