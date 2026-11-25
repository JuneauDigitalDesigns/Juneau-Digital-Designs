import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import LeadPhone from "@/app/components/services/LeadPhone";
import ServiceClose from "@/app/components/services/ServiceClose";
import ServiceRail from "@/app/components/services/ServiceRail";
import SvcIcon, { type SvcIconName } from "@/app/components/services/SvcIcon";
import { TRADE_SAMPLES } from "@/app/data/trade-samples";
import { CRM_DESCRIPTION, CRM_TITLE, crmJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/crm", CRM_TITLE, CRM_DESCRIPTION);

/**
 * /crm: "A lead portal and CRM for local service businesses."
 *
 * Built to the round-3 mockup Xander approved word for word on 24 Nov 2026
 * (https://claude.ai/artifact/KqRJeYPSZdpVs4XdsWDWsM#crm). `test/service-pages.test.mjs` pins it.
 *
 * Not /portal-anything: proxy.ts puts every address that starts with /portal behind the sign-in.
 *
 * The people on the board, in the inbox and on the customer card are the portal tour's own sample
 * data for a business with no trade (`TRADE_SAMPLES.other`), so no single trade is named. The
 * Growth lines are /pricing's, word for word, with their "After carrier approval" tags; if the plan
 * change moves any of them, this page follows it.
 */
const SAMPLE = TRADE_SAMPLES.other;
const [CAROL, , TAMMY] = SAMPLE.inbox;

const GROWTH: { icon: SvcIconName; title: string; line: string; gated?: boolean }[] = [
    { icon: "calendar", title: "A calendar for every job", line: "Book job visits, estimates and follow-up calls against each customer, in one month view." },
    { icon: "msg", title: "Customer texts", line: "Text customers back from your business number, right in your portal.", gated: true },
    { icon: "star", title: "Google reviews", line: "Ask for a Google review in one tap when the job is done.", gated: true },
    { icon: "bolt", title: "The 60-second callback", line: "Web form leads get a call back automatically, within about a minute." },
];

const ROOMS: { icon: SvcIconName; name: string; line: string; growth?: string }[] = [
    { icon: "tray", name: "Inbox", line: "Every call and web inquiry, newest first." },
    { icon: "phone", name: "Calls", line: "A summary of every call.", growth: "Recordings and search on Growth" },
    { icon: "kanban", name: "Customers", line: "Your pipeline, from Lead to Won.", growth: "On Starter + AI and Growth" },
    { icon: "chart", name: "Traffic", line: "Visitors, where they came from, and your most-read pages." },
    { icon: "gauge", name: "Performance", line: "How fast your site is, in plain words." },
    { icon: "card", name: "Billing", line: "Your plan, your invoices and your call minutes." },
];

export default function CrmPage() {
    const b = SAMPLE.board;
    return (
        <main className="svc-page">
            <JsonLd data={crmJsonLd()} />

            <div className="svc-gut">
                <div className="svc-inner">
                    <div className="svc-hero svc-hero-wide">
                        <div>
                            <p className="svc-kicker">Portal + CRM</p>
                            <h1 className="svc-h1">
                                A lead portal and CRM for <span className="svc-em">local service businesses.</span>
                            </h1>
                            <p className="svc-intro">Every call and web inquiry lands in your portal, and you get a text the moment a new one arrives.</p>
                            <div className="svc-acts">
                                <Link href="/contact" className="btn primary">
                                    Get Started
                                </Link>
                                <Link href="/pricing" className="btn ghost">
                                    View plans + pricing
                                </Link>
                            </div>
                        </div>
                        <div>
                            {/* The pipeline's real stages (Lost is the sixth, kept off to the side), with the
                                portal tour's sample customers. "Going stale" is the portal's own word for a
                                lead that has sat too long (CustomersSection.tsx); the mockup drew "Going cold". */}
                            <div className="svc-board" role="img" aria-label="Example: the pipeline in the portal, from Lead to Won">
                                <Col name="Lead" card={{ name: b.lead[0].name, tag: b.lead[0].tags[0], note: b.lead[0].note }} />
                                <Col name="Contacted" card={{ name: b.contacted[0].name, tag: b.contacted[0].tags[0], note: "Going stale", stale: true }} />
                                <Col name="Quoted" card={{ name: b.quoted[0].name, tag: b.quoted[0].tags[0], note: b.quoted[0].note }} />
                                <Col name="Scheduled" card={{ name: b.scheduled[0].name, tag: b.scheduled[0].tags[0], note: b.scheduled[0].note }} />
                                <Col name="Won" won card={{ name: SAMPLE.lead.name, tag: SAMPLE.job.service, note: `$${SAMPLE.job.amount}` }} />
                            </div>
                            <div className="svc-board-cap">
                                <span className="svc-eg">
                                    <span className="svc-tag">Example</span> The portal tour&apos;s sample customers.
                                </span>
                                <span className="svc-eg">On Starter + AI and Growth</span>
                            </div>
                        </div>
                    </div>
                    <ServiceRail current="/crm" />
                </div>
            </div>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            Every lead lands <span className="svc-em">in one place.</span>
                        </h2>
                        <p className="svc-lede">
                            Calls the receptionist answers, and every form someone fills in on your site, go straight into your portal&apos;s inbox. The moment a new lead is added, a text goes to your phone saying it&apos;s there.
                        </p>
                    </div>
                    <div className="svc-land">
                        <div className="svc-inbox" role="img" aria-label="Example: three leads in the portal inbox">
                            <div className="svc-inbox-top">
                                <b>Inbox</b>
                                <span>{SAMPLE.business.name}</span>
                            </div>
                            <div className="svc-inbox-day">TODAY</div>
                            <div className="svc-irow unread">
                                <span className="svc-irow-dot" />
                                <div>
                                    <div className="svc-r1">
                                        <strong>{SAMPLE.lead.name}</strong>
                                        <span className="svc-st cb">Wants a callback</span>
                                        <time>2:13 AM</time>
                                    </div>
                                    <p className="svc-pv">{SAMPLE.lead.preview}</p>
                                    <span className="svc-mini">Call · {SAMPLE.lead.duration}</span>
                                </div>
                            </div>
                            <div className="svc-irow unread">
                                <span className="svc-irow-dot" />
                                <div>
                                    <div className="svc-r1">
                                        <strong>{CAROL.name}</strong>
                                        <span className="svc-st web">Web inquiry</span>
                                        <time>{CAROL.time}</time>
                                    </div>
                                    <p className="svc-pv">{CAROL.preview}</p>
                                    <span className="svc-mini">{CAROL.tag}</span>
                                </div>
                            </div>
                            <div className="svc-irow svc-m-cut">
                                <span className="svc-irow-dot" />
                                <div>
                                    <div className="svc-r1">
                                        <strong>{TAMMY.name}</strong>
                                        <time>{TAMMY.time}</time>
                                    </div>
                                    <p className="svc-pv">{TAMMY.preview}</p>
                                    <span className="svc-mini">{TAMMY.tag}</span>
                                </div>
                            </div>
                        </div>
                        <LeadPhone />
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <div className="svc-head">
                        <h2 className="svc-h2">
                            Then work every lead <span className="svc-em">to Won.</span>
                        </h2>
                        <p className="svc-lede">With the AI receptionist, your portal becomes a pipeline you run from Lead to Won.</p>
                    </div>
                    <div className="svc-cust">
                        <div className="svc-ccard" role="img" aria-label="Example: one customer's record in the portal">
                            <div className="svc-cc-top">
                                <span className="svc-av">{SAMPLE.lead.initials}</span>
                                <span>
                                    <b>{SAMPLE.lead.name}</b>
                                    <small>
                                        {SAMPLE.lead.phone} · {SAMPLE.lead.address}
                                    </small>
                                </span>
                                <span className="svc-stage-pill">Won</span>
                            </div>
                            <div className="svc-cc-row">
                                <span>Job</span>
                                <span>
                                    {SAMPLE.job.service} · <b>${SAMPLE.job.amount}</b>
                                </span>
                            </div>
                            <div className="svc-cc-row">
                                <span>Note</span>
                                <span>{SAMPLE.note}</span>
                            </div>
                            <div className="svc-thread">
                                <p className="svc-bub me">{SAMPLE.sms}</p>
                                <p className="svc-bub them">{SAMPLE.reply}</p>
                            </div>
                            <div className="svc-cc-act">
                                <span className="pri">Ask for a review</span>
                                <span>Text</span>
                                <span>Call</span>
                            </div>
                        </div>
                        <div>
                            <ul className="svc-gsys">
                                {GROWTH.map((g) => (
                                    <li key={g.title}>
                                        <SvcIcon name={g.icon} />
                                        <b>
                                            {g.title}
                                            {g.gated && (
                                                <Link href="/faq#how-fast-live" className="svc-gate">
                                                    After carrier approval
                                                </Link>
                                            )}
                                        </b>
                                        <p>{g.line}</p>
                                    </li>
                                ))}
                            </ul>
                            <p className="svc-also">AI lead qualification, a searchable call log with recordings, and urgency and caller names pulled from every call.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            Your portal, <span className="svc-em">tab by tab.</span>
                        </h2>
                    </div>
                    <ul className="svc-rooms">
                        {ROOMS.map((r) => (
                            <li key={r.name} className="svc-room">
                                <SvcIcon name={r.icon} />
                                <b>{r.name}</b>
                                <p>
                                    {r.line}
                                    {r.growth && <span>{r.growth}</span>}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <ServiceClose next={{ lead: "Back to the start", href: "/website-design", label: "Website design" }} />
                </div>
            </section>
        </main>
    );
}

function Col({ name, card, won }: { name: string; won?: boolean; card: { name: string; tag: string; note?: string; stale?: boolean } }) {
    return (
        <div className={`svc-col${won ? " won" : ""}`}>
            <p className="svc-col-h">
                {name} <span>1</span>
            </p>
            <div className={`svc-card${card.stale ? " stale" : ""}${won ? " won" : ""}`}>
                <b>{card.name}</b>
                <span className="svc-card-tg">{card.tag}</span>
                {card.note && <span className="svc-card-nt">{card.note}</span>}
            </div>
        </div>
    );
}
