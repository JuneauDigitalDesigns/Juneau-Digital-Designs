"use client"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe, faPhone, faCalendarCheck, faChartBar, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Scroll reveal hook ───────────────────────────────────── */
function useReveal(options: IntersectionObserverInit = {}) {
    const ref = useRef<HTMLElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        el.classList.add("is-in");
                        io.unobserve(el);
                    }
                });
            },
            { threshold: 0.15, rootMargin: "0px 0px -8% 0px", ...options }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return ref;
}

function Reveal({
    children,
    delay = 0,
    className = "",
    style,
    as: Tag = "div",
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
    style?: React.CSSProperties;
    as?: React.ElementType;
}) {
    const ref = useReveal();
    return (
        <Tag
            ref={ref}
            className={`reveal ${className}`}
            data-delay={delay || undefined}
            style={style}
        >
            {children}
        </Tag>
    );
}

/* ── Animated counter ────────────────────────────────────── */
function useCounter(
    target: number,
    { duration = 1600, decimals = 0 }: { duration?: number; decimals?: number } = {}
): [React.RefObject<HTMLSpanElement | null>, string] {
    const [value, setValue] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const startedRef = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (!e.isIntersecting || startedRef.current) return;
                    startedRef.current = true;
                    const t0 = performance.now();
                    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
                    const step = (now: number) => {
                        const t = Math.min(1, (now - t0) / duration);
                        setValue(target * ease(t));
                        if (t < 1) requestAnimationFrame(step);
                        else setValue(target);
                    };
                    requestAnimationFrame(step);
                });
            },
            { threshold: 0.3 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [target, duration]);

    const display =
        decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
    return [ref, display];
}

function CounterEl({
    to,
    duration,
    decimals = 0,
    suffix = "",
}: {
    to: number;
    duration?: number;
    decimals?: number;
    suffix?: string;
}) {
    const [ref, val] = useCounter(to, { duration, decimals });
    return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Hero ─────────────────────────────────────────────────── */
function Hero() {
    return (
        <section
            style={{
                position: "relative",
                overflow: "hidden",
                padding: "140px 0 100px",
                minHeight: "80vh",
                display: "flex",
                alignItems: "center",
            }}
        >
            {/* Aurora grid overlay */}
            <div className="aurora-grid" />

            {/* Aurora blob background */}
            <div className="aurora-bg">
                <div
                    className="aurora-blob"
                    style={{
                        width: 620,
                        height: 620,
                        background: "radial-gradient(circle, rgba(182,168,255,0.55) 0%, transparent 70%)",
                        left: "5%",
                        top: "10%",
                    }}
                />
                <div
                    className="aurora-blob"
                    style={{
                        width: 540,
                        height: 540,
                        background: "radial-gradient(circle, rgba(120,90,255,0.45) 0%, transparent 70%)",
                        right: "8%",
                        top: "0%",
                        animationDelay: "-8s",
                    }}
                />
                <div
                    className="aurora-blob"
                    style={{
                        width: 700,
                        height: 700,
                        background: "radial-gradient(circle, rgba(38,80,180,0.5) 0%, transparent 70%)",
                        left: "30%",
                        top: "30%",
                        animationDelay: "-14s",
                    }}
                />
            </div>

            {/* Bottom fade — blends aurora into next section */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 200,
                    background: "linear-gradient(to bottom, transparent, var(--bg))",
                    zIndex: 1,
                    pointerEvents: "none",
                }}
            />

            {/* Content */}
            <div
                style={{
                    position: "relative",
                    zIndex: 2,
                    width: "100%",
                    maxWidth: 1240,
                    margin: "0 auto",
                    padding: "0 max(24px, 4vw)",
                    textAlign: "center",
                }}
            >
                <Reveal>
                    <h1
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(48px, 7vw, 96px)",
                            fontWeight: 400,
                            lineHeight: 0.98,
                            letterSpacing: "-0.035em",
                            color: "var(--fg)",
                            marginBottom: 28,
                        }}
                    >
                        We build your site.
                        <span
                            style={{
                                display: "block",
                                fontStyle: "italic",
                                color: "var(--accent)",
                            }}
                        >
                            Your site books your clients.
                        </span>
                    </h1>
                </Reveal>

                <Reveal delay={2}>
                    <p
                        style={{
                            fontSize: 18,
                            lineHeight: 1.6,
                            color: "var(--fg-2)",
                            maxWidth: "54ch",
                            margin: "0 auto 36px",
                        }}
                    >
                        A normal website loses leads. Our sites are built with a powerful AI voice receptionist baked in, so you never miss a call — even at 2 a.m. on a Sunday.
                    </p>
                </Reveal>

                <Reveal delay={3} style={{ marginBottom: 80 }}>
                    <a href="/pricing" className="btn primary lg">
                        Get Started
                    </a>
                </Reveal>

            </div>
        </section>
    );
}

