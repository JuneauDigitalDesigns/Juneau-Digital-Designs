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
                        We build the site. We install the AI receptionist. Every inbound call gets answered, qualified, and booked — even at 2 a.m. on a Sunday.
                    </p>
                </Reveal>

                <Reveal delay={3} style={{ marginBottom: 80 }}>
                    <a href="/pricing" className="btn primary lg">
                        Get Started
                    </a>
                </Reveal>

                {/* Hero stat counter panel */}
                <Reveal delay={4}>
                    <div
                        className="glass"
                        style={{
                            maxWidth: 880,
                            margin: "0 auto",
                            padding: "40px 36px",
                            position: "relative",
                        }}
                    >
                        <div className="kicker" style={{ color: "rgba(244,246,251,0.55)" }}>
                            ━━ Calls captured by JD across the network · this month
                        </div>
                        <div
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(80px, 13vw, 168px)",
                                lineHeight: 0.95,
                                letterSpacing: "-0.045em",
                                fontWeight: 400,
                                marginTop: 6,
                                background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.55) 100%)",
                                WebkitBackgroundClip: "text",
                                backgroundClip: "text",
                                color: "transparent",
                                textShadow: "0 0 40px rgba(91,232,224,0.18)",
                            }}
                        >
                            <CounterEl to={18472} duration={2000} />
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1px 1fr 1px 1fr",
                                gap: 28,
                                alignItems: "center",
                                marginTop: 24,
                                paddingTop: 22,
                                borderTop: "1px solid var(--rule)",
                                fontSize: 13,
                                color: "var(--fg-2)",
                            }}
                        >
                            <div>
                                <div className="kicker">avg pickup</div>
                                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, marginTop: 4 }}>
                                    <CounterEl to={1.4} decimals={1} suffix="s" />
                                </div>
                            </div>
                            <div style={{ background: "var(--rule)", height: 36 }} />
                            <div>
                                <div className="kicker">booking rate</div>
                                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, marginTop: 4 }}>
                                    <CounterEl to={73} suffix="%" />
                                </div>
                            </div>
                            <div style={{ background: "var(--rule)", height: 36 }} />
                            <div>
                                <div className="kicker">missed calls</div>
                                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, marginTop: 4, color: "var(--accent)" }}>
                                    0
                                </div>
                            </div>
                        </div>
                    </div>
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
            description: "We build a custom, lightning-fast website served from Cloudflare's global edge — not a template, not a builder. Every page is structured for local search, scored for 95+ Lighthouse on mobile, and wired with schema markup so Google knows exactly who you are and where you serve.",
            bullets: [
                "Custom 5-page website built for your brand and market",
                "Cloudflare edge delivery — faster than your competitors' hosting",
                "95+ Lighthouse mobile score, schema markup for local search",
                "Google Business Profile optimization",
                "Smart contact forms with instant lead capture",
                "AI text-back on missed calls so no lead goes cold",
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
            ],
            availableOn: "Growth & Front Office plans",
        },
        {
            id: "booking",
            title: "Live Calendar Booking",
            icon: faCalendarCheck,
            tagline: "Calls that end in a confirmed appointment, not a voicemail.",
            description: "When a caller is ready to book, the AI calls into your scheduling system in real time — holding the slot, returning the confirmation ID, and firing a text to both parties. No back-and-forth. No missed follow-up. End-to-end latency averages 4 seconds.",
            bullets: [
                "Direct integration with Google Calendar, Jobber, ServiceTitan, or Acuity",
                "Holds the appointment slot in real time — no double-booking",
                "Caller and owner both receive an SMS confirmation",
                "CRM row created automatically on every booking",
                "Zero back-and-forth — the job is on the calendar before the call ends",
            ],
            availableOn: "Growth & Front Office plans",
        },
        {
            id: "dashboard",
            title: "Owner Dashboard & Reports",
            icon: faChartBar,
            tagline: "Every call, booking, and dollar — visible at a glance.",
            description: "Your dashboard shows every call, every booking, and every dollar in motion. Monthly performance reports are included on all plans. Growth clients get bi-monthly deep-dives. Front Office clients get quarterly strategy sessions with our founder — no tickets, no bots.",
            bullets: [
                "Real-time call log and booking feed",
                "SMS notification on every captured lead",
                "Monthly performance reports on all plans",
                "Bi-monthly reports on Growth and above",
                "Deep CRM integration and multi-team routing on Front Office",
                "Quarterly strategy sessions with our founder on Front Office",
            ],
            availableOn: "All plans · depth grows per tier",
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
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1.2fr",
                                gap: 48,
                                alignItems: "start",
                            }}
                        >
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
        tech: "Function-calls into Google Calendar, Jobber, ServiceTitan, or Acuity. Holds the slot, returns the confirmation ID.",
    },
    {
        simple: "You get a text. The customer gets a text.",
        tech: "Twilio SMS to owner + SendGrid email to customer + row in your CRM. End-to-end latency averages 4 seconds.",
    },
];

