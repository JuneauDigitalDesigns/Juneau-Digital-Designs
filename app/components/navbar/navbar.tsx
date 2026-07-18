"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "../theme/ThemeToggle";

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
            className="sticky top-0 z-50 w-full"
            style={{
                background: "var(--nav-bg)",
                backdropFilter: "blur(28px) saturate(150%)",
                WebkitBackdropFilter: "blur(28px) saturate(150%)",
                borderBottom: "1px solid var(--rule)",
            }}
        >
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
                <Link href="/" aria-label="Go to home page" className="flex items-center gap-3 hover:cursor-pointer">
                    {/* light mode → JD_dark wordmark · dark mode → JD_light wordmark */}
                    <Image src="/JDD_mark.png" alt="Juneau Digital Designs home" width={886} height={347} priority className="logo-light h-12 w-auto sm:h-16" />
                    <Image src="/JDD_mark_1.png" alt="Juneau Digital Designs home" width={886} height={347} priority className="logo-dark h-12 w-auto sm:h-16" />
                </Link>

                {/* Desktop nav — toggle pinned far right */}
                <div className="ml-auto hidden items-center gap-4 md:flex">
                    <Link href="/pricing" className="btn primary" style={{ fontSize: 14 }}>
                        View Pricing
                    </Link>
                    <Link href="/portal" className="btn primary" style={{ fontSize: 14 }}>
                        Portal
                    </Link>
                    <ThemeToggle />
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
                            <div className="flex items-center justify-between">
                                <span className="kicker">Theme</span>
                                <ThemeToggle />
                            </div>
                            <Link
                                className="btn primary w-full justify-center"
                                href="/pricing"
                                onClick={() => setShowNav(false)}
                            >
                                See Plans
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
