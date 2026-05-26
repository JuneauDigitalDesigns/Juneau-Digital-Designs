"use client"
/* Z-index constants: navbar: 50 | grain: 60 | modals: 70 */

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useReducedMotion,
  animate,
} from "framer-motion";
import {
  Globe,
  Phone,
  ChartBar,
  HardDrives,
  Info,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import testimonialsData from "@/app/data/testimonials.json";


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
const tData = testimonialsData as TestimonialsData;


const SPRING = { type: "spring", stiffness: 100, damping: 20 } as const;

const HERO_WORDS = ["Built,", "hosted,", "maintained,"];

const LOGOS = [
    { slug: "vercel", label: "Vercel" },
    { slug: "nextdotjs", label: "Next.js" },
    { slug: "stripe", label: "Stripe" },
    { slug: "elevenlabs", label: "ElevenLabs" },
    { slug: "anthropic", label: "Anthropic" },
    { slug: "airtable", label: "Airtable" },
];

const KINETIC_ITEMS = [
    "Built for local business",
    "AI answering 24/7",
    "Zero missed leads",
    "Fully managed",
];


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
    variant = "up",
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
    style?: React.CSSProperties;
    as?: React.ElementType;
    variant?: "up" | "left";
}) {
    const ref = useReveal();
    const revealClass = variant === "left" ? "reveal-left" : "reveal";
    return (
        <Tag
            ref={ref}
            className={`${revealClass} ${className}`}
            data-delay={delay || undefined}
            style={style}
        >
            {children}
        </Tag>
    );
}

