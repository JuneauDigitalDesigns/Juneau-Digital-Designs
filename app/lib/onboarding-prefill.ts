/**
 * What the onboarding wizard can fill in from records we already hold, so a client only checks it.
 *
 * Two sources, chosen per site:
 *   - The signed agreement (`PortalSite.agreementId`), which both paths write: self-serve signing
 *     and a sales-call close. It holds the legal name, address and signer.
 *   - The operator order (`PortalSite.orderId`), written only by a sales-call close. It adds what
 *     only the call collected: the trading name (DBA), the contact's mobile and the trade.
 *
 * Rules:
 *   - Never invent. A field neither record holds stays absent and the wizard asks for it as usual.
 *   - Never prefill what we don't store. No EIN, representative or A2P detail is read here.
 *   - Only facts, never inferences. The signer becomes the owner's name only when their own title
 *     says they are the owner; a trade is used only when it is one the wizard offers.
 *   - A saved draft always wins over this (the wizard only seeds a blank start from it).
 *
 * Pure, so `test/onboarding-prefill.test.mjs` can pin it without Redis.
 */

import type { OperatorOrder } from "@jdd/schema";
import type { AgreementRecord } from "./agreement-types";
import { TRADE_OPTIONS, type WizardPrefill } from "@/app/components/onboarding/wizard/model";

/** `source` says where the values came from, for the note under each prefilled field. */
export type OnboardingPrefill = WizardPrefill;

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const OWNER_TITLE = /\b(owner|co-owner|founder|co-founder)\b/i;

export function buildPrefill(input: {
    agreement?: Pick<AgreementRecord, "clientLegalName" | "clientAddress" | "signerName" | "signerTitle"> | null;
    order?: Pick<OperatorOrder, "client" | "vertical"> | null;
}): OnboardingPrefill | null {
    const { agreement, order } = input;
    if (!agreement && !order) return null;

    const out: OnboardingPrefill = { source: order ? "call" : "agreement" };

    // The name the business trades under reads better on a site than its legal entity name.
    const name = clean(order?.client.dba) || clean(order?.client.legalName) || clean(agreement?.clientLegalName);
    if (name) out.name = name;

    const address = clean(order?.client.address) || clean(agreement?.clientAddress);
    if (address) out.address = address;

    // The contact mobile from the call. It becomes the number the receptionist rings first, which
    // must be the owner's real phone (never the line being forwarded, or calls would loop).
    const phone = clean(order?.client.phone);
    if (phone) out.phone = phone;

    const trade = clean(order?.vertical);
    if (trade && TRADE_OPTIONS.some((t) => t.id === trade)) out.trade = trade;

    const signer = clean(order?.client.contactName) || clean(agreement?.signerName);
    const title = clean(order?.client.contactTitle) || clean(agreement?.signerTitle);
    if (signer && OWNER_TITLE.test(title)) out.owner = signer;

    return Object.keys(out).length > 1 ? out : null;
}
