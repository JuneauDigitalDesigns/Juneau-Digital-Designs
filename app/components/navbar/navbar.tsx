"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { TRADE_PAGES } from "@/app/data/trade-pages";
import TradesMenu, { Chevron } from "./TradesMenu";

export default function Navbar() {
    const [showNav, setShowNav] = useState(false);
    /** The mobile menu's own Trades disclosure. The desktop one is `TradesMenu`. */
    const [showTrades, setShowTrades] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();

    /* Closing the menu also collapses Trades, so reopening it never starts expanded. Done here
       rather than in an effect on `showNav`: the two belong to the same action. */
    const closeNav = () => {
        setShowNav(false);
        setShowTrades(false);
    };

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

                {/* Desktop nav, pinned far right. Two outlined pills (About, Trades) then the
                    two coral asks: the outline says "another page", the fill says "do this", so
                    the row still has one primary pair rather than four equal buttons. */}
                <div className="ml-auto hidden items-center gap-4 md:flex">
                    <Link href="/about" className="nav-pill">
                        About
                    </Link>
                    <TradesMenu />
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
                    onClick={() => (showNav ? closeNav() : setShowNav(true))}
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
                            {/* Same pair as the desktop bar, in the same order. Trades expands in
                                place rather than dropping over the page: there is nothing beside
                                it on a phone for a floating panel to sit against. */}
                            <Link
                                className="nav-pill w-full justify-center"
                                href="/about"
                                onClick={closeNav}
                            >
                                About
                            </Link>
                            <button
                                type="button"
                                className="nav-pill w-full justify-center"
                                aria-expanded={showTrades}
                                onClick={() => setShowTrades(prev => !prev)}
                            >
                                Trades
                                <Chevron open={showTrades} />
                            </button>
                            <AnimatePresence initial={false}>
                                {showTrades && (
                                    <motion.ul
                                        key="trades-mobile"
                                        className="nav-trades-mobile"
                                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        {TRADE_PAGES.map(trade => (
                                            <li key={trade.href}>
                                                <Link
                                                    href={trade.href}
                                                    className="nav-trades-link"
                                                    onClick={closeNav}
                                                >
                                                    {trade.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </motion.ul>
                                )}
                            </AnimatePresence>
                            <Link
                                className="btn primary w-full justify-center"
                                href="/pricing"
                                onClick={closeNav}
                            >
                                See Plans
                            </Link>
                            <Link
                                className="btn primary w-full justify-center"
                                href="/portal"
                                onClick={closeNav}
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