/* â”€â”€ Animated counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function CounterEl({
    to,
    duration = 1.6,
    decimals = 0,
    suffix = "",
}: {
    to: number;
    duration?: number;
    decimals?: number;
    suffix?: string;
}) {
    const nodeRef = useRef<HTMLSpanElement>(null);
    const startedRef = useRef(false);
    useEffect(() => {
        const el = nodeRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (!e.isIntersecting || startedRef.current) return;
                    startedRef.current = true;
                    animate(0, to, {
                        duration,
                        ease: [0.22, 1, 0.36, 1],
                        onUpdate: (v) => {
                            el.textContent =
                                (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()) + suffix;
                        },
                    });
                });
            },
            { threshold: 0.3 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [to, duration, decimals, suffix]);
    return <span ref={nodeRef}>0{suffix}</span>;
}

/* â”€â”€ Spotlight border card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function SpotlightBorderCard({
    children,
    className = "",
    style,
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const spotRef = useRef<HTMLDivElement>(null);
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const card = cardRef.current;
        const spot = spotRef.current;
        if (!card || !spot) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        spot.style.background = `radial-gradient(300px circle at ${x}px ${y}px, rgba(245,237,214,0.12), transparent 70%)`;
    };
    return (
        <div
            ref={cardRef}
            className={`spotlight-card ${className}`}
            style={{ position: "relative", overflow: "hidden", ...style }}
            onMouseMove={handleMouseMove}
        >
            <div
                ref={spotRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                    transition: "background 0.05s",
                }}
            />
            <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
        </div>
    );
}

function Hero() {
    const sectionRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
    const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
    const prefersReducedMotion = useReducedMotion();
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    function handleMagnet(e: React.MouseEvent<HTMLAnchorElement>) {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        mx.set((e.clientX - cx) * 0.35);
        my.set((e.clientY - cy) * 0.35);
    }
    function resetMagnet() {
        mx.set(0);
        my.set(0);
    }
    return (
        <section
            ref={sectionRef}
            style={{
                position: "relative",
                overflow: "hidden",
                minHeight: "100dvh",
                display: "flex",
                alignItems: "center",
            }}
        >
            {/* Geometric dot pattern */}
            <div className="aurora-grid" />

            {/* Bottom fade */}
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

            {/* Split grid content */}
            <div
                style={{
                    position: "relative",
                    zIndex: 2,
                    width: "100%",
                    maxWidth: 1240,
                    margin: "0 auto",
                    padding: "120px max(24px, 4vw) 100px",
                }}
            >
                <div className="hero-split-asymmetric">
                    {/* Left 55%: headline + CTA */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <motion.h1
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: {},
                                visible: { transition: { staggerChildren: 0.08 } },
                            }}
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(56px, 8vw, 112px)",
                                fontWeight: 400,
                                lineHeight: 1.0,
                                letterSpacing: "0.04em",
                                color: "var(--fg)",
                                marginBottom: 20,
                            }}
                        >
                            {HERO_WORDS.map((word) => (
                                <motion.span
                                    key={word}
                                    variants={{
                                        hidden: { opacity: 0, y: 32 },
                                        visible: { opacity: 1, y: 0, transition: SPRING },
                                    }}
                                    style={{ display: "inline-block", marginRight: "0.25em" }}
                                >
                                    {word}
                                </motion.span>
                            ))}
                            <motion.span
                                variants={{
                                    hidden: { opacity: 0, y: 32 },
                                    visible: { opacity: 1, y: 0, transition: SPRING },
                                }}
                                style={{
                                    display: "block",
                                    fontFamily: "var(--font-body)",
                                    fontStyle: "italic",
                                    fontWeight: 300,
                                    fontSize: "clamp(24px, 3.5vw, 48px)",
                                    letterSpacing: "-0.01em",
                                    lineHeight: 1.3,
                                    color: "var(--accent)",
                                    marginTop: 12,
                                }}
                            >
                                and always answering.
                            </motion.span>
                        </motion.h1>

                        <Reveal delay={2} style={{ marginTop: 8 }}>
                            <p
                                style={{
                                    fontSize: 18,
                                    lineHeight: 1.7,
                                    color: "var(--fg-2)",
                                    maxWidth: "42ch",
                                    marginBottom: 32,
                                }}
                            >
                                We own every piece — website, hosting, upkeep, and AI receptionist — so there&apos;s no gap between your marketing and the customers who tried to reach you.
                            </p>
                        </Reveal>

                        <Reveal delay={3}>
                            <motion.a
                                href="/pricing"
                                className="btn primary lg"
                                style={{ display: "inline-flex", x: mx, y: my }}
                                onMouseMove={handleMagnet}
                                onMouseLeave={resetMagnet}
                                transition={SPRING}
                            >
                                Get Started
                            </motion.a>
                        </Reveal>
                    </div>

                    {/* Right 45%: hero image */}
                    <div className="hero-image-container" style={{ position: "relative" }}>
                        <motion.div
                            style={{
                                position: "absolute",
                                inset: 0,
                                y: prefersReducedMotion ? 0 : imgY,
                                borderRadius: 20,
                                overflow: "hidden",
                            }}
                        >
                            <Image
                                src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1334&auto=format&fit=crop"
                                alt="Digital agency workspace"
                                fill
                                priority
                                sizes="(max-width: 768px) 100vw, 45vw"
                                style={{ objectFit: "cover" }}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "linear-gradient(135deg, rgba(7,16,30,0.35) 0%, rgba(7,16,30,0.1) 100%)",
                                }}
                            />
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ── Logo marquee ───────────────────────────────────────────── */
function LogoMarquee() {
    const prefersReducedMotion = useReducedMotion();
    const repeated = Array.from({ length: 8 }, () => LOGOS).flat();
    if (prefersReducedMotion) {
        return (
            <section style={{ padding: "48px 0", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}>
                <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", opacity: 0.6 }}>
                    {LOGOS.map((l) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            key={l.slug}
                            src={`https://cdn.simpleicons.org/${l.slug}/F5EDD6`}
                            alt={l.label}
                            width={32}
                            height={32}
                            style={{ opacity: 0.7 }}
                        />
                    ))}
                </div>
            </section>
        );
    }
    return (
        <section style={{ padding: "48px 0", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", overflow: "hidden" }}>
            <div className="marquee-container" aria-hidden="true">
                <div className="marquee-track">
                    {repeated.map((l, i) => (
                        <span key={i} className="logo-marquee-item">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`https://cdn.simpleicons.org/${l.slug}/F5EDD6`}
                                alt={l.label}
                                width={32}
                                height={32}
                                style={{ opacity: 0.65, display: "block" }}
                            />
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ── Services bento grid ───────────────────────────────────────────── */
function SpotlightGrid() {
    return (
        <section style={{ position: "relative", padding: "120px 0" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
                <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
                    
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(36px, 5vw, 64px)",
                            fontWeight: 400,
                            letterSpacing: "0.03em",
                            color: "var(--fg)",
                            marginTop: 16,
                            marginBottom: 12,
                        }}
                    >
                        What We <em style={{ color: "var(--accent)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>Deliver</em>
                    </h2>
                </Reveal>

                <div className="bento-grid">
                    {/* Cell 1: Website & SEO â€” hero cell (tall, left) */}
                    <SpotlightBorderCard className="glass bento-cell-hero" style={{ padding: "40px 36px", display: "flex", flexDirection: "column" }}>
                        <Globe weight="duotone" size={32} color="var(--accent)" />
                        <h3
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(28px, 3.5vw, 42px)",
                                fontWeight: 400,
                                letterSpacing: "0.03em",
                                color: "var(--fg)",
                                margin: "20px 0 12px",
                                lineHeight: 1.1,
                            }}
                        >
                            Website &amp; Local SEO
                        </h3>
                        <p style={{ color: "var(--fg-2)", fontSize: 15, lineHeight: 1.7 }}>
                            Custom Next.js build served from Vercel&apos;s global edge. 95+ Lighthouse mobile, schema markup, Google Business Profile optimisation.
                        </p>
                        <div
                            style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 11,
                                color: "var(--accent)",
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                marginTop: "auto",
                                paddingTop: 24,
                            }}
                        >
                            All plans
                        </div>
                    </SpotlightBorderCard>

                    {/* Cell 2: AI Voice â€” right top */}
                    <SpotlightBorderCard className="glass" style={{ padding: "36px 32px", display: "flex", flexDirection: "column" }}>
                        <Phone weight="duotone" size={32} color="var(--accent)" />
                        <h3
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(24px, 2.8vw, 34px)",
                                fontWeight: 400,
                                letterSpacing: "0.03em",
                                color: "var(--fg)",
                                margin: "16px 0 10px",
                                lineHeight: 1.1,
                            }}
                        >
                            AI Voice Receptionist
                        </h3>
                        <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.65 }}>
                            24/7 AI voice â€” answers under 1.4 s, qualifies callers, books real appointments.
                        </p>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--accent)", marginTop: "auto", paddingTop: 16, letterSpacing: "-0.02em" }}>
                            &lt;1.4s
                        </div>
                    </SpotlightBorderCard>

                    {/* Cell 3: Dashboard & Reports â€” right bottom */}
                    <SpotlightBorderCard className="glass" style={{ padding: "36px 32px", display: "flex", flexDirection: "column" }}>
                        <ChartBar weight="duotone" size={32} color="var(--accent)" />
                        <h3
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(24px, 2.8vw, 34px)",
                                fontWeight: 400,
                                letterSpacing: "0.03em",
                                color: "var(--fg)",
                                margin: "16px 0 10px",
                                lineHeight: 1.1,
                            }}
                        >
                            Dashboard &amp; Reports
                        </h3>
                        <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.65 }}>
                            Every call, booking, and dollar visible at a glance. Daily, weekly, and monthly reports included.
                        </p>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--accent)", marginTop: "auto", paddingTop: 16, letterSpacing: "-0.02em" }}>
                            Real-time
                        </div>
                    </SpotlightBorderCard>

                    {/* Cell 4: Hosting â€” full-width bottom */}
                    <SpotlightBorderCard className="glass bento-cell-full" style={{ padding: "32px 36px", display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                        <HardDrives weight="duotone" size={32} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <h3
                                style={{
                                    fontFamily: "var(--font-display)",
                                    fontSize: "clamp(22px, 2.5vw, 30px)",
                                    fontWeight: 400,
                                    letterSpacing: "0.03em",
                                    color: "var(--fg)",
                                    margin: "0 0 8px",
                                    lineHeight: 1.1,
                                }}
                            >
                                Managed Hosting &amp; Uptime
                            </h3>
                            <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
                                Fully managed hosting, 99.9% uptime, automatic backups, and security monitoring. Always fast, always on.
                            </p>
                        </div>
                        <a href="/pricing" className="btn primary" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
                            View Pricing <ArrowSquareOut weight="bold" size={14} style={{ marginLeft: 6 }} />
                        </a>
                    </SpotlightBorderCard>
                </div>
            </div>
        </section>
    );
}


