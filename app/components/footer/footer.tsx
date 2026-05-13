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
                {/* 4-column grid */}
                <div
                    className="grid gap-9"
                    style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
                >
                    {/* Col 1 — brand */}
                    <div className="col-span-4 md:col-span-1" style={{ gridColumn: undefined }}>
                        <Link href="/" aria-label="Go to home page" className="inline-flex items-center gap-3 mb-5">
                            <Image
                                src="/JDs_nobg.png"
                                alt="Juneau Digital Designs home"
                                width={52}
                                height={52}
                                className="rounded-lg"
                                style={{ background: "var(--surface)", padding: 4 }}
                            />
                            <span
                                style={{
                                    fontFamily: "var(--font-display)",
                                    fontSize: 15,
                                    fontWeight: 500,
                                    color: "var(--fg)",
                                    lineHeight: 1.2,
                                }}
                            >
                                Juneau Digital<br />Designs
                            </span>
                        </Link>
                        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.6 }}>
                            Thoughtful design, clean code, and a partner-first process from kickoff to launch.
                        </p>
                    </div>

                    {/* Col 2 — Pages */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="kicker" style={{ marginBottom: 14 }}>Pages</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            <li><Link href="/" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="hover:text-white">Home</Link></li>
                            <li><Link href="/pricing" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="hover:text-white">Pricing</Link></li>
                        </ul>
                    </div>

                    {/* Col 4 — Legal */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="kicker" style={{ marginBottom: 14 }}>Legal</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--fg-2)" }}>
                            <li><Link href="/privacy-policy" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }} className="hover:text-white">Privacy Policy</Link></li>
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
                </div>
            </div>
        </footer>
    )
}
