"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
    const [showNav, setShowNav] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setShowNav(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div
            ref={navRef}
            /* Not sticky since 9 Nov 2026 (Xander's call): the bar sits at the top of the page and
               scrolls away with it. `relative` stays so the mobile menu can hang below it. */
            className="relative z-50 w-full"
            style={{
                background: "var(--nav-bg)",
                backdropFilter: "blur(28px) saturate(150%)",
                WebkitBackdropFilter: "blur(28px) saturate(150%)",
                borderBottom: "1px solid var(--rule)",
            }}
        >
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
                <Link href="/" aria-label="Go to home page" className="flex items-center gap-3 hover:cursor-pointer">
                    <Image src="/JDD_mark.webp" alt="Juneau Digital Designs home" width={1774} height={887} priority className="h-12 w-auto sm:h-16" />
                </Link>

                {/* Desktop nav, pinned far right */}
                <div className="ml-auto hidden items-center gap-4 md:flex">
                    <Link href="/pricing" className="btn primary" style={{ fontSize: 14 }}>
                        View Pricing
                    </Link>
                    <Link href="/portal" className="btn primary" style={{ fontSize: 14 }}>
                        Portal
                    </Link>
                </div>

                {/* Mobile hamburger */}
                <button
                    type="button"
                    aria-label={showNav ? "Close navigation menu" : "Open navigation menu"}
                    className="ml-auto select-none md:hidden"
                    style={{ color: "var(--fg)" }}
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

            {/* Mobile menu */}
            <AnimatePresence>
                {showNav && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.175, ease: "easeOut" }}
                        className="absolute w-full md:hidden pb-6 pt-3"
                        style={{
                            background: "var(--nav-bg-solid)",
                            backdropFilter: "blur(28px) saturate(150%)",
                            WebkitBackdropFilter: "blur(28px) saturate(150%)",
                            borderBottom: "1px solid var(--rule)",
                            color: "var(--fg)",
                        }}
                    >
                        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4">
                            <Link
                                className="btn primary w-full justify-center"
                                href="/pricing"
                                onClick={() => setShowNav(false)}
                            >
                                See Plans
                            </Link>
                            <Link
                                className="btn primary w-full justify-center"
                                href="/portal"
                                onClick={() => setShowNav(false)}
                            >
                                Portal
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
