import Link from "next/link";

/**
 * /hvac's first two asks, under the heading: Get started, which goes to /contact as every Get
 * Started on the site does since the homepage redesign (Xander, 19 Nov 2026), and the pricing
 * page. The page's last asks are `PageAsk`, as on /about and /faq. Words unchanged.
 */
export default function HvacStart() {
    return (
        <div className="hvac-acts">
            <Link href="/contact" className="btn primary lg">
                Get started
            </Link>
            <Link href="/pricing" className="btn ghost lg">
                View plans + pricing
            </Link>
        </div>
    );
}
