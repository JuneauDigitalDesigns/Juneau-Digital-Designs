"use client"
/* Z-index constants: navbar: 50 | grain: 60 | modals: 70 */

import Image from "next/image";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import {
  Globe,
  Phone,
  ChartBar,
  HardDrives,
  Info,
  ArrowSquareOut,
} from "@phosphor-icons/react";


const SPRING = { type: "spring", stiffness: 100, damping: 20 } as const;

const HERO_WORDS = ["Built,", "hosted,", "maintained,"];

/* Hero image variants — one is randomly selected on each page load */
const HERO_IMAGES = {
    a: "/hero-signal-a.webp",
    b: "/hero-signal-b.webp",
    c: "/hero-signal-c.webp",
} as const;
type HeroVariant = keyof typeof HERO_IMAGES;

/* Per-variant objectPosition — c sits at y=20% so the top strands are visible */
const HERO_POSITIONS: Record<HeroVariant, string> = {
    a: "70% 50%",
    b: "70% 50%",
    c: "70% 20%",
};

/* Picks a random variant once per client-side module lifetime (once per full page load).
   Returns the same value on every call so useSyncExternalStore's snapshot-stability
   contract is satisfied. Server always receives "a" via the server-snapshot argument. */
const getRandomVariant = (() => {
    let cached: HeroVariant | undefined;
    return (): HeroVariant => {
        if (cached === undefined) {
            const keys = Object.keys(HERO_IMAGES) as HeroVariant[];
            cached = keys[Math.floor(Math.random() * keys.length)];
        }
        return cached;
    };
})();

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

/* ── Card — subtle 3D cursor tilt + travelling border pulse ──── */
const TILT_SPRING = { stiffness: 150, damping: 18 } as const;
const MAX_TILT = 6.5; // degrees — "felt, not noticed"

function SpotlightBorderCard({
    children,
    className = "",
    cellClassName = "",
    style,
}: {
    children: React.ReactNode;
    className?: string;
    /** grid-placement class applied to the perspective wrapper (the grid item) */
    cellClassName?: string;
    style?: React.CSSProperties;
}) {
    const reduce = useReducedMotion();
    const cardRef = useRef<HTMLDivElement>(null);

    // Tilt driven entirely by motion values — no React re-render per frame.
    const rotX = useMotionValue(0);
    const rotY = useMotionValue(0);
    const rotateX = useSpring(rotX, TILT_SPRING);
    const rotateY = useSpring(rotY, TILT_SPRING);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (reduce) return;
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const halfW = rect.width / 2;
        const halfH = rect.height / 2;
        rotY.set(((x - halfW) / halfW) * MAX_TILT);
        rotX.set(((y - halfH) / halfH) * -MAX_TILT);
    };

    const handleMouseLeave = () => {
        rotX.set(0);
        rotY.set(0);
    };

    return (
        <div className={`bento-tilt-wrap ${cellClassName}`}>
            <motion.div
                ref={cardRef}
                className={`spotlight-card ${className}`}
                style={{
                    position: "relative",
                    height: "100%",
                    rotateX: reduce ? 0 : rotateX,
                    rotateY: reduce ? 0 : rotateY,
                    transformStyle: "preserve-3d",
                    ...style,
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* Pulse that travels slowly around the card's rounded border.
                    pathLength={100} normalizes every card's perimeter so one
                    dash pattern works on all sizes. */}
                <svg className="border-pulse" width="100%" height="100%" aria-hidden="true">
                    <rect
                        className="border-pulse-rect"
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        rx="22"
                        ry="22"
                        pathLength={100}
                    />
                </svg>
                <div style={{ position: "relative", zIndex: 1, transformStyle: "preserve-3d" }}>
                    {children}
                </div>
            </motion.div>
        </div>
    );
}

