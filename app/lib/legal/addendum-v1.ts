import { PROVIDER, TERMS_VERSION } from "./terms-v4";
import type { PlanSchedule, Section } from "./types";

export const ADDENDUM_VERSION = "addendum-v1";

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * The Site Addendum — what a client signs for their second site and every one after.
 *
 * A client signs the full Master Services Agreement once. Later purchases are authorised by
 * this instead: one page that names the site, its plan, its fees and the entity contracting
 * for it, and adopts the master by reference for everything else.
 *
 * The split is not only about friction. A client's second site is frequently bought by a
 * *different legal entity* — another LLC, a separate brand they own — and re-signing the
 * master with different entity details would either overwrite the first entity's contracting
 * record or leave two masters with no stated relationship between them. An addendum is the
 * correct instrument for that: one governing agreement, one signed document per site, each
 * naming its own contracting party.
 *
 * Deliberately built from the same `Section`/`Block` vocabulary as the master, so it renders
 * through the existing `TermsReader` and `pdf-renderer` with no new code in either. Adding a
 * block kind here would mean implementing it twice; the constraint is the point.
 *
 * The scroll gate still applies. It is one screen, so satisfying it is trivial — but "the
 * client reached the end before signing" should not be a claim that depends on document
 * length.
 */
export function buildAddendumSections(
  s: PlanSchedule,
  opts: { siteNames?: string[] } = {},
): Section[] {
  const siteNames = (opts.siteNames ?? []).filter((n) => n.trim().length > 0);

  return [
    {
      num: 1,
      heading: "THE SITE",
      intro: [
        {
          kind: "para",
          text:
            `This Addendum adds one or more websites to an existing engagement between ` +
            `Client and ${PROVIDER.legalName} ("Provider"). It is signed separately for ` +
            `each purchase so that the site, its plan and the entity responsible for it are ` +
            `recorded on their own instrument.`,
        },
      ],
      subsections: [
        {
          num: "1.1",
          heading: "Site Covered",
          blocks:
            siteNames.length > 0
              ? [
                  {
                    kind: "bullets",
                    items: siteNames.map((n, i) => `Site ${i + 1}: ${n}`),
                  },
                ]
              : [
                  {
                    kind: "para",
                    text:
                      "The website described during onboarding immediately following this " +
                      "Addendum. Provider will record the business name and domain on the " +
                      "Client's portal record once onboarding is submitted.",
                  },
                ],
        },
        {
          num: "1.2",
          heading: "Contracting Entity",
          blocks: [
            {
              kind: "para",
              text:
                "The legal entity named in the signature block below contracts for this " +
                "site. It need not be the same entity that signed the Master Services " +
                "Agreement — a Client operating several businesses may hold sites under " +
                "different entities. Each entity is responsible for the site it signs for.",
            },
          ],
        },
      ],
    },

    {
      num: 2,
      heading: "PLAN AND FEES",
      intro: [
        {
          kind: "para",
          text:
            `This site is provided on the ${s.name} plan at ${money(s.monthlyPrice)} per ` +
            `month, covering ${s.siteLabel}.` +
            (s.onboardingFee > 0
              ? ` A one-time onboarding fee of ${money(s.onboardingFee)} applies to this site.`
              : ""),
        },
      ],
      subsections: [
        {
          num: "2.1",
          heading: "Billing",
          blocks: [
            {
              kind: "para",
              text:
                "Fees for this site are billed to the Client's existing payment method on " +
                "the same account, beginning on the date payment for this Addendum is " +
                "captured, and recur monthly until cancelled under the Master Services " +
                "Agreement.",
            },
            { kind: "table", rows: s.feeTable },
          ],
        },
        ...(s.callMinutes !== null
          ? [
              {
                num: "2.2",
                heading: "Included Call Minutes",
                blocks: [
                  {
                    kind: "para" as const,
                    text:
                      s.slug === "enterprise"
                        ? `The ${s.name} plan includes ${s.callMinutes.toLocaleString()} call-minutes per month, pooled across every site covered by this plan.`
                        : `This site includes ${s.callMinutes.toLocaleString()} call-minutes per month. These minutes belong to this site alone and are not shared with any other site on the Client's account; each site's usage is measured and billed against its own allowance.`,
                  },
                ],
              },
            ]
          : []),
      ],
    },

    {
      num: 3,
      heading: "INCORPORATION OF THE MASTER SERVICES AGREEMENT",
      intro: [
        {
          kind: "para",
          text:
            `Except as stated in this Addendum, the Master Services Agreement (version ` +
            `${TERMS_VERSION}) previously executed by Client governs this site in full — ` +
            `including its terms on intellectual property, warranties, limitation of ` +
            `liability, dispute resolution and cancellation.`,
        },
      ],
      subsections: [
        {
          num: "3.1",
          heading: "Conflicts",
          blocks: [
            {
              kind: "para",
              text:
                "Where this Addendum and the Master Services Agreement conflict, this " +
                "Addendum controls, and only as to the site it covers.",
            },
          ],
        },
        {
          num: "3.2",
          heading: "Cancellation",
          blocks: [
            {
              kind: "para",
              text:
                `Either party may cancel this site on the notice period set out in the ` +
                `Master Services Agreement (${s.cancellationNoticeDays} days for the ` +
                `${s.name} plan). Cancelling this site does not cancel any other site on ` +
                `the Client's account, and does not terminate the Master Services Agreement.`,
            },
          ],
        },
      ],
    },

    {
      num: 4,
      heading: "EFFECTIVE DATE",
      intro: [
        {
          kind: "para",
          text:
            "This Addendum takes effect on the date it is signed by Client and payment is " +
            "captured. Provider begins work on the site once onboarding details are " +
            "submitted.",
        },
      ],
      subsections: [],
    },
  ];
}

/**
 * The addendum, resolved for one plan.
 *
 * Mirrors `getTermsForPlan`'s return shape so the signing page and PDF generator can accept
 * either without branching on which document they were handed.
 */
export function getAddendumForPlan(
  schedule: PlanSchedule,
  opts: { siteNames?: string[] } = {},
): { version: string; sections: Section[] } {
  return {
    version: ADDENDUM_VERSION,
    sections: buildAddendumSections(schedule, opts),
  };
}
