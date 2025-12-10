"use client"
import Image from "next/image"
import Link from "next/link"
export default function Navbar() {
    return (
        <div className="z-50 w-full flex bg-[#0E1A2B]">
            <Image src="/JD_nobg.png" alt="Logo" width={200} height={50} />
            <nav className="flex items-center ml-auto space-x-4 mr-4">
                <Link href="/" className="text-lg font-medium hover:text-gray-700">
                    Home
                </Link>
                <Link href="/contact" className="text-lg font-medium hover:text-gray-700">
                    Contact
                </Link>
            </nav>
        </div>
    )
}