/* ── Services / What We Offer ─────────────────────────────── */
function Offer() {
    interface Service {
        id: string;
        title: string;
        icon: IconDefinition;
        tagline: string;
        description: string;
        bullets: string[];
        availableOn: string;
    }

    const services: Service[] = [
        {
            id: "website",
            title: "Website & Local SEO",
            icon: faGlobe,
            tagline: "A site that ranks, loads fast, and converts.",
            description: "We build a custom, lightning-fast website served from Vercel's global edge — not a template, not a builder. Every page is structured for local search, scored for 95+ Lighthouse on mobile, and wired with schema markup so Google knows exactly who you are and where you serve.",
            bullets: [
                "Custom one-page website built for your brand and market",
                "Vercel edge delivery — faster than your competitors' hosting",
                "95+ Lighthouse mobile score, schema markup for local search",
                "Google Business Profile optimization",
                
            ],
            availableOn: "All plans",
        },
        {
            id: "receptionist",
            title: "AI Voice Receptionist",
            icon: faPhone,
            tagline: "Every call answered. Every caller qualified. 24/7.",
            description: "Your existing number rolls to a Twilio line that streams in under a second to an ElevenLabs voice powered by an OpenAI reasoning loop. It knows your services, hours, prices, and service area — and it books real appointments, not just takes messages.",
            bullets: [
                "24/7 AI voice answers every inbound call under 1.4 seconds",
                "Trained on your exact services, pricing, hours, and service area",
                "Qualifies callers before transferring or booking",
                "Owner SMS alert sent in under 60 seconds per captured lead",
                "Monthly call review and AI tuning session included",
                "Smart contact forms with instant lead capture and follow-up",
            ],
            availableOn: "Growth & Enterprise plans",
        },
        {
            id: "dashboard",
            title: "Owner Dashboard & Reports",
            icon: faChartBar,
            tagline: "Every call, booking, and dollar — visible at a glance.",
            description: "Your dashboard shows every call, and every booking. Monthly performance reports are included on all plans. Growth clients get bi-monthly deep-dives. Enterprise clients get quarterly strategy sessions with our founder — no tickets, no bots.",
            bullets: [
                "View all calls and bookings in a simple dashboard",
                "Real-time call log and booking feed",
                "Daily and Weekly performance reports with insights",
                
                
            ],
            availableOn: "Growth & Enterprise plans",
        },
    ];

    const [activeId, setActiveId] = useState<string>(services[0].id);
    const active = services.find(s => s.id === activeId)!;

    return (
        <section style={{ position: "relative", padding: "120px 0" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
                <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
                    <span className="eyebrow" style={{ marginBottom: 20 }}>Our Services</span>
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(36px, 5vw, 64px)",
                            fontWeight: 400,
                            letterSpacing: "-0.025em",
                            color: "var(--fg)",
                            marginTop: 16,
                            marginBottom: 12,
                        }}
                    >
                        What We <em style={{ color: "var(--accent)", fontStyle: "italic" }}>Deliver</em>
                    </h2>
                    <p className="kicker">Select a service to see what&apos;s included</p>
                </Reveal>

                {/* Pill selector */}
                <Reveal delay={1}>
                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            justifyContent: "center",
                            flexWrap: "wrap",
                            marginBottom: 40,
                        }}
                    >
                        {services.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setActiveId(s.id)}
                                style={{
                                    border: "1px solid",
                                    borderColor: activeId === s.id ? "var(--accent)" : "var(--rule)",
                                    borderRadius: 999,
                                    padding: "10px 22px",
                                    background: activeId === s.id ? "var(--accent)" : "var(--surface)",
                                    color: activeId === s.id ? "#06121a" : "var(--fg-2)",
                                    fontSize: 13,
                                    fontFamily: "var(--font-mono)",
                                    cursor: "pointer",
                                    transition: "all 0.18s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    letterSpacing: "0.01em",
                                }}
                            >
                                <FontAwesomeIcon icon={s.icon} style={{ fontSize: 12 }} />
                                {s.title}
                            </button>
                        ))}
                    </div>
                </Reveal>

                {/* Detail panel */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeId}
                        className="glass"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        style={{ padding: "40px 36px", borderRadius: 22, position: "relative", overflow: "hidden" }}
                    >
                        {/* Accent top bar */}
                        <div
                            style={{
                                position: "absolute",
                                inset: "0 0 auto 0",
                                height: 2,
                                borderRadius: "22px 22px 0 0",
                                background: "linear-gradient(90deg, var(--accent), rgba(182,168,255,0.3))",
                            }}
                        />
                        <div className="grid-2col-responsive" style={{ alignItems: "start" }}>
                            {/* Left: description */}
                            <div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                    {active.availableOn}
                                </div>
                                <h3
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: "clamp(24px, 3vw, 38px)",
                                        fontWeight: 400,
                                        letterSpacing: "-0.02em",
                                        color: "var(--fg)",
                                        marginBottom: 16,
                                        lineHeight: 1.1,
                                    }}
                                >
                                    {active.title}
                                </h3>
                                <p
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: 17,
                                        fontStyle: "italic",
                                        color: "var(--accent)",
                                        marginBottom: 16,
                                        lineHeight: 1.4,
                                    }}
                                >
                                    {active.tagline}
                                </p>
                                <p style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 15 }}>
                                    {active.description}
                                </p>
                            </div>
                            {/* Right: bullets */}
                            <div>
                                <div className="kicker" style={{ marginBottom: 16 }}>What&apos;s included</div>
                                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                                    {active.bullets.map((bullet, i) => (
                                        <li
                                            key={i}
                                            style={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                gap: 12,
                                                fontSize: 14.5,
                                                color: "var(--fg-2)",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            <span style={{
                                                marginTop: 5,
                                                width: 6,
                                                height: 6,
                                                borderRadius: "50%",
                                                background: "var(--accent)",
                                                flexShrink: 0,
                                            }} />
                                            {bullet}
                                        </li>
                                    ))}
                                </ul>
                                <div style={{ marginTop: 28 }}>
                                    <a href="/pricing" className="btn primary" style={{ display: "inline-flex" }}>
                                        View Pricing →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </section>
    );
}

