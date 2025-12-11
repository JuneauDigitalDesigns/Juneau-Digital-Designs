import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComputer, faDraftingCompass, faGear, faWrench, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";


function Hero() {
    return (
        <>
            <div className="z-20 w-full py-20 px-4 md:px-16 flex justify-center items-center">
                <div className="w-full flex flex-col md:flex-row items-center justify-center md:space-x-4">

                    <div className="w-full md:w-1/2 flex flex-col items-center md:items-start px-4 text-center md:text-left">
                        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                            Digital Solutions for Modern Businesses
                        </h1>

                        <p className="text-xl md:text-2xl mb-6 max-w-lg">
                            <span className="text-2xl md:text-3xl font-extrabold">Cutting-edge</span> web design, full-stack development, and maintenance & support services
                            to help your business thrive in the digital age.
                        </p>

                        <button className="border px-6 py-3 rounded hover:bg-black hover:text-white transition">
                            Get Started
                        </button>
                    </div>

                    <div className="w-full md:w-1/2 flex justify-center md:justify-end mt-10 md:mt-0 px-4">
                        <Image
                            src="/window_element.png"
                            alt="Homepage Illustration"
                            width={600}
                            height={600}
                            className="w-full max-w-sm md:max-w-md lg:max-w-xl"
                        />
                    </div>
                </div>
            </div>
        </>


    )
}

