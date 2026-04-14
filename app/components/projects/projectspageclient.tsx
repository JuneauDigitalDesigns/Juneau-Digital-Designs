"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
export default function ProjectsPageClient() {
    /**
     * 1) Swap "TECH" filters for WEBSITE TYPES
     * 2) Update projects with a `types` array for filtering
     * 3) Restructure cards to match the mockup: header + tabs + grid cards
     */

    type SiteTypeId = "marketing" | "ecommerce" | "fullstack";
    type BuildStatusId = "live" | "inProgress";

    interface SiteType {
        id: SiteTypeId;
        label: string;
        description?: string;
    }

    interface BuildStatus {
        id: BuildStatusId;
        label: string;
        modalLabel: string;
    }

    const SITE_TYPES: Record<SiteTypeId, SiteType> = {
        marketing: {
            id: "marketing",
            label: "Marketing",
            description: "Lead-gen, service pages, SEO-first site structure.",
        },
        ecommerce: {
            id: "ecommerce",
            label: "eCommerce",
            description: "Product catalog, carts/checkout, conversion optimization.",
        },
        fullstack: {
            id: "fullstack",
            label: "Full Stack",
            description: "Dashboards, portals, APIs, and custom integrations.",
        },
    };

    const BUILD_STATUSES: Record<BuildStatusId, BuildStatus> = {
        live: {
            id: "live",
            label: "Live Build",
            modalLabel: "Live Build",
        },
        inProgress: {
            id: "inProgress",
            label: "In Progress",
            modalLabel: "Build In Progress",
        },
    };

    interface ProjectDetail {
        title: string;
        summary: string;
        highlights?: string[];
    }

    interface Project {
        id: number;
        name: string;
        description: string;
        types: SiteTypeId[];
        buildStatus: BuildStatusId;
        thumbnail: string;
        websiteUrl: string;
        details: ProjectDetail[];
    }

    const projects: Project[] = [
        {
            id: 1,
            name: "Air Service of Florida",
            description:
                "A modern, responsive website for a regional industrial air service company.",
            types: ["marketing"],
            buildStatus: "live",
            thumbnail: "/airserviceflorida.png",
            websiteUrl: "https://airserviceofflorida.com",
            details: [
                {
                    title: "Marketing Site",
                    summary:
                        "Service-first IA, SEO-friendly pages, and clear CTAs designed to convert visitors into leads.",
                    highlights: ["Service landing pages", "CTA hierarchy", "Local SEO structure"],
                },
                {
                    title: "UX & UI",
                    summary:
                        "A clean, industrial aesthetic with a focus on readability, speed, and mobile-first browsing.",
                    highlights: ["Mobile-first layout", "Accessibility-minded typography", "Component consistency"],
                },
            ],
        },
        {
            id: 2,
            name: "Atlantic Compressor",
            description:
                "An eCommerce rebuild emphasizing clarity, speed, and conversion-ready product browsing.",
            types: ["ecommerce", "fullstack"],
            buildStatus: "inProgress",
            thumbnail: "/atlanticcompressor_1.png",
            websiteUrl: "https://atlanticcompressor.com",
            details: [
                {
                    title: "eCommerce Experience",
                    summary:
                        "Optimized product discovery and purchasing flow with category structure and conversion-minded layout.",
                    highlights: ["Product grids & filters", "Cart/checkout flow", "Conversion-focused UX"],
                },
                {
                    title: "Full-Stack Integration",
                    summary:
                        "Backend support for forms/integrations and scalable structure for future expansion.",
                    highlights: ["API integrations", "Form processing", "Maintainable architecture"],
                },
            ],
        },
    ];

    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [activeFilter, setActiveFilter] = useState<"all" | SiteTypeId>("all");

    useEffect(() => {
        if (!selectedProject) return;

        const previousOverflow = document.body.style.overflow;
        const previousPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.paddingRight = previousPaddingRight;
        };
    }, [selectedProject]);

    const filteredProjects = useMemo(() => {
        if (activeFilter === "all") return projects;
        return projects.filter((p) => p.types.includes(activeFilter));
    }, [activeFilter]);

    function Hero() {
        return (
            <div className="w-full max-w-6xl px-4 pt-16 pb-8 md:pt-20">
                
                <h1 className="montserrat mt-5 max-w-4xl text-4xl font-extrabold tracking-[-0.02em] text-[#101C2F] md:text-6xl">
                    Websites That Actually
                    <span className="block text-[#D4672A]">Move The Needle</span>
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
                    See how we craft UX-focused, performance-driven websites across marketing, eCommerce, and custom full-stack builds.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm">
                    <span className="rounded-full border border-[#14273F]/15 bg-white/80 px-3 py-1 text-[#14273F] backdrop-blur">
                        {projects.filter((p) => p.buildStatus === "live").length} launched builds
                    </span>
                    <span className="rounded-full border border-[#D4672A]/25 bg-[#D4672A]/10 px-3 py-1 text-[#9E471C]">
                        {filteredProjects.length} shown in this view
                    </span>
                    <span className="rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-amber-800">
                        {projects.filter((p) => p.buildStatus === "inProgress").length} in progress
                    </span>
                </div>

                {/* Filter Tabs (matches the mockup vibe) */}
                <div className="mt-8 rounded-2xl border border-gray-200/70 bg-white/80 p-2 backdrop-blur">
                    <div className="flex flex-wrap gap-2">
                        <TabButton
                            active={activeFilter === "all"}
                            onClick={() => setActiveFilter("all")}
                            label="All"
                        />
                        {Object.values(SITE_TYPES).map((t) => (
                            <TabButton
                                key={t.id}
                                active={activeFilter === t.id}
                                onClick={() => setActiveFilter(t.id)}
                                label={t.label}
                            />
                        ))}
                    </div>
                    {activeFilter !== "all" ? (
                        <p className="px-2 pt-3 text-sm text-gray-600">{SITE_TYPES[activeFilter].description}</p>
                    ) : null}
                </div>
            </div>
        );
    }

    function TabButton({
        active,
        onClick,
        label,
    }: {
        active: boolean;
        onClick: () => void;
        label: string;
    }) {
        return (
            <motion.button
                layout
                onClick={onClick}
                aria-pressed={active}
                className={[
                    "relative overflow-hidden rounded-xl px-4 py-2 text-sm md:text-base transition hover:cursor-pointer",
                    active
                        ? "text-white shadow-md shadow-[#14273F]/25"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                ].join(" ")}
            >
                {active ? (
                    <motion.span
                        layoutId="active-filter-pill"
                        className="absolute inset-0 bg-[#14273F]"
                        transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    />
                ) : null}
                <span className="relative z-10">{label}</span>
            </motion.button>
        );
    }

    function ProjectCards() {
        return (
            <div className="w-full max-w-6xl px-4 pb-20">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeFilter}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="grid grid-cols-1 gap-7 md:grid-cols-2"
                    >
                        {filteredProjects.map((project, index) => (
                            <motion.article
                                key={project.id}
                                layout
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 12 }}
                                transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.07 }}
                                className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#14273F]/10"
                            >
                                <div className="relative h-56 overflow-hidden">
                                    <Image
                                        src={project.thumbnail}
                                        alt={`${project.name} website preview`}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                        priority={project.id === 1}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E1A2B]/65 via-[#0E1A2B]/20 to-transparent" />

                                    <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                                        {project.types.map((t) => (
                                            <span
                                                key={t}
                                                className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs text-white backdrop-blur"
                                            >
                                                {SITE_TYPES[t].label}
                                            </span>
                                        ))}
                                    </div>

                                    <span className="absolute right-4 bottom-4 z-10 rounded-full border border-white/25 bg-black/25 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white backdrop-blur">
                                        Case Study
                                    </span>
                                </div>

                                <div className="h-1 w-full bg-gradient-to-r from-[#D4672A] via-[#F19A63] to-[#14273F]" />

                                <div className="relative p-6">
                                    <div className="pointer-events-none absolute right-5 top-2 text-6xl font-extrabold leading-none tracking-tight text-[#14273F]/8">
                                        {String(project.id).padStart(2, "0")}
                                    </div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D4672A]">
                                        {SITE_TYPES[project.types[0]].label} Build
                                    </p>
                                    <h2 className="montserrat mt-2 text-xl font-bold text-[#101C2F] md:text-2xl">
                                        {project.name}
                                    </h2>
                                    <p className="mt-3 leading-relaxed text-gray-600">{project.description}</p>
                                    <button
                                        onClick={() => setSelectedProject(project)}
                                        className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#14273F] px-4 py-2 text-white transition hover:cursor-pointer hover:bg-[#1C3656]"
                                    >
                                        View Project
                                    </button>
                                </div>
                            </motion.article>
                        ))}
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    function ProjectModal() {
        if (!selectedProject) return null;

        const uniqueHighlights = Array.from(
            new Set(selectedProject.details.flatMap((detail) => detail.highlights ?? []))
        );

        return (
            <AnimatePresence>
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-black/50 py-8 backdrop-blur-sm"
                    onClick={() => setSelectedProject(null)}
                >
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0, y: 30, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 280, damping: 24 }}
                        className="mx-auto w-[92%] max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative border-b bg-[#F8FAFC] p-6 md:p-8">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(20,39,63,0.12),transparent_45%),radial-gradient(circle_at_92%_20%,rgba(212,103,42,0.12),transparent_35%)]" />
                            <div className="flex items-start justify-between gap-4">
                                <div className="relative z-10">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4672A]">Project Spotlight</p>
                                    <h3 className="montserrat text-2xl font-bold md:text-3xl">{selectedProject.name}</h3>
                                    <p className="mt-2 text-gray-600 leading-relaxed">{selectedProject.description}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {selectedProject.types.map((t) => (
                                            <span
                                                key={t}
                                                className="rounded-full bg-[#0E1A2B] text-white px-3 py-1 text-sm"
                                            >
                                                {SITE_TYPES[t].label}
                                            </span>
                                        ))}
                                        <span
                                            className={[
                                                "rounded-full px-3 py-1 text-sm font-medium",
                                                selectedProject.buildStatus === "live"
                                                    ? "border border-emerald-300 bg-emerald-50 text-emerald-800"
                                                    : "border border-amber-300 bg-amber-50 text-amber-800",
                                            ].join(" ")}
                                        >
                                            {BUILD_STATUSES[selectedProject.buildStatus].label}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedProject(null)}
                                    className="relative z-10 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition hover:cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="p-6 md:p-8">
                            <div className="relative h-52 w-full overflow-hidden rounded-xl border border-gray-200">
                                <Image
                                    src={selectedProject.thumbnail}
                                    alt={`${selectedProject.name} full preview`}
                                    fill
                                    className="object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-[#0E1A2B]/65 via-[#0E1A2B]/30 to-transparent" />
                                <div className="absolute right-0 bottom-0 p-4 text-right">
                                    <p className="text-xs uppercase tracking-[0.2em] text-white/75">
                                        {BUILD_STATUSES[selectedProject.buildStatus].modalLabel}
                                    </p>
                                    <p className="montserrat text-lg font-semibold text-white">{selectedProject.name}</p>
                                </div>
                            </div>

                            <h4 className="text-lg font-semibold text-[#101C2F]">What we delivered</h4>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedProject.details.map((d, detailIndex) => (
                                    <motion.div
                                        key={d.title}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25, delay: detailIndex * 0.08 }}
                                        className="rounded-xl border p-4"
                                    >
                                        <div className="font-semibold text-[#14273F]">{d.title}</div>
                                        <p className="mt-1 text-sm text-gray-600">{d.summary}</p>
                                        {d.highlights?.length ? (
                                            <ul className="mt-3 text-sm list-disc pl-5">
                                                {d.highlights.map((h) => (
                                                    <li key={h}>{h}</li>
                                                ))}
                                            </ul>
                                        ) : null}
                                    </motion.div>
                                ))}
                            </div>

                            {uniqueHighlights.length ? (
                                <div className="mt-6 rounded-xl border border-[#14273F]/15 bg-[#14273F]/5 p-4">
                                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#14273F]">Impact Highlights</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {uniqueHighlights.map((highlight) => (
                                            <span
                                                key={highlight}
                                                className="rounded-full border border-[#14273F]/20 bg-white px-3 py-1 text-sm text-[#14273F]"
                                            >
                                                {highlight}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Optional CTA row */}
                            <div className="mt-8 flex flex-col md:flex-row gap-3">
                                {selectedProject.buildStatus === "live" ? (
                                    <a
                                        href={selectedProject.websiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center rounded-lg bg-[#14273F] text-white px-5 py-3 hover:opacity-90 transition hover:cursor-pointer"
                                    >
                                        Visit Live Website
                                    </a>
                                ) : (
                                    <span className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-5 py-3 font-medium text-amber-800">
                                        This build is currently in progress
                                    </span>
                                )}
                                <a
                                    href="/quote"
                                    className="rounded-lg bg-[#D4672A] text-white px-5 py-3 hover:opacity-90 transition hover:cursor-pointer"
                                >
                                    Request a Quote
                                </a>
                                
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    }
    
    return (
        <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-[#F8FAFC] text-black">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(20,39,63,0.12),transparent_38%),radial-gradient(circle_at_85%_12%,rgba(212,103,42,0.14),transparent_35%)]" />
            {Hero()}
            {ProjectCards()}
            {ProjectModal()}
        </div>
    );
}
