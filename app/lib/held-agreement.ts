import type { MasterAgreementRef, PortalAccount } from "@jdd/schema";
import type { AgreementRecord } from "./agreement-types";

/**
 * Agreements accepted for an in-place plan change are HELD until the change goes through.
 *
 * `/api/agreement` used to record every full master on the account at the moment it was
 * accepted. For a first purchase that's right (an abandoned checkout doesn't un-sign the terms).
 * For a plan change it is not. A declined upgrade left `account.masterAgreement` pointing at the
 * Growth agreement: a Growth tier ceiling on a client still on Starter, referencing a record on a
 * 30-day TTL that nothing would persist, while the Starter master it replaced was orphaned
 * (Stripe test run, F1, 2026-11-04).
 *
 * So a held agreement leaves the master alone, and the plan-change route records it with
 * `masterRefFor` once the change has succeeded, persisting it at the same time.
 */
export function isHeldForPlanChange(record: AgreementRecord): boolean {
    return Boolean(record.pendingUpgrade || record.pendingDowngrade || record.pendingConsolidation || record.pendingReceptionist);
}

/**
 * Was this agreement accepted by this account? Stamped at acceptance from the signed-in session,
 * never from the form. A plan-change route can no longer bind through `account.masterAgreement`,
 * because a held agreement isn't there until the change succeeds.
 */
export function acceptedBy(agreement: AgreementRecord, account: PortalAccount): boolean {
    return Boolean(agreement.accountEmail) && agreement.accountEmail!.toLowerCase() === account.email.toLowerCase();
}

/** The master reference for an agreement that now governs the account. */
export function masterRefFor(agreement: AgreementRecord): MasterAgreementRef {
    return {
        agreementId: agreement.id,
        version: agreement.agreementVersion,
        tierCeiling: agreement.plan,
        signedAt: Date.parse(agreement.audit.signedAt),
    };
}
