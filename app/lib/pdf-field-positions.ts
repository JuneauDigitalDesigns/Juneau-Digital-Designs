/**
 * (x, y) coordinates for stamping fields onto the MSA PDF.
 *
 * Coordinate system: PDF origin is BOTTOM-LEFT. US Letter = 612×792 points.
 * These are initial guesses — visually tune by signing a test agreement and
 * adjusting until each field sits in its blank line.
 *
 * Page numbers are 1-indexed (pages[0] = page 1).
 */

export const FIELDS = {
  // ── Page 1 ── Header
  page1_clientName:    { page: 1, x: 130, y: 580, fontSize: 11 },
  page1_clientEntity:  { page: 1, x: 410, y: 580, fontSize: 11 },
  page1_clientAddress: { page: 1, x: 130, y: 550, fontSize: 11 },
  page1_effectiveDate: { page: 1, x: 175, y: 510, fontSize: 11 },

  // ── Page 1 ── Selected Plan callout box (drawn above Section 1)
  page1_planCalloutBox:   { page: 1, x: 60, y: 470, width: 490, height: 56 },
  page1_planCalloutTitle: { page: 1, x: 75, y: 506, fontSize: 9  },
  page1_planCalloutValue: { page: 1, x: 75, y: 488, fontSize: 16 },
  page1_planCalloutSub:   { page: 1, x: 75, y: 476, fontSize: 9  },

  // ── Page 11 ── Signature block (Client side; Provider side is pre-signed by JDD)
  page11_clientSigImage: { page: 11, x: 95, y: 178, width: 180, height: 50 },
  page11_clientName:     { page: 11, x: 100, y: 168, fontSize: 11 },
  page11_clientTitle:    { page: 11, x: 95, y: 110, fontSize: 11 },
  page11_clientBusiness: { page: 11, x: 130, y: 82,  fontSize: 11 },
  page11_clientDate:     { page: 11, x: 95, y: 56,  fontSize: 11 },

  // ── Page 13 ── Schedule A selections
  page13_planCheckboxStarter:    { page: 13, x: 156, y: 642 },
  page13_planCheckboxGrowth:     { page: 13, x: 230, y: 642 },
  page13_planCheckboxEnterprise: { page: 13, x: 305, y: 642 },
  page13_monthlyFee:  { page: 13, x: 466, y: 642, fontSize: 11 },
  page13_setupFee:    { page: 13, x: 535, y: 642, fontSize: 11 },
  page13_launchDate:  { page: 13, x: 245, y: 620, fontSize: 11 },
  page13_site1:       { page: 13, x: 108, y: 558, fontSize: 11 },
  page13_site2:       { page: 13, x: 108, y: 538, fontSize: 11 },
  page13_site3:       { page: 13, x: 108, y: 518, fontSize: 11 },
} as const;
