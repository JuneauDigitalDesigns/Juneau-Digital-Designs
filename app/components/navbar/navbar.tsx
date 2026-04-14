"use client"
import Image from "next/image"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
interface Pages {
    name: string;
    href: string;
}

export default function Navbar() {
    const [showNav, setShowNav] = useState(false)
    const navRef = useRef<HTMLDivElement>(null);
    const handleCloseModal = () => {
        setShowNav(false);
    }
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                handleCloseModal();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [handleCloseModal]);
    const pages: Pages[] = [
        { name: "Projects", href: "/projects" },
    ]
    return (
        <div ref={navRef} className="sticky top-0 z-50 w-full bg-[#0E1A2B]/95 backdrop-blur-sm shadow-lg">
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center px-4 sm:px-6">
                <Link href="/" aria-label="Go to home page" className="hover:cursor-pointer">
                    <Image src="/JDs_nobg.png" alt="Juneau Digital Designs home" width={100} height={100} className="h-14 w-14 sm:h-32 sm:w-32" />
                </Link>

                <div className="ml-auto hidden items-center gap-7 text-sm font-medium text-white/90 md:flex">
                    {pages.map((page) => (
                        <Link key={page.name} href={page.href} className="transition-colors hover:text-white">
                            {page.name}
                        </Link>
                    ))}
                    <Link
                        href="/quote"
                        className="rounded-md border border-white/35 px-4 py-2 text-sm transition-colors hover:bg-white hover:text-[#0E1A2B]"
                    >
                        Request a Quote
                    </Link>
                </div>

                <button
                    type="button"
                    aria-label={showNav ? "Close navigation menu" : "Open navigation menu"}
                    className="ml-auto select-none text-white md:hidden"
                    onClick={() => setShowNav(prev => !prev)}
                >
                    <motion.div
                        key={showNav ? "close" : "open"}
                        initial={{ opacity: 0, rotate: showNav ? -90 : 90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: showNav ? 90 : -90 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="text-3xl leading-none"
                    >
                        {showNav ? "✕" : "☰"}
                    </motion.div>
                </button>
            </div>

            <AnimatePresence>
                {showNav && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.175, ease: "easeOut" }}
                        className="absolute w-full md:hidden bg-gradient-to-b from-[#1A2E4C] to-[#13233B] pb-6 pt-3 text-white"
                    >
                        <div className="mx-auto w-full max-w-7xl ">
                            <div className="overflow-hidden w-full">
                                <div className="px-3 py-3">
                                    <p className="text-xs uppercase tracking-[0.2em] text-white/65">Navigation</p>
                                    <p className="mt-1 text-sm text-white/85">Explore our work and start your next project.</p>
                                </div>

                                <div className="flex flex-col gap-2 p-3">
                                    {pages.map((page, index) => (
                                        <motion.div
                                            key={page.name}
                                            initial={{ opacity: 0, x: -12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.35, delay: index * 0.05 }}
                                        >
                                            <Link
                                                className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base font-medium transition-colors hover:border-white/35 hover:bg-white/[0.09]"
                                                href={page.href}
                                                onClick={() => setShowNav(false)}
                                            >
                                                <span>{page.name}</span>
                                                <span className="text-white/45 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white">→</span>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="p-3">
                                    <Link
                                        className="inline-flex w-full items-center justify-center rounded-xl border border-white/55 bg-white/5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white hover:text-[#14233A]"
                                        href="/quote"
                                        onClick={() => setShowNav(false)}
                                    >
                                        Request a Quote
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
