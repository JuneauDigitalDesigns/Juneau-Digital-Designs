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
    }, []);

    return (
        <div
            ref={navRef}
            className="sticky top-0 z-50 w-full"
            style={{
                background: "rgba(7, 16, 30, 0.75)",
                backdropFilter: "blur(28px) saturate(150%)",
                WebkitBackdropFilter: "blur(28px) saturate(150%)",
                borderBottom: "1px solid var(--rule)",
            }}
        >
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center px-4 sm:px-6">
                <Link href="/" aria-label="Go to home page" className="hover:cursor-pointer">
                    <Image src="/JDs_nobg.png" alt="Juneau Digital Designs home" width={100} height={100} className="h-14 w-14 sm:h-32 sm:w-32" />
                </Link>

                <div className="ml-auto hidden items-center gap-7 text-sm font-medium md:flex">
                    
                    <Link href="/pricing" className="btn primary" style={{ fontSize: 13.5 }}>
                        View Pricing
                    </Link>
                </div>

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

            <AnimatePresence>
                {showNav && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.175, ease: "easeOut" }}
                        className="absolute w-full md:hidden pb-6 pt-3"
                        style={{
                            background: "rgba(7, 16, 30, 0.95)",
                            backdropFilter: "blur(28px) saturate(150%)",
                            WebkitBackdropFilter: "blur(28px) saturate(150%)",
                            borderBottom: "1px solid var(--rule)",
                            color: "var(--fg)",
                        }}
                    >
                        <div className="mx-auto w-full max-w-7xl">
                            <div className="overflow-hidden w-full">
                                <div className="px-3 py-3">
                                    <p className="kicker">Navigation</p>
                                    <p className="mt-1 text-sm" style={{ color: "var(--fg-2)" }}>
                                        Explore our work and start your next project.
                                    </p>
                                </div>

                                

                                <div className="p-3">
                                    <Link
                                        className="btn primary w-full justify-center"
                                        href="/pricing"
                                        onClick={() => setShowNav(false)}
                                    >
                                        See Plans
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
