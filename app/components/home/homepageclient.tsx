import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComputer, faDraftingCompass, faGear, faWrench, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

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
    return (
        <>
            <motion.section
                className="relative w-full overflow-hidden"
                variants={sectionReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >

                <div className="absolute inset-0 z-0">
                    <Image
                        src="/hero_background1.png"
                        alt="Hero Background"
                        fill
                        priority
                        className="object-cover"
                    />

                    <div className="absolute inset-0 bg-black/30" />
                </div>


                <div className="relative z-10 w-full py-20 px-4 md:px-16 flex justify-center items-center">
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
    const handleOfferingClick = (offering: Offering) => {
        setSelectedOffering(offering);
    }
    const offerings: Offering[] = [
        {
            title: "User-First Design",
            icon: faDraftingCompass,
            iconColor: "text-blue-700",
            description: "We put users at the heart of every design decision. By designing intuitive and seamless user interfaces that enhance usability, and streamline navigation, we create an unforgettable experience for your audience."
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
            description: "Crafting visually stunning, responsive websites tailored to your brand identity. Every element is designed to engage users and convert visitors into customers."
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
            description: "Building robust web applications from front-end to back-end, integrating modern technologies to ensure performance, scalability, and seamless user experiences."
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
            description: "We provide comprehensive maintenance and support services to ensure your website remains secure, and up-to-date. From regular updates and backups to troubleshooting and enhancements, we are committed to keeping your digital presence strong and reliable."
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

    return (
        <motion.section
            className="z-20 py-24 px-4 bg-gray-50"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
        >
            {selectedOffering && (
                <div className="fixed inset-0 z-[999] bg-black/40 flex justify-center items-center">
                    <div ref={modalRef} className="bg-white rounded-2xl p-8 max-w-2xl mx-4 relative shadow-xl">
                        <button
                            className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-4xl hover:cursor-pointer"
                            onClick={() => setSelectedOffering(null)}
                        >
                            &times;
                        </button>

                        <h3 className="text-3xl font-extrabold mb-4">
                            {selectedOffering.clicked.title}
                        </h3>

                        <p className="text-gray-800 leading-relaxed">
                            {selectedOffering.clicked.description}
                        </p>
                        {selectedOffering.clicked.videos.map((video, index) => (
                            <div key={index} className="my-6">
                                <video
                                    src={(video as any).src}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="w-full rounded-lg shadow-md"
                                />
                                {video.body && <p className="text-gray-700 mt-2">{(video as any).body}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <motion.div className="flex flex-col w-full items-center justify-center" variants={sectionReveal}>
                <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-center text-gray-800">
                    What We Offer
                </h2>
                <span className="text-sm md:text-md italic text-center mb-12">Click one of the below services to learn more</span>
            </motion.div>
            <div className="flex flex-wrap gap-8 justify-center items-stretch">
                {offerings.map((offering) => (
                    <motion.div
                        key={offering.title}
                        className="w-full sm:w-1/2 lg:w-1/4 p-4 hover:cursor-pointer"
                        onClick={() => handleOfferingClick(offering)}
                        variants={sectionReveal}
                    >
                        <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-2 text-center h-full">
                            <div className={`${offering.iconColor} mb-6`}>
                                <FontAwesomeIcon icon={offering.icon} size="4x" />
                            </div>
                            <h3 className="text-2xl font-bold mb-3">{offering.title}</h3>
                            <p className="text-gray-700 leading-relaxed">
                                {offering.description}
                            </p>
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
    }


    const technologies: Technology[] = [
        {
            name: "Next.js",
            logo: "/techlogos/nextjs.png",
            shortDescription: "React framework for modern apps",
            detailedDescription: "Next.js is a versatile React framework that enables server-side rendering, static site generation, and API routes in one seamless solution. We use Next.js to streamline performance optimization, simplify routing, and improve SEO for our clients' websites, allowing us to deliver fast, scalable, and highly performant web applications."
        },
        {
            name: "Node.js",
            logo: "/techlogos/nodejs.png",
            shortDescription: "JavaScript runtime",
            detailedDescription: "Node.js is a runtime environment that brings JavaScript to the server, enabling full-stack development using a single language. We leverage Node.js for building scalable back-end applications and real-time APIs, allowing us to maintain consistency across the front-end and back-end while taking advantage of its high performance and vast ecosystem of open-source packages."
        },
        {
            name: "Tailwind CSS",
            logo: "/techlogos/tailwindcss.png",
            shortDescription: "Utility-first CSS",
            detailedDescription: "Tailwind CSS is a utility-first CSS framework that allows developers to quickly build custom, responsive designs without writing complex CSS. We use Tailwind to speed up UI development, maintain design consistency across projects, and ensure that our websites are visually appealing, responsive, and easy to maintain."
        },
        {
            name: "TypeScript",
            logo: "/techlogos/typescript.png",
            shortDescription: "Typed JavaScript",
            detailedDescription: "TypeScript is a superset of JavaScript that adds static typing and modern language features. We use TypeScript to catch errors early, improve code readability, and make large codebases easier to maintain. Its type safety ensures more predictable behavior and helps us deliver robust, reliable applications efficiently."
        },
        {
            name: "PostgreSQL",
            logo: "/techlogos/postgresql.png",
            shortDescription: "Open source database",
            detailedDescription: "PostgreSQL is a powerful open-source relational database known for reliability, extensibility, and advanced features like JSON support and full-text search. We use PostgreSQL to store structured data securely and efficiently, ensuring our applications can handle complex queries and scale reliably as our clients’ businesses grow."
        },
        {
            name: "MongoDB",
            logo: "/techlogos/mongodb.png",
            shortDescription: "NoSQL database",
            detailedDescription: "MongoDB is a flexible, document-oriented NoSQL database designed for modern applications. We use MongoDB to manage unstructured or rapidly evolving data models, enabling quick iteration during development while maintaining performance and scalability for applications that require real-time updates or handle large volumes of data."
        },
        {
            name: "AI",
            logo: "/techlogos/ai.webp",
            shortDescription: "Artificial Intelligence",
            detailedDescription: "Artificial Intelligence (AI) encompasses technologies that enable machines to mimic human intelligence, such as machine learning and natural language processing. We integrate AI solutions to enhance user experiences, automate tasks, and provide personalized content, helping our clients stay ahead in a competitive digital landscape."
        }
    ];

    const [selectedTech, setSelectedTech] = useState<Technology>(technologies[0] || null);

    return (
        <motion.section
            className="z-20 bg-white py-20 px-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
        >
            <motion.h2 className="text-4xl md:text-5xl font-extrabold mb-12 text-center text-black" variants={sectionReveal}>
                Technologies We Use
            </motion.h2>

            <motion.div className="flex flex-col-reverse md:flex-col mt-16 md:mt-0" variants={sectionReveal}>
                <div className="flex flex-wrap justify-center gap-4 mt-16 md:mb-16 md:mt-0">
                    {technologies.map((tech) => {
                        const isActive = selectedTech.name === tech.name;
                        return (
                            <motion.button
                                key={tech.name}
                                onClick={() => setSelectedTech(tech)}
                                className={`
                flex items-center gap-2 px-6 py-3 rounded-full border transition cursor-pointer
                ${isActive ? "border-black border-2 shadow-lg" : "bg-gray-100 text-black border-black hover:bg-gray-200"}
              `}
                                variants={sectionReveal}
                            >
                                <Image src={tech.logo} alt={`${tech.name} Logo`} width={24} height={24} className="rounded-full" />
                                <span>{tech.name}</span>
                            </motion.button>
                        );
                    })}
                </div>

                <AnimatePresence mode="wait">
                    {selectedTech && (
                        <motion.div
                            key={selectedTech.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                            className="max-w-5xl mx-auto p-10 bg-white rounded-2xl shadow-xl border-t-4 border-black"
                        >
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-10">

                                <div className="flex-shrink-0">
                                    <div className="w-32 h-32 flex items-center justify-center rounded-full bg-gray-200 shadow-inner">
                                        <Image
                                            src={selectedTech.logo}
                                            alt={`${selectedTech.name} Logo`}
                                            width={100}
                                            height={100}
                                            className="p-4"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-3xl md:text-4xl font-extrabold text-black mb-4">
                                        {selectedTech.name}
                                    </h3>
                                    <p className="text-lg md:text-xl text-gray-800 leading-relaxed">
                                        {selectedTech.detailedDescription}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
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
            category: "Corporate Website"

        },
        {
            title: "Atlantic Compressor",
            description: "A sleek, user-friendly e-commerce platform for a leading provider of industrial compressors and parts.",
            image: "/atlanticcompressor.png",
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
                <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />

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
                className="flex flex-col w-full z-20 py-20 px-4 bg-gray-100"
                variants={sectionReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
            >
                <motion.div className="max-w-2xl mx-auto text-center" variants={staggerContainer}>
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
                        Ready to Elevate Your Digital Presence?
                    </h2>
                    <p className="text-lg md:text-xl text-gray-700 mb-8">
                        Contact Juneau Digital Designs today to discuss your project and discover how we can help bring your vision to life.
                    </p>
                    <button className="bg-black text-white px-8 py-3 rounded-md text-lg font-semibold hover:bg-gray-900 transition">
                        Get in Touch
                    </button>
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