"use client"
import Image from "next/image"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
interface Pages {
    name: string;
    href: string;
}

export default function Navbar() {
    const [showNav, setShowNav] = useState(false)
    const modalRef = useRef<HTMLDivElement>(null);
    const handleCloseModal = () => {
        setShowNav(false);
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
    const pages: Pages[] = [
        { name: "Home", href: "/" },
        { name: "Projects", href: "/projects" },
        { name: "Contact", href: "/contact" },
    ]
    return (
        <div className="relative z-50 w-full bg-[#0E1A2B] flex items-center shadow-lg sticky top-0">

            <div className="flex w-full px-4 py-4 items-center">
                <Link href="/" className="hover:cursor-pointer">
                    <Image src="/JD_nobg.png" alt="Logo" width={100} height={100} className="w-[100px] h-[100px]" />
                </Link>

                <div
                    ref={modalRef}
                    className="ml-auto text-3xl cursor-pointer text-white select-none relative"
                    onClick={() => setShowNav(prev => !prev)}
                >
                    <motion.div
                        key={showNav ? "close" : "open"}
                        initial={{ opacity: 0, rotate: showNav ? -90 : 90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: showNav ? 90 : -90 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="mr-4 cursor-pointer text-3xl text-white"
                    >
                        {showNav ? "✕" : "☰"}
                    </motion.div>
                </div>
            </div>
            <AnimatePresence>
                {showNav && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="absolute top-0 text-white
                                w-screen h-screen
                                flex flex-col text-lg 
                                divide-y divide-white
                                scrollbar-hide
                                
                                "
                    >
                        <div className="flex flex-col w-full bg-[#14233A] shadow-2xl" >
                            <div className="flex flex-row px-4 items-center border-b border-white/20">
                                <Image src="/JD_nobg.png" alt="Logo" width={200} height={200} className="w-[150px] h-[150px]" />
                                <motion.div
                                    key={showNav ? "close" : "open"}
                                    initial={{ opacity: 0, rotate: showNav ? -90 : 90 }}
                                    animate={{ opacity: 1, rotate: 0 }}
                                    exit={{ opacity: 0, rotate: showNav ? 90 : -90 }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="ml-auto mr-8 cursor-pointer text-3xl text-white"
                                >
                                    {showNav ? "✕" : "☰"}
                                </motion.div>
                            </div>
                            <div className="flex flex-col md:flex-row ">
                                <div className="flex flex-col items-center justify-center px-16">
                                    {pages.map((page) => (
                                        <Link
                                            key={page.name
                                            }
                                            className="py-4 ml-8 hover:underline hover:underline-offset-4"
                                            href={page.href}
                                            onClick={() => setShowNav(false)}
                                        >
                                            {page.name}
                                        </Link>
                                    ))
                                    }

                                </div>
                                <div className="p-32 ml-auto">
                                    <Link className="p-8 border border-white/50 rounded-xl" href="/quote" onClick={() => setShowNav(false)}>Request a Quote</Link>
                                </div>
                            </div>
                        </div>

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
