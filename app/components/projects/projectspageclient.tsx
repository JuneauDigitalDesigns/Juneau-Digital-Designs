"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import Image from "next/image";
export default function ProjectsPageClient() {
    /**
     * 1) Swap "TECH" filters for WEBSITE TYPES
     * 2) Update projects with a `types` array for filtering
     * 3) Restructure cards to match the mockup: header + tabs + grid cards
     */

    type SiteTypeId = "marketing" | "ecommerce" | "fullstack";

    interface SiteType {
        id: SiteTypeId;
        label: string;
        description?: string;
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
        thumbnail: string;
        details: ProjectDetail[];
    }

    const projects: Project[] = [
        {
            id: 1,
            name: "Air Service of Florida",
            description:
                "A modern, responsive website for a regional industrial air service company.",
            types: ["marketing"],
            thumbnail: "/airserviceflorida.png",
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
            thumbnail: "/atlanticcompressor.png",
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

    const filteredProjects = useMemo(() => {
        if (activeFilter === "all") return projects;
        return projects.filter((p) => p.types.includes(activeFilter));
    }, [activeFilter]);

    function Hero() {
        return (
            <div className="w-full max-w-6xl px-4 pt-14 pb-6">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Our Projects</h1>
                <p className="mt-3 text-lg md:text-xl text-gray-600 max-w-2xl">
                    See how we craft UX-focused, performance-driven websites across marketing, eCommerce, and custom full-stack builds.
                </p>

                {/* Filter Tabs (matches the mockup vibe) */}
                <div className="mt-8 flex flex-wrap gap-2">
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
            <button
                onClick={onClick}
                className={[
                    "rounded-lg px-4 py-2 text-sm md:text-base transition hover:cursor-pointer",
                    active
                        ? "bg-[#14273F] text-white shadow"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                ].join(" ")}
            >
                {label}
            </button>
        );
    }

    function ProjectCards() {
        return (
            <div className="w-full max-w-6xl px-4 pb-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredProjects.map((project) => (
                        <div
                            key={project.id}
                            className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                        >
                        
                            <div className="h-56 bg-gradient-to-br from-[#0E1A2B] to-[#1B2F4B] relative">
                                
                                <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                                    {project.types.map((t) => (
                                        <span
                                            key={t}
                                            className="rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs text-white border border-white/20"
                                        >
                                            {SITE_TYPES[t].label}
                                        </span>
                                    ))}
                                </div>

                                <div className="absolute bottom-4 right-4 w-40 h-24 rounded-xl border border-white/50 bg-white/10 backdrop-blur" >
                                <Image
                                    src={project.thumbnail}
                                    alt={`${project.name} website preview`}
                                    fill
                                    className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl"
                                    priority={project.id === 1}
                                />
                                </div>
                            </div>

                            <div className="p-6">
                                <h2 className="text-xl md:text-2xl font-semibold">{project.name}</h2>
                                <p className="mt-2 text-gray-600">{project.description}</p>
                                <button
                                    onClick={() => setSelectedProject(project)}
                                    className="mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2 border border-gray-200 hover:bg-gray-50 transition hover:cursor-pointer"
                                >
                                    View Project
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    function ProjectModal() {
        if (!selectedProject) return null;

        return (
            <AnimatePresence>
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                    onClick={() => setSelectedProject(null)}
                >
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="mx-auto mt-10 w-[92%] max-w-3xl rounded-2xl bg-white shadow-xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 md:p-8 border-b">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-2xl md:text-3xl font-bold">{selectedProject.name}</h3>
                                    <p className="mt-2 text-gray-600">{selectedProject.description}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {selectedProject.types.map((t) => (
                                            <span
                                                key={t}
                                                className="rounded-full bg-[#0E1A2B] text-white px-3 py-1 text-sm"
                                            >
                                                {SITE_TYPES[t].label}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedProject(null)}
                                    className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition hover:cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="p-6 md:p-8">
                            <h4 className="text-lg font-semibold">What we delivered</h4>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedProject.details.map((d) => (
                                    <div key={d.title} className="rounded-xl border p-4">
                                        <div className="font-semibold">{d.title}</div>
                                        <p className="mt-1 text-sm text-gray-600">{d.summary}</p>
                                        {d.highlights?.length ? (
                                            <ul className="mt-3 text-sm list-disc pl-5">
                                                {d.highlights.map((h) => (
                                                    <li key={h}>{h}</li>
                                                ))}
                                            </ul>
                                        ) : null}
                                    </div>
                                ))}
                            </div>

                            {/* Optional CTA row */}
                            <div className="mt-8 flex flex-col md:flex-row gap-3">
                                <button className="rounded-lg bg-[#14273F] text-white px-5 py-3 hover:opacity-90 transition hover:cursor-pointer">
                                    Request a Quote
                                </button>
                                <button className="rounded-lg border border-gray-200 px-5 py-3 hover:bg-gray-50 transition hover:cursor-pointer">
                                    View More Work
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        );
    }
    function ProjectQuote() {
        return (
            <div className="w-full max-w-6xl px-4 pb-16">
                <div className="bg-[#14273F] text-white rounded-2xl px-8 py-8 md:py-16 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h3 className="text-2xl md:text-4xl font-semibold">Ready to start your project?</h3>
                        <p className="mt-2 text-lg md:text-xl">Contact us today for a free quote and consultation.</p>
                    </div>
                    <button className="rounded-lg bg-white text-[#14273F] px-5 py-3 hover:opacity-90 transition ease-in-out hover:cursor-pointer">
                        Request a Quote
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center min-h-screen w-full bg-white text-black">
            <Hero />
            <ProjectCards />
            <ProjectQuote />
            {selectedProject && <ProjectModal />}
        </div>
    );
}
