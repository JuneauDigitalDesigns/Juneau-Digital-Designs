import type { Metadata } from "next";
import { FAQ_GROUPS } from "@/app/data/faq";
import FaqAsk from "@/app/components/faq/FaqAsk";

export const metadata: Metadata = {
    title: "FAQ | Juneau Digital Designs",
    description:
        "Straight answers on the AI receptionist, your website, your plan and getting set up, before you call.",
};

/**
 * The FAQ, on its own page.
 *
 * Was the homepage's "Before you call." section: five collapsed questions that had fallen behind
 * the fuller set on /pricing. Moved here on 9 Nov 2026 and rebuilt from the pricing answers plus
 * the four homepage questions pricing never had. Every answer is read from `app/data/faq.ts`, the
 * same objects /pricing prints, so the two pages cannot disagree.
 *
 * Open, not collapsed: someone who came to a page called FAQ came to read the answers. The ruled
 * two-column entries are /pricing's FAQ layout, grouped under four plain labels.
 */
export default function FaqPage() {
    return (
        <main className="faq-page">
            <div className="aurora-grid" />
            <div className="faq-inner">
                <p className="kicker faq-kicker">FAQ</p>
                <h1 className="faq-h1">Before you call.</h1>

                {FAQ_GROUPS.map((group) => (
                    <section key={group.label} className="faq-group" aria-labelledby={`faq-${slug(group.label)}`}>
                        <h2 id={`faq-${slug(group.label)}`} className="faq-group-label">{group.label}</h2>
                        <div className="faq-grid">
                            {group.entries.map((item) => (
                                <div key={item.q} id={item.id} className="faq-entry">
                                    <h3 className="faq-entry-q">{item.q}</h3>
                                    {(Array.isArray(item.a) ? item.a : [item.a]).map((para, i) => (
                                        <p key={i} className="faq-entry-a">{para}</p>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}

                <FaqAsk />
            </div>
        </main>
    );
}

function slug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