function Hero() {
    const sectionRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
    const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
    const prefersReducedMotion = useReducedMotion();

    // useSyncExternalStore: server snapshot always "a" (SSR-safe); client snapshot
    // returns the module-level memoized random variant (stable across React's
    // repeated getSnapshot calls, so no instability warning).
    const variant = useSyncExternalStore<HeroVariant>(
        () => () => {},
        getRandomVariant,
        () => "a",
    );
    const heroSrc = HERO_IMAGES[variant];

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
            {/* Full-bleed hero image (parallax) */}
            <motion.div
                style={{
                    position: "absolute",
                    inset: 0,
                    y: prefersReducedMotion ? 0 : imgY,
                    zIndex: 0,
                }}
            >
                <Image
                    key={heroSrc}
                    src={heroSrc}
                    alt="Orchestrated signal — fiber-optic communication routing through the network"
                    fill
                    priority
                    sizes="100vw"
                    style={{ objectFit: "cover", objectPosition: HERO_POSITIONS[variant] }}
                />
            </motion.div>

            {/* Geometric dot pattern (lifted above the image, below the scrim) */}
            <div className="aurora-grid" style={{ zIndex: 1 }} />

            {/* Legibility scrim (left→right) + edge vignette to meld image into --bg */}
            <div className="hero-fullbleed-overlay" />

            {/* Bottom fade */}
            <div
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 200,
                    background: "linear-gradient(to bottom, transparent, var(--bg))",
                    zIndex: 2,
                    pointerEvents: "none",
                }}
            />

            {/* Content (sits above image + overlays) */}
            <div
                style={{
                    position: "relative",
                    zIndex: 3,
                    width: "100%",
                    maxWidth: 1240,
                    margin: "0 auto",
                    padding: "120px max(24px, 4vw) 100px",
                }}
            >
                <div className="hero-content-fullbleed">
                    {/* Headline + CTA, constrained left so the image breathes on the right */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <motion.h1
                            initial="hidden"
                            animate="visible"
                            variants={{
                                hidden: {},
                                visible: { transition: { staggerChildren: 0.08 } },
                            }}
                            style={{ marginBottom: 20 }}
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
                                    fontSize: "clamp(28px, 4vw, 56px)",
                                    letterSpacing: "-0.01em",
                                    lineHeight: 1.3,
                                    paddingBottom: 4,
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
                                Your site, hosting, maintenance, and AI receptionist under one roof. Every lead lands somewhere real.
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
    // One spotlight for the whole grid — a single warm light tracks the cursor
    // across all cards and the gaps, rather than each card lighting on its own.
    const spotRef = useRef<HTMLDivElement>(null);
    const handleGridMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const spot = spotRef.current;
        if (!spot) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        spot.style.background = `radial-gradient(440px circle at ${x}px ${y}px, rgba(245,237,214,0.10), transparent 70%)`;
    };
    const handleGridLeave = () => {
        if (spotRef.current) spotRef.current.style.background = "transparent";
    };

    return (
        <section style={{ position: "relative", padding: "120px 0" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
                <Reveal style={{ textAlign: "center", marginBottom: 56 }}>

                    <h2 style={{ marginTop: 16, marginBottom: 12 }}>
                        What We <em style={{ color: "var(--accent)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>Deliver</em>
                    </h2>
                </Reveal>

                <div className="bento-grid" onMouseMove={handleGridMove} onMouseLeave={handleGridLeave}>
                    <div ref={spotRef} className="section-spotlight" aria-hidden="true" />

                    {/* Cell 1: Website & SEO — hero cell (tall, left) */}
                    <SpotlightBorderCard className="glass" cellClassName="bento-cell-hero" style={{ padding: "40px 36px", display: "flex", flexDirection: "column" }}>
                        <Globe weight="duotone" size={32} color="var(--accent)" className="bento-depth-icon" />
                        <h3 className="bento-depth-title" style={{ fontSize: "var(--text-2xl)", margin: "20px 0 12px" }}>
                            Website &amp; Local SEO
                        </h3>
                        <p style={{ color: "var(--fg-2)", fontSize: 15, lineHeight: 1.7 }}>
                            Custom Next.js build served from Vercel&apos;s global edge. 95+ Lighthouse mobile, schema markup, Google Business Profile optimisation.
                        </p>
                        <div
                            className="bento-depth-stat"
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

                    {/* Cell 2: AI Voice — right top */}
                    <SpotlightBorderCard className="glass" style={{ padding: "36px 32px", display: "flex", flexDirection: "column" }}>
                        <Phone weight="duotone" size={32} color="var(--accent)" className="bento-depth-icon" />
                        <h3 className="bento-depth-title" style={{ fontSize: "var(--text-xl)", margin: "16px 0 10px" }}>
                            AI Voice Receptionist
                        </h3>
                        <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.65 }}>
                            24/7 AI voice — answers under 1.4 s, qualifies callers, books real appointments.
                        </p>
                        <div className="bento-depth-stat" style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--accent)", marginTop: "auto", paddingTop: 16, letterSpacing: "-0.02em" }}>
                            &lt;1.4s
                        </div>
                    </SpotlightBorderCard>

                    {/* Cell 3: Dashboard & Reports — right bottom */}
                    <SpotlightBorderCard className="glass" style={{ padding: "36px 32px", display: "flex", flexDirection: "column" }}>
                        <ChartBar weight="duotone" size={32} color="var(--accent)" className="bento-depth-icon" />
                        <h3 className="bento-depth-title" style={{ fontSize: "var(--text-xl)", margin: "16px 0 10px" }}>
                            Dashboard &amp; Reports
                        </h3>
                        <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.65 }}>
                            Every call, booking, and dollar visible at a glance. Daily, weekly, and monthly reports included.
                        </p>
                        <div className="bento-depth-stat" style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: "var(--accent)", marginTop: "auto", paddingTop: 16, letterSpacing: "-0.02em" }}>
                            Real-time
                        </div>
                    </SpotlightBorderCard>

                    {/* Cell 4: Hosting — full-width bottom */}
                    <SpotlightBorderCard className="glass" cellClassName="bento-cell-full" style={{ padding: "32px 36px", display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                        <HardDrives weight="duotone" size={32} color="var(--accent)" className="bento-depth-icon" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 180 }}>
                            <h3 className="bento-depth-title" style={{ fontSize: "var(--text-xl)", margin: "0 0 8px" }}>
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
                                fontSize: "var(--text-4xl)",
                                fontWeight: 800,
                                color: i % 2 === 0 ? "var(--fg)" : "var(--fg-3)",
                                letterSpacing: "var(--tracking-tightest)",
                                lineHeight: 1,
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
                            
                            <h2>
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
                            fontSize: "var(--text-4xl)",
                            fontWeight: 600,
                            letterSpacing: "var(--tracking-tightest)",
                            maxWidth: "20ch",
                            margin: "20px auto 0",
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

