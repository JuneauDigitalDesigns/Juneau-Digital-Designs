"use client"
import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Pages {
    name: string;
    href: string;
}

export default function Navbar() {
    const [showNav, setShowNav] = useState(false)
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
            className="top-0 z-50 w-full"
            style={{
                background: "rgba(7, 16, 30, 0.75)",
                backdropFilter: "blur(28px) saturate(150%)",
                WebkitBackdropFilter: "blur(28px) saturate(150%)",
                
            }}
        >
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center px-4 sm:px-6">
                <Link href="/" aria-label="Go to home page" className="hover:cursor-pointer">
                    <Image src="/JDs_nobg.png" alt="Juneau Digital Designs home" width={100} height={100} className="h-20 w-20 sm:h-25 sm:w-25" />
                </Link>

                {/* Desktop nav */}
                <div className="ml-auto hidden items-center gap-7 text-sm md:flex">
                    
                    <Link href="/pricing" className="btn primary" style={{ fontSize: 13.5 }}>
                        View Pricing
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
                            background: "rgba(7, 16, 30, 0.97)",
                            backdropFilter: "blur(28px) saturate(150%)",
                            WebkitBackdropFilter: "blur(28px) saturate(150%)",
                            borderBottom: "1px solid var(--rule)",
                            color: "var(--fg)",
                        }}
                    >
                        <div className="mx-auto w-full max-w-7xl px-4">
                            <p className="kicker px-1 pt-1 pb-3">Navigation</p>

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
    )
}
