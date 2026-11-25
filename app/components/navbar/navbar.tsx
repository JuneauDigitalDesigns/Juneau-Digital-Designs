"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CONTACT } from "@/app/data/contact";
import { TRADE_PAGES } from "@/app/data/trade-pages";
import { SERVICE_PAGES } from "@/app/data/service-pages";
import { MONOGRAM, WORDMARK } from "@/app/data/brand-marks";
import TradesMenu, { Chevron } from "./TradesMenu";
import { DoorGlyph, PhoneGlyph } from "./NavIcons";

/** The pages in the middle of the bar, left to right. Services, then Trades, sit between About and
    Contact (Xander, 24 Nov 2026: what you sell, then who it's for). */
const LINKS: { href: string; label: string }[] = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/pricing", label: "Pricing" },
];

export default function Navbar() {
    const [showNav, setShowNav] = useState(false);
    /** The mobile menu's own Trades disclosure. The desktop one is `TradesMenu`. */
    const [showTrades, setShowTrades] = useState(false);
    /** The mobile menu's Services disclosure, built the same way. */
    const [showServices, setShowServices] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();
    const pathname = usePathname();

    /* Closing the menu also collapses Trades, so reopening it never starts expanded. Done here
       rather than in an effect on `showNav`: the two belong to the same action. */
    const closeNav = () => {
        setShowNav(false);
        setShowTrades(false);
        setShowServices(false);
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

    /* Home only counts as current on "/" itself; every other link also covers the pages beneath
       it, so /contact/thank-you still shows Contact as where you are. */
    const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

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
            {/* Three zones, not one row pushed right (Xander, 19 Nov 2026): the logo, the pages
                centred in the bar, and the two actions hard against the right edge. The middle
                column is what centres the links, and it stays centred in the bar rather than
                between its neighbours, so the row does not drift as pages are added.

                One filled button only. Two coral buttons meant neither was the ask; now the
                phone is the ask and Portal is the way back in for people who already bought. */}
            <div className="nav-bar mx-auto w-full max-w-7xl px-4 sm:px-6">
                {/* The brand as markup (Xander, 24 Nov 2026): monogram, a dark hairline, the
                    wordmark, all transparent, no baked-in box. Below 640px the wordmark stands
                    alone. The link names the business, so both pictures are decorative. */}
                <Link href="/" aria-label="Juneau Digital Designs, home" className="nav-brand">
                    <Image src={MONOGRAM.src} alt="" width={MONOGRAM.width} height={MONOGRAM.height} priority className="nav-brand-mono" />
                    <span className="nav-brand-rule" aria-hidden="true" />
                    <Image src={WORDMARK.src} alt="" width={WORDMARK.width} height={WORDMARK.height} priority className="nav-brand-word" />
                </Link>

                <nav className="nav-links" aria-label="Pages">
                    {LINKS.map((link) =>
                        link.href === "/contact" ? (
                            /* Services and Trades belong between About and Contact, and they are
                               menus rather than links, so they are placed here instead of in LINKS. */
                            <span key="trades-and-contact" className="contents">
                                <TradesMenu label="Services" items={SERVICE_PAGES} menuClassName="nav-services-menu" />
                                <TradesMenu />
                                <Link
                                    href={link.href}
                                    className={`nav-link${isCurrent(link.href) ? " nav-link-current" : ""}`}
                                    aria-current={isCurrent(link.href) ? "page" : undefined}
                                >
                                    {link.label}
                                </Link>
                            </span>
                        ) : (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`nav-link${isCurrent(link.href) ? " nav-link-current" : ""}`}
                                aria-current={isCurrent(link.href) ? "page" : undefined}
                            >
                                {link.label}
                            </Link>
                        ),
                    )}
                </nav>

                <div className="nav-actions">
                    {/* The number itself, not "Call": it is more use to someone deciding whether
                        to ring, and a bare number is harder to mistake for a form. */}
                    <a href={CONTACT.phoneHref} className="btn primary nav-tel">
                        <PhoneGlyph />
                        {CONTACT.phoneDisplay}
                    </a>
                    <Link href="/portal" className="nav-portal">
                        <DoorGlyph />
                        Portal
                    </Link>

                    {/* Mobile: the call button stays in the bar rather than going in the menu,
                        since dialling is the likeliest thing a visitor on a phone wants. */}
                    <a href={CONTACT.phoneHref} className="btn primary nav-tel-sm" aria-label={`Call ${CONTACT.phoneDisplay}`}>
                        <PhoneGlyph size={16} />
                    </a>
                    <button
                        type="button"
                        aria-label={showNav ? "Close navigation menu" : "Open navigation menu"}
                        aria-expanded={showNav}
                        className="nav-burger select-none"
                        onClick={() => (showNav ? closeNav() : setShowNav(true))}
                    >
                        <motion.span
                            key={showNav ? "close" : "open"}
                            initial={{ opacity: 0, rotate: showNav ? -90 : 90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: showNav ? 90 : -90 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="block text-3xl leading-none"
                        >
                            {showNav ? "✕" : "☰"}
                        </motion.span>
                    </button>
                </div>
            </div>

            {/* Mobile menu: the same items in the same order as the bar above. */}
            <AnimatePresence>
                {showNav && (
                    <motion.div
                        key="mobile-menu"
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
                        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4">
                            <Link href="/" className="nav-link-sm" onClick={closeNav}>
                                Home
                            </Link>
                            <Link href="/about" className="nav-link-sm" onClick={closeNav}>
                                About
                            </Link>
                            <button
                                type="button"
                                className="nav-link-sm"
                                aria-expanded={showServices}
                                onClick={() => setShowServices((prev) => !prev)}
                            >
                                Services
                                <Chevron open={showServices} />
                            </button>
                            <AnimatePresence initial={false}>
                                {showServices && (
                                    <motion.ul
                                        key="services-mobile"
                                        className="nav-trades-mobile"
                                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                        {SERVICE_PAGES.map((service) => (
                                            <li key={service.href}>
                                                <Link href={service.href} className="nav-trades-link" onClick={closeNav}>
                                                    {service.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </motion.ul>
                                )}
                            </AnimatePresence>
                            <button
                                type="button"
                                className="nav-link-sm"
                                aria-expanded={showTrades}
                                onClick={() => setShowTrades((prev) => !prev)}
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
                                        {TRADE_PAGES.map((trade) => (
                                            <li key={trade.href}>
                                                <Link href={trade.href} className="nav-trades-link" onClick={closeNav}>
                                                    {trade.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </motion.ul>
                                )}
                            </AnimatePresence>
                            <Link href="/contact" className="nav-link-sm" onClick={closeNav}>
                                Contact
                            </Link>
                            <Link href="/pricing" className="nav-link-sm" onClick={closeNav}>
                                Pricing
                            </Link>
                            <Link href="/portal" className="nav-portal nav-portal-sm" onClick={closeNav}>
                                <DoorGlyph size={16} />
                                Portal
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
