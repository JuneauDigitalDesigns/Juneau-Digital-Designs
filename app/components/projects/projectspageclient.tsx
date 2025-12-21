"use client"
import { useState, useEffect } from 'react';
export default function ProjectsPageClient() {
    interface TechBase {
        id: string;
        label: string;
        icon?: string;
        color?: string;
    }

    const TECH: Record<string, TechBase> = {
        nextjs: { id: "nextjs", label: "Next.js" },
        node: { id: "node", label: "Node.js" },
        typescript: { id: "typescript", label: "TypeScript" },
        tailwind: { id: "tailwind", label: "Tailwind CSS" },
    };

    interface ProjectTech {
        techId: keyof typeof TECH;
        summary: string;
        details?: string;
        highlights?: string[];
    }

    interface Project {
        id: number;
        name: string;
        description: string;
        tech: ProjectTech[];
    }

    const projects: Project[] = [
        {
            id: 1,
            name: "Air Service of Florida",
            description:
                "A modern, responsive website for a regional industrial air service company.",
            tech: [
                {
                    techId: "nextjs",
                    summary:
                        "Used Next.js for server-side rendering and fast page loads.",
                    highlights: [
                        "SEO-optimized routing",
                        "Server Components",
                        "Image optimization",
                    ],
                },
                {
                    techId: "tailwind",
                    summary:
                        "Tailwind enabled rapid UI iteration with a consistent design system.",
                },
            ],
        },
        {
            id: 2,
            name: "Atlantic Compressor",
            description:
                "A performance-focused rebuild emphasizing clarity and speed.",
            tech: [
                {
                    techId: "nextjs",
                    summary:
                        "Used Next.js strictly for static generation and routing.",
                },
                {
                    techId: "node",
                    summary:
                        "Node.js handled backend form processing and API integrations.",
                },
                {
                    techId: "typescript",
                    summary:
                        "TypeScript ensured type safety and maintainability in the codebase.",
                },
            ],
        },
    ];

    const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects);
    const [selectedTech, setSelectedTech] = useState<string>("all");
    const [activeTechInfo, setActiveTechInfo] = useState<{
        projectId: number;
        tech: string;
    } | null>(null);
    const handleFilter = (techId: string) => {
        setSelectedTech(techId);
        setActiveTechInfo(null);

        if (techId === "all") {
            setFilteredProjects(projects);
        } else {
            setFilteredProjects(
                projects.filter(project =>
                    project.tech.some(t => t.techId === techId)
                )
            );
        }
    };
    const handleTechInfo = (projectId: number, tech: string) => {
        setActiveTechInfo(prev =>
            prev?.projectId === projectId && prev.tech === tech
                ? null
                : { projectId, tech }
        );
    };
    function Hero() {
        return (
            <>
                <h1 className="p-4 text-2xl md:text-4xl">Projects</h1>
                <p className="py-4 text-xl md:text-2xl">
                    Explore my latest projects and collaborations.
                </p>

                <div className="w-full flex justify-between px-32 gap-2">
                    <button
                        onClick={() => handleFilter("all")}
                        className={`w-full rounded-lg py-2 text-lg text-white md:text-xl
                        ${selectedTech === "all"
                                ? "bg-blue-600"
                                : "bg-gray-400 hover:bg-gray-500"}`}
                    >
                        All
                    </button>

                    {Object.values(TECH).map((tech) => (
                        <button
                            key={tech.id}
                            onClick={() => handleFilter(tech.id)}
                            className={`w-full rounded-lg py-2 text-lg text-white md:text-xl
                            ${selectedTech === tech.id
                                    ? "bg-blue-600"
                                    : "bg-gray-400 hover:bg-gray-500"}`}
                        >
                            {tech.label}
                        </button>
                    ))}
                </div>
            </>
        );
    }
    function ProjectCards() {
        return (
            <>
                {filteredProjects.map((project) => {
                    const activeTechForProject =
                        activeTechInfo?.projectId === project.id
                            ? activeTechInfo.tech
                            : null;

                    return (
                        <div
                            key={project.id}
                            className="flex flex-col items-center w-full md:h-1/2 p-8 border rounded mx-8"
                        >
                            <h2 className="text-xl md:text-2xl text-center">
                                {project.name}
                            </h2>
                            <p className="p-8 text-center">
                                {project.description}
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {project.tech.map(({ techId }) => (
                                    <span
                                        key={techId}
                                        onClick={() => handleTechInfo(project.id, techId)}
                                        className={`cursor-pointer rounded-full px-3 py-1 text-sm md:text-base
            ${activeTechForProject === techId
                                                ? "bg-yellow-600"
                                                : selectedTech === techId
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-gray-400"
                                            }`}
                                    >
                                        {TECH[techId].label}
                                    </span>
                                ))}
                            </div>
                            {activeTechForProject && (
                                <div className="mt-4 w-full p-4 bg-gray-400 rounded-lg">
                                    <h4 className="font-semibold mb-1">
                                        {TECH[activeTechForProject].label}
                                    </h4>

                                    <p className="text-sm">
                                        {
                                            project.tech.find(
                                                t => t.techId === activeTechForProject
                                            )?.summary
                                        }
                                    </p>

                                    {project.tech.find(
                                        t => t.techId === activeTechForProject
                                    )?.highlights && (
                                            <ul className="list-disc pl-5 mt-2 text-sm">
                                                {project.tech
                                                    .find(t => t.techId === activeTechForProject)!
                                                    .highlights!.map(item => (
                                                        <li key={item}>{item}</li>
                                                    ))}
                                            </ul>
                                        )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        );
    }

    return (
        <div className='w-full h-screen flex flex-col items-center justify-center bg-white text-black'>
            <Hero />
            <div className='w-full h-full flex flex-col md:flex-row items-center justify-center'>
                <ProjectCards />
            </div>
        </div>
    );
}