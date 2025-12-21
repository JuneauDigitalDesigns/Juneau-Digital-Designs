"use client"
import Image from "next/image"
import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

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

    return (
        <div className="relative z-50 w-full bg-[#0E1A2B] flex items-center py-2 px-4 shadow-lg sticky top-0">

            <Link href="/" className="flex items-center hover:cursor-pointer">
                <Image src="/JD_nobg.png" alt="Logo" width={100} height={100} className="w-[100px] h-[100px]"  />
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
                    className="cursor-pointer text-3xl text-white"
                >
                    {showNav ? "✕" : "☰"}
                </motion.div>

                <AnimatePresence>
                    {showNav && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="absolute right-0 mt-4 bg-[#14233A] text-white rounded-lg shadow-xl 
                                w-72  
                                px-4 py-4
                                flex flex-col text-lg 
                                divide-y divide-white"
                        >
                            <Link className="py-4" href="/" onClick={() => setShowNav(false)}>Home</Link>
                            <Link className="py-4" href="/projects" onClick={() => setShowNav(false)}>Projects</Link>
                            <Link className="py-4" href="/contact" onClick={() => setShowNav(false)}>Contact</Link>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
