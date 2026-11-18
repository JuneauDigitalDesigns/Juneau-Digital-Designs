import { ownerTextCampaign, type OwnerTextCampaign } from "../owner-text-campaign";
import type { Block, SectionDef, SubsectionDef } from "./types";

/**
 * The Terms of Service, v6.0 and v6.2. Approved word for word by Xander on 2026-11-16
 * ("The new terms of service looks good. I approve."). Don't reword any of it without his sign-off.
 * Three later sentences were approved word for word the same day: the §2.2 exception, the §3.7
 * Growth to Enterprise sentence (Q8), and the §3.10 add-on billing sentence ("billing date", not
 * "renewal date", his choice; the portal uses the same words).
 *
 * Replaced the Master Services Agreement (v5.4, `terms-v5.ts`, deleted in this change; its text
 * lives in git history and in every stored PDF). What changed, in short:
 *   - month to month only: no annual prepay, no minimum term, no refunds, credits or proration;
 *   - the onboarding fee is charged once and buys a permanent licence to use the website (§6.4);
 *   - on exit the client takes a UI-only static copy of the site, the content file once fees are
 *     paid, a PDF of the call log and web inquiries, the domain, and may port a JDD number (§9);
 *   - search work beyond the technical basics (§3.4) is a paid add-on (§3.5, §3.10);
 *   - a site is four (4) or more pages, carried over from MSA v5.5 (PR #113, closed unmerged).
 *
 * ONE DOCUMENT FOR EVERY PLAN. Section numbers are fixed: a clause that applies to one plan says
 * so instead of disappearing, so every client reads the same numbers. Only the plan summary
 * (Schedule A's successor, built in `index.ts` from `schedules.ts`) varies by plan.
 *
 * v6.1 → v6.2 on 2026-11-18 (Xander, word for word): §4.6 under v2 names customer-reply alerts, as
 * the replacement campaign and its consent text (`sms-consent-v3`) do. v6.1 was only ever shown
 * under `OWNER_TEXT_CAMPAIGN=v2`; it was bumped rather than edited because whether any preview
 * deploy had recorded a v6.1 acceptance could not be checked, and a version names one text.
 *
 * TWO VERSIONS, ONE DIFFERENCE. v6.0 is the text under the SMS campaign live today (v1); v6.2 is
 * the same text with §4.6 and the plan summary's text-alert line in the v2 wording. Which one is
 * shown follows `OWNER_TEXT_CAMPAIGN`, exactly as the SMS checkbox does, and each has its own
 * version string and hash, so an acceptance proves the words that client saw. The env is read on
 * the server; every importer of this module is server-side.
 *
 * No dashes as punctuation, no square brackets, "inquiry" not "enquiry" (house style).
 */

export type TermsCampaign = OwnerTextCampaign;

export const TERMS_VERSIONS: Record<TermsCampaign, string> = { v1: "v6.0", v2: "v6.2" };

/** The version for a campaign. Defaults to the live switch. */
export function termsVersion(campaign: TermsCampaign = ownerTextCampaign()): string {
  return TERMS_VERSIONS[campaign];
}

/** The live version, as stored on every acceptance made under this deploy. */
export const TERMS_VERSION = termsVersion();

export const PROVIDER = {
  legalName: "Juneau Digital Designs LLC",
  addressLine: "120 Windtree Ln",
  cityStateZip: "Winter Garden, FL 34787",
  signerName: "Xander Juneau",
  signerTitle: "Founder",
} as const;

const p = (text: string): Block => ({ kind: "para", text });
const caps = (text: string): Block => ({ kind: "allcaps", text });
/** A numbered clause with no heading of its own: the renderers print its number inline. */
const clause = (...blocks: Block[]): SubsectionDef => ({ heading: "", blocks });
const titled = (heading: string, ...blocks: Block[]): SubsectionDef => ({ heading, blocks });

