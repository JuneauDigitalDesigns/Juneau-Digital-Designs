import "server-only";
import type { OperatorOrder } from "@jdd/schema";
import { getAgreement, updateAgreement } from "./kv";
import type { AgreementRecord, VerbalAcceptance } from "./agreement-types";

/**
 * The recording of the terms on a read-aloud close (Xander, 2026-11-09: terms only).
 *
 * Only the terms are recorded because the next step can put a card number on the call, and that
 * must never end up in a recording. So the recording has to be confirmed stopped before payment
 * can begin, and that is enforced here as well as on the wizard's screen: the wizard can be
 * reopened straight onto its Payment step.
 */

const verbalOf = (record: AgreementRecord | null): VerbalAcceptance | null =>
    record?.acceptance?.method === "verbal-operator" ? record.acceptance : null;

/**
 * The time the operator ticked "Client consented to recording", or null if it can't be right.
 * It comes from the operator's machine, so it gets a little slack for clock drift. It is bounded
 * because an acceptance stamped with consent from some other day proves nothing about this call.
 */
export function parseConsentTime(value: unknown, nowMs: number): string | null {
    if (typeof value !== "string") return null;
    const at = Date.parse(value);
    if (Number.isNaN(at)) return null;
    if (at > nowMs + 5 * 60_000 || at < nowMs - 12 * 60 * 60_000) return null;
    return new Date(at).toISOString();
}

/** A recording was consented to and hasn't been confirmed stopped. */
export function recordingRunning(record: AgreementRecord | null): boolean {
    const verbal = verbalOf(record);
    return Boolean(verbal?.recordingConsentAt && !verbal.recordingStoppedAt);
}

export async function orderRecordingRunning(order: OperatorOrder): Promise<boolean> {
    return order.agreementId ? recordingRunning(await getAgreement(order.agreementId)) : false;
}

/** Stamp the stop. A second call keeps the first time. */
export async function markRecordingStopped(record: AgreementRecord, nowMs: number): Promise<AgreementRecord> {
    const verbal = verbalOf(record);
    if (!verbal || verbal.recordingStoppedAt) return record;
    const next: AgreementRecord = { ...record, acceptance: { ...verbal, recordingStoppedAt: new Date(nowMs).toISOString() } };
    await updateAgreement(next);
    return next;
}

/**
 * Why a recording can't be attached to this agreement, or null. Consent must already be on the
 * record. A recording is evidence only if the agreement says the client agreed to it, and without
 * that it is a liability. One recording per agreement, and never replaced: a hash that can be
 * swapped later proves nothing.
 */
export function recordingAttachRefusal(record: AgreementRecord): string | null {
    if (!verbalOf(record)?.recordingConsentAt) return "No recording consent on this agreement.";
    if (record.recording) return "A recording is already attached to this agreement.";
    return null;
}
