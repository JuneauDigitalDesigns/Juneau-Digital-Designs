import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComputer, faDraftingCompass, faGear, faWrench, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useScroll, useTransform, type Variants } from "framer-motion";

const sectionReveal: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    }
};

const staggerContainer: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.1
        }
    }
};


function Hero() {
    const heroRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"]
    });
    const backgroundY = useTransform(scrollYProgress, [0, 1], [-48, 48]);

    return (
        <>
            <motion.section
                ref={heroRef}
                className="relative w-full overflow-hidden"
                variants={sectionReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >

                <motion.div className="absolute -inset-x-0 -top-24 -bottom-24 z-0 will-change-transform" style={{ y: backgroundY }}>
                    <Image
                        src="/hero_background1.png"
                        alt="Hero Background"
                        fill
                        priority
                        className="object-cover"
                    />

                    <div className="absolute inset-0 bg-black/30" />
                </motion.div>


                <div className="relative z-10 w-full min-h-[70vh] md:min-h-[78vh] py-24 md:py-28 px-4 md:px-16 flex justify-center items-center">
                    <div className="w-full flex flex-col md:flex-row items-center md:space-x-4">

                        <div className="w-full md:w-1/2 flex flex-col items-center md:items-start px-4 text-center md:text-left text-white">
                            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                                Every Pixel Matters. Every Click Counts.
                            </h1>

                            <p className="text-xl md:text-2xl mb-6 max-w-3xl">
                                At <span className="font-semibold text-2xl">Juneau Digital Designs</span>, we craft websites where no detail is too small.
                                From micro-interactions to seamless navigation, we focus on the user experience that ensures your audience stays engaged with your business.
                            </p>

                            <button className="border px-6 py-3 rounded hover:bg-white hover:text-black transition">
                                Get Started
                            </button>
                        </div>

                    </div>
                </div>
            </motion.section>

        </>


    )
}