/* ── How It Works ─────────────────────────────────────────── */
/* copy from design handoff TECH_ROWS (df-shared.jsx) */
const TECH_ROWS = [
    {
        simple: "A website that's faster than your competitors'.",
        tech: "Astro + Tailwind static build, served from Cloudflare's edge. 95+ Lighthouse on mobile, schema-marked-up for local search.",
    },
    {
        simple: "Your number forwards to a smart voice that picks up 24/7.",
        tech: "Your existing line rolls to a Twilio number. Sub-second streaming to an ElevenLabs voice + OpenAI reasoning loop.",
    },
    {
        simple: "The AI knows YOUR services, hours, prices, service area.",
        tech: "Custom system prompt + retrieval index of your menu, FAQ, holidays. Updated whenever your business changes.",
    },
    {
        simple: "If a caller wants to book, it actually books — for real.",
        tech: "The AI qualifies the caller, then creates a new entry on Airtable. You visit your dashboard to review and confirm the booking — no bots, no fake appointments.",
    },
    {
        simple: "You no longer miss leads from calls, even at 2 a.m. on a Sunday.",
        tech: "Every call is answered under 1.4 seconds. Booking is handled without your involvement.",
    },
];

function HowItWorks() {
    return (
        <section style={{ position: "relative", padding: "120px 0" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>

                {/* 2-col header */}
                <Reveal>
                    <div className="hiw-header-grid">
                        <div style={{ width: "100%" }}>
                            <div className="kicker" style={{ marginBottom: 16 }}>━━ How it works</div>
                            <h2
                                style={{
                                    fontFamily: "var(--font-display)",
                                    fontSize: "clamp(36px, 5vw, 64px)",
                                    fontWeight: 400,
                                    letterSpacing: "-0.025em",
                                    color: "var(--fg)",
                                    lineHeight: 1.05,
                                }}
                            >
                                The plain version.{" "}
                                <em style={{ color: "var(--accent)", fontStyle: "italic" }}>And the technical one.</em>
                            </h2>
                        </div>
                    </div>
                </Reveal>

                {/* Table */}
                <Reveal delay={1}>
                    <div style={{ width: "100%" }}>
                        {/* Header row */}
                        <div className="hiw-header-row">
                            <div className="kicker">━ #</div>
                            <div className="kicker">━ The simple version</div>
                            <div className="kicker hiw-tech-col">━ Under the hood</div>
                        </div>

                        {/* Data rows */}
                        {TECH_ROWS.map((row, i) => (
                            <motion.div
                                key={i}
                                className="hiw-row"
                                whileHover={{ background: "var(--surface)" }}
                            >
                                <div
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: 22,
                                        fontWeight: 300,
                                        color: "var(--fg-3)",
                                        minWidth: 40,
                                        paddingTop: 2,
                                    }}
                                >
                                    {String(i + 1).padStart(2, "0")}
                                </div>
                                <div
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: "clamp(16px, 2.5vw, 22px)",
                                        fontWeight: 400,
                                        letterSpacing: "-0.015em",
                                        color: "var(--fg)",
                                        lineHeight: 1.3,
                                    }}
                                >
                                    {row.simple}
                                </div>
                                <div
                                    className="hiw-tech-cell"
                                    style={{
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 12.5,
                                        lineHeight: 1.7,
                                        color: "var(--fg-2)",
                                        paddingTop: 4,
                                    }}
                                >
                                    {row.tech}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── Testimonials data types ──────────────────────────────── */
interface TestimonialItem {
    quote: string;
    author: string;
    role: string;
    company: string;
}
interface TestimonialStat {
    value: string;
    label: string;
    attribution: string;
}
interface TestimonialsData {
    headline: string;
    items: TestimonialItem[];
    stats: TestimonialStat[];
}

/* ── Testimonial carousel ─────────────────────────────────── */
function TestimonialCarousel({ items }: { items: TestimonialItem[] }) {
    const [activeIdx, setActiveIdx] = useState(0);
    const [showArrows, setShowArrows] = useState(true);
    const touchStartX = useRef<number | null>(null);
    const len = items.length;

    const prev = () => setActiveIdx((i) => (i - 1 + len) % len);
    const next = () => setActiveIdx((i) => (i + 1) % len);

    useEffect(() => {
        const check = () => setShowArrows(window.innerWidth >= 640);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 50) delta < 0 ? next() : prev();
        touchStartX.current = null;
    };

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
                position: "relative",
                perspective: 1200,
                maxWidth: 800,
                margin: "0 auto 48px",
                height: "clamp(260px, 36vw, 340px)",
                overflow: "visible",
            }}
        >
            {items.map((item, i) => {
                const offset = ((i - activeIdx + len) % len + len) % len;
                // Normalize offset so cards on the "left" side get negative offset
                const normalizedOffset = offset > len / 2 ? offset - len : offset;
                const isActive = normalizedOffset === 0;
                const isAdjacent = Math.abs(normalizedOffset) === 1;
                const isVisible = isActive || isAdjacent;

                // Clamp so hidden cards park behind adjacent cards instead of flying in from off-screen
                const clampedPos = Math.max(-1, Math.min(1, normalizedOffset));
                const rotateY = showArrows ? clampedPos * 35 : 0;
                const translateX = showArrows ? clampedPos * 55 : 0;
                const scale = isActive ? 1 : 0.88;
                const opacity = isActive ? 1 : isAdjacent ? 0.65 : 0;
                const zIndex = isActive ? 10 : isAdjacent ? 5 : 0;

                return (
                    <motion.blockquote
                        key={i}
                        className="glass"
                        animate={{
                            rotateY,
                            x: `${translateX}%`,
                            scale,
                            opacity,
                            zIndex,
                        }}
                        transition={{ duration: 0.45, ease: "easeInOut" }}
                        style={{
                            position: "absolute",
                            inset: 0,
                            padding: "clamp(28px, 4vw, 56px) clamp(28px, 5vw, 72px)",
                            textAlign: "center",
                            margin: 0,
                            transformOrigin: "center center",
                            pointerEvents: isVisible ? "auto" : "none",
                            cursor: isAdjacent
                                ? (normalizedOffset < 0 ? "w-resize" : "e-resize")
                                : "default",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "linear-gradient(180deg, rgba(12,24,40,0.97) 0%, rgba(7,16,30,0.99) 100%)",
                        }}
                        onClick={isAdjacent ? (normalizedOffset < 0 ? prev : next) : undefined}
                    >
                        <p
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(18px, 2.8vw, 28px)",
                                fontWeight: 300,
                                fontStyle: "italic",
                                color: "var(--fg-2)",
                                lineHeight: 1.4,
                                maxWidth: "32ch",
                                margin: "0 auto 28px",
                            }}
                        >
                            {item.quote}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: "50%",
                                    background: "linear-gradient(135deg, var(--accent), rgba(182,168,255,0.3))",
                                    flexShrink: 0,
                                }}
                            />
                            <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: 15, fontWeight: 400, color: "var(--fg)" }}>
                                    {item.author}
                                </div>
                                <div className="kicker">
                                    {item.role}{item.company ? ` — ${item.company}` : ""}
                                </div>
                            </div>
                        </div>
                    </motion.blockquote>
                );
            })}

            {/* Arrow buttons — hidden on small screens (<640px), swipe handles navigation there */}
            {len > 1 && showArrows && (
                <>
                    <button
                        onClick={prev}
                        aria-label="Previous testimonial"
                        style={{
                            position: "absolute",
                            left: -72,
                            top: "50%",
                            transform: "translateY(-50%)",
                            zIndex: 20,
                            background: "linear-gradient(135deg, rgba(182,168,255,0.3) 0%, rgba(120,90,255,0.25) 100%)",
                            border: "1.5px solid rgba(182,168,255,0.75)",
                            borderRadius: "50%",
                            width: 48,
                            height: 48,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--accent)",
                            fontSize: 20,
                            boxShadow: "0 4px 24px rgba(120,90,255,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
                            transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.18s",
                        }}
                        onMouseEnter={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.style.background = "linear-gradient(135deg, rgba(182,168,255,0.28) 0%, rgba(120,90,255,0.18) 100%)";
                            btn.style.borderColor = "var(--accent)";
                            btn.style.boxShadow = "0 6px 32px rgba(120,90,255,0.32), inset 0 1px 0 rgba(255,255,255,0.12)";
                            btn.style.transform = "translateY(-50%) scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.style.background = "linear-gradient(135deg, rgba(182,168,255,0.15) 0%, rgba(120,90,255,0.08) 100%)";
                            btn.style.borderColor = "rgba(182,168,255,0.45)";
                            btn.style.boxShadow = "0 4px 24px rgba(120,90,255,0.18), inset 0 1px 0 rgba(255,255,255,0.08)";
                            btn.style.transform = "translateY(-50%) scale(1)";
                        }}
                    >
                        ←
                    </button>
                    <button
                        onClick={next}
                        aria-label="Next testimonial"
                        style={{
                            position: "absolute",
                            right: -72,
                            top: "50%",
                            transform: "translateY(-50%)",
                            zIndex: 20,
                            background: "linear-gradient(135deg, rgba(182,168,255,0.15) 0%, rgba(120,90,255,0.08) 100%)",
                            border: "1.5px solid rgba(182,168,255,0.45)",
                            borderRadius: "50%",
                            width: 48,
                            height: 48,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--accent)",
                            fontSize: 20,
                            boxShadow: "0 4px 24px rgba(120,90,255,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
                            transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.18s",
                        }}
                        onMouseEnter={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.style.background = "linear-gradient(135deg, rgba(182,168,255,0.28) 0%, rgba(120,90,255,0.18) 100%)";
                            btn.style.borderColor = "var(--accent)";
                            btn.style.boxShadow = "0 6px 32px rgba(120,90,255,0.32), inset 0 1px 0 rgba(255,255,255,0.12)";
                            btn.style.transform = "translateY(-50%) scale(1.1)";
                        }}
                        onMouseLeave={(e) => {
                            const btn = e.currentTarget as HTMLButtonElement;
                            btn.style.background = "linear-gradient(135deg, rgba(182,168,255,0.15) 0%, rgba(120,90,255,0.08) 100%)";
                            btn.style.borderColor = "rgba(182,168,255,0.45)";
                            btn.style.boxShadow = "0 4px 24px rgba(120,90,255,0.18), inset 0 1px 0 rgba(255,255,255,0.08)";
                            btn.style.transform = "translateY(-50%) scale(1)";
                        }}
                    >
                        →
                    </button>
                </>
            )}
        </div>
    );
}

