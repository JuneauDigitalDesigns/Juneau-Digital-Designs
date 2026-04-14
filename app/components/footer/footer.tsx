import Image from "next/image"
import Link from "next/link"

export default function Footer() {
    const year = new Date().getFullYear()

    return (
        <footer className="relative w-full overflow-hidden border-t border-white/10 bg-gradient-to-b from-[#13233B] to-[#0B1524] text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(96,165,250,0.14),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(56,189,248,0.12),transparent_34%)]" />

            <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6">
                <div className="flex flex-col gap-6 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-3xl">
                        <Link href="/" aria-label="Go to home page" className="mb-4 inline-flex items-center gap-4 rounded-xl py-2 transition-colors hover:bg-white/[0.08]">
                            <Image
                                src="/JDs_nobg.png"
                                alt="Juneau Digital Designs home"
                                width={72}
                                height={72}
                                className="h-14 w-14 rounded-lg bg-white/10 p-1"
                            />
                            <div className="leading-tight">
                                <p className="text-lg font-semibold text-white">Juneau Digital Designs</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-white/65">Web Design and Development</p>
                            </div>
                        </Link>

                        <h2 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
                            Building polished digital experiences that convert.
                        </h2>
                        <p className="mt-3 text-sm text-white/75 sm:text-base">
                            Thoughtful design, clean code, and a partner-first process from kickoff to launch.
                        </p>
                    </div>

                    <Link
                        href="/quote"
                        className="inline-flex items-center justify-center rounded-xl border border-white/45 bg-white/5 px-5 py-3 text-sm font-semibold transition-colors hover:bg-white hover:text-[#13233B]"
                    >
                        Request a Quote
                    </Link>
                </div>

                <div className="flex flex-col gap-5 text-sm text-white/80 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                        <Link href="/" className="transition-colors hover:text-white">Home</Link>
                        <Link href="/projects" className="transition-colors hover:text-white">Projects</Link>
                        <Link href="/contact" className="transition-colors hover:text-white">Contact</Link>
                    </div>

                    <div className="flex flex-col gap-1 sm:items-end">
                        <p>&copy; {year} Juneau Digital Designs. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </footer>
    )
}