/** The text before Section 1. Rendered unnumbered, ahead of the sections, and hashed with them. */
export const PREAMBLE: Block[] = [
  p(
    'These Terms of Service (the "Terms") are an agreement between Juneau Digital Designs LLC, 120 Windtree Ln, Winter Garden, FL 34787 ("JDD", "we", "us") and the business that accepts them ("you"). They cover the website, AI receptionist, phone number, call log, client portal and related services we provide on your plan (the "Service"). Your plan summary, shown with these Terms when you accept them, lists what your plan includes and what it costs, and is part of these Terms.',
  ),
  p(
    "By ticking the box to accept these Terms, or by agreeing to them on a recorded call with us, you accept them on behalf of your business and confirm that you have the authority to do so.",
  ),
];

const TEXTS_V1 =
  "If you opt in, we text you a summary after each call the AI receptionist handles, and occasional service alerts about your account. These texts are optional, are covered by our SMS Terms, and are not a condition of buying the Service. Message frequency varies based on call volume. Reply STOP to stop them, or HELP for help. If your plan lets your business text its own customers, you are responsible for having each customer's consent and for what your business sends.";
const TEXTS_V2 =
  "If you opt in, we text you call summaries, new-lead alerts, customer-reply alerts and occasional service alerts about your own account. These texts are optional, are covered by our SMS Terms, and are not a condition of buying the Service. Message frequency varies based on call and lead volume. Reply STOP to stop them, or HELP for help. If your plan lets your business text its own customers, you are responsible for having each customer's consent and for what your business sends.";