function Mission() {
    return (
        <>
            <section className="z-20 py-32 px-4 bg-gray-50">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
                        Every Pixel Matters. Every Click Counts.
                    </h2>
                    <p className="text-lg md:text-xl text-gray-700 mb-8">
                        At <span className="font-semibold text-2xl">Juneau Digital Designs</span>, we craft websites where no detail is too small.
                        From micro-interactions to seamless navigation, we focus on the user experience that ensures your audience stays engaged with your business.
                    </p>
                    <button className="bg-black text-white px-8 py-3 rounded-md text-lg font-semibold hover:bg-gray-900 transition">
                        Discover How
                    </button>
                </div>
            </section>
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
        <div className="z-20 py-24 px-4 bg-gray-50 mb-8">
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

            <div className="flex flex-col w-full items-center justify-center">
                <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-center text-gray-800">
                    What We Offer
                </h2>
                <span className="text-sm md:text-md italic text-center mb-12">Click one of the below services to learn more</span>
            </div>
            <div className="flex flex-wrap gap-8 justify-center items-stretch">
                {offerings.map((offering) => (
                    <div
                        key={offering.title}
                        className="w-full sm:w-1/2 lg:w-1/4 p-4 hover:cursor-pointer"
                        onClick={() => handleOfferingClick(offering)}
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
                    </div>
                ))}
            </div>
        </div>

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
        <section className="z-20 bg-white py-20 px-4">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-12 text-center text-black">
                Technologies We Use
            </h2>

            <div className="flex flex-wrap justify-center gap-4 mb-16">
                {technologies.map((tech) => {
                    const isActive = selectedTech.name === tech.name;
                    return (
                        <button
                            key={tech.name}
                            onClick={() => setSelectedTech(tech)}
                            className={`
                flex items-center gap-2 px-6 py-3 rounded-full border transition cursor-pointer
                ${isActive ? "border-black border-2 shadow-lg" : "bg-gray-100 text-black border-black hover:bg-gray-200"}
              `}
                        >
                            <Image src={tech.logo} alt={`${tech.name} Logo`} width={24} height={24} className="rounded-full" />
                            <span>{tech.name}</span>
                        </button>
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
        </section>
    );
}

// function Design() {
//     const designTools = [
//         {
//             name: "Figma",
//             logo: "/techlogos/figma.png",
//         },
//         {
//             name: "Sketch",
//             logo: "/techlogos/sketch.png",
//         },
//         {
//             name: "Adobe XD",
//             logo: "/techlogos/adobexd.png",
//         },
//         {
//             name: "Canva",
//             logo: "/techlogos/canva.png",
//         },
//     ];
//     return (
//         <>
//             <div className="z-20 bg-gray-100 py-16 px-4 pb-16">
//                 <h2 className="text-4xl md:text-5xl text-center font-extrabold mb-6 leading-tight">Design Tools We Use</h2>
//                 <div className="w-full flex flex-col flex-wrap md:flex-row items-center justify-center">
//                     {designTools.map((tool) => (
//                         <div key={tool.name} className="p-6 m-4 w-48 flex flex-col items-center">
//                             <Image
//                                 src={tool.logo}
//                                 alt={`${tool.name} Logo`}
//                                 width={64}
//                                 height={64}
//                                 className="mb-4"
//                             />
//                             <h3 className="text-xl font-bold mb-2">{tool.name}</h3>
//                         </div>
//                     ))}
//                 </div>
//             </div>
//         </>
//     )
// }

function Projects() {
    interface Project {
        title?: string;
        description?: string;
        image?: string;
        link?: string;
    }

    const projects: Project[] = [
        {
            title: "Air Service of Florida",
            description: "A modern, responsive website for a regional industrial air service company. ",
            image: "/airserviceflorida.png",
            link: "https://airserviceofflorida.com"

        },
        {
            title: "Atlantic Compressor",
            description: "A sleek, user-friendly e-commerce platform for a leading provider of industrial compressors and parts.",
            image: "/atlanticcompressor.png",
            link: "https://atlanticcompressor.com"
        }
    ];
    return (
        <>
            <div className="bg-gray-100 z-20 py-20 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
                        Our Recent Projects
                    </h2>
                    <p className="text-lg md:text-xl text-gray-700 mb-8">
                        Explore some of our latest work showcasing our expertise in web design, UI/UX, and full stack development.
                    </p>
                    <div className="w-full flex flex-col md:flex-row gap-8">
                        {projects.map((project) => (
                            <div key={project.title} className="w-full bg-white rounded-2xl shadow-lg overflow-hidden mb-12">
                                {project.image && (
                                    <Image
                                        src={project.image}
                                        alt={project.title || "Project Image"}
                                        width={800}
                                        height={400}
                                        className="w-full h-[200px] object-cover"
                                    />
                                )}
                                <div className="p-6 text-left">
                                    <h3 className="text-2xl font-bold mb-2">{project.title}</h3>
                                    <p className="text-gray-700 mb-4">{project.description}</p>
                                    {project.link && (
                                        <a
                                            href={project.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-600 hover:underline font-semibold"
                                        >
                                            Visit Website
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}

function Contact() {
    return (
        <>
            <section className="z-20 py-20 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
                        Ready to Elevate Your Digital Presence?
                    </h2>
                    <p className="text-lg md:text-xl text-gray-700 mb-8">
                        Contact Juneau Digital Designs today to discuss your project and discover how we can help bring your vision to life.
                    </p>
                    <button className="bg-black text-white px-8 py-3 rounded-md text-lg font-semibold hover:bg-gray-900 transition">
                        Get in Touch
                    </button>
                </div>
            </section>
        </>
    )
}

// function ParallaxBackground() {
//   // This tracks the scroll of the whole page
//   const { scrollY } = useScroll();

//   // Map scroll position to y-offsets for layers
//   const ySlow = useTransform(scrollY, [0, 1000], [0, -50]);
//   const yMedium = useTransform(scrollY, [0, 1000], [0, -100]);
//   const yFast = useTransform(scrollY, [0, 1000], [0, -150]);

//   return (
//     <div className="fixed inset-0 z-10 pointer-events-none">
//       <motion.div
//         style={{ y: ySlow }}
//         className="absolute top-20 left-10 w-40 h-40 bg-indigo-300 rounded-full opacity-30"
//       />
//       <motion.div
//         style={{ y: yMedium }}
//         className="absolute top-64 right-20 w-60 h-60 bg-pink-300 rounded-full opacity-20"
//       />
//       <motion.div
//         style={{ y: yFast }}
//         className="absolute bottom-20 left-80 transform -translate-x-1/2 w-80 h-80 bg-yellow-300 rounded-full opacity-10"
//       />
//     </div>
//   );
// }

export default function HomePageClient() {
    return (
        <div className="w-full min-h-[100dvh] text-black bg-white relative overflow-x-hidden">
            {/* <ParallaxBackground /> */}
            <Hero />
            <Mission />
            <Offer />
            <Technology />
            <Projects />
            {/* <Design /> */}
            <Contact />
        </div>
    );
}