// @ts-check
/**
 * A2P 10DLC identity — the pure half: enums, validation, payload shapes, and the tax-ID
 * tripwire.
 *
 * Plain ESM on purpose, not TypeScript.
 *
 * This module holds the only code in the repo that ever touches an EIN, and the failure it
 * guards against is silent, permanent and unrecoverable — an EIN written to a draft store
 * cannot be un-leaked. So it has to be covered by a test that imports the real
 * implementation. This repo has no test runner, and Node here is v22.0.0, which cannot strip
 * types — a `.ts` module could not be imported by `node --test` at all. Plain ESM with
 * `@ts-check` + JSDoc gets full `tsc --noEmit` coverage (`allowJs` is on) *and* runs
 * untranspiled under `node --test`: the same reasoning as the `jdd-ops` root suite, which
 * keeps its code plain ESM so it needs no devDependencies.
 *
 * Nothing here does I/O, so it is safe in both the client bundle (the wizard step needs the
 * enums) and the route (which needs the payload builders).
 *
 * Vendor shapes come from the runbook (`JDD-a2p-isv-runbook.html`, Phase 2.2-2.4) and
 * Twilio's Secondary Customer Profile reference. Do not re-derive them inline.
 */

/**
 * `business_industry` — Twilio TrustHub's accepted values for
 * `customer_profile_business_information`, verbatim and complete (31 values).
 *
 * Rendered as a `<select>`, never a text input: the field is an enum on Twilio's side, and a
 * freeform value fails the compliance evaluation days later rather than at submit.
 *
 * The whole list ships rather than only the five verticals we sell, because none of the five
 * trades has its own value — Twilio's list has no construction or home-services entry — so
 * the mapping below is a *default*, not a truth. A client who knows better can correct it,
 * which is exactly what a guess dressed up as the only option would prevent.
 *
 * @type {ReadonlyArray<{ value: string; label: string }>}
 */
export const A2P_BUSINESS_INDUSTRIES = [
  { value: "AGRICULTURE", label: "Agriculture" },
  { value: "AUTOMOTIVE", label: "Automotive" },
  { value: "BANKING", label: "Banking" },
  { value: "CONSUMER", label: "Consumer services" },
  { value: "EDUCATION", label: "Education" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "ENERGY", label: "Energy" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "FAST_MOVING_CONSUMER_GOODS", label: "Fast-moving consumer goods" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "FINTECH", label: "Fintech" },
  { value: "FOOD_AND_BEVERAGE", label: "Food and beverage" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "HOSPITALITY", label: "Hospitality" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "JEWELRY", label: "Jewelry" },
  { value: "LEGAL", label: "Legal" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "MEDIA", label: "Media" },
  { value: "NOT_FOR_PROFIT", label: "Not for profit" },
  { value: "OIL_AND_GAS", label: "Oil and gas" },
  { value: "ONLINE", label: "Online" },
  { value: "RAW_MATERIALS", label: "Raw materials" },
  { value: "REAL_ESTATE", label: "Real estate" },
  { value: "RELIGION", label: "Religion" },
  { value: "RETAIL", label: "Retail" },
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "TELECOMMUNICATIONS", label: "Telecommunications" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "TRAVEL", label: "Travel" },
];

/**
 * The default `business_industry` per vertical we sell.
 *
 * Only car detailing has an unambiguous value. The trades all fall to `CONSUMER` — a
 * consumer-services business is what they are, and Twilio's list offers nothing closer.
 * `ENGINEERING` reads closer to the work but means engineering *firms*, and `REAL_ESTATE`
 * means property businesses; either would describe the client to the carriers as something
 * they are not.
 *
 * Keyed on `INDUSTRY_MENUS` ids from `@jdd/schema` — `hvac`, `roofing`, `plumbing`,
 * `lawn-care`, `car-detailing`, `health` — and nothing else. A key that matches no menu id
 * would silently never apply, which is worse than having no default at all.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_INDUSTRY_BY_VERTICAL = {
  plumbing: "CONSUMER",
  hvac: "CONSUMER",
  roofing: "CONSUMER",
  "lawn-care": "CONSUMER",
  "car-detailing": "AUTOMOTIVE",
  health: "HEALTHCARE",
};

/**
 * `business_type` — Twilio's accepted values, verbatim.
 *
 * Note `Limited Liability Corporation`, which is not what an LLC is actually called. The
 * runbook writes `Limited Liability Company` in its example payload; Twilio's reference does
 * not list that string, so sending it risks a rejection on the one field a client is most
 * likely to be right about. Twilio's spelling wins, because Twilio's parser is the one
 * reading it.
 *
 * @type {ReadonlyArray<{ value: string; label: string }>}
 */
export const A2P_BUSINESS_TYPES = [
  { value: "Limited Liability Corporation", label: "LLC" },
  { value: "Corporation", label: "Corporation" },
  { value: "Partnership", label: "Partnership" },
  { value: "Sole Proprietorship", label: "Sole proprietorship" },
  { value: "Co-operative", label: "Co-operative" },
  { value: "Non-profit Corporation", label: "Non-profit corporation" },
];

/**
 * Which registration path this client takes.
 *
 * @typedef {"ein" | "sole-proprietor"} A2pRegistrationPath
 */

/**
 * An EIN as the IRS writes it and as the client types it: `NN-NNNNNNN`.
 *
 * Checked on the client before submit because a typo costs a brand rejection and a restart,
 * which is days — and checked again on the server because a client-side check is a
 * convenience, not a control.
 */
export const EIN_INPUT_PATTERN = /^\d{2}-\d{7}$/;

/** @param {string} value */
export function isEinShaped(value) {
  return EIN_INPUT_PATTERN.test(String(value ?? "").trim());
}

/**
 * The tax-ID tripwire.
 *
 * Deliberately the hyphenated form only, with digit boundaries on both sides. The handoff's
 * `\d{2}-?\d{7}` is right for a test fixture but wrong as a production predicate: unanchored
 * and with the hyphen optional, it matches inside *every* 10-digit phone number
 * (`4075551234` is `40` + `7555123`), and a wizard draft is full of phone numbers. A
 * tripwire that fires on ordinary data is a tripwire somebody switches off.
 *
 * `\d{5}-\d{4}` (ZIP+4) and `\d{3}-\d{4}` (local phone) do not match this shape, and a
 * boundary-anchored `NN-NNNNNNN` has no other ordinary meaning in a wizard draft.
 */
const TAX_ID_SHAPE = /(?<!\d)\d{2}-\d{7}(?!\d)/;

/** @param {unknown} value */
export function looksLikeTaxId(value) {
  return typeof value === "string" && TAX_ID_SHAPE.test(value);
}

/**
 * Walk any JSON-ish value and return the **paths** of every string that looks like a tax ID.
 *
 * Paths, never values: this feeds log lines and error messages, which is precisely where a
 * leak would end up. A caller refusing a write needs to know *where* the value is so the
 * code can be fixed, and never needs the value itself.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @returns {string[]}
 */