function KineticMarquee() {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) {
        return (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                {KINETIC_ITEMS.join("·")}
            </div>
        );
    }
    const tripled = [...KINETIC_ITEMS, ...KINETIC_ITEMS, ...KINETIC_ITEMS];
    return (
        <div style={{ overflow: "hidden", padding: "32px 0", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }} aria-hidden="true">
            <div className="marquee-container">
                <div className="marquee-track kinetic-marquee-track">
                    {tripled.map((item, i) => (
                        <span
                            key={i}
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(18px, 2.5vw, 28px)",
                                color: i % 2 === 0 ? "var(--fg)" : "var(--fg-3)",
                                letterSpacing: "0.06em",
                                padding: "0 40px",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {item}
                            <span style={{ color: "var(--accent)", marginLeft: 40 }}>·</span>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}


const TECH_ROWS = [
    {
        simple: "A website that's faster than your competitors'.",
        tech: "Next.JS + Tailwind static build, served from Vercel's edge. 95+ Lighthouse on mobile, schema-marked-up for local search.",
    },
    {
        simple: "Your number forwards to a smart voice that picks up 24/7.",
        tech: "Your existing line rolls to a Twilio number. Sub-second streaming to an ElevenLabs voice + OpenAI reasoning loop via RetellAI",
    },
    {
        simple: "The AI knows YOUR services, hours, prices, service area.",
        tech: "Custom system prompt + retrieval index of your menu, FAQ, holidays. Updated whenever your business changes.",
    },
    {
        simple: "If a caller wants to book, it actually books — for real.",
        tech: "The AI qualifies the caller, then creates a new entry on Airtable. You visit your dashboard via Looker to review and confirm the booking — no bots, no fake appointments.",
    },
    {
        simple: "You no longer miss leads from calls, even at 11:42 p.m. on a Wednesday.",
        tech: "Every call is answered under 1.4 seconds. Booking is handled without your involvement.",
    },
];

function HowItWorks() {
    const [mode, setMode] = useState<"plain" | "technical">("plain");
    return (
        <section style={{ position: "relative", padding: "120px 0" }} data-hiw-mode={mode}>
            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>

                {/* 2-col header */}
                <Reveal>
                    <div className="hiw-header-grid">
                        <div style={{ width: "100%" }}>
                            
                            <h2
                                style={{
                                    fontFamily: "var(--font-display)",
                                    fontSize: "clamp(36px, 5vw, 64px)",
                                    fontWeight: 400,
                                    letterSpacing: "0.03em",
                                    color: "var(--fg)",
                                    lineHeight: 1.05,
                                }}
                            >
                                The plain version.{" "}
                                <em style={{ color: "var(--accent)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>And the technical one.</em>
                            </h2>
                        </div>
                    </div>
                </Reveal>

                {/* Mobile mode toggle */}
                <Reveal delay={1}>
                    <div className="hiw-mode-toggle">
                        {(["plain", "technical"] as const).map((m) => (
                            <button
                                key={m}
                                className={`hiw-mode-btn${mode === m ? " active" : ""}`}
                                onClick={() => setMode(m)}
                                style={{ position: "relative" }}
                            >
                                {m === "plain" ? "Plain English" : "Technical"}
                                {mode === m && (
                                    <motion.div
                                        layoutId="mode-indicator"
                                        style={{
                                            position: "absolute",
                                            bottom: -2,
                                            left: 0,
                                            right: 0,
                                            height: 2,
                                            background: "var(--accent)",
                                            borderRadius: 1,
                                        }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </Reveal>

                {/* Table */}
                <Reveal delay={1} variant="left">
                    <div style={{ width: "100%" }}>
                        {/* Header row — desktop only */}
                        <div className="hiw-header-row">
                            <div className="kicker">#</div>
                            <div className="kicker">PLAIN</div>
                            <div className="kicker">UNDER THE HOOD</div>
                        </div>

                        {/* Data rows */}
                        {TECH_ROWS.map((row, i) => (
                            <motion.div
                                key={i}
                                className="hiw-row"
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.25 }}
                                transition={{ duration: 0.4, delay: i * 0.06 }}
                                whileHover={{ background: "var(--surface)" }}
                            >
                                <div className="hiw-num">{String(i + 1).padStart(2, "0")}</div>

                                <div className="hiw-simple-cell">
                                    <div className="hiw-cell-label">PLAIN</div>
                                    <div className="hiw-simple-text">{row.simple}</div>
                                </div>

                                <div className="hiw-tech-cell">
                                    <div className="hiw-cell-label hiw-tech-label">UNDER THE HOOD</div>
                                    <div className="hiw-tech-text">{row.tech}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── Testimonial marquee ───────────────────────────────────────────── */
function TestimonialCard({ item }: { item: TestimonialItem }) {
    return (
        <blockquote
            className="glass testimonial-card"
            style={{
                padding: "clamp(20px, 3vw, 32px)",
                borderRadius: 16,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                flexShrink: 0,
            }}
        >
            <p
                style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(14px, 1.6vw, 16px)",
                    fontStyle: "italic",
                    fontWeight: 300,
                    color: "var(--fg-2)",
                    lineHeight: 1.6,
                    margin: 0,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                } as React.CSSProperties}
            >
                {item.quote}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--accent), rgba(245,237,214,0.3))",
                        flexShrink: 0,
                    }}
                />
                <div>
                    <div style={{ fontSize: 14, fontWeight: 400, color: "var(--fg)" }}>
                        {item.author}
                    </div>
                    <div className="kicker">
                        {item.role}{item.company ? `, ${item.company}` : ""}
                    </div>
                </div>
            </div>
        </blockquote>
    );
}

function TestimonialMarquee({ items }: { items: TestimonialItem[] }) {
    const prefersReducedMotion = useReducedMotion();
    if (prefersReducedMotion) {
        return (
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 16,
                    marginBottom: 48,
                }}
            >
                {items.map((item, i) => (
                    <TestimonialCard key={i} item={item} />
                ))}
            </div>
        );
    }
    const tripled = [...items, ...items, ...items];
    const mid = Math.ceil(tripled.length / 2);
    const row1 = tripled.slice(0, mid);
    const row2 = tripled.slice(mid);
    return (
        <div style={{ overflow: "hidden", marginBottom: 48 }}>
            {/* Row 1 â€” scrolls left */}
            <div className="marquee-container" style={{ marginBottom: 16 }}>
                <div className="marquee-track testimonial-track">
                    {row1.map((item, i) => (
                        <TestimonialCard key={i} item={item} />
                    ))}
                </div>
            </div>
            {/* Row 2 â€” scrolls right */}
            <div className="marquee-container">
                <div className="marquee-track testimonial-track marquee-reverse">
                    {row2.map((item, i) => (
                        <TestimonialCard key={i} item={item} />
                    ))}
                </div>
            </div>
        </div>
    );
}

/* â”€â”€ Testimonials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function Testimonials() {
    return (
        <section style={{ position: "relative", padding: "100px 0 120px", overflow: "hidden" }}>
            {/* Bottom fade â€” blends aurora into next section */}
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
                        background: "radial-gradient(circle, rgba(245,237,214,0.18) 0%, transparent 70%)",
                        left: "30%",
                        top: "10%",
                    }}
                />
            </div>

            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)", position: "relative", zIndex: 2 }}>
                <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
                    
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(36px, 5vw, 64px)",
                            fontWeight: 400,
                            letterSpacing: "0.03em",
                            color: "var(--fg)",
                            marginTop: 16,
                            marginBottom: 0,
                        }}
                    >
                        {tData.headline}
                    </h2>
                </Reveal>

                {/* Dual-row marquee */}
                <Reveal delay={1}>
                    <TestimonialMarquee items={tData.items} />
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
                        {tData.stats.flatMap((stat, i) => {
                            const m = stat.value.match(/^(\d+(?:\.\d+)?)(.*)/);
                            const numVal = m ? parseFloat(m[1]) : 0;
                            const suffix = m ? m[2] : stat.value;
                            const isDecimal = m ? m[1].includes(".") : false;
                            return [
                                <div key={`stat-${i}`} style={{ padding: "0 24px", textAlign: "center" }}>
                                    <div
                                        style={{
                                            fontFamily: "var(--font-display)",
                                            fontSize: "clamp(32px, 5vw, 56px)",
                                            fontWeight: 400,
                                            color: "var(--accent)",
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        {numVal > 0
                                            ? <CounterEl to={numVal} decimals={isDecimal ? 1 : 0} suffix={suffix} />
                                            : stat.value}
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
                            ];
                        })}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}


function Contact() {
    const btnRef = useRef<HTMLAnchorElement>(null);
    const bx = useMotionValue(0);
    const by = useMotionValue(0);

    function onMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
        const el = e.currentTarget.getBoundingClientRect();
        bx.set((e.clientX - el.left - el.width / 2) * 0.3);
        by.set((e.clientY - el.top - el.height / 2) * 0.3);
    }
    function onMouseLeave() { bx.set(0); by.set(0); }

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
                    
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(40px, 6vw, 80px)",
                            fontWeight: 400,
                            letterSpacing: "0.03em",
                            color: "var(--fg)",
                            maxWidth: "20ch",
                            margin: "20px auto 0",
                            lineHeight: 1.05,
                        }}
                    >
                        Your business never stops {" "}
                        <em style={{ color: "var(--accent)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>answering.</em>
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
                        Modern websites, reliable hosting, ongoing maintenance, and AI-assisted reception built to capture more opportunities — without adding more to your plate.
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
                        <motion.a
                            ref={btnRef}
                            href="/pricing"
                            className="btn primary lg"
                            style={{ x: bx, y: by }}
                            onMouseMove={onMouseMove}
                            onMouseLeave={onMouseLeave}
                            transition={SPRING}
                        >
                            View Pricing
                        </motion.a>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* â”€â”€ Missed Calls Revenue Calculator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function MissedCallsCalculator() {
    const MISSED_MIN = 1, MISSED_MAX = 50;
    const RECOVERY_MIN = 1, RECOVERY_MAX = 100;
    const JOB_SLIDER_MIN = 0, JOB_SLIDER_MAX = 100;

    // Research-backed conversion factors.
    const LEAD_RATE = 0.47;         // Invoca: 47% of inbound home-services calls are new leads
    const CLOSE_RATE = 0.46;        // Supply House Times: 46% lead-to-job conversion when properly handled
    const AI_RECOVERY_RATE = 0.73;  // ~85% caller engagement × ~86% AI booking parity vs. perfect human handling

    // Log scale helpers: slider 0â€“100 â†’ $50â€“$500,000
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

    const annualMissed = missedPerWeek * 52;
    const annualLeadCalls = annualMissed * LEAD_RATE;
    const unrecoveredLeads = annualLeadCalls * (1 - currentRecovery / 100);
    const revenueOnTable = unrecoveredLeads * CLOSE_RATE * avgJobValue;
    const recoverableRevenue = revenueOnTable * AI_RECOVERY_RATE;

    function formatDollars(n: number): string {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
        if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
        return `$${Math.round(n).toLocaleString()}`;
    }

    const missedPct = ((missedPerWeek - MISSED_MIN) / (MISSED_MAX - MISSED_MIN)) * 100;
    const jobPct = jobSliderPos;
    const recoveryPct = ((currentRecovery - RECOVERY_MIN) / (RECOVERY_MAX - RECOVERY_MIN)) * 100;
    const revenueFormatted = formatDollars(revenueOnTable);

    return (
        <section style={{ position: "relative", padding: "120px 0", overflow: "hidden" }}>
            {/* Aurora grid */}
            <div className="aurora-grid" />

            {/* Aurora blobs */}
            <div className="aurora-bg">
                <div
                    className="aurora-blob"
                    style={{
                        width: 560, height: 560,
                        background: "radial-gradient(circle, rgba(245,237,214,0.18) 0%, transparent 70%)",
                        right: "5%", top: "0%", animationDelay: "-6s",
                    }}
                />
                <div
                    className="aurora-blob"
                    style={{
                        width: 480, height: 480,
                        background: "radial-gradient(circle, rgba(245,237,214,0.10) 0%, transparent 70%)",
                        left: "2%", bottom: "10%", animationDelay: "-16s",
                    }}
                />
            </div>

            <div style={{ position: "relative", zIndex: 2, maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
                {/* Header */}
                <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
                    <h2
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(36px, 5vw, 64px)",
                            fontWeight: 400,
                            letterSpacing: "0.03em",
                            color: "var(--fg)",
                            marginTop: 16, marginBottom: 12, lineHeight: 1.1,
                        }}
                    >
                        How much are missed calls{" "}
                        <em style={{ color: "var(--accent)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>costing you?</em>
                    </h2>
                    <p style={{ color: "var(--fg-2)", fontSize: 16, maxWidth: "50ch", margin: "0 auto", lineHeight: 1.6 }}>
                        Move the sliders to match your business. See your real numbers instantly.
                    </p>
                </Reveal>

                {/* Glass card â€” 2-col layout */}
                <Reveal delay={1}>
                    <div
                        className="glass calc-layout"
                        style={{ padding: "40px 36px", borderRadius: 22, position: "relative", overflow: "hidden" }}
                    >
                        {/* Accent top bar */}
                        <div style={{ position: "absolute", inset: "0 0 auto 0", height: 2, borderRadius: "22px 22px 0 0", background: "linear-gradient(90deg, var(--accent), rgba(182,168,255,0.3))" }} />

                        {/* LEFT: sliders */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
                            {/* Slider 1: Missed calls / week */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                                    <span className="kicker">Missed calls / week</span>
                                    <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, color: "var(--fg)", letterSpacing: "0.02em" }}>{missedPerWeek}</span>
                                </div>
                                <input type="range" className="calc-slider" min={MISSED_MIN} max={MISSED_MAX} step={1} value={missedPerWeek}
                                    onChange={e => setMissedPerWeek(Number(e.target.value))}
                                    style={{ "--pct": `${missedPct}%` } as React.CSSProperties} />
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.1em" }}>
                                    <span>1</span><span>50</span>
                                </div>
                            </div>

                            {/* Slider 2: Average job value */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                                    <span className="kicker">Avg job value</span>
                                    <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, color: "var(--fg)", letterSpacing: "0.02em" }}>
                                        {avgJobValue >= 1000
                                            ? `$${(avgJobValue / 1000).toFixed(avgJobValue >= 100000 ? 0 : 1)}K`
                                            : `$${avgJobValue.toLocaleString()}`}
                                    </span>
                                </div>
                                <input type="range" className="calc-slider" min={JOB_SLIDER_MIN} max={JOB_SLIDER_MAX} step={0.5} value={jobSliderPos}
                                    onChange={e => setJobSliderPos(Number(e.target.value))}
                                    style={{ "--pct": `${jobPct}%` } as React.CSSProperties} />
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.1em" }}>
                                    <span>$50</span><span>$500K</span>
                                </div>
                            </div>

                            {/* Slider 3: Current recovery rate */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                                    <span className="kicker">Lead calls you currently recover</span>
                                    <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, color: currentRecovery >= 90 ? "var(--accent)" : "var(--fg)", letterSpacing: "0.02em", transition: "color 0.2s ease" }}>{currentRecovery}%</span>
                                </div>
                                <input type="range" className="calc-slider" min={RECOVERY_MIN} max={RECOVERY_MAX} step={1} value={currentRecovery}
                                    onChange={e => setCurrentRecovery(Number(e.target.value))}
                                    style={{ "--pct": `${recoveryPct}%` } as React.CSSProperties} />
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.1em" }}>
                                    <span>1%</span><span>100%</span>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: results */}
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>
                            {/* Revenue on table */}
                            <div>
                                <div className="kicker" style={{ marginBottom: 12 }}>Revenue Left on the Table</div>
                                <div
                                    key={revenueFormatted}
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: "clamp(48px, 7vw, 88px)",
                                        fontWeight: 400, lineHeight: 1, letterSpacing: "0.04em",
                                        background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.55) 100%)",
                                        WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                                    }}
                                >
                                    {revenueFormatted}
                                </div>
                                <div className="kicker" style={{ marginTop: 8 }}>per year</div>
                            </div>

                            <div style={{ width: "100%", height: 1, background: "var(--rule)" }} />

                            {/* Recoverable via AI */}
                            <div>
                                <div className="kicker" style={{ marginBottom: 12 }}>Recoverable via AI Receptionist</div>
                                <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(48px, 7vw, 88px)", fontWeight: 400, lineHeight: 1, letterSpacing: "0.04em", color: "var(--accent)", textShadow: "0 0 40px var(--accent-glow)" }}>
                                    {formatDollars(recoverableRevenue)}
                                </div>
                                <div className="kicker" style={{ marginTop: 8 }}>per year</div>
                            </div>

                            {/* Accordion: How we calculate this */}
                            <details className="calc-accordion">
                                <summary>
                                    <Info size={16} weight="duotone" style={{ color: "var(--accent)", flexShrink: 0 }} />
                                    How we calculate this
                                </summary>
                                <div className="calc-accordion-body">
                                    <p style={{ marginBottom: 12, color: "var(--fg-2)", fontSize: 13, lineHeight: 1.6 }}>
                                        Estimates based on your inputs and published industry research. Results vary by market and business.
                                    </p>
                                    <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                                        <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                                            <strong style={{ color: "var(--fg)" }}>{missedPerWeek} calls/week × 52</strong> = {Math.round(annualMissed).toLocaleString()} missed/year
                                        </li>
                                        <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                                            × <strong style={{ color: "var(--fg)" }}>47% new-business leads</strong> (Invoca 2025) = {Math.round(annualLeadCalls).toLocaleString()} lead calls
                                        </li>
                                        <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                                            × <strong style={{ color: "var(--fg)" }}>{Math.round((1 - currentRecovery / 100) * 100)}% unrecovered</strong> = {Math.round(unrecoveredLeads).toLocaleString()} lost leads
                                        </li>
                                        <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                                            × <strong style={{ color: "var(--fg)" }}>46% close rate</strong> × avg job value = {formatDollars(revenueOnTable)}
                                        </li>
                                        <li style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
                                            × <strong style={{ color: "var(--fg)" }}>73% AI recovery</strong> = {formatDollars(recoverableRevenue)}
                                        </li>
                                    </ol>
                                </div>
                            </details>

                            <p style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.5, margin: 0 }}>
                                Illustrative estimates only. Actual results vary by market, business model, and execution.
                            </p>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* -- Page ---------------------------------------------- */
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
            <LogoMarquee />
            <SpotlightGrid />
            <KineticMarquee />
            <HowItWorks />
            <Testimonials />
            <MissedCallsCalculator />
            <Contact />
        </div>
    );
}
