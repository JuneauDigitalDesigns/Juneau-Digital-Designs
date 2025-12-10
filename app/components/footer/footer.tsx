export default function Footer() {
    return (
        <footer className="w-full bg-gray-800 text-white py-6 flex flex-col items-center">
            <p className="text-sm">&copy; {new Date().getFullYear()} Juneau Digital Designs. All rights reserved.</p>
            <p className="text-sm mt-2">Crafted with care by Juneau Digital Designs.</p>
        </footer>
    );
}