/* ── Testimonials ─────────────────────────────────────────── */
// Single source of truth: app/data/testimonials.json
// Add a new entry by appending an object to the "items" array.
import testimonialsData from "@/app/data/testimonials.json";
const tData = testimonialsData as TestimonialsData;

function Testimonials() {
    return (
        <section style={{ position: "relative", padding: "100px 0 120px", overflow: "hidden" }}>
            {/* Bottom fade — blends aurora into next section */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 200,
                    background: "linear-gradient(to bottom, transparent, var(--bg))",
                    zIndex: 1,
                    pointerEvents: "none",
                }}
            />
            {/* Aurora bleed */}
            <div className="aurora-bg" style={{ inset: "0 -10% 30% -10%", opacity: 0.45 }}>
                <div
                    className="aurora-blob"
                    style={{
                        width: 540,
                        height: 540,
                        background: "radial-gradient(circle, rgba(182,168,255,0.5) 0%, transparent 70%)",
                        left: "30%",
                        top: "10%",
                    }}
                />
            </div>

            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)", position: "relative", zIndex: 2 }}>
                <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
                    <span className="eyebrow" style={{ marginBottom: 20 }}>What Clients Say</span>
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(36px, 5vw, 64px)",
                            fontWeight: 400,
                            letterSpacing: "-0.025em",
                            color: "var(--fg)",
                            marginTop: 16,
                            marginBottom: 0,
                        }}
                    >
                        {tData.headline}
                    </h2>
                </Reveal>

                {/* 3D rotating card carousel */}
                <Reveal delay={1}>
                    <TestimonialCarousel items={tData.items} />
                </Reveal>

                {/* Stats grid */}
                <Reveal delay={2}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
                            borderTop: "1px solid var(--rule)",
                            paddingTop: 40,
                            maxWidth: 800,
                            margin: "0 auto",
                            gap: 0,
                        }}
                    >
                        {tData.stats.flatMap((stat, i) => [
                            <div key={`stat-${i}`} style={{ padding: "0 24px", textAlign: "center" }}>
                                <div
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: "clamp(32px, 5vw, 56px)",
                                        fontWeight: 300,
                                        color: "var(--accent)",
                                        letterSpacing: "-0.03em",
                                    }}
                                >
                                    {stat.value}
                                </div>
                                <div style={{ fontSize: 14, color: "var(--fg-2)", marginTop: 6 }}>
                                    {stat.label}
                                </div>
                                <div className="kicker" style={{ marginTop: 4 }}>
                                    {stat.attribution}
                                </div>
                            </div>,
                            i < tData.stats.length - 1
                                ? <div key={`div-${i}`} style={{ width: 1, background: "var(--rule)" }} />
                                : null,
                        ])}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── CTA / Contact ────────────────────────────────────────── */
