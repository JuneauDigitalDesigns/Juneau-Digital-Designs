import type { QueuedIntake } from "@jdd/schema";

/**
 * Which order or purchase a signup came from, stamped on every record the console reads about it.
 *
 * Xander, 2026-11-16: every signup carries the id of what it came from, on both paths.
 *   - closed on a sales call (the console's close wizard): the operator order, `jdd:order:{id}`;
 *   - bought on this site (self-serve): the purchase intent, `jdd:purchase:{id}`.
 * Both already live on the PortalSite (`orderId`, `purchaseId`), written at fulfilment. The
 * console never reads accounts, though: it sees the queued intake and the pending-onboard record.
 * So the ids are copied onto those two at creation, and the console reads them with
 * `@jdd/schema`'s `intakeOrigin()` (its Clients badge counts the self-serve ones).
 *
 * The fields are `QueuedIntake.orderId` / `purchaseId` (`@jdd/schema` v1.36.0).
 *
 * Pure: no I/O, so the suite runs it as is.
 */
export type IntakeOriginIds = Pick<QueuedIntake, "orderId" | "purchaseId">;

/** The ids to stamp, from the site the signup belongs to. Absent ids are left off, never empty. */
export function intakeOriginIds(site: { orderId?: string | null; purchaseId?: string | null }): IntakeOriginIds {
  return {
    ...(site.orderId ? { orderId: site.orderId } : {}),
    ...(site.purchaseId ? { purchaseId: site.purchaseId } : {}),
  };
}