export function buildSections(campaign: TermsCampaign = ownerTextCampaign()): SectionDef[] {
  return [
    {
      id: "term",
      heading: "NO LONG-TERM CONTRACT",
      subsections: [
        clause(p("The Service runs month to month. There is no minimum term and no early-termination fee.")),
        clause(
          p(
            "You can cancel at any time, in your client portal or by emailing us. Cancellation takes effect at the end of the monthly term you have already paid for. The Service keeps running until then, and the handover in Section 9 starts when it ends.",
          ),
        ),
        clause(
          p(
            "We can end the Service at the end of any monthly term by giving you at least thirty (30) days' notice by email, or sooner under Section 12.",
          ),
        ),
      ],
    },
    {
      id: "fees",
      heading: "FEES, BILLING AND NO REFUNDS",
      subsections: [
        clause(
          p(
            "You pay your plan's monthly fee in advance. The first month's fee and the one-time onboarding fee are charged at checkout. Each later monthly fee is charged on the same day of the month as the first. The onboarding fee is charged once only, and never again, including when you change plans.",
          ),
        ),
        titled(
          "No refunds",
          p(
            "Every fee is non-refundable, including the onboarding fee and the current month's fee. We do not prorate, credit or refund any part of a month for any reason, including when you cancel, change to a lower plan, or stop using the Service. The one exception is a move onto an Enterprise plan, described in Section 3.7.",
          ),
        ),
        clause(
          p(
            "Fees are due for every month the Service runs, whether or not you use it, send us content or respond to our requests.",
          ),
        ),
        titled(
          "Call minutes",
          p(
            "Your plan includes a monthly allowance of call minutes, which covers calls the AI receptionist answers and callbacks it places. Unused minutes do not roll over. Minutes over the allowance are billed at the overage rate in your plan summary after the month ends.",
          ),
        ),
        titled(
          "Payment method and failed payments",
          p(
            "You authorize us to charge your payment method on file each month. If a payment fails, we will retry it. If it is still unpaid seven (7) days after it was due, we may suspend the Service until it is paid. A payment unpaid for more than fifteen (15) days carries a $25 late fee. If a payment is still unpaid thirty (30) days after it was due, we may end the Service.",
          ),
        ),
        titled(
          "Chargebacks",
          p(
            "Please contact us before you dispute a charge with your bank or card issuer. If you file a chargeback without contacting us first, we may suspend the Service while it is open, and you agree to repay the fee our payment processor charges us for it. A chargeback filed in bad faith is a breach of these Terms. This section does not limit any right you have under law that cannot be waived.",
          ),
        ),
        titled(
          "Price changes",
          p(
            "We will give you at least thirty (30) days' notice by email of any change to your price. If you do not accept it, you can cancel before it takes effect.",
          ),
        ),
        titled(
          "What your fees pay for",
          p(
            "The onboarding fee pays for building your website, and buys the licence to use it described in Section 6.4. The monthly fee pays for the Service: hosting, the AI receptionist, your phone number, our automations, your call log and client portal, your domain, content edits and support.",
          ),
        ),
      ],
    },
    {
      id: "provide",
      heading: "WHAT WE PROVIDE",
      subsections: [
        titled(
          "Your plan and your website",
          p(
            "Your plan summary lists what your plan includes. Your website is a site at a single domain of four (4) or more pages: Home, Services, About and Contact, an individual page for each service for which you give us enough detail to support one, an individual page for each town you work in for which you give us enough real details about your work there, such as photos of jobs or reviews from customers in that town, and an optional additional page. Other pages, including pages added later and new pages proposed from search data, are not included in any plan and are paid add-on work. Landing pages and microsites do not count as separate sites. Anything else your plan summary does not list is outside your plan, and we will quote it separately before doing it.",
          ),
        ),
        titled(
          "Onboarding and delivery",
          p(
            "You give us your business information through our intake form. We aim to deliver a preview of your site within seventy-two (72) hours of a complete intake, and your live site within one (1) week. These are targets, not guarantees, and they run from the day your intake is complete.",
          ),
        ),
        titled(
          "Content edits",
          p(
            "Your plan includes a number of content edits each month, as listed in your plan summary. An edit changes the text on your site or the colors already in use. Changes to layout, structure or design, and new sections or pages, are quoted separately and done only with your written approval. Unused edits do not roll over.",
          ),
        ),
        titled(
          "Search-ready build",
          p(
            "We build every site with the technical basics search engines look for: a title, description and canonical address for each page; a sitemap, and a robots file that lets search engines in; structured data that describes your business, its services and how its pages fit together; link previews for sharing; and a short summary for AI search tools. Pages are prebuilt so they load fast, images are sized for each screen in modern formats and carry text descriptions, fonts are served with the site, and the design works on phones. We do not promise any search ranking, traffic or number of inquiries. To see how your site appears in Google search, we add it to our own Google Search Console account; that is for our use and is not a service to you, and Section 9.6 says what happens when the Service ends.",
          ),
        ),
        titled(
          "Not included",
          p(
            "Unless your plan summary lists them, these are not included: e-commerce or online payments; paid ads, social media or email marketing; content marketing and link building; search engine optimization services, such as ongoing search optimization, keyword research and new pages proposed from search data; integrations with other software; custom AI receptionist flows; and a full accessibility audit (see Section 8.2).",
          ),
        ),
        titled(
          "Support",
          p("We aim to reply to support requests within one (1) business day during our business hours. A reply is not a resolution."),
        ),
        titled(
          "Plan changes",
          p(
            "A change to a higher plan takes effect immediately. You are charged the difference between the two plans' monthly fees, prorated for the rest of the current month, and the higher plan's monthly fee from your next billing date. A change to a lower plan takes effect at the end of the current monthly term, with no credit, refund or proration of any kind. When sites on a Growth plan move onto an Enterprise plan, the unused part of the current month on each of their Growth subscriptions is credited to your account and taken off your next invoices, and their unused included call minutes are added to your Enterprise allowance for the rest of that month only.",
          ),
        ),
        titled(
          "Enterprise sites",
          p(
            "The Enterprise plan covers two (2) to three (3) sites, each at its own domain, with one shared pool of call minutes. You may swap a site for a different one up to two (2) times in any twelve (12) months, with thirty (30) days' notice. A fourth site needs a separate plan. Removing a site does not change the fee. Whoever accepts these Terms for an Enterprise plan confirms they have authority to bind every business on it.",
          ),
        ),
        titled(
          "Our providers",
          p(
            "We run the Service with third-party providers, including Vercel (hosting, site statistics and document storage), GitHub (code), Cloudflare (domains, DNS and form protection), Clerk (portal sign-in), Upstash (data storage), Make.com (automation), Airtable (call log), Twilio (phone numbers and texts), Retell AI (voice agent, call recording and call summaries), OpenAI and Anthropic (AI models), Resend (email), Stripe (payments) and Google (Search Console and Lighthouse performance checks). We may change providers. We are responsible for the Service as a whole, but not for an outage, error or change made by one of them (see Section 10).",
          ),
        ),
        titled(
          "Optional add-ons",
          p(
            "We may offer optional services that are not part of any plan. Each has its own price, which we tell you before you add it. An add-on is billed monthly with your plan, is covered by these Terms (including Section 2.2), and can be cancelled at any time, taking effect at the end of the monthly term you have paid for. An add-on's monthly price is never prorated. You can start it right away, paying its full monthly price that day and then on each billing date, or have it start on your next billing date.",
          ),
        ),
      ],
    },
    {
      id: "receptionist",
      heading: "THE AI RECEPTIONIST",
      intro: [p("This section does not apply to a website-only plan.")],
      subsections: [
        titled(
          "How it answers",
          p(
            "Calls ring your own line first. The AI receptionist answers only when you do not pick up, so it takes the place of your voicemail. It can answer only once your calls reach the number we give you. At onboarding you choose either to forward your business line to that number or to publish that number as your business number. You make the change with your phone company, and we will help. On the Starter plan you may instead decline the receptionist and take the website only, at the same price.",
          ),
        ),
        titled(
          "What it does, and its limits",
          p(
            "The receptionist answers from the information you give us, takes each caller's details and puts the call in your portal. It is set up not to quote prices, make bookings or commitments, or give legal, medical, financial or other professional advice. It is an AI system: it can mishear, misunderstand or say something inaccurate, and a call can fail or go unanswered. You are responsible for keeping your information accurate, telling us when it changes, and checking your portal.",
          ),
        ),
        titled(
          "Call recording",
          p(
            "Every call the receptionist handles is recorded and summarized. Florida is an all-party consent state (Fla. Stat. § 934.03), and some other states also require every party's consent to record a call. On every call it handles, the receptionist's first words say that the call is recorded, and we will not remove that. As the business each call is for, you consent to those calls being recorded and summarized. We do not record calls you answer yourself. If you record any call by your own means, getting any consent the law requires is your responsibility. Tell us in writing of any further recording rule you know applies to your business or industry. We set up the disclosure as described here; we do not promise that it alone satisfies every law, or that every caller hears it.",
          ),
        ),
        titled(
          "Saying it is an AI",
          p(
            "If a caller asks, the receptionist says it is a virtual assistant. Some places require a business to tell callers up front that they are talking to an AI. Tell us in writing if that applies to you, at onboarding and whenever it changes. On your written request, we will have the receptionist say near the start of each call that it is an AI.",
          ),
        ),
        titled(
          "AI callbacks (Growth and Enterprise)",
          p(
            "The receptionist calls back someone who fills in your website form only if they tick a box agreeing to a call from an AI voice. We provide that box and its wording, and we keep the record of each agreement. You must not change or remove the box or its wording, or ask us to call anyone who has not agreed that way. If anyone asks not to be called again, you must honor that and tell us. Your dealings with your own customers are your responsibility.",
          ),
        ),
        titled("Texts from us to you", p(campaign === "v2" ? TEXTS_V2 : TEXTS_V1)),
        titled(
          "The law that applies to you",
          p(
            "You are responsible for complying with the laws that apply to your business and to the calls and texts made for it, including the Telephone Consumer Protection Act, recording laws, laws about disclosing AI, and your industry's rules. We rely on what you tell us about your business. We do not monitor changes in the law for you or decide which laws apply to you or your callers.",
          ),
        ),
        titled(
          "Your phone number",
          p(
            "A number we provision for you belongs to our telephone account. While you are a client, it is yours alone to use, and you may put it on your website, vehicles, cards, ads and Google Business Profile. A number you already had, and forward to ours, stays yours. What happens to each when you leave is in Section 9.4.",
          ),
        ),
      ],
    },
    {
      id: "portal",
      heading: "YOUR CLIENT PORTAL",
      intro: [
        p(
          "You can use the client portal while you are a client. Keep your sign-in safe and do not share it outside your business; you are responsible for activity under your account, and you should tell us promptly if you think someone else has used it. The portal is your report: we do not send separate periodic reports. It is provided as available, and the uptime target in Section 10.1 does not apply to it. Your access ends when the Service ends.",
        ),
      ],
      subsections: [],
    },
    {
      id: "ip",
      heading: "YOUR CONTENT, YOUR WEBSITE AND OUR TECHNOLOGY",
      subsections: [
        titled(
          "Your content",
          p(
            "Your business name, logo, photos, text, testimonials and other content you give us stay yours. You let us use them to provide the Service. You confirm that you own them or have permission to use them, and that they do not infringe anyone's rights or mislead anyone.",
          ),
        ),
        titled(
          "Copyright complaints",
          p(
            "If we receive a copyright complaint about content on your site, we may forward it to you and take the content down until it is resolved. Repeated infringement, or ignoring valid complaints, lets us end the Service under Section 12.",
          ),
        ),
        titled(
          "Our technology",
          p(
            "Our website templates and components, intake forms, AI receptionist prompts and configuration, automations, call log, client portal and other tools are ours. While you are a client, you may use them for your own business only. You may not copy, resell or reverse engineer them, or use them for another business. After you leave, your only rights in our technology are the licence in Section 6.4.",
          ),
        ),
        titled(
          "Your website licence",
          p(
            "Your onboarding fee buys a permanent licence to use your website, as we deliver it to you under Section 9.1. The licence is for your own business. It does not end when the Service ends, and it cannot be transferred, sold or sublicensed. You may change your website and host it anywhere. You may not resell it, or use it or its code as a template for any other website or business. The site content file we write for your pages is our work, and it is covered by this licence once every fee you owe us is paid. The licence does not cover our automations and infrastructure (Section 9.2).",
          ),
        ),
        titled(
          "Our portfolio",
          p(
            "We may show your business name, logo and pictures of your site in our portfolio and marketing. Email us at any time to opt out, and we will stop any new use.",
          ),
        ),
      ],
    },
    {
      id: "data",
      heading: "DATA AND PRIVACY",
      subsections: [
        titled(
          "What we handle for you",
          p(
            "To provide the Service, we handle your account details, the inquiries visitors send through your site, your callers' numbers and names and the details they give, call recordings and summaries, and your site's visitor statistics.",
          ),
        ),
        titled(
          "Privacy policy and roles",
          p(
            "We publish a privacy policy on your site that describes how the site, its forms and the AI receptionist collect and use information, and we keep it in line with the Service. Tell us if your business uses that information in other ways, so the policy can say so. We handle your visitors' and callers' information for you, only to provide the Service, as your agent under the Florida Information Protection Act (Fla. Stat. § 501.171). How your business uses its customers' information outside the Service is your responsibility.",
          ),
        ),
        titled(
          "Security",
          p(
            "We use reasonable safeguards, including encryption in transit, a separate sign-in for each portal account, access controls on our own systems, kept-up-to-date software, and providers that meet industry security standards.",
          ),
        ),
        titled(
          "If there is a breach",
          p(
            "If we confirm a breach affecting the personal information of your customers, visitors or callers, we will tell you in writing within seventy-two (72) hours, say which sites were affected, and help you with any notice the law requires.",
          ),
        ),
        titled(
          "No sensitive data",
          p(
            "Do not ask us to have the receptionist or your forms collect Social Security numbers, driver's license numbers, bank or card numbers, or medical or health insurance information.",
          ),
        ),
        titled(
          "How long we keep it",
          p(
            "Call summaries and call details stay in your portal while you are a client. Call recordings are held by our voice provider, and you can play them from your portal while you are a client. You can ask us in writing to delete your call data at any time, and we will delete it within thirty (30) days. Your access to recordings ends when the Service ends. Within sixty (60) days after it ends, and once we have sent you your call log (Section 9.3), we delete your call data, including the recordings our voice provider holds.",
          ),
        ),
      ],
    },
    {
      id: "use",
      heading: "ACCEPTABLE USE AND ACCESSIBILITY",
      subsections: [
        titled(
          "Acceptable use",
          p(
            "You will not use the Service for anything unlawful, deceptive, harassing or fraudulent; to send unwanted calls or texts; to collect information you are not allowed to collect; to impersonate anyone; or to change, bypass or interfere with the receptionist's setup or our systems.",
          ),
        ),
        titled(
          "Accessibility",
          p(
            "Our templates follow reasonable accessibility practices, such as meaningful page structure, image descriptions, keyboard navigation and readable color contrast. The Service does not include a full accessibility audit (for example against WCAG 2.1 Level AA) or ongoing accessibility monitoring. We offer accessibility audits and fixes as a separate paid service.",
          ),
        ),
      ],
    },
    {
      id: "exit",
      heading: "WHEN YOU LEAVE",
      intro: [p("When the Service ends, at the end of your last paid monthly term, we start this handover.")],
      subsections: [
        titled(
          "Your website",
          p(
            "Within fourteen (14) days after the Service ends, we send you a zip file, through a private download link that expires, containing:",
          ),
          {
            kind: "bullets",
            items: [
              "your website as a Next.js project that builds and runs as a static website, with your pages, design, styles, fonts and images as they were on your last day;",
              "the site content file, which holds the words and page settings we wrote for your site; and",
              "the PDF described in Section 9.3.",
            ],
          },
          p(
            "The project has no API routes, server code, automation code, or code libraries that connect it to our systems, so everything that depended on them stops: lead delivery from your forms, AI callbacks, the client portal, call routing and our form protection. Every lead form is removed, and your phone number and email address appear in its place as plain links. Section 6.4 sets out what you may do with the website. Hosting and maintaining it is up to you, and we do not support it after the Service ends.",
          ),
        ),
        titled(
          "The automations stay with us",
          p(
            "The AI receptionist and its prompts and configuration, our automations, the call log database, the client portal and its customer tools, the systems that deliver your leads and place callbacks, and our accounts with our providers are our infrastructure. They stay with us, and we switch them off for your business when the Service ends. Your hosting project and code repository on our accounts are deleted.",
          ),
        ),
        titled(
          "Your call log and inquiries",
          p(
            "The PDF lists every call recorded for your site, with its date and time, caller name, caller number, callback number, summary, length, call type, priority and outcome, and every inquiry sent through your website's forms, with its date, name, contact details and message. It does not include call recordings, or notes kept in the portal's customer tools.",
          ),
        ),
        titled(
          "Your phone number",
          p(
            "A number we provisioned for you belongs to us, but if you want to keep it, we will port it to the phone company you choose for a one-time fee of $50 per number. Ask us within thirty (30) days after the Service ends. Your new phone company starts the port, and we release the number to it; we cannot control how long the port takes on their side. Until the number is ported or released, calls to it are forwarded to your own phone line, and the AI receptionist no longer answers them. If you do not ask within thirty (30) days, we release the number and it cannot be recovered. While a dispute about fees or about the end of the Service is open, we may hold the number for up to thirty (30) days. A number you already had, and forwarded to ours, stays yours and is not affected; to stop the forwarding, change it with your phone company.",
          ),
        ),
        titled(
          "Your domain",
          p(
            "We register your domain name after your site goes live, once we have agreed with you what it will be. It is registered in your business's name, in your own Cloudflare account, which we set up with you or for you. We pay its registration and each renewal while you are a client. When the Service ends, we hand it over at no charge: you get full control of the account, we remove our access and payment details, and its renewals are then yours to pay. A newly registered domain cannot move to another registrar for sixty (60) days, so if you want to move it within that time, you can do so once that period ends, and we keep it renewed until then. If you already own a domain, it stays yours; we only point it at your site, and when you leave you point it wherever you like.",
          ),
        ),
        titled(
          "Google Search Console",
          p(
            "If we verified your site in Google Search Console, we stop being a verified owner when the Service ends and send you instructions to verify it yourself.",
          ),
        ),
        titled(
          "If fees are owed",
          p(
            "If you owe us fees when the Service ends, we still send your website project and the PDF, and still hand over your domain. The site content file and the port of your number wait until every fee you owe is paid. Until then, you may add your own content to the project.",
          ),
        ),
      ],
    },
    {
      id: "liability",
      heading: "WARRANTIES AND LIABILITY",
      subsections: [
        clause(
          p(
            "We will provide the Service in a professional and workmanlike manner. We aim for 99.5% monthly uptime for your website, not counting scheduled maintenance and our providers' outages. The client portal and the AI receptionist are provided as available.",
          ),
        ),
        titled(
          "Not a lead-generation service",
          p(
            "We build your website, connect it properly to the internet and to search engines, and capture the calls and inquiries that come from it. We do not generate leads, buy them or send them to you.",
          ),
          caps("WE DO NOT GUARANTEE ANY NUMBER OF LEADS, CALLS, INQUIRIES, CUSTOMERS, VISITORS OR SEARCH RANKINGS."),
        ),
        clause(
          caps(
            'EXCEPT AS STATED IN THESE TERMS, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", AND WE DISCLAIM ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE AI RECEPTIONIST WILL ANSWER EVERY CALL, UNDERSTAND EVERY CALLER, GIVE CORRECT INFORMATION OR CAPTURE EVERY LEAD, OR THAT ANY CALL, CALLBACK, TEXT, EMAIL OR LEAD WILL BE DELIVERED.',
          ),
        ),
        clause(
          caps(
            "WE ARE NOT LIABLE FOR MISSED, DROPPED OR UNANSWERED CALLS; MISSED OR LATE CALLBACKS OR TEXTS; LOST LEADS OR MISSED APPOINTMENTS; INCORRECT OR INCOMPLETE INFORMATION GIVEN OR RECORDED BY THE AI RECEPTIONIST; OR OUTAGES, ERRORS OR CHANGES BY OUR PROVIDERS, BY PHONE CARRIERS, OR BY YOUR OWN PHONE COMPANY.",
          ),
        ),
        clause(
          caps(
            "IN NO EVENT ARE WE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING LOST REVENUE, LOST CUSTOMERS, LOST GOODWILL, LOST DATA OR BUSINESS INTERRUPTION, EVEN IF WE WERE TOLD THEY WERE POSSIBLE.",
          ),
        ),
        clause(
          caps(
            "OUR TOTAL LIABILITY FOR ALL CLAIMS RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF THE FEES YOU PAID US IN THE THREE (3) MONTHS BEFORE THE CLAIM, OR FIVE HUNDRED DOLLARS ($500).",
          ),
        ),
        clause(caps("THESE LIMITS APPLY TO THE FULLEST EXTENT THE LAW ALLOWS.")),
      ],
    },
    {
      id: "indemnity",
      heading: "INDEMNITY",
      intro: [
        p(
          "You will defend, indemnify and hold harmless JDD and its owners, employees and agents against any claim, loss, liability, cost or expense (including reasonable attorneys' fees) arising from: your content; information you give us for the receptionist; your breach of any law, including the Telephone Consumer Protection Act, CAN-SPAM, recording laws, AI disclosure laws and the Florida Information Protection Act; any call recording you make, and your use or sharing of any recording, transcript or summary; any claim that a call the receptionist handled was recorded without a required consent, unless it results from our failing to set up the disclosure in Section 4.3; texts your business sends to its customers; accessibility claims arising from content or third-party tools you add to your site; copyright complaints about your content; and your breach of these Terms.",
        ),
        p(
          "We will defend and indemnify you against a third-party claim that our template code infringes their intellectual property, if you tell us about the claim promptly and help us defend it.",
        ),
      ],
      subsections: [],
    },
    {
      id: "breach",
      heading: "SUSPENSION AND ENDING FOR BREACH",
      intro: [
        p(
          "We may suspend or end the Service at once if: a payment is unpaid as described in Section 2.5; you file a chargeback in bad faith; you break Section 8.1; you repeatedly infringe copyright or ignore valid complaints; or you cause the recording disclosure or the callback consent box to be removed or disabled, or mislead us about the recording or AI rules that apply to you, in a way that exposes us to legal risk. Either of us may end the Service for any other material breach the other has not fixed within fifteen (15) days of written notice. No fee is refunded when the Service ends for breach.",
        ),
      ],
      subsections: [],
    },
    {
      id: "general",
      heading: "GENERAL",
      subsections: [
        titled("Governing law", p("Florida law governs these Terms, without regard to its conflict of law rules.")),
        titled(
          "Disputes",
          p(
            "We will both try in good faith to resolve any dispute. If it is not resolved within thirty (30) days, it will be decided by binding arbitration in Orange County, Florida, under the rules of the American Arbitration Association.",
          ),
          {
            kind: "callout",
            text: "BY ACCEPTING THESE TERMS, YOU AND WE EACH GIVE UP THE RIGHT TO A TRIAL BY JURY AND THE RIGHT TO TAKE PART IN A CLASS ACTION OR CLASS-WIDE ARBITRATION. DISPUTES WILL BE DECIDED BY A PRIVATE ARBITRATOR, NOT A JUDGE OR JURY, AND NEITHER OF US MAY BRING OR JOIN A CLASS OR REPRESENTATIVE CLAIM AGAINST THE OTHER. YOU HAVE HAD A REASONABLE OPPORTUNITY TO READ THIS SECTION AND, IF YOU WISH, TO ASK A LAWYER ABOUT IT BEFORE ACCEPTING.",
          },
        ),
        titled(
          "Changes to these Terms",
          p(
            "We may update these Terms by giving you at least thirty (30) days' notice by email. An update takes effect at the start of your first monthly term after the notice period ends. If you do not agree to it, you can cancel before then.",
          ),
        ),
        titled(
          "Notices",
          p("We send notices to the email address on your account. Send yours to hello@juneaudigitaldesigns.com."),
        ),
        titled(
          "Entire agreement",
          p(
            "These Terms, your plan summary, and our SMS Terms and Privacy Policy where they apply, are the whole agreement between us about the Service.",
          ),
        ),
        titled(
          "Assignment",
          p("You may not transfer these Terms without our written consent. We may transfer them to a business that takes over ours."),
        ),
        titled(
          "Other terms",
          p(
            "If any part of these Terms cannot be enforced, the rest still applies, and the arbitration and class waiver in Section 13.2 are enforced as far as the law allows. Neither of us is liable for a failure caused by something outside our reasonable control, such as a natural disaster, an internet or provider outage, government action or a pandemic.",
          ),
        ),
        titled(
          "What continues after the Service ends",
          p("Sections 2 (for fees owed), 6, 7, 9, 10, 11 and 13 continue after the Service ends."),
        ),
      ],
    },
  ];
}