/* copy migrated from original Contact() component */
function Contact() {
    return (
        <section style={{ position: "relative", padding: "80px 0 40px", overflow: "hidden" }}>
            {/* Aurora blobs */}
            <div className="aurora-bg" style={{ inset: 0, opacity: 0.7 }}>
                <div
                    className="aurora-blob"
                    style={{
                        width: 800,
                        height: 600,
                        background: "radial-gradient(circle, rgba(182,168,255,0.5) 0%, transparent 70%)",
                        left: "10%",
                        top: "-20%",
                    }}
                />
                <div
                    className="aurora-blob"
                    style={{
                        width: 600,
                        height: 600,
                        background: "radial-gradient(circle, rgba(120,90,255,0.45) 0%, transparent 70%)",
                        right: "0%",
                        bottom: "-20%",
                        animationDelay: "-10s",
                    }}
                />
            </div>

            <div
                style={{
                    position: "relative",
                    zIndex: 2,
                    maxWidth: 1240,
                    margin: "0 auto",
                    padding: "0 max(24px, 4vw)",
                    textAlign: "center",
                }}
            >
                <Reveal>
                    <span className="eyebrow" style={{ marginBottom: 24 }}>Let&apos;s Build Something Great</span>
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(40px, 6vw, 80px)",
                            fontWeight: 400,
                            letterSpacing: "-0.03em",
                            color: "var(--fg)",
                            maxWidth: "20ch",
                            margin: "20px auto 0",
                            lineHeight: 1.05,
                        }}
                    >
                        Ready to{" "}
                        <em style={{ color: "var(--accent)", fontStyle: "italic" }}>Elevate</em>
                        {" "}Your Digital Presence?
                    </h2>
                </Reveal>

                <Reveal delay={1}>
                    <p
                        style={{
                            marginTop: 22,
                            fontSize: 18,
                            color: "var(--fg-2)",
                            maxWidth: "52ch",
                            margin: "22px auto 0",
                            lineHeight: 1.6,
                        }}
                    >
                        Have a project in mind or just want to explore ideas? We keep the process simple, collaborative, and focused on results your business can feel.
                    </p>
                </Reveal>

                <Reveal delay={2}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 20 }}>
                        {["Fast turnaround", "Clear communication", "Built for growth"].map((tag) => (
                            <span
                                key={tag}
                                style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 12,
                                    color: "var(--fg-3)",
                                    border: "1px solid var(--rule)",
                                    borderRadius: 999,
                                    padding: "5px 14px",
                                    background: "var(--surface)",
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </Reveal>

                <Reveal delay={3}>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, marginTop: 32 }}>
                        <a href="/pricing" className="btn primary lg">
                            View Pricing
                        </a>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── Missed Calls Revenue Calculator ────────────────────── */
function MissedCallsCalculator() {
    const MISSED_MIN = 1, MISSED_MAX = 50;
    const RECOVERY_MIN = 1, RECOVERY_MAX = 100;
    const JOB_SLIDER_MIN = 0, JOB_SLIDER_MAX = 100;

    // Log scale helpers: slider 0–100 → $50–$500,000
    function sliderToJobValue(pos: number): number {
        return Math.round(50 * Math.pow(10000, pos / 100));
    }
    function jobValueToSlider(val: number): number {
        return (Math.log(val / 50) / Math.log(10000)) * 100;
    }

    const [missedPerWeek, setMissedPerWeek] = useState(10);
    const [jobSliderPos, setJobSliderPos] = useState(() => jobValueToSlider(800));
    const [currentRecovery, setCurrentRecovery] = useState(20);

    const avgJobValue = sliderToJobValue(jobSliderPos);

    const missedPerYear = missedPerWeek * 52;
    const unrecoveredPerYear = missedPerYear * (1 - currentRecovery / 100);
    const revenueOnTable = unrecoveredPerYear * avgJobValue;
    const recoverableRevenue = revenueOnTable * 0.73;

    function formatDollars(n: number): string {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
        if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
        return `$${Math.round(n).toLocaleString()}`;
    }

    const missedPct = ((missedPerWeek - MISSED_MIN) / (MISSED_MAX - MISSED_MIN)) * 100;
    const jobPct = jobSliderPos;
    const recoveryPct = ((currentRecovery - RECOVERY_MIN) / (RECOVERY_MAX - RECOVERY_MIN)) * 100;

    return (
        <section style={{ position: "relative", padding: "120px 0", overflow: "hidden" }}>
            {/* Aurora grid */}
            <div className="aurora-grid" />

            {/* Aurora blobs */}
            <div className="aurora-bg">
                <div
                    className="aurora-blob"
                    style={{
                        width: 560,
                        height: 560,
                        background: "radial-gradient(circle, rgba(182,168,255,0.40) 0%, transparent 70%)",
                        right: "5%",
                        top: "0%",
                        animationDelay: "-6s",
                    }}
                />
                <div
                    className="aurora-blob"
                    style={{
                        width: 480,
                        height: 480,
                        background: "radial-gradient(circle, rgba(38,80,180,0.45) 0%, transparent 70%)",
                        left: "2%",
                        bottom: "10%",
                        animationDelay: "-16s",
                    }}
                />
            </div>

            <div
                style={{
                    position: "relative",
                    zIndex: 2,
                    maxWidth: 1240,
                    margin: "0 auto",
                    padding: "0 max(24px, 4vw)",
                }}
            >
                {/* Header */}
                <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
                    <span className="eyebrow" style={{ marginBottom: 20 }}>Revenue Calculator</span>
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(36px, 5vw, 64px)",
                            fontWeight: 400,
                            letterSpacing: "-0.025em",
                            color: "var(--fg)",
                            marginTop: 16,
                            marginBottom: 12,
                            lineHeight: 1.1,
                        }}
                    >
                        How much are missed calls{" "}
                        <em style={{ color: "var(--accent)", fontStyle: "italic" }}>costing you?</em>
                    </h2>
                    <p
                        style={{
                            color: "var(--fg-2)",
                            fontSize: 16,
                            maxWidth: "50ch",
                            margin: "0 auto",
                            lineHeight: 1.6,
                        }}
                    >
                        Move the sliders to match your business. See your real numbers instantly.
                    </p>
                </Reveal>

                {/* Glass card */}
                <Reveal delay={1}>
                    <div
                        className="glass"
                        style={{
                            padding: "40px 36px",
                            borderRadius: 22,
                            position: "relative",
                            overflow: "hidden",
                        }}
                    >
                        {/* Accent top bar */}
                        <div
                            style={{
                                position: "absolute",
                                inset: "0 0 auto 0",
                                height: 2,
                                borderRadius: "22px 22px 0 0",
                                background: "linear-gradient(90deg, var(--accent), rgba(182,168,255,0.3))",
                            }}
                        />

                        {/* Sliders */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                                gap: "40px 48px",
                                marginBottom: 48,
                            }}
                        >
                            {/* Slider 1: Missed calls / week */}
                            <div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline",
                                        marginBottom: 14,
                                    }}
                                >
                                    <span className="kicker">Missed calls / week</span>
                                    <span
                                        style={{
                                            fontFamily: "var(--font-display)",
                                            fontSize: 28,
                                            fontWeight: 400,
                                            color: "var(--fg)",
                                            letterSpacing: "-0.02em",
                                        }}
                                    >
                                        {missedPerWeek}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    className="calc-slider"
                                    min={MISSED_MIN}
                                    max={MISSED_MAX}
                                    step={1}
                                    value={missedPerWeek}
                                    onChange={e => setMissedPerWeek(Number(e.target.value))}
                                    style={{ "--pct": `${missedPct}%` } as React.CSSProperties}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginTop: 8,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                        color: "var(--fg-3)",
                                        letterSpacing: "0.1em",
                                    }}
                                >
                                    <span>1</span><span>50</span>
                                </div>
                            </div>

                            {/* Slider 2: Average job value */}
                            <div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline",
                                        marginBottom: 14,
                                    }}
                                >
                                    <span className="kicker">Avg job value</span>
                                    <span
                                        style={{
                                            fontFamily: "var(--font-display)",
                                            fontSize: 28,
                                            fontWeight: 400,
                                            color: "var(--fg)",
                                            letterSpacing: "-0.02em",
                                        }}
                                    >
                                        {avgJobValue >= 1000
                                            ? `$${(avgJobValue / 1000).toFixed(avgJobValue >= 100000 ? 0 : 1)}K`
                                            : `$${avgJobValue.toLocaleString()}`}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    className="calc-slider"
                                    min={JOB_SLIDER_MIN}
                                    max={JOB_SLIDER_MAX}
                                    step={0.5}
                                    value={jobSliderPos}
                                    onChange={e => setJobSliderPos(Number(e.target.value))}
                                    style={{ "--pct": `${jobPct}%` } as React.CSSProperties}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginTop: 8,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                        color: "var(--fg-3)",
                                        letterSpacing: "0.1em",
                                    }}
                                >
                                    <span>$50</span><span>$500K</span>
                                </div>
                            </div>

                            {/* Slider 3: Current recovery rate */}
                            <div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "baseline",
                                        marginBottom: 14,
                                    }}
                                >
                                    <span className="kicker">Calls currently recovered</span>
                                    <span
                                        style={{
                                            fontFamily: "var(--font-display)",
                                            fontSize: 28,
                                            fontWeight: 400,
                                            color: currentRecovery >= 90 ? "var(--accent)" : "var(--fg)",
                                            letterSpacing: "-0.02em",
                                            transition: "color 0.2s ease",
                                        }}
                                    >
                                        {currentRecovery}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    className="calc-slider"
                                    min={RECOVERY_MIN}
                                    max={RECOVERY_MAX}
                                    step={1}
                                    value={currentRecovery}
                                    onChange={e => setCurrentRecovery(Number(e.target.value))}
                                    style={{ "--pct": `${recoveryPct}%` } as React.CSSProperties}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginTop: 8,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                        color: "var(--fg-3)",
                                        letterSpacing: "0.1em",
                                    }}
                                >
                                    <span>1%</span><span>100%</span>
                                </div>
                            </div>
                        </div>

                        {/* Results divider */}
                        <div style={{ borderTop: "1px solid var(--rule)", marginBottom: 40 }} />

                        {/* Result figures */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1px 1fr",
                                gap: "0 32px",
                                alignItems: "center",
                                marginBottom: 28,
                            }}
                        >
                            {/* Left: Revenue on table */}
                            <div style={{ textAlign: "center" }}>
                                <div className="kicker" style={{ marginBottom: 12 }}>Revenue Left on the Table</div>
                                <div
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: "clamp(40px, 6vw, 80px)",
                                        fontWeight: 400,
                                        lineHeight: 1,
                                        letterSpacing: "-0.04em",
                                        background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.55) 100%)",
                                        WebkitBackgroundClip: "text",
                                        backgroundClip: "text",
                                        color: "transparent",
                                    }}
                                >
                                    {formatDollars(revenueOnTable)}
                                </div>
                                <div className="kicker" style={{ marginTop: 8 }}>per year</div>
                            </div>

                            {/* Vertical rule */}
                            <div style={{ background: "var(--rule)", height: 80, borderRadius: 1 }} />

                            {/* Right: Recoverable via AI */}
                            <div style={{ textAlign: "center" }}>
                                <div className="kicker" style={{ marginBottom: 12 }}>Recoverable via AI Receptionist</div>
                                <div
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: "clamp(40px, 6vw, 80px)",
                                        fontWeight: 400,
                                        lineHeight: 1,
                                        letterSpacing: "-0.04em",
                                        color: "var(--accent)",
                                        textShadow: "0 0 40px var(--accent-glow)",
                                    }}
                                >
                                    {formatDollars(recoverableRevenue)}
                                </div>
                                <div className="kicker" style={{ marginTop: 8 }}>per year</div>
                            </div>
                        </div>

                        {/* Footnote */}
                        <div style={{ textAlign: "center" }}>
                            <span className="kicker">━━ Based on 73% AI booking rate · 52 weeks / year</span>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function HomePageClient() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        const prev = window.history.scrollRestoration;
        window.history.scrollRestoration = "manual";
        window.scrollTo(0, 0);
        return () => { window.history.scrollRestoration = prev; };
    }, []);

    return (
        <div style={{ width: "100%", background: "var(--bg)" }}>
            <Hero />
            <MissedCallsCalculator />
            <Offer />
            <HowItWorks />
            <Testimonials />
            <Contact />
        </div>
    );
}
