import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A service page's close: the homepage's "Get started. / Contact us now." set large, the two
 * buttons, an optional price line read from the plan list, and the next stop in the system.
 * Get Started goes to /contact, as every Get Started on the site does.
 */
export default function ServiceClose({
    price,
    second = { href: "/pricing", label: "View plans + pricing" },
    next,
}: {
    price?: ReactNode;
    second?: { href: string; label: string };
    next?: { lead: string; href: string; label: string };
}) {
    return (
        <div className="svc-close">
            <p className="svc-ask-h">
                Get <span className="svc-em">started.</span>
            </p>
            <p className="svc-ask-s">Contact us now.</p>
            <div className="svc-ask-pair">
                <Link href="/contact" className="btn primary lg">
                    Get Started
                </Link>
                <Link href={second.href} className="btn ghost">
                    {second.label}
                </Link>
            </div>
            {price && <p className="svc-price">{price}</p>}
            {next && (
                <div className="svc-next">
                    <span>{next.lead}</span>
                    <Link href={next.href}>
                        {next.label} <b>→</b>
                    </Link>
                </div>
            )}
        </div>
    );
}