/* ── Missed Calls Revenue Calculator ──────────────────────── */
function MissedCallsCalculator() {
    const MISSED_MIN = 1, MISSED_MAX = 50;
    const RECOVERY_MIN = 1, RECOVERY_MAX = 100;
    const JOB_SLIDER_MIN = 0, JOB_SLIDER_MAX = 100;

    // Research-backed conversion factors.
    const LEAD_RATE = 0.47;         // Invoca: 47% of inbound home-services calls are new leads
    const CLOSE_RATE = 0.46;        // Supply House Times: 46% lead-to-job conversion when properly handled
    const AI_RECOVERY_RATE = 0.73;  // ~85% caller engagement × ~86% AI booking parity vs. perfect human handling

    // Log scale helpers: slider 0-100 → $50-$500,000
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

            <div style={{ position: "relative", zIndex: 2, maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>
                {/* Header */}
                <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
                    <h2 style={{ marginTop: 16, marginBottom: 12 }}>
                        How much are missed calls{" "}
                        <em style={{ color: "var(--accent)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>costing you?</em>
                    </h2>
                    <p style={{ color: "var(--fg-2)", fontSize: 16, maxWidth: "50ch", margin: "0 auto", lineHeight: 1.6 }}>
                        Move the sliders to match your business. See your real numbers instantly.
                    </p>
                </Reveal>

                {/* Glass card — 2-col layout */}
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
                                    <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--fg)", letterSpacing: "var(--tracking-tight)" }}>{missedPerWeek}</span>
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
                                    <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--fg)", letterSpacing: "var(--tracking-tight)" }}>
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
                                    <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: currentRecovery >= 90 ? "var(--accent)" : "var(--fg)", letterSpacing: "var(--tracking-tight)", transition: "color 0.2s ease" }}>{currentRecovery}%</span>
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
                                        fontSize: "var(--text-4xl)",
                                        fontWeight: 700, lineHeight: 1, letterSpacing: "var(--tracking-tightest)",
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
                                <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-4xl)", fontWeight: 700, lineHeight: 1, letterSpacing: "var(--tracking-tightest)", color: "var(--accent)", textShadow: "0 0 40px var(--accent-glow)" }}>
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
    return (
        <div style={{ width: "100%", background: "var(--bg)" }}>
            <Hero />
            <KineticMarquee />
            <SpotlightGrid />
            <LogoMarquee />
            <HowItWorks />
            <MissedCallsCalculator />
            <Contact />
        </div>
    );
}