export function findTaxIdPaths(value, path = "$") {
  if (looksLikeTaxId(value)) return [path];
  if (Array.isArray(value)) {
    return value.flatMap((entry, i) => findTaxIdPaths(entry, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => findTaxIdPaths(entry, `${path}.${key}`));
  }
  return [];
}

/**
 * @typedef {object} A2pIdentityAddress
 * @property {string} street
 * @property {string} city
 * @property {string} region
 * @property {string} postalCode
 * @property {string} country
 */

/**
 * @typedef {object} A2pIdentityRep
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} jobPosition
 * @property {string} businessTitle
 * @property {string} email
 * @property {string} phone
 */

/**
 * @typedef {object} A2pIdentityInput
 * @property {A2pRegistrationPath} registrationPath
 * @property {string} legalBusinessName
 * @property {string} businessType
 * @property {string} businessIndustry
 * @property {string} websiteUrl
 * @property {string} [ein] Present only on the `ein` path. Never stored, never echoed.
 * @property {A2pIdentityAddress} address
 * @property {A2pIdentityRep} rep
 */

/**
 * Validate the submission.
 *
 * Returns **field names**, never values and never a reason containing one, for the same
 * reason `findTaxIdPaths` returns paths: the result is rendered and logged.
 *
 * @param {A2pIdentityInput} input
 * @returns {{ ok: true } | { ok: false; fields: string[] }}
 */
export function validateIdentityInput(input) {
  /** @type {string[]} */
  const fields = [];
  const add = (/** @type {string} */ field) => {
    if (!fields.includes(field)) fields.push(field);
  };

  if (!String(input?.legalBusinessName ?? "").trim()) add("legalBusinessName");
  if (!String(input?.websiteUrl ?? "").trim()) add("websiteUrl");
  if (!A2P_BUSINESS_TYPES.some((t) => t.value === input?.businessType)) add("businessType");
  if (!A2P_BUSINESS_INDUSTRIES.some((i) => i.value === input?.businessIndustry)) add("businessIndustry");

  // The EIN is required on the EIN path and must be *absent* on the sole-proprietor path. A
  // client who picked sole proprietor and typed one anyway would otherwise have it sent to
  // Twilio on a profile that does not need it — collected and transmitted for nothing.
  if (input?.registrationPath === "ein") {
    if (!isEinShaped(String(input?.ein ?? ""))) add("ein");
  } else if (input?.registrationPath === "sole-proprietor") {
    if (String(input?.ein ?? "").trim()) add("ein");
  } else {
    add("registrationPath");
  }

  for (const key of /** @type {Array<keyof A2pIdentityAddress>} */ ([
    "street",
    "city",
    "region",
    "postalCode",
    "country",
  ])) {
    if (!String(input?.address?.[key] ?? "").trim()) add(`address.${key}`);
  }

  for (const key of /** @type {Array<keyof A2pIdentityRep>} */ ([
    "firstName",
    "lastName",
    "jobPosition",
    "businessTitle",
    "email",
    "phone",
  ])) {
    if (!String(input?.rep?.[key] ?? "").trim()) add(`rep.${key}`);
  }

  return fields.length ? { ok: false, fields } : { ok: true };
}

/**
 * `customer_profile_business_information` attributes (runbook 2.2).
 *
 * On the sole-proprietor path the registration identifier and number are **omitted** rather
 * than sent empty: a sole proprietor has no EIN to give, and an empty
 * `business_registration_number` is a value Twilio evaluates rather than a field it skips.
 *
 * _(unverified)_ that TrustHub accepts a business EndUser with no registration number — the
 * sole-proprietor flow is documented at the brand layer, not here. If it refuses, this
 * builder is the only thing that changes.
 *
 * @param {A2pIdentityInput} input
 * @returns {Record<string, string>}
 */
export function buildBusinessEndUserAttributes(input) {
  /** @type {Record<string, string>} */
  const attributes = {
    business_name: input.legalBusinessName.trim(),
    business_type: input.businessType,
    business_industry: input.businessIndustry,
    business_regions_of_operation: "USA_AND_CANADA",
    website_url: input.websiteUrl.trim(),
    business_identity: "direct_customer",
  };
  if (input.registrationPath === "ein") {
    attributes.business_registration_identifier = "EIN";
    attributes.business_registration_number = String(input.ein ?? "").trim();
  }
  return attributes;
}

/**
 * `authorized_representative_1` attributes (runbook 2.3).
 *
 * The rep's direct email and mobile get the same zero-retention treatment as the EIN: needed
 * for this one call (the mobile is where a sole-proprietor OTP lands), never stored.
 *
 * @param {A2pIdentityInput} input
 * @returns {Record<string, string>}
 */
export function buildRepEndUserAttributes(input) {
  return {
    first_name: input.rep.firstName.trim(),
    last_name: input.rep.lastName.trim(),
    email: input.rep.email.trim(),
    phone_number: input.rep.phone.trim(),
    job_position: input.rep.jobPosition.trim(),
    business_title: input.rep.businessTitle.trim(),
  };
}

/**
 * Address resource params (runbook 2.4).
 *
 * Collected as five fields rather than parsed out of the freeform `brand.address` the intake
 * already holds: a mis-parsed region fails the compliance evaluation with no useful error,
 * days after submit.
 *
 * @param {A2pIdentityInput} input
 * @returns {Record<string, string>}
 */
export function buildAddressParams(input) {
  return {
    CustomerName: input.legalBusinessName.trim(),
    Street: input.address.street.trim(),
    City: input.address.city.trim(),
    Region: input.address.region.trim(),
    PostalCode: input.address.postalCode.trim(),
    IsoCountry: input.address.country.trim().toUpperCase() || "US",
  };
}

/**
 * Scrub a vendor error message before it reaches a log line or the operator.
 *
 * A Twilio 400 is the likeliest leak in the whole design: it echoes the offending value back
 * ("Invalid business_registration_number: 47-1234567"), and an unhandled throw in a Next
 * route prints its message to stderr, which Vercel captures. So the field-level reason — which
 * the runbook rightly wants surfaced instead of waiting days for a rejection — is kept, and
 * every value this request submitted is removed from it, by identity *and* by shape.
 *
 * @param {string} message
 * @param {string[]} submitted Values the client submitted on this request. Never logged.
 * @returns {string}
 */
export function scrubVendorMessage(message, submitted) {
  let out = String(message ?? "");
  for (const value of submitted) {
    const trimmed = String(value ?? "").trim();
    // Short values (a two-letter region, a title) would mangle the message for no gain, and
    // are not identifiers worth protecting.
    if (trimmed.length < 4) continue;
    out = out.split(trimmed).join("[redacted]");
  }
  // Belt and braces: anything still tax-ID-shaped goes, recognised or not.
  return out.replace(new RegExp(TAX_ID_SHAPE.source, "g"), "[redacted]");
}
