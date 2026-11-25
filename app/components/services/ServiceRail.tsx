import Link from "next/link";
import { SERVICE_PAGES } from "@/app/data/service-pages";

/**
 * The "system rail" under each service page's hero: the four services as one line, this page lit.
 * It is what sets the service pages apart from the trade pages, and it links each to the others.
 * "One system. One monthly bill." is the homepage's live line.
 */
export default function ServiceRail({ current }: { current: string }) {
    return (
        <nav className="svc-rail" aria-label="Our services">
            <p className="svc-rail-lbl">
                One system.
                <br />
                One monthly bill.
            </p>
            <ol>
                {SERVICE_PAGES.map((s) => {
                    const on = s.href === current;
                    return (
                        <li key={s.href} className={on ? "on" : undefined}>
                            <Link href={s.href} aria-current={on ? "page" : undefined}>
                                {s.label}
                                <span>{on ? "You're here" : s.rail}</span>
                            </Link>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
