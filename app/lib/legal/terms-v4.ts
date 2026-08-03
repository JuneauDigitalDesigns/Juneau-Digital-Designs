import { ref, type PlanSchedule, type SectionDef } from "./types";

export const TERMS_VERSION = "v4.0";

export const PROVIDER = {
  legalName: "Juneau Digital Designs LLC",
  addressLine: "120 Windtree Ln",
  cityStateZip: "Winter Garden, FL 34787",
  signerName: "Xander Juneau",
  signerTitle: "Founder",
} as const;

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * The shared body of the Service Agreement. Sections that do not apply
 * to a plan are tagged with `plans` and filtered out before numbering; plan
 * facts (prices, allowances, notice periods) interpolate from the schedule so
 * no number is written twice.
 */
export function buildSections(s: PlanSchedule): SectionDef[] {
  const notice = `${s.cancellationNoticeDays} days`;

  return [
    /* ────────────────────────────────────────── 1 */
    {
      id: "services",
      heading: "SERVICES",
      intro: [
        {
          kind: "para",
          text: `This Agreement governs the ${s.name} plan, billed at ${money(s.monthlyPrice)} per month. Provider will deliver the services described in this Agreement and detailed in Schedule A. The ${s.name} plan covers ${s.siteLabel}.`,
        },
        { kind: "para", text: `The ${s.name} plan includes:` },
        { kind: "bullets", items: s.included },
        {
          kind: "para",
          text: "The specific deliverables, allowances, and fees are defined in Schedule A. Where this section and Schedule A differ, Schedule A controls.",
        },
      ],
      subsections: [],
    },

    /* ────────────────────────────────────────── 2 */
    {
      id: "onboarding",
      heading: "ONBOARDING AND DELIVERY",
      subsections: [
        {
          heading: "Onboarding",
          blocks: [
            {
              kind: "para",
              text: s.slug === "enterprise"
                ? "Client agrees to complete Provider's onboarding intake form for each site within five (5) business days of executing this Agreement. The intake forms collect the brand, content, business information, and voice-agent configuration data required for each site."
                : "Client agrees to complete Provider's onboarding intake form within five (5) business days of executing this Agreement. The intake form collects the brand, content, and business information required to build the site" +
                  (s.hasVoiceAgent ? " and configure the voice agent." : "."),
            },
          ],
        },
        {
          heading: "Delivery Targets",
          blocks: [
            {
              kind: "para",
              text: "Provider aims to deliver a preview site URL within seventy-two (72) hours of receiving a complete onboarding submission, and to deliver the fully deployed website within one (1) week of receiving a complete onboarding submission.",
            },
            {
              kind: "para",
              text: "These timeframes are good-faith targets, not guarantees, and no remedy, credit, or refund attaches to a missed target. Both timeframes run from receipt of a complete submission; incomplete or delayed intake extends them accordingly.",
            },
          ],
        },
        {
          heading: "Voice Agent Setup",
          plans: ["growth", "enterprise"],
          blocks: [
            {
              kind: "para",
              text: "Provider will configure and test each AI voice agent following Client's approval of the corresponding preview site. Client agrees to participate in at least one test call per voice agent before it goes live.",
            },
          ],
        },
        {
          heading: "Domain Connection",
          blocks: [
            {
              kind: "para",
              text: "Once Client provides written approval of the preview and the necessary DNS access or credentials, Provider will connect the custom domain promptly. Provider does not commit to fixed launch dates; a site is deployed once Client has approved it and provided the required domain access.",
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 3 */
    {
      id: "fees",
      heading: "FEES AND BILLING",
      subsections: [
        {
          heading: "Monthly Subscription",
          blocks: [
            {
              kind: "para",
              text: `Client agrees to pay the monthly fee of ${money(s.monthlyPrice)} for the ${s.name} plan, billed in advance on the first calendar day of each service month. The first month's fee is prorated from the date the site is deployed to its domain.`,
            },
            ...(s.onboardingFee > 0
              ? [
                  {
                    kind: "para" as const,
                    text: `A one-time onboarding fee of ${money(s.onboardingFee)} applies to the ${s.name} plan and is charged at signing. The onboarding fee is non-refundable once onboarding has begun.`,
                  },
                ]
              : []),
            {
              kind: "para",
              text: "Monthly fees are due for each service month regardless of how much Client engages with the Services, including months in which Client provides no content, requests no edits, or does not respond to Provider's requests.",
            },
          ],
        },
        {
          heading: "Payment Method",
          blocks: [
            {
              kind: "para",
              text: "Client authorizes recurring automatic billing via the payment method on file (credit card, ACH, or other method offered). Failed payments will be retried within seventy-two (72) hours. Service may be suspended after seven (7) days of an unpaid invoice.",
            },
          ],
        },
        {
          heading: "Price Changes",
          blocks: [
            {
              kind: "para",
              text: "Provider will provide at least thirty (30) days written notice of any price increase. Client may cancel within that notice period without penalty if Client does not accept the new rate.",
            },
          ],
        },
        {
          heading: "Late Fees",
          blocks: [
            {
              kind: "para",
              text: "Invoices unpaid for more than fifteen (15) days are subject to a $25 late fee.",
            },
          ],
        },
        {
          heading: "No Refunds for Partial Months",
          blocks: [
            {
              kind: "para",
              text: `Monthly fees are non-refundable for partial months. Cancellation takes effect at the end of the current paid month, subject to the notice period in Section ${ref("term")}.`,
            },
          ],
        },
        {
          heading: "Payment Disputes and Chargebacks",
          blocks: [
            {
              kind: "para",
              text: "Client agrees to contact Provider in writing to dispute any charge before initiating a chargeback with their card issuer or bank. If Client initiates a chargeback without first attempting to resolve the dispute with Provider directly:",
            },
            {
              kind: "bullets",
              items: [
                "Provider may immediately suspend all Services until the chargeback is resolved",
                "Client agrees to reimburse Provider for any chargeback fees assessed by Provider's payment processor (typically $15 to $25 per chargeback)",
                `Wrongfully initiated or fraudulent chargebacks are a material breach of this Agreement and may result in immediate termination under Section ${ref("term")}`,
                "Provider reserves the right to refer unresolved chargeback disputes to collections",
              ],
            },
            {
              kind: "para",
              text: "This Section does not waive Client's rights under applicable consumer protection law where such rights cannot be contractually waived.",
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 4 */
    {
      id: "scope",
      heading: "SCOPE OF SERVICES",
      subsections: [
        {
          heading: 'Definition of "Site"',
          blocks: [
            {
              kind: "para",
              text: 'For purposes of this Agreement, a "site" is a single-page website at a single domain. The standard build delivered under every plan is a one-page site.',
            },
            {
              kind: "para",
              text: "Additional pages are not included in any plan and are quoted separately as paid add-on work. Seasonal landing pages, marketing microsites, and sub-pages do not count as separate sites and are not included in the base build.",
            },
            ...(s.slug === "enterprise"
              ? [
                  {
                    kind: "para" as const,
                    text: "Sites under this Agreement may be multiple locations of the same business, multiple separate businesses owned by Client, or multiple brands of a single parent business owned by Client. Each site occupies its own domain.",
                  },
                ]
              : []),
          ],
        },
        {
          heading: "Content Edits",
          blocks: [
            {
              kind: "para",
              text: `The ${s.name} plan includes ${s.editAllowance}. An edit request is limited to changes to the copy on the site or to the colors already in use on the site.`,
            },
            {
              kind: "para",
              text: "Changes to layout, structure, design, or the addition of new sections or pages are outside the included edit allowance. Provider will quote such work separately, and Client's written approval of the quote is required before Provider performs it.",
            },
            {
              kind: "para",
              text: "Unused edits do not roll over from one month to the next. Provider will notify Client before performing or billing any work that falls outside the included allowance.",
            },
          ],
        },
        ...(s.includesSeo
          ? [
              {
                heading: "Technical SEO",
                blocks: [
                  {
                    kind: "para" as const,
                    text: "Provider will perform ongoing technical on-page search engine optimization, limited to: meta titles and descriptions, structured data markup, sitemap and robots configuration, crawlability and indexability, canonical tags, and page performance tuning.",
                  },
                  {
                    kind: "para" as const,
                    text: "Technical SEO under this Agreement expressly excludes content marketing, blog or article writing, keyword research engagements, link building, local citation management, paid search, and paid social advertising.",
                  },
                  {
                    kind: "allcaps" as const,
                    text: "PROVIDER MAKES NO WARRANTY, REPRESENTATION, OR GUARANTEE AS TO ANY SEARCH ENGINE RANKING, SEARCH RESULT PLACEMENT, IMPRESSION VOLUME, TRAFFIC VOLUME, OR LEAD VOLUME. SEARCH ENGINE ALGORITHMS ARE CONTROLLED BY THIRD PARTIES AND CHANGE WITHOUT NOTICE.",
                  },
                ],
              },
            ]
          : []),
        {
          heading: "Not Included",
          blocks: [
            {
              kind: "para",
              text: `The following are outside the scope of the ${s.name} plan:`,
            },
            {
              kind: "bullets",
              items: [
                "Additional pages beyond the one-page site",
                "Layout, structural, or design changes (quoted separately)",
                "Custom design beyond the initial template configuration",
                "E-commerce functionality, payment processing, or shopping carts",
                ...(s.includesSeo
                  ? ["Content marketing, link building, paid ads, or social media management"]
                  : ["Search engine optimization of any kind", "Content marketing, paid ads, or social media management"]),
                "Email marketing platforms or campaign creation",
                "CRM integration beyond Provider's standard automation",
                ...(s.hasVoiceAgent
                  ? ["Custom voice agent flows beyond standard qualification logic"]
                  : ["Any AI voice agent, dedicated phone number, or call handling of any kind"]),
                ...(s.slug === "enterprise"
                  ? ["Coverage for more than three (3) websites under a single Enterprise subscription"]
                  : []),
                `Website accessibility (ADA/WCAG) remediation as part of the base service (see Section ${ref("accessibility")})`,
              ],
            },
            ...(s.hasVoiceAgent
              ? []
              : [
                  {
                    kind: "para" as const,
                    text: `The ${s.name} plan is a website-only plan. It does not include an AI voice agent, a dedicated business phone number, call recording, call transcription, or any call handling. Lead capture on the ${s.name} plan is by website form submission delivered to Client by email. Client may upgrade to a plan that includes a voice agent under Section ${ref("planchanges")}.`,
                  },
                ]),
          ],
        },
        {
          heading: "Support",
          blocks: [
            {
              kind: "para",
              text: `Provider targets a response to Client support requests within ${s.supportResponse} during Provider's normal business hours.${s.slug === "enterprise" ? " Enterprise requests receive priority placement in Provider's support queue." : ""} Response time means Provider's initial reply, not resolution.`,
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 5 */
    {
      id: "callvolume",
      heading: "CALL VOLUME AND OVERAGES",
      plans: ["growth", "enterprise"],
      subsections: [
        {
          heading: "Monthly Allotment",
          blocks: [
            {
              kind: "para",
              text: s.slug === "enterprise"
                ? `The ${s.name} plan includes up to ${s.callMinutes?.toLocaleString("en-US")} call-minutes per month, pooled across all sites under this Agreement. The pool covers both inbound calls answered by any AI voice agent and outbound callbacks placed by any AI voice agent.`
                : `The ${s.name} plan includes up to ${s.callMinutes?.toLocaleString("en-US")} call-minutes per month. The allotment covers both inbound calls answered by the AI voice agent and outbound callbacks placed by the AI voice agent.`,
            },
            {
              kind: "para",
              text: "Unused call-minutes do not roll over from one month to the next.",
            },
          ],
        },
        {
          heading: "Overage Billing",
          blocks: [
            {
              kind: "para",
              text: `Call-minutes exceeding the monthly allotment are billed at $0.20 per minute on the next monthly invoice. Provider may, as a courtesy, notify Client when usage reaches approximately 80% of the monthly allotment, but is under no contractual obligation to do so.`,
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 6 */
    {
      id: "sitelist",
      heading: "SITE LIST AND SITE CHANGES",
      plans: ["enterprise"],
      subsections: [
        {
          heading: "Site List",
          blocks: [
            {
              kind: "para",
              text: "The websites covered under this Agreement are listed in Schedule A. Client must identify its sites at the time of signing. A site not identified at signing may be added later, subject to the swap terms below.",
            },
          ],
        },
        {
          heading: "Site Swaps",
          blocks: [
            {
              kind: "para",
              text: "Client may request to swap one of the listed sites for a different site during the term, subject to the following:",
            },
            {
              kind: "bullets",
              items: [
                "Client must provide thirty (30) days written notice of the swap",
                "A site swap fee of $200 per swap applies, due upon Provider's acceptance of the swap request",
                "The fee covers decommissioning the outgoing site and provisioning the incoming site, including repository, hosting project, phone number, voice agent, and call log base",
                `The outgoing site's phone number will be released or, at Client's option, ported under Section ${ref("phone")}`,
                "Schedule A will be amended in writing to reflect the new site list",
                "No more than two (2) site swaps per twelve-month period are permitted",
              ],
            },
          ],
        },
        {
          heading: "Adding a Fourth Site",
          blocks: [
            {
              kind: "para",
              text: "This Agreement covers up to three (3) sites. Adding a fourth or additional sites requires a separate agreement at Provider's then-current pricing. Provider is not obligated to offer additional-site pricing on any specific terms.",
            },
          ],
        },
        {
          heading: "Removing a Site Without Replacement",
          blocks: [
            {
              kind: "para",
              text: "Client may request to permanently remove a site without replacement. Provider will decommission the site and its associated infrastructure on thirty (30) days' notice, but the monthly fee remains unchanged. The Enterprise fee is structured as a flat bundle, not a per-site fee.",
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 7 */
    {
      id: "subcontractors",
      heading: "THIRD-PARTY SUBCONTRACTORS AND INFRASTRUCTURE",
      subsections: [
        {
          heading: "Disclosure of Third-Party Providers",
          blocks: [
            {
              kind: "para",
              text: 'Client acknowledges that Provider relies on the following third-party service providers ("Subcontractors") to deliver the Services:',
            },
            {
              kind: "bullets",
              items: [
                "Vercel - website hosting, deployment, SSL, and uptime infrastructure",
                "Vercel Blob - storage of executed agreement documents",
                "GitHub - source code repository",
                "Cloudflare - domain registration and DNS management, or an equivalent provider where Client uses Provider-managed domain services",
                "Clerk - authentication for the client portal",
                "Upstash - hosted data store for portal account records, lead records, and cached site-health data",
                "Google Analytics 4 - website traffic analytics",
                "Make.com - workflow automation",
                "Airtable - call log storage and operational records",
                "Resend - transactional and notification email delivery",
                "Stripe - payment processing, or an equivalent processor",
                ...(s.hasVoiceAgent
                  ? [
                      "Twilio - telephony, phone number provisioning, and SIP routing",
                      "Retell AI - voice AI agent, call transcription, and call summary generation",
                      "OpenAI and Anthropic - the underlying large language models powering the voice agents",
                    ]
                  : []),
              ],
            },
          ],
        },
        {
          heading: "Right to Use Subcontractors",
          blocks: [
            {
              kind: "para",
              text: 'Client grants Provider the right to engage these and other reasonable Subcontractors and Infrastructure-as-a-Service ("IaaS") providers to deliver the Services. Provider may substitute equivalent providers in its sole discretion without notice to Client, provided substitute providers meet comparable industry standards for security and reliability.',
            },
          ],
        },
        {
          heading: "No Liability for Subcontractor Acts",
          blocks: [
            {
              kind: "para",
              text: `Provider remains responsible for the overall delivery of the Services, but is not liable for individual outages, errors, data breaches at the Subcontractor level (subject to Section ${ref("privacy")}), or service changes by any Subcontractor. Provider will use commercially reasonable efforts to mitigate Subcontractor disruptions.`,
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 8 */
    {
      id: "accessibility",
      heading: "WEBSITE ACCESSIBILITY (ADA / WCAG)",
      subsections: [
        {
          heading: "ADA Title III Acknowledgment",
          blocks: [
            {
              kind: "para",
              text: 'The Americans with Disabilities Act ("ADA") Title III may apply to businesses that operate as "places of public accommodation," and federal courts have consistently interpreted that obligation to extend to business websites. The U.S. Department of Justice and federal courts commonly reference the Web Content Accessibility Guidelines ("WCAG") version 2.1 Level AA as the technical benchmark for website accessibility, though no statutory technical standard currently exists for private-sector websites under Title III.',
            },
          ],
        },
        {
          heading: "Base Service Does Not Include Full Accessibility Compliance",
          blocks: [
            {
              kind: "para",
              text: "Provider's websites are built on Provider's standard template, which incorporates reasonable accessibility practices including semantic HTML, alt text fields, keyboard navigation support, and sufficient color contrast at the template level. However, the base service does NOT include:",
            },
            {
              kind: "bullets",
              items: [
                "A full WCAG 2.1 Level AA accessibility audit",
                "Manual accessibility testing or remediation",
                "Ongoing accessibility monitoring",
                "Accessibility statements or VPATs (Voluntary Product Accessibility Templates)",
                "Defense against accessibility-related demand letters or lawsuits",
              ],
            },
          ],
        },
        {
          heading: "Client Responsibility",
          blocks: [
            {
              kind: "para",
              text: "Client is solely responsible for ensuring each deployed website meets any accessibility obligations applicable to Client's business under the ADA, Section 504 of the Rehabilitation Act, or any state law. This includes responsibility for:",
            },
            {
              kind: "bullets",
              items: [
                "Accessibility of any content Client provides (images, video, documents)",
                "Accessibility of any third-party widgets, integrations, or plugins added at Client's request",
                "Periodic accessibility audits and remediation",
                "Responding to accessibility complaints or demand letters",
              ],
            },
          ],
        },
        {
          heading: "Optional Accessibility Add-On",
          blocks: [
            {
              kind: "para",
              text: "Provider offers WCAG 2.1 Level AA accessibility audits and remediation services as separate paid engagements. Pricing available on request.",
            },
          ],
        },
        {
          heading: "Indemnification for Accessibility Claims",
          blocks: [
            {
              kind: "para",
              text: "Client agrees to indemnify Provider against any claims, demand letters, lawsuits, or settlements arising from alleged website accessibility violations on any site covered under this Agreement, including but not limited to ADA Title III claims, except to the extent such claims arise directly from defects in Provider's standard template code that were not caused or exacerbated by Client-provided content or third-party additions.",
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 9 */
    {
      id: "privacy",
      heading: "DATA PRIVACY AND SECURITY",
      subsections: [
        {
          heading: "Florida Information Protection Act (FIPA)",
          blocks: [
            {
              kind: "para",
              text: 'Provider acknowledges that Florida Statute Section 501.171 (the Florida Information Protection Act, "FIPA") imposes obligations on businesses that acquire, use, store, or maintain personal information of Florida residents. Provider operates as a third-party agent on behalf of Client for the limited purpose of delivering the Services described in this Agreement.',
            },
          ],
        },
        {
          heading: "Data Provider Handles",
          blocks: [
            {
              kind: "para",
              text: "In delivering the Services, Provider may handle the following types of data on Client's behalf:",
            },
            {
              kind: "bullets",
              items: [
                "Business contact information provided by Client during intake",
                "The client portal account record, including the authorized user identities associated with Client's account and the mapping of those users to Client's sites",
                "Aggregated website traffic data",
                "Form submissions made by visitors to the site, routed to Client through Provider's automation",
                ...(s.hasVoiceAgent
                  ? [
                      "Caller telephone numbers captured by any AI voice agent",
                      "Caller-provided information (names, callback numbers, email addresses, service inquiries) collected during AI voice agent interactions",
                      "Call recordings, transcripts, and call summaries generated in connection with any AI voice agent",
                    ]
                  : []),
              ],
            },
            {
              kind: "para",
              text: "Provider does not intentionally collect or store sensitive personal information as defined under FIPA Section 501.171(1)(g), including Social Security numbers, driver's license numbers, financial account numbers, medical information, or health insurance information. Client agrees not to instruct Provider to solicit or store such sensitive information without a separate written data processing agreement.",
            },
          ],
        },
        {
          heading: "Reasonable Security Measures",
          blocks: [
            {
              kind: "para",
              text: "Provider will implement reasonable administrative, technical, and physical safeguards to protect Client data and end-user data handled in connection with the Services. These measures include:",
            },
            {
              kind: "bullets",
              items: [
                "Encryption in transit (HTTPS/TLS) for all website and portal traffic",
                ...(s.hasVoiceAgent ? ["Encryption in transit for voice and call data via SIP/TLS"] : []),
                "Authenticated, per-account access control on the client portal",
                "Access controls and authentication for Provider's internal systems",
                "Regular software updates for hosted dependencies",
                "Reliance on Subcontractors that maintain industry-standard security certifications",
              ],
            },
          ],
        },
        {
          heading: "Data Breach Notification",
          blocks: [
            {
              kind: "para",
              text: "If Provider becomes aware of a confirmed data breach affecting personal information of Client's customers, website visitors, or callers, Provider will:",
            },
            {
              kind: "bullets",
              items: [
                "Notify Client in writing within seventy-two (72) hours of confirming the breach",
                "Identify which site or sites were affected",
                "Cooperate with Client in any required notification to affected individuals or to the Florida Department of Legal Affairs as required under FIPA Section 501.171(3) and (4)",
                "Provide reasonable assistance in identifying the scope and nature of the breach",
              ],
            },
            {
              kind: "para",
              text: "Client retains primary responsibility for FIPA breach notification to its own customers, as Client is the data controller in the relationship between Client and Client's end users.",
            },
          ],
        },
        {
          heading: "Client Privacy Policy Responsibility",
          blocks: [
            {
              kind: "para",
              text: "Client is responsible for publishing a privacy policy on each deployed website that accurately describes Client's data collection and handling practices, including any data collected via Provider-built forms" +
                (s.hasVoiceAgent ? " or AI voice agents." : ".") +
                " Provider can include a template privacy policy on a deployed site upon request, but Client is responsible for reviewing and adopting it.",
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 10 */
    {
      id: "agents",
      heading: "AI VOICE AGENTS",
      plans: ["growth", "enterprise"],
      subsections: [
        {
          heading: "Nature of the Service",
          blocks: [
            {
              kind: "para",
              text: "Each AI voice agent provided under this Agreement is an automated conversational system powered by large language models. Each agent is designed to greet callers, answer questions using information Client provides during onboarding, qualify leads, and collect contact information. The AI voice agents are not human receptionists and do not have judgment, discretion, or real-time access to Client's calendar, pricing, or operations unless explicitly configured.",
            },
          ],
        },
        {
          heading: "Information Accuracy",
          blocks: [
            {
              kind: "para",
              text: "Each AI voice agent answers caller questions using only information Client provides during onboarding, and any subsequent updates Client provides. Provider will not configure any agent to answer questions outside Client-provided information. Client is solely responsible for the accuracy, completeness, and currency of information provided to Provider for use by each AI agent.",
            },
          ],
        },
        {
          heading: "No Price Quotes or Commitments",
          blocks: [
            {
              kind: "para",
              text: "Each AI voice agent is configured never to quote prices or make commitments on Client's behalf. Each agent will defer all pricing, scheduling commitments, and contractual discussions to Client.",
            },
          ],
        },
        {
          heading: "No Replacement for Licensed Professional Advice",
          blocks: [
            {
              kind: "para",
              text: "The AI voice agents do not provide legal, medical, financial, or other professional advice. For businesses in regulated industries, Client is responsible for ensuring each agent's configuration complies with applicable professional conduct rules.",
            },
          ],
        },
        {
          heading: "Hallucination Risk",
          blocks: [
            {
              kind: "para",
              text: '"Hallucination" in the context of AI systems means the model may confidently provide false, inaccurate, or invented information that was not part of the configuration provided. While Provider takes reasonable measures to limit hallucination — including restricting each agent to Client-provided information and configuring agents to defer to Client when uncertain — AI systems may occasionally produce inaccurate or unexpected outputs. Client acknowledges this risk. Provider\'s responsibility is limited to using commercially reasonable efforts to monitor and correct identified issues.',
            },
          ],
        },
        {
          heading: "Call Recording and Two-Party Consent Disclosure",
          blocks: [
            {
              kind: "para",
              text: "Calls handled by an AI voice agent are recorded and transcribed by Provider's telephony and AI subcontractors for service delivery, quality assurance, and generation of Client's call log.",
            },
            {
              kind: "para",
              text: "Recording consent laws vary by state. The United States operates under two general frameworks:",
            },
            {
              kind: "bullets",
              items: [
                "One-party consent: only one party to the call must consent to recording. Florida operates under one-party consent for telephone communications under Fla. Stat. Section 934.03. In one-party jurisdictions, the AI agent, operating on Client's behalf, serves as the consenting party.",
                "Two-party (all-party) consent: all parties to the call must consent. States including but not limited to California, Illinois, Maryland, Massachusetts, Michigan, Montana, New Hampshire, Pennsylvania, and Washington require all-party consent.",
              ],
            },
            {
              kind: "para",
              text: "If Client operates in or serves customers in two-party consent jurisdictions, Client must inform Provider during onboarding so that the AI voice agent's greeting can be configured to include appropriate recording disclosure language. Provider relies on Client's representations about jurisdictional requirements and assumes no independent obligation to monitor changes in recording-consent law.",
            },
          ],
        },
        {
          heading: "AI Caller Disclosure",
          blocks: [
            {
              kind: "para",
              text: "Some jurisdictions require businesses to disclose to callers that they are speaking with an AI rather than a human. Client is responsible for informing Provider during onboarding whether such disclosure is required in the jurisdictions where Client's business and customers are located. Upon written request, Provider will configure the AI voice agent's greeting to include appropriate disclosure language.",
            },
          ],
        },
        {
          heading: "Call Data Retention",
          blocks: [
            {
              kind: "para",
              text: `Call summaries and call metadata — the date and time of the call, the caller's name where provided, the caller's telephone number, a written summary of the call, call duration, call type, and outcome — are retained by Provider and are viewable by Client in the client portal for the life of Client's account. Provider deletes this data following termination in accordance with Section ${ref("term")}.`,
            },
            {
              kind: "para",
              text: "Full call audio recordings and verbatim transcripts are generated and held by Provider's telephony and AI subcontractors under those subcontractors' own retention policies, which Provider does not control and which are subject to change by those providers. Full recordings and verbatim transcripts are not surfaced in the client portal.",
            },
            {
              kind: "para",
              text: "Client may request deletion of its call data in writing at any time, and Provider will delete the data within Provider's own systems within thirty (30) days of the request. Industry-regulated retention obligations, such as those under HIPAA or financial services regulation, are Client's responsibility to specify in advance under a separate written agreement.",
            },
          ],
        },
        {
          heading: "Client Authorization",
          blocks: [
            {
              kind: "para",
              text: "Client represents that it has all necessary rights and authorizations to deploy the AI voice agents for each business covered under this Agreement and to record calls under applicable law in the jurisdictions where Client and Client's customers are located.",
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 11 */
    {
      id: "phone",
      heading: "PHONE NUMBER OWNERSHIP",
      plans: ["growth", "enterprise"],
      subsections: [
        {
          heading: "Provider Ownership",
          blocks: [
            {
              kind: "para",
              text: "All dedicated business phone numbers provided under this Agreement are owned by Provider's master telephony account. Client receives exclusive use of the numbers for the duration of the Agreement.",
            },
          ],
        },
        {
          heading: "Display of the Numbers",
          blocks: [
            {
              kind: "para",
              text: "Client may display each assigned number on the corresponding website, business cards, vehicles, marketing materials, and Google Business Profile. Each number functions identically to any local business phone number.",
            },
          ],
        },
        {
          heading: "Termination and Number Disposition",
          blocks: [
            {
              kind: "para",
              text: "Upon termination of this Agreement, Client may choose one of the following options for each assigned phone number independently:",
            },
            {
              kind: "bullets",
              items: [
                "Option A - Release: Provider releases the number back to the public pool. Client has no further claim to the number. This is the default option if Client makes no selection within fourteen (14) days of termination.",
                "Option B - Port to Client: Client may port the number to a carrier of their choice. Client is responsible for the porting process at the receiving carrier. Provider charges a one-time administrative fee of $50 per number to facilitate the port-out. Port-out requests must be initiated within thirty (30) days of termination, after which Option A applies.",
              ],
            },
          ],
        },
        {
          heading: "Number Hold During Dispute",
          blocks: [
            {
              kind: "para",
              text: "If termination is contested, Provider may hold the numbers for up to thirty (30) days while disputes are resolved.",
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 12 */
    {
      id: "portal",
      heading: "CLIENT PORTAL",
      subsections: [
        {
          heading: "Portal Access",
          blocks: [
            {
              kind: "para",
              text: "Provider provides Client with authenticated access to a web-based client portal for the duration of this Agreement. The portal is Client's continuous, self-service view into the Services.",
            },
            {
              kind: "para",
              text: "The portal displays website health and site status information" +
                (s.hasVoiceAgent
                  ? ", together with Client's call log showing call summaries and call metadata as described in this Agreement."
                  : ".") +
                (s.slug === "enterprise"
                  ? " Enterprise portal access presents a consolidated view across all sites covered under this Agreement." : ""),
            },
          ],
        },
        {
          heading: "Portal Replaces Periodic Reports",
          blocks: [
            {
              kind: "para",
              text: "Performance and activity information is delivered through the portal, which Client may access at any time. Provider does not commit to producing or delivering periodic written performance reports on any schedule, and no plan includes weekly, monthly, or other recurring reports as a deliverable. Continuous portal availability is the reporting mechanism under this Agreement.",
            },
          ],
        },
        {
          heading: "Portal Credentials",
          blocks: [
            {
              kind: "para",
              text: "Client is responsible for the security of its portal credentials and for all activity occurring under its account. Client agrees not to share portal logins with any person outside Client's organization and to notify Provider promptly of any suspected unauthorized access.",
            },
          ],
        },
        {
          heading: "No Portal Warranty",
          blocks: [
            {
              kind: "para",
              text: 'The client portal is provided on an "as-available" basis. The uptime target in this Agreement applies to Client\'s deployed website, not to the portal. Provider does not warrant uninterrupted portal availability, and portal unavailability is not a breach of this Agreement.',
            },
          ],
        },
        {
          heading: "Portal Access Ends at Termination",
          blocks: [
            {
              kind: "para",
              text: `Client's portal access is deactivated upon termination of this Agreement. Client is responsible for exporting any data it wishes to retain before the effective date of termination, or for requesting the exit data package described in Section ${ref("ip")} within the window stated there. Provider is under no obligation to restore portal access after termination.`,
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 13 */
    {
      id: "copyright",
      heading: "COPYRIGHT AND DMCA",
      subsections: [
        {
          heading: "Client Content Ownership and Authorization",
          blocks: [
            {
              kind: "para",
              text: "Client represents and warrants that Client owns or has full authorization to use all content (text, images, video, logos, testimonials, and other materials) provided to Provider for use on any deployed website under this Agreement. Client is solely responsible for any copyright infringement, defamation, false advertising, or trademark violation arising from Client-provided content.",
            },
          ],
        },
        {
          heading: "DMCA Takedown Notices",
          blocks: [
            {
              kind: "para",
              text: 'If Provider receives a notification of claimed copyright infringement under the Digital Millennium Copyright Act ("DMCA," 17 U.S.C. Section 512) concerning content on any of Client\'s deployed websites, Provider may:',
            },
            {
              kind: "bullets",
              items: [
                "Forward the notice to Client within three (3) business days",
                "Temporarily remove or disable access to the allegedly infringing content pending resolution",
                "Require Client to either provide a valid DMCA counter-notice or confirm the content will be permanently removed",
              ],
            },
            {
              kind: "para",
              text: "Client agrees to indemnify Provider for any costs, damages, or fees arising from copyright claims related to Client-provided content, including reasonable attorneys' fees incurred in responding to DMCA notices or counter-notices.",
            },
          ],
        },
        {
          heading: "Repeat Infringer Policy",
          blocks: [
            {
              kind: "para",
              text: `Provider reserves the right to terminate this Agreement under Section ${ref("term")} if Client is identified as a repeat copyright infringer or fails to respond appropriately to valid DMCA notices.`,
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 14 */
    {
      id: "ip",
      heading: "INTELLECTUAL PROPERTY",
      subsections: [
        {
          heading: "Client Content",
          blocks: [
            {
              kind: "para",
              text: "Client retains full ownership of all content Client provides: business names, logos, photographs, copy submitted via the onboarding forms, testimonials, and any subsequent content updates. Client grants Provider a non-exclusive license to use this content solely to deliver the Services.",
            },
          ],
        },
        {
          heading: "Site Code and License Scope",
          blocks: [
            {
              kind: "para",
              text: 'Each website is built on Provider\'s proprietary Next.js template ("Template Code"). Provider retains all rights, title, and interest in the Template Code, including all derivative works created in the course of customizing the Template Code for Client.',
            },
            {
              kind: "para",
              text: "Client is purchasing a subscription to use the deployed website" +
                (s.hasVoiceAgent ? " and voice agent" : "") +
                ", not ownership of the software that runs them. During the term of this Agreement, Client receives a limited, non-exclusive, non-transferable, non-sublicensable license to:",
            },
            {
              kind: "bullets",
              items: [
                "Display each deployed website at the specific domain identified in Schedule A",
                `Use each deployed website${s.hasVoiceAgent ? " and voice agent" : ""} for Client's own business operations only`,
              ],
            },
            { kind: "para", text: "Client's license expressly does not include the right to:" },
            {
              kind: "bullets",
              items: [
                "Copy, redistribute, sublicense, or sell the Template Code or any derivative work",
                "Deploy any website, in original or modified form, at any domain other than the one specified in Schedule A for that site",
                "Use any export or copy of a site to launch additional sites for Client's other businesses or for any third party",
                "Extract or reuse the Template Code's source files independent of the deployed site",
                `Reverse engineer, decompile, or attempt to recreate the Template Code${s.hasVoiceAgent ? " or any voice agent configuration" : ""}`,
              ],
            },
            {
              kind: "para",
              text: "This license terminates automatically upon termination of this Agreement.",
            },
          ],
        },
        {
          heading: "Provider Tools",
          blocks: [
            {
              kind: "para",
              text: "Provider's intake schema, orchestration scripts, agent prompts, voice agent configurations, and operational tooling are Provider's intellectual property and are not transferred to Client under any circumstance.",
            },
          ],
        },
        {
          heading: "Publicity Rights",
          blocks: [
            {
              kind: "para",
              text: "Provider may include Client's business name, logo, and non-confidential summaries of the engagement (such as project type, industry, and screenshots of the deployed site) in Provider's marketing materials, portfolio, and case studies. Client may opt out of this provision by providing written notice to Provider at any time. Opt-out does not require Provider to remove materials already published, but Provider will cease new uses upon receipt of the opt-out notice.",
            },
          ],
        },
        {
          heading: "Exit Data Package",
          blocks: [
            {
              kind: "para",
              text: "Upon termination and upon Client's written request within thirty (30) days, Provider will deliver, for each site under this Agreement:",
            },
            {
              kind: "bullets",
              items: [
                "A static HTML/CSS export of the deployed site at the time of termination, suitable for hosting on any third-party static host",
                ...(s.hasVoiceAgent ? ["An export of that site's call log in CSV format"] : []),
                "A copy of that site's content data in JSON format",
              ],
            },
            {
              kind: "para",
              text: "Each static export is provided for Client's own use at a single replacement domain for that specific site. Static exports do not include any Template Code, build tooling, or source files" +
                (s.hasVoiceAgent
                  ? ". The voice agents themselves are not transferable; on termination, Client is responsible for arranging any replacement voice answering service independently."
                  : ".") +
                " Client is responsible for finding new hosting and rebuilding any dynamic functionality.",
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 15 */
    {
      id: "term",
      heading: "TERM AND TERMINATION",
      subsections: [
        {
          heading: "Term",
          blocks: [
            {
              kind: "para",
              text: "This Agreement begins on the Effective Date and continues month-to-month until terminated by either party.",
            },
          ],
        },
        {
          heading: "Termination for Convenience",
          blocks: [
            {
              kind: "para",
              text: `Either party may terminate this Agreement at the end of any monthly billing cycle with ${notice} written notice to the other party.` +
                (s.slug === "enterprise"
                  ? " The longer notice period on the Enterprise plan accounts for the additional operational work of decommissioning multiple sites, phone numbers, voice agents, and integrations."
                  : "") +
                " Notice may be delivered by email to the addresses on file.",
            },
          ],
        },
        {
          heading: "Termination for Breach",
          blocks: [
            {
              kind: "para",
              text: "Either party may terminate immediately if the other party materially breaches this Agreement and fails to cure within fifteen (15) days of written notice. The following are material breaches:",
            },
            {
              kind: "bullets",
              items: [
                "Non-payment of fees",
                `Wrongfully initiated chargebacks (Section ${ref("fees")})`,
                `Repeat copyright infringement (Section ${ref("copyright")})`,
                ...(s.hasVoiceAgent
                  ? [`Material misrepresentation of jurisdictional disclosure or recording consent requirements (Section ${ref("agents")}) resulting in legal exposure to Provider`]
                  : []),
                ...(s.slug === "enterprise"
                  ? [`Exceeding the site swap limit in Section ${ref("sitelist")} in bad faith, such as repeated attempts to cycle through sites to obtain free onboarding`]
                  : []),
                `Use of the Services outside the license granted in Section ${ref("ip")}`,
              ],
            },
          ],
        },
        {
          heading: "Effect of Termination",
          blocks: [
            {
              kind: "para",
              text: "Upon termination:",
            },
            {
              kind: "bullets",
              items: [
                `All monthly fees through the end of the applicable ${notice} notice period remain payable`,
                "Provider will continue the Services through the end of the paid period",
                `Client's portal access is deactivated as described in Section ${ref("portal")}`,
                ...(s.hasVoiceAgent ? [`Phone number disposition follows Section ${ref("phone")}`] : []),
                `Data export follows the exit data package terms in Section ${ref("ip")}`,
                `The license granted in Section ${ref("ip")} terminates and Client must cease displaying the Template Code`,
              ],
            },
            {
              kind: "para",
              text: `Sections ${ref("subcontractors")}, ${ref("accessibility")}, ${ref("privacy")}, ${ref("copyright")}, ${ref("ip")}, ${ref("term")}, ${ref("planchanges")}, ${ref("warranties")}, and ${ref("disputes")} survive termination, including all indemnification obligations that accrued prior to termination.`,
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 16 */
    {
      id: "planchanges",
      heading: "PLAN CHANGES",
      subsections: [
        {
          heading: "Available Plan Changes",
          blocks: [
            {
              kind: "para",
              text: "Provider offers the Starter, Growth, and Enterprise plans. Client may move between plans subject to this Section.",
            },
          ],
        },
        {
          heading: "Change Process",
          blocks: [
            {
              kind: "para",
              text: `If Client wishes to change plans during the term:`,
            },
            {
              kind: "bullets",
              items: [
                `Client will provide ${notice} written notice, consistent with the termination for convenience terms above`,
                "This Agreement terminates at the end of the notice period",
                "Client will sign a new Service Agreement for the selected plan",
                "The new Agreement will amend and restate this Agreement as of the change effective date",
                "Any sites, phone numbers, or voice agents not covered under the new plan will be decommissioned",
              ],
            },
          ],
        },
        {
          heading: "Continuity of Obligations",
          blocks: [
            {
              kind: "para",
              text: "Notwithstanding the amend-and-restate structure above, the following obligations expressly survive and carry forward into any new Agreement:",
            },
            {
              kind: "bullets",
              items: [
                `All indemnification obligations under Sections ${ref("accessibility")}, ${ref("copyright")}, and ${ref("disputes")}`,
                "All unpaid fees, late fees, site swap fees, chargeback reimbursements, and other monetary obligations accrued through the change effective date",
                "All confidentiality obligations",
                `The aggregate liability cap and exclusion of indirect damages under Section ${ref("warranties")}`,
                `The arbitration and class-action waiver provisions under Section ${ref("disputes")}`,
              ],
            },
            {
              kind: "para",
              text: "The new Agreement will explicitly acknowledge the survival of these obligations.",
            },
          ],
        },
        {
          heading: "Fees on a Plan Change",
          blocks: [
            {
              kind: "bullets",
              items: [
                "The $100 onboarding fee applies on any change into the Starter plan, as the Starter plan carries an onboarding fee in all cases",
                "No onboarding fee applies on a change into the Growth or Enterprise plan",
                "Client's billing cycle resets to the new plan's pricing on the first day of the next monthly billing period after the change effective date",
                "Any unused portion of the current month's fee is forfeited and is not credited or refunded toward the new plan",
              ],
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 17 */
    {
      id: "warranties",
      heading: "WARRANTIES, DISCLAIMERS, AND LIABILITY",
      subsections: [
        {
          heading: "Service Warranty",
          blocks: [
            {
              kind: "para",
              text: "Provider warrants that the Services will be performed in a professional and workmanlike manner consistent with industry standards.",
            },
          ],
        },
        {
          heading: "Uptime",
          blocks: [
            {
              kind: "para",
              text: "Provider targets 99.5% monthly uptime for each deployed website. Uptime is measured per site by the hosting provider. Provider does not warrant uninterrupted or error-free service. Scheduled maintenance and third-party outages are excluded from uptime calculations.",
            },
          ],
        },
        ...(s.hasVoiceAgent
          ? [
              {
                heading: "Voice Agent Performance",
                blocks: [
                  {
                    kind: "para" as const,
                    text: 'The AI voice agents are provided on an "as-available" basis. Provider does not warrant that any AI agent will handle every call correctly, capture every lead, or never produce unexpected outputs. Performance depends on caller behavior, audio quality, third-party services, and the accuracy of Client-provided configuration data.',
                  },
                ],
              },
            ]
          : []),
        {
          heading: "Disclaimer",
          blocks: [
            {
              kind: "allcaps",
              text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, EXCEPT AS EXPRESSLY STATED IN THIS AGREEMENT, PROVIDER DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.",
            },
          ],
        },
        {
          heading: "Aggregate Liability Cap",
          blocks: [
            {
              kind: "allcaps",
              text: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PROVIDER'S TOTAL AGGREGATE LIABILITY FOR ANY AND ALL CLAIMS ARISING OUT OF OR RELATED TO THIS AGREEMENT OR THE SERVICES SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES PAID BY CLIENT TO PROVIDER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) FIVE HUNDRED DOLLARS ($500).",
            },
          ],
        },
        {
          heading: "Exclusion of Indirect Damages",
          blocks: [
            {
              kind: "allcaps",
              text: "IN NO EVENT SHALL PROVIDER BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF REVENUE, LOSS OF CUSTOMERS, LOSS OF GOODWILL, LOSS OF DATA, OR BUSINESS INTERRUPTION, EVEN IF PROVIDER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
            },
          ],
        },
        ...(s.hasVoiceAgent
          ? [
              {
                heading: "AI-Specific Liability",
                blocks: [
                  {
                    kind: "allcaps" as const,
                    text: "PROVIDER SHALL HAVE NO LIABILITY WHATSOEVER FOR DAMAGES ARISING FROM INDIVIDUAL AI VOICE AGENT OUTPUTS, INCLUDING BUT NOT LIMITED TO MISSED CALLS, INCORRECT INFORMATION PROVIDED BY ANY AGENT, MISSED APPOINTMENTS, OR LEADS LOST DUE TO AGENT MALFUNCTION OR HALLUCINATION.",
                  },
                ],
              },
            ]
          : []),
        {
          heading: "Third-Party Service Outages",
          blocks: [
            {
              kind: "para",
              text: `Provider relies on third-party Subcontractors as identified in Section ${ref("subcontractors")}. Provider is not liable for outages, errors, or service changes by these third-party providers, but will use commercially reasonable efforts to mitigate impact and restore service.`,
            },
          ],
        },
      ],
    },

    /* ────────────────────────────────────────── 18 */
    {
      id: "disputes",
      heading: "CLIENT RESPONSIBILITIES, INDEMNIFICATION, AND DISPUTE RESOLUTION",
      subsections: [
        {
          heading: "Client Responsibilities",
          blocks: [
            { kind: "para", text: "Client agrees to:" },
            {
              kind: "bullets",
              items: [
                "Provide accurate and complete business information during onboarding",
                "Notify Provider promptly of any changes to business name, address, phone number, services, hours, or pricing",
                ...(s.hasVoiceAgent
                  ? [
                      "Notify Provider of any state-specific AI disclosure or recording consent requirements",
                      "Not bypass or modify any AI voice agent configuration without Provider's knowledge",
                      "Promptly report any concerns about AI voice agent behavior or call outcomes",
                    ]
                  : []),
                "Review the preview site before launch and provide written approval",
                "Safeguard client portal credentials and not share logins outside Client's organization",
                "Comply with all applicable laws including TCPA, CAN-SPAM, FIPA, ADA, state recording consent laws, and industry-specific regulations",
                "Not use the Services for unlawful, deceptive, harassing, or fraudulent purposes",
                "Maintain ownership and authorization for all content provided to Provider",
              ],
            },
          ],
        },
        ...(s.slug === "enterprise"
          ? [
              {
                heading: "Authorization to Bind All Sites",
                blocks: [
                  {
                    kind: "para" as const,
                    text: `Client represents that the individual signing this Agreement has full authority to bind all businesses, entities, or brands listed as sites in Schedule A. If Client adds a site under Section ${ref("sitelist")} owned by a separate legal entity, Client further represents that it has authority to bind that entity to the terms of this Agreement.`,
                  },
                ],
              },
            ]
          : []),
        {
          heading: "Indemnification by Client",
          blocks: [
            {
              kind: "para",
              text: "Client agrees to indemnify, defend, and hold harmless Provider and its officers, employees, and agents from any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from:",
            },
            {
              kind: "bullets",
              items: [
                "Client's content (including claims of infringement, defamation, or false advertising)",
                "Client's violation of applicable law including TCPA, CAN-SPAM, state recording consent laws, AI disclosure laws, FIPA, ADA, and industry regulations",
                ...(s.hasVoiceAgent
                  ? [
                      "Inaccurate, incomplete, or unauthorized information Client provides for use by any AI voice agent",
                      "Client's failure to inform Provider of jurisdictional disclosure or recording consent requirements",
                    ]
                  : []),
                `Website accessibility claims as described in Section ${ref("accessibility")}`,
                `DMCA and copyright claims as described in Section ${ref("copyright")}`,
                "Client's use of the Services in violation of this Agreement",
              ],
            },
          ],
        },
        {
          heading: "Indemnification by Provider",
          blocks: [
            {
              kind: "para",
              text: "Provider agrees to indemnify Client against third-party claims that Provider's underlying Template Code infringes the intellectual property rights of a third party, provided Client promptly notifies Provider of the claim and cooperates in the defense.",
            },
          ],
        },
        {
          heading: "Governing Law",
          blocks: [
            {
              kind: "para",
              text: "This Agreement is governed by the laws of the State of Florida, without regard to conflict of law principles.",
            },
          ],
        },
        {
          heading: "Dispute Resolution; Binding Arbitration",
          blocks: [
            {
              kind: "para",
              text: "The parties will attempt to resolve disputes through good-faith negotiation. If unresolved within thirty (30) days, disputes shall be resolved by binding arbitration in Orange County, Florida, under the rules of the American Arbitration Association.",
            },
            { kind: "para", text: "IMPORTANT - READ CAREFULLY:" },
            {
              kind: "callout",
              text: "BY SIGNING THIS AGREEMENT, EACH PARTY KNOWINGLY AND VOLUNTARILY WAIVES THE RIGHT TO A TRIAL BY JURY AND THE RIGHT TO PARTICIPATE IN ANY CLASS ACTION OR CLASS-WIDE ARBITRATION. THIS MEANS THAT DISPUTES BETWEEN THE PARTIES WILL BE RESOLVED BY A PRIVATE ARBITRATOR (NOT A JUDGE OR JURY IN COURT), AND NEITHER PARTY MAY JOIN ANY CLASS OR REPRESENTATIVE LAWSUIT AGAINST THE OTHER. CLIENT ACKNOWLEDGES THAT CLIENT HAS HAD A REASONABLE OPPORTUNITY TO REVIEW THIS PROVISION AND, IF DESIRED, CONSULT WITH LEGAL COUNSEL BEFORE SIGNING.",
            },
          ],
        },
        {
          heading: "Notices",
          blocks: [
            {
              kind: "para",
              text: "All formal notices under this Agreement must be in writing and delivered by email with read receipt requested, or by certified mail. Routine communications may occur via the parties' standard email channels.",
            },
          ],
        },
        {
          heading: "Entire Agreement",
          blocks: [
            {
              kind: "para",
              text: `This Agreement, including Schedule A, constitutes the entire agreement between the parties and supersedes all prior agreements and understandings, except as provided in Section ${ref("planchanges")} in the case of plan changes.`,
            },
          ],
        },
        {
          heading: "Amendments",
          blocks: [
            {
              kind: "para",
              text: "Modifications to this Agreement must be in writing and signed by both parties." +
                (s.slug === "enterprise"
                  ? " Schedule A may be amended via written confirmation from both parties to reflect site swaps."
                  : ""),
            },
          ],
        },
        {
          heading: "Assignment",
          blocks: [
            {
              kind: "para",
              text: "Client may not assign this Agreement without Provider's written consent. Provider may assign to a successor entity in connection with a merger, acquisition, or sale of all or substantially all of its assets.",
            },
          ],
        },
        {
          heading: "Severability",
          blocks: [
            {
              kind: "para",
              text: `If any provision is held unenforceable, the remainder of the Agreement remains in effect. The parties intend that the arbitration and class action waiver in this Section be enforced to the broadest extent permitted by law, and if any portion is held unenforceable, the remaining portions shall continue in effect.`,
            },
          ],
        },
        {
          heading: "Force Majeure",
          blocks: [
            {
              kind: "para",
              text: "Neither party is liable for failure to perform due to circumstances beyond reasonable control, including natural disasters, internet outages, third-party service failures, government action, or pandemic.",
            },
          ],
        },
      ],
    },
  ];
}