function HowItWorks() {
    return (
        <section style={{ position: "relative", padding: "120px 0" }}>
            <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 max(24px, 4vw)" }}>

                {/* 2-col header */}
                <Reveal>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1.2fr",
                            gap: 60,
                            alignItems: "end",
                            marginBottom: 64,
                        }}
                        className="block md:grid"
                    >
                        <div>
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
                                <em style={{ color: "var(--accent)", fontStyle: "italic" }}>And the geeky one.</em>
                            </h2>
                        </div>
                        <div style={{ paddingBottom: 8 }}>
                            <p style={{ color: "var(--fg-2)", fontSize: 17, lineHeight: 1.6, maxWidth: "56ch" }}>
                                Two ways to read the same system. Scroll the table for the plain-English version, or flip to the technical column if you want to know what&apos;s actually running under the hood.
                            </p>
                        </div>
                    </div>
                </Reveal>

                {/* Table */}
                <Reveal delay={1}>
                    <div style={{ width: "100%", overflowX: "auto" }}>
                        {/* Header row */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "auto 1fr 1.1fr",
                                gap: "0 32px",
                                padding: "0 0 14px",
                                borderBottom: "1px solid var(--rule)",
                                marginBottom: 0,
                            }}
                        >
                            <div className="kicker">━ #</div>
                            <div className="kicker">━ The simple version</div>
                            <div className="kicker">━ Under the hood</div>
                        </div>

                        {/* Data rows */}
                        {TECH_ROWS.map((row, i) => (
                            <motion.div
                                key={i}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "auto 1fr 1.1fr",
                                    gap: "0 32px",
                                    padding: "24px 0",
                                    borderBottom: "1px solid var(--rule)",
                                    transition: "background 0.2s ease",
                                }}
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
                                        fontSize: 22,
                                        fontWeight: 400,
                                        letterSpacing: "-0.015em",
                                        color: "var(--fg)",
                                        lineHeight: 1.3,
                                    }}
                                >
                                    {row.simple}
                                </div>
                                <div
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

/* ── Testimonials — scaffold (no live copy yet) ───────────── */
function Testimonials() {
    return (
        <section style={{ position: "relative", padding: "100px 0 120px", overflow: "hidden" }}>
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
                    {/* TODO: no copy found for this slot — add section headline */}
                </Reveal>

                {/* Featured quote — TODO: populate */}
                <Reveal delay={1}>
                    <blockquote
                        className="glass"
                        style={{
                            padding: "56px clamp(28px, 5vw, 72px)",
                            textAlign: "center",
                            maxWidth: 800,
                            margin: "0 auto 48px",
                        }}
                    >
                        <p
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(20px, 3vw, 32px)",
                                fontWeight: 300,
                                fontStyle: "italic",
                                color: "var(--fg-2)",
                                lineHeight: 1.4,
                                maxWidth: "32ch",
                                margin: "0 auto 32px",
                            }}
                        >
                            {/* TODO: no copy found for this slot — add featured testimonial quote */}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: "50%",
                                    background: "linear-gradient(135deg, var(--accent), rgba(182,168,255,0.3))",
                                }}
                            />
                            <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: 15, fontWeight: 400, color: "var(--fg)" }}>
                                    {/* TODO: no copy found for this slot — add client name */}
                                </div>
                                <div className="kicker">
                                    {/* TODO: no copy found for this slot — add client role */}
                                </div>
                            </div>
                        </div>
                    </blockquote>
                </Reveal>

                {/* Quick stats grid — TODO: populate */}
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
                        {[0, 1, 2].map((i) => (
                            i % 2 === 0 ? (
                                <div key={i} style={{ padding: "0 24px", textAlign: "center" }}>
                                    <div
                                        style={{
                                            fontFamily: "var(--font-display)",
                                            fontSize: "clamp(32px, 5vw, 56px)",
                                            fontWeight: 300,
                                            color: "var(--accent)",
                                            letterSpacing: "-0.03em",
                                        }}
                                    >
                                        {/* TODO: no copy found for this slot — add stat value */}
                                    </div>
                                    <div style={{ fontSize: 14, color: "var(--fg-2)", marginTop: 6 }}>
                                        {/* TODO: no copy found for this slot — add stat label */}
                                    </div>
                                    <div className="kicker" style={{ marginTop: 4 }}>
                                        {/* TODO: no copy found for this slot — add attribution */}
                                    </div>
                                </div>
                            ) : (
                                <div key={i} style={{ width: 1, background: "var(--rule)" }} />
                            )
                        ))}
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
                        <a href="/projects" className="btn ghost lg">
                            View Our Work
                        </a>
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
            <Offer />
            <HowItWorks />
            <Testimonials />
            <Contact />
        </div>
    );
}