function Offer() {
    interface Videos {
        src: string;
        body?: string;
        type: string;
    }

    interface Offering {
        title: string;
        icon: IconDefinition;
        iconColor?: string;
        description: string;
        clicked: {
            title: string;
            description: string;
            body: string;
            videos: Videos[];
        };
    }

    const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null);
    const [isClient, setIsClient] = useState(false);
    const handleOfferingClick = (offering: Offering) => {
        setSelectedOffering(offering);
    }
    const offerings: Offering[] = [
        {
            title: "User-First Design",
            icon: faDraftingCompass,
            iconColor: "text-blue-700",
            description: "We put users at the heart of every design decision."
            , clicked: {
                title: "End-Users are at the Heart of Design",
                description: "At Juneau Digital Designs, our user-first design philosophy ensures that every element of your website is crafted with the end-user in mind. We prioritize usability, accessibility, and engagement to create digital experiences that resonate with your audience. Our goal is to create websites that not only meet your business objectives but also provide a seamless and enjoyable experience for your users.",
                body: "This popup window is an example of how we prioritize user experience in our designs. From intuitive navigation to engaging interfaces, we focus on creating digital experiences that are visually appealing and easy to use. We believe that all website content should be accessible and eye appealing. ",
                videos: [
                    { src: "/userfirst1.mp4", body: "We believe the content your customers rely on to make buying decisions should always be immediately accessible, no more than one click from view.", type: "video/mp4" },
                    { src: "/userfirst2.mp4", body: "", type: "video/mp4" }
                ]
            }
        },
        {
            title: "Responsive Web Experiences",
            icon: faComputer,
            iconColor: "text-yellow-500",
            description: "Crafting visually stunning, responsive websites tailored to your brand identity."
            , clicked: {
                title: "Websites That Adapt and Engage",
                description: "We take great care in designing websites that not only look stunning but also function flawlessly across all devices. Our responsive web design approach ensures that your site adapts seamlessly to different screen sizes, providing an optimal viewing experience for users on desktops, tablets, and smartphones. By focusing on performance optimization and user engagement, we create digital experiences that captivate your audience and drive meaningful interactions with your brand.",
                body: "",
                videos: [
                    { src: "/userfirst1.mp4", type: "video/mp4" },
                    { src: "/userfirst2.mp4", type: "video/mp4" }
                ]
            }
        },
        {
            title: "End-to-End Development",
            icon: faGear,
            iconColor: "text-green-600",
            description: "Building robust web applications from front-end to back-end."
            , clicked: {
                title: "Full Stack Excellence",
                description: "Juneau Digital Designs offers comprehensive full stack development services that cover every aspect of your web application. From crafting dynamic front-end interfaces using the latest frameworks to developing scalable back-end systems, we ensure that your website is built for performance and reliability. Our expertise in database management, API integration, and cloud deployment allows us to deliver end-to-end solutions that meet your business needs and provide a seamless experience for your users.",
                body: "",
                videos: [
                    { src: "/userfirst1.mp4", type: "video/mp4" },
                    { src: "/userfirst2.mp4", type: "video/mp4" }
                ]
            }
        },
        {
            title: "Ongoing Maintenance & Support",
            icon: faWrench,
            iconColor: "text-gray-700",
            description: "Comprehensive maintenance and support services to keep your website running smoothly."
            , clicked: {
                title: "Support That Never Sleeps",
                description: "After launching your website, our commitment to your success continues with our ongoing maintenance and support services. We understand that a well-maintained website is crucial for security, performance, and user satisfaction. Our team provides regular updates, security patches, and backups to keep your site running smoothly. Additionally, we offer troubleshooting assistance and implement enhancements based on user feedback and evolving business needs. With Juneau Digital Designs, you can rest assured that your digital presence is in capable hands.",
                body: "",
                videos: [
                    { src: "/userfirst1.mp4", type: "video/mp4" },
                    { src: "/userfirst2.mp4", type: "video/mp4" }
                ]
            }
        }
    ];

    const modalRef = useRef<HTMLDivElement>(null);
    const handleCloseModal = () => {
        setSelectedOffering(null);
    }
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                handleCloseModal();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [handleCloseModal]);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!selectedOffering) return;

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                handleCloseModal();
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", onEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", onEscape);
        };
    }, [selectedOffering]);

    const modalOverlay = (
        <AnimatePresence>
            {selectedOffering && (
                <motion.div
                    className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-[2px] flex justify-center items-center px-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    aria-modal="true"
                    role="dialog"
                >
                    <motion.div
                        ref={modalRef}
                        className="bg-white rounded-3xl p-8 md:p-10 max-w-3xl w-full relative shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto"
                        initial={{ opacity: 0, y: 20, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.25 }}
                    >
                        <button
                            className="absolute top-4 right-5 text-gray-600 hover:text-gray-900 text-4xl hover:cursor-pointer"
                            onClick={() => setSelectedOffering(null)}
                            aria-label="Close service details"
                        >
                            &times;
                        </button>

                        <span className="inline-flex rounded-full border border-zinc-300 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-zinc-700 mb-4">
                            Service Details
                        </span>
                        <h3 className="text-3xl md:text-4xl font-extrabold mb-4 text-zinc-900">
                            {selectedOffering.clicked.title}
                        </h3>

                        <p className="text-zinc-700 leading-relaxed text-lg">
                            {selectedOffering.clicked.description}
                        </p>
                        {selectedOffering.clicked.videos.map((video, index) => (
                            <div key={index} className="my-6">
                                <video
                                    src={video.src}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="w-full rounded-xl shadow-md border border-zinc-200"
                                />
                                {video.body && <p className="text-gray-700 mt-3 leading-relaxed">{video.body}</p>}
                            </div>
                        ))}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <motion.section
            className="relative z-20 py-24 px-4 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-zinc-100"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
        >
            {isClient ? createPortal(modalOverlay, document.body) : null}

            <motion.div className="relative flex flex-col w-full items-center justify-center mb-6" variants={sectionReveal}>
                <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white/80 px-4 py-1 text-xs md:text-sm font-semibold tracking-[0.12em] uppercase text-zinc-700 mb-5">
                    Our Services
                </span>
                <h2 className="text-4xl md:text-6xl font-extrabold mb-4 text-center text-zinc-900 leading-tight">
                    What We Offer
                </h2>
                <span className="text-sm md:text-base italic text-center mb-12 text-zinc-600">Click any service card to open details</span>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                {offerings.map((offering, index) => (
                    <motion.div
                        key={offering.title}
                        className="h-full hover:cursor-pointer"
                        onClick={() => handleOfferingClick(offering)}
                        variants={sectionReveal}
                        whileHover={{ y: -6 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="group bg-white/95 p-8 rounded-3xl shadow-lg border border-zinc-200 hover:shadow-2xl transition text-center h-full relative overflow-hidden flex flex-col">
                            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400" />
                            <div className="absolute top-4 right-4 text-xs font-bold text-zinc-400">0{index + 1}</div>
                            <div className={`${offering.iconColor} mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 group-hover:scale-105 transition`}>
                                <FontAwesomeIcon icon={offering.icon} size="2x" />
                            </div>
                            <h3 className="text-2xl font-black mb-3 text-zinc-900">{offering.title}</h3>
                            <p className="text-gray-700 leading-relaxed mb-6 flex-1">
                                {offering.description}
                            </p>
                            <span className="relative inline-flex w-full items-center justify-center rounded-full border border-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-900 group-hover:bg-zinc-900 group-hover:text-white transition">
                                <span className="text-center">Learn More</span>
                                <span aria-hidden="true" className="absolute right-4 transition-transform group-hover:translate-x-1">&gt;</span>
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.section>

    )
}

function Technology() {
    interface Technology {
        name: string;
        logo: string;
        shortDescription: string;
        detailedDescription: string;
        usageTitle: string;
        usagePoints: string[];
    }


    const technologies: Technology[] = [
        {
            name: "Next.js",
            logo: "/techlogos/nextjs.png",
            shortDescription: "React framework for modern apps",
            detailedDescription: "Next.js is the backbone of most projects we build. It gives us a clean structure out of the gate, helps pages load fast, and keeps SEO in a great spot. In simple terms: it is the scaffolding that lets us build quickly without the site feeling pieced together.",
            usageTitle: "Project Scaffolding and App Architecture",
            usagePoints: [
                "We build page routing, shared layouts, and metadata in one place so everything stays consistent.",
                "Marketing pages are pre-rendered for speed, while interactive pages stay dynamic where needed.",
                "We use API routes and server actions for lightweight backend tasks inside the same project."
            ]
        },
        {
            name: "Node.js",
            logo: "/techlogos/nodejs.png",
            shortDescription: "JavaScript runtime",
            detailedDescription: "Node.js runs the behind-the-scenes side of your site, from APIs to custom logic. It keeps things fast, dependable, and easy to scale as your business grows. We like it because it plays nicely with the same JavaScript ecosystem we use on the frontend.",
            usageTitle: "Backend APIs and Business Logic",
            usagePoints: [
                "We build custom endpoints for forms, CRM syncing, and third-party integrations.",
                "Background tasks like notifications and webhook handling run on Node workflows.",
                "Authentication and permissions logic live here to keep sensitive operations secure."
            ]
        },
        {
            name: "Tailwind CSS",
            logo: "/techlogos/tailwindcss.png",
            shortDescription: "Utility-first CSS",
            detailedDescription: "Tailwind helps us design faster without sacrificing quality. We can build clean, responsive interfaces that stay consistent across the whole site, and updates are easier because styles are structured in a predictable way. That means fewer visual bugs and faster iteration.",
            usageTitle: "Design System Execution",
            usagePoints: [
                "We create reusable UI patterns for buttons, spacing, typography, and section layouts.",
                "Every component gets mobile-first breakpoints so screens feel intentional on any device.",
                "Design tweaks happen directly in components, which speeds up revisions with less CSS drift."
            ]
        },
        {
            name: "TypeScript",
            logo: "/techlogos/typescript.png",
            shortDescription: "Typed JavaScript",
            detailedDescription: "TypeScript gives our code guardrails. It catches issues early, keeps features predictable, and makes the project easier to maintain over time. For clients, that translates to fewer surprises and a smoother launch process.",
            usageTitle: "Type Safety and Code Reliability",
            usagePoints: [
                "We type API request and response shapes to prevent frontend/backend mismatch bugs.",
                "Shared interfaces keep forms, database models, and UI components in sync.",
                "Refactors are safer because the compiler points out broken paths before deployment."
            ]
        },
        {
            name: "PostgreSQL",
            logo: "/techlogos/postgresql.png",
            shortDescription: "Open source database",
            detailedDescription: "PostgreSQL is our go-to when data needs to be structured, accurate, and reliable. It handles complex queries well and holds up as traffic and data grow. If your project depends on strong reporting or relationships between data, this is usually the right fit.",
            usageTitle: "Structured Data and Reporting",
            usagePoints: [
                "We model relationships like users, orders, and services with strong data constraints.",
                "Custom queries power admin dashboards, reporting views, and filtered search results.",
                "Backups, migrations, and indexing are planned up front for long-term stability."
            ]
        },
        {
            name: "MongoDB",
            logo: "/techlogos/mongodb.png",
            shortDescription: "NoSQL database",
            detailedDescription: "MongoDB is great when a project needs flexibility. It lets us move quickly with content-heavy or evolving features without forcing everything into rigid tables. We often use it for fast-moving apps where the data model needs room to grow.",
            usageTitle: "Flexible Content and Rapid Iteration",
            usagePoints: [
                "We use flexible collections for content modules that change often during growth phases.",
                "Feature teams can ship new fields without heavy schema migration overhead.",
                "It is a strong fit for activity feeds, custom profile data, and evolving app content."
            ]
        },
        {
            name: "AI",
            logo: "/techlogos/ai.webp",
            shortDescription: "Artificial Intelligence",
            detailedDescription: "We use AI where it actually adds value, not just because it is trendy. From automating repetitive tasks to personalizing user experiences, it helps teams work smarter and users get what they need faster. Our focus is practical AI that improves real business outcomes.",
            usageTitle: "Automation and Personalization",
            usagePoints: [
                "We add AI where it saves time, like content drafting, tagging, and response suggestions.",
                "Search and recommendations can be tuned to show more relevant results to each user.",
                "Support features like smart triage and answer assist help teams respond faster."
            ]
        }
    ];

    const [selectedTech, setSelectedTech] = useState<Technology>(technologies[0] || null);

    return (
        <motion.section
            className="relative z-20 bg-gradient-to-b from-white via-zinc-50 to-white py-24 px-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
        >
            <div className="max-w-6xl mx-auto">
                <motion.div className="text-center mb-12" variants={sectionReveal}>
                    <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-4 py-1 text-xs md:text-sm font-semibold tracking-[0.12em] uppercase text-zinc-700 mb-5">
                        Built With Proven Tools
                    </span>
                    <h2 className="text-4xl md:text-6xl font-extrabold mb-4 text-center text-zinc-900 leading-tight">
                        Technologies We Use
                    </h2>
                    <p className="text-zinc-600 md:text-lg max-w-3xl mx-auto">
                        We choose each part of the stack for speed, scalability, and long-term maintainability.
                    </p>
                </motion.div>

                <motion.div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-12" variants={sectionReveal}>
                    {technologies.map((tech) => {
                        const isActive = selectedTech.name === tech.name;
                        return (
                            <motion.button
                                key={tech.name}
                                onClick={() => setSelectedTech(tech)}
                                className={`
                group flex items-center gap-2 px-5 py-2.5 rounded-full border transition cursor-pointer text-sm md:text-base
                ${isActive
                                        ? "bg-zinc-900 text-white border-zinc-900 shadow-lg"
                                        : "bg-white text-zinc-900 border-zinc-300 hover:border-zinc-500 hover:bg-zinc-100"}
              `}
                                variants={sectionReveal}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Image
                                    src={tech.logo}
                                    alt={`${tech.name} Logo`}
                                    width={24}
                                    height={24}
                                    className={`rounded-full ${isActive ? "bg-white p-0.5" : ""}`}
                                />
                                <span>{tech.name}</span>
                            </motion.button>
                        );
                    })}
                </motion.div>

                <AnimatePresence mode="wait">
                    {selectedTech && (
                        <motion.div
                            key={selectedTech.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="p-8 md:p-10 bg-white rounded-3xl shadow-2xl border border-zinc-200"
                        >
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-4 md:gap-5">
                                    <div className="w-16 h-16 md:w-24 md:h-24 flex items-center justify-center rounded-2xl bg-zinc-100 shadow-inner border border-zinc-200 flex-shrink-0">
                                        <Image
                                            src={selectedTech.logo}
                                            alt={`${selectedTech.name} Logo`}
                                            width={80}
                                            height={80}
                                            className="p-2 md:p-3 object-contain"
                                        />
                                    </div>

                                    <div className="text-left">
                                        <h3 className="text-3xl md:text-4xl font-extrabold text-zinc-900 mb-2">
                                            {selectedTech.name}
                                        </h3>
                                        <p className="text-base md:text-lg text-zinc-600">
                                            {selectedTech.shortDescription}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-lg text-zinc-800 leading-relaxed text-left">
                                    {selectedTech.detailedDescription}
                                </p>

                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:p-6">
                                    <h4 className="text-lg md:text-xl font-bold text-zinc-900 mb-3">
                                        How We Use It: {selectedTech.usageTitle}
                                    </h4>
                                    <ul className="space-y-2 text-zinc-700 leading-relaxed text-left">
                                        {selectedTech.usagePoints.map((point, index) => (
                                            <li key={index} className="flex items-start gap-2">
                                                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-600 flex-shrink-0" />
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.section>
    );
}


function Projects() {
    interface Project {
        title?: string;
        description?: string;
        image?: string;
        link?: string;
        category?: string;
    }

    const projects: Project[] = [
        {
            title: "Air Service of Florida",
            description: "A modern, responsive website for a regional industrial air service company. ",
            image: "/airserviceflorida.png",
            link: "https://airserviceofflorida.com",
            category: "Marketing"

        },
        {
            title: "Atlantic Compressor",
            description: "A sleek, user-friendly e-commerce platform for a leading provider of industrial compressors and parts.",
            image: "/atlanticcompressor_1.png",
            link: "https://atlantic-compressor.vercel.app",
            category: "E-Commerce"
        }
    ];
    return (
        <>
            <motion.section
                className="relative z-20 py-24 px-4 overflow-hidden bg-gradient-to-b from-zinc-100 via-slate-50 to-white"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >
                <div className="relative max-w-6xl mx-auto">
                    <motion.div className="text-center mb-14" variants={sectionReveal}>
                        <span className="inline-flex items-center rounded-full border border-zinc-300 bg-white/80 px-4 py-1 text-xs md:text-sm font-semibold tracking-[0.12em] uppercase text-zinc-700">
                            Featured Work
                        </span>
                        <h2 className="text-4xl md:text-6xl font-extrabold mt-5 mb-5 leading-tight text-zinc-900">
                            Recent Projects
                        </h2>
                        <p className="text-lg md:text-xl text-zinc-700 max-w-3xl mx-auto">
                            Real business outcomes, polished interactions, and production-ready engineering. Here are two launches we are proud of.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                        {projects.map((project, index) => (
                            <motion.article
                                key={project.title}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.3 }}
                                transition={{ duration: 0.45, delay: index * 0.12 }}
                                className="group relative isolate rounded-3xl border border-zinc-200 bg-white/90 shadow-xl shadow-zinc-300/40 overflow-hidden"
                                variants={sectionReveal}
                            >
                                {project.image && (
                                    <div className="relative h-56 overflow-hidden">
                                        <Image
                                            src={project.image}
                                            alt={project.title || "Project Image"}
                                            width={1200}
                                            height={700}
                                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                                        {project.category && (
                                            <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-900">
                                                {project.category}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="p-7 text-left">
                                    <h3 className="text-2xl md:text-3xl font-black mb-3 text-zinc-900">
                                        {project.title}
                                    </h3>
                                    <p className="text-zinc-700 mb-6 leading-relaxed min-h-[72px]">
                                        {project.description}
                                    </p>
                                    {project.link && (
                                        <a
                                            href={project.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-full border border-zinc-900 px-5 py-2.5 font-semibold text-zinc-900 transition hover:bg-zinc-900 hover:text-white"
                                        >
                                            Visit Website
                                            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                                        </a>
                                    )}
                                </div>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </motion.section>
        </>
    )
}

function Contact() {
    return (
        <>
            <motion.section
                className="relative w-full z-20 py-24 px-4 bg-gradient-to-r from-slate-100 via-white to-zinc-100 text-zinc-900 overflow-hidden"
                variants={sectionReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >

                <motion.div
                    className="relative max-w-6xl mx-auto p-8 md:p-12"
                    variants={staggerContainer}
                >
                    <div className="flex flex-col lg:flex-row gap-10 lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <span className="inline-flex items-center rounded-full border border-zinc-300 px-4 py-1 text-xs md:text-sm font-semibold tracking-[0.12em] uppercase text-zinc-700 mb-5">
                                Let&apos;s Build Something Great
                            </span>
                            <h2 className="text-4xl md:text-6xl font-extrabold mb-5 leading-tight">
                                Ready to Elevate Your Digital Presence?
                            </h2>
                            <p className="text-lg md:text-xl text-zinc-700 leading-relaxed">
                                Have a project in mind or just want to explore ideas? We keep the process simple, collaborative, and focused on results your business can feel.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3 text-sm text-zinc-700">
                                <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1">Fast turnaround</span>
                                <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1">Clear communication</span>
                                <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1">Built for growth</span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 lg:justify-end lg:self-end shrink-0">
                            <a
                                href="/contact"
                                className="inline-flex justify-center items-center rounded-full bg-zinc-900 text-white px-6 py-3 text-base font-bold hover:bg-zinc-800 transition min-w-[180px]"
                            >
                                Get in Touch
                            </a>
                            <a
                                href="/projects"
                                className="inline-flex justify-center items-center rounded-full border border-zinc-400 px-6 py-3 text-base font-semibold text-zinc-900 hover:bg-zinc-100 transition min-w-[180px]"
                            >
                                View Our Work
                            </a>
                        </div>
                    </div>
                </motion.div>
            </motion.section>
        </>
    )
}

export default function HomePageClient() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        const previousRestoration = window.history.scrollRestoration;
        window.history.scrollRestoration = "manual";
        window.scrollTo(0, 0);

        return () => {
            window.history.scrollRestoration = previousRestoration;
        };
    }, []);

    return (
        <div className="w-full text-black bg-white relative">

            <Hero />
            <Projects />
            
            <Offer />
            <Technology />
            <Contact />
        </div>
    );
}