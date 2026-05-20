/**
 * Per-plan field coordinate maps for stamping onto the plan-specific MSA PDFs.
 *
 * Coordinate system: PDF origin is BOTTOM-LEFT. US Letter = 612×792 points.
 * Page numbers are 1-indexed (pages[0] = page 1).
 *
 * These coordinates are ported from the old msa-v2.pdf positions and will need
 * visual calibration — sign a test agreement for each plan and adjust x/y values
 * until each field sits correctly on its blank line.
 */

export interface PlanFields {
  // Page 1 — Header
  page1_clientName: { page: number; x: number; y: number; fontSize: number };
  page1_clientEntity: { page: number; x: number; y: number; fontSize: number };
  page1_clientAddress: { page: number; x: number; y: number; fontSize: number };
  page1_effectiveDate: { page: number; x: number; y: number; fontSize: number };

  // Provider (JDD) signature block — same page as client sig, above it
  provider_sigImage: { page: number; x: number; y: number; width: number; height: number };
  provider_name: { page: number; x: number; y: number; fontSize: number };
  provider_title: { page: number; x: number; y: number; fontSize: number };
  provider_date: { page: number; x: number; y: number; fontSize: number };

  // Signature block — page A (sig image + signer name)
  sigA_clientSigImage: { page: number; x: number; y: number; width: number; height: number };
  sigA_clientName: { page: number; x: number; y: number; fontSize: number };

  // Signature block — page B (title / business / date overflow)
  sigB_clientTitle: { page: number; x: number; y: number; fontSize: number };
  sigB_clientBusiness: { page: number; x: number; y: number; fontSize: number };
  sigB_clientDate: { page: number; x: number; y: number; fontSize: number };

  // Schedule A — site names (enterprise only; null for starter/growth)
  schedA_site1: { page: number; x: number; y: number; fontSize: number } | null;
  schedA_site2: { page: number; x: number; y: number; fontSize: number } | null;
  schedA_site3: { page: number; x: number; y: number; fontSize: number } | null;
}

const STARTER_FIELDS: PlanFields = {
  page1_clientName: { page: 1, x: 130, y: 385, fontSize: 11 },
  page1_clientEntity: { page: 1, x: 370, y: 385, fontSize: 11 },
  page1_clientAddress: { page: 1, x: 60, y: 365, fontSize: 11 },
  page1_effectiveDate: { page: 1, x: 175, y: 340, fontSize: 11 },

  provider_sigImage: { page: 15, x: 100, y: 515, width: 160, height: 20 },
  provider_name: { page: 15, x: 100, y: 500, fontSize: 11 },
  provider_title: { page: 15, x: 110, y: 480, fontSize: 11 },
  provider_date: { page: 15, x: 95, y: 465, fontSize: 11 },

  sigA_clientSigImage: { page: 15, x: 100, y: 420, width: 160, height: 28 },
  sigA_clientName: { page: 15, x: 100, y: 395, fontSize: 11 },

  sigB_clientTitle: { page: 15, x: 95, y: 375, fontSize: 11 },
  sigB_clientBusiness: { page: 15, x: 110, y: 355, fontSize: 11 },
  sigB_clientDate: { page: 15, x: 95, y: 335, fontSize: 11 },

  schedA_site1: null,
  schedA_site2: null,
  schedA_site3: null,
};

const GROWTH_FIELDS: PlanFields = {
  page1_clientName: { page: 1, x: 130, y: 345, fontSize: 11 },
  page1_clientEntity: { page: 1, x: 370, y: 345, fontSize: 11 },
  page1_clientAddress: { page: 1, x: 60, y: 330, fontSize: 11 },
  page1_effectiveDate: { page: 1, x: 175, y: 305, fontSize: 11 },

  provider_sigImage: { page: 19, x: 100, y: 515, width: 160, height: 20 },
  provider_name: { page: 19, x: 100, y: 500, fontSize: 11 },
  provider_title: { page: 19, x: 110, y: 480, fontSize: 11 },
  provider_date: { page: 19, x: 95, y: 465, fontSize: 11 },

  sigA_clientSigImage: { page: 19, x: 100, y: 420, width: 160, height: 28 },
  sigA_clientName: { page: 19, x: 100, y: 395, fontSize: 11 },

  sigB_clientTitle: { page: 19, x: 95, y: 375, fontSize: 11 },
  sigB_clientBusiness: { page: 19, x: 110, y: 355, fontSize: 11 },
  sigB_clientDate: { page: 19, x: 95, y: 335, fontSize: 11 },

  schedA_site1: null,
  schedA_site2: null,
  schedA_site3: null,
};

const ENTERPRISE_FIELDS: PlanFields = {
  page1_clientName: { page: 1, x: 130, y: 365, fontSize: 11 },
  page1_clientEntity: { page: 1, x: 370, y: 365, fontSize: 11 },
  page1_clientAddress: { page: 1, x: 60, y: 345, fontSize: 11 },
  page1_effectiveDate: { page: 1, x: 175, y: 325, fontSize: 11 },

  provider_sigImage: { page: 21, x: 100, y: 765, width: 160, height: 20 },
  provider_name: { page: 21, x: 100, y: 745, fontSize: 11 },
  provider_title: { page: 21, x: 110, y: 725, fontSize: 11 },
  provider_date: { page: 21, x: 95, y: 710, fontSize: 11 },

  sigA_clientSigImage: { page: 21, x: 100, y: 655, width: 160, height: 28 },
  sigA_clientName: { page: 21, x: 100, y: 640, fontSize: 11 },

  sigB_clientTitle: { page: 21, x: 95, y: 618, fontSize: 11 },
  sigB_clientBusiness: { page: 21, x: 190, y: 600, fontSize: 11 },
  sigB_clientDate: { page: 21, x: 95, y: 581, fontSize: 11 },

  // Site names: 1 & 2 on p.22, site 3 overflow to p.23
  schedA_site1: { page: 22, x: 135, y: 165, fontSize: 11 },
  schedA_site2: { page: 22, x: 135, y: 85, fontSize: 11 },
  schedA_site3: { page: 23, x: 135, y: 715, fontSize: 11 },
};

export const PLAN_FIELDS: Record<"starter" | "growth" | "enterprise", PlanFields> = {
  starter: STARTER_FIELDS,
  growth: GROWTH_FIELDS,
  enterprise: ENTERPRISE_FIELDS,
};
