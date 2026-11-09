import "server-only";
import { normalizeEmail, type PortalAccount } from "@jdd/schema";
import type { AgreementRecord } from "./agreement-types";
import { getAgreement, listAccountAgreementIds } from "./kv";

/**
 * Which signed agreements belong to an account.
 *
 * The account record alone can't answer it. `masterAgreement` is overwritten by an upgrade, and
 * a downgrade or consolidation addendum is never written onto the account at all. So the list is
 * the union of what the account names and the per-account index `persistAgreement` adds to when
 * an agreement is paid for or its plan change completes. An unpaid draft is on neither, so it
 * never shows.
 */
async function agreementIdsFor(account: PortalAccount): Promise<string[]> {
    const indexed = await listAccountAgreementIds(account.email);
    const named = [account.masterAgreement?.agreementId, ...account.sites.map((s) => s.agreementId)];
    return [...new Set([...named, ...indexed].filter((id): id is string => Boolean(id)))];
}

/** Signed for this account, or signed with no account recorded (operator-closed orders). */
function signedFor(record: AgreementRecord, account: PortalAccount): boolean {
    return !record.accountEmail || normalizeEmail(record.accountEmail) === normalizeEmail(account.email);
}

/**
 * The agreement, only if it is this account's. Null for anything else, including an id that
 * exists under another account: the download route can't tell the caller which it was.
 */
export async function ownedAgreement(account: PortalAccount, id: string): Promise<AgreementRecord | null> {
    if (!(await agreementIdsFor(account)).includes(id)) return null;
    const record = await getAgreement(id);
    return record && signedFor(record, account) ? record : null;
}

export interface AccountAgreement {
    id: string;
    kind: "master" | "addendum";
    /** True for the master this account is on now. False for one an upgrade replaced. */
    current: boolean;
    signedAt: string;
    /** The site an addendum covers, by name. Null on a master, which covers the account. */
    siteName: string | null;
}

/** The site an addendum was signed for: the one it authorised, or the plan change's target. */
function siteNameFor(record: AgreementRecord, account: PortalAccount): string | null {
    const slug = record.upgradeSlug ?? record.downgradeSlug;
    const site = account.sites.find((s) => s.agreementId === record.id || (slug && s.slug === slug));
    return site ? (site.name ?? site.slug) : null;
}

/**
 * Everything to show in Settings: account-wide, whichever site is selected, because the master
 * governs every site on the account. The current master first, then newest first.
 */
export async function listAccountAgreements(account: PortalAccount): Promise<AccountAgreement[]> {
    const ids = await agreementIdsFor(account);
    const records = await Promise.all(ids.map((id) => getAgreement(id)));
    const rows = records
        .filter((r): r is AgreementRecord => Boolean(r) && signedFor(r as AgreementRecord, account))
        .map((r): AccountAgreement => {
            const kind = r.kind === "addendum" ? "addendum" : "master";
            return {
                id: r.id,
                kind,
                current: kind === "master" && account.masterAgreement?.agreementId === r.id,
                signedAt: r.audit.signedAt,
                siteName: kind === "addendum" ? siteNameFor(r, account) : null,
            };
        });
    return rows.sort((a, b) => Number(b.current) - Number(a.current) || Date.parse(b.signedAt) - Date.parse(a.signedAt));
}
