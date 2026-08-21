import "server-only";
import {
  meteringGroups as schemaMeteringGroups,
  meteringGroupFor as schemaMeteringGroupFor,
  type MeteringGroup,
  type MinuteCaps,
  type PortalSite,
} from "@jdd/schema";
import { getSchedule } from "./legal/schedules";

export { voiceSitesOf, ENTERPRISE_GROUP_REF, type MeteringGroup } from "@jdd/schema";

const PAGE_SIZE = 100;
// 5,000 calls max per query — well beyond any monthly cap check
const MAX_PAGES = 50;

interface RetellCallRecord {
  call_id?: string;
  call_status?: string;
  start_timestamp?: number;
  end_timestamp?: number;
}

/**
 * Sum the duration of all ended calls for one Retell agent within [fromMs, toMs].
 * Returns total seconds, unrounded.
 *
 * Uses the same list-calls pagination pattern as reconcile-demo-calls. Retell is
 * the authoritative source — Airtable logs are lossy and unsuitable for billing.
 */
export async function fetchAgentSeconds(
  apiKey: string,
  agentId: string,
  fromMs: number,
  toMs: number,
): Promise<number> {
  let totalSeconds = 0;
  let paginationKey: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch("https://api.retellai.com/v2/list-calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter_criteria: { agent_id: [agentId] },
        sort_order: "descending",
        limit: PAGE_SIZE,
        ...(paginationKey ? { pagination_key: paginationKey } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(
        `Retell list-calls failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
      );
    }

    const calls = (await res.json()) as RetellCallRecord[];
    if (!Array.isArray(calls) || calls.length === 0) break;

    for (const call of calls) {
      const start = call.start_timestamp;
      if (typeof start !== "number") continue;
      // Descending order — once we're past the start of the window, stop.
      if (start < fromMs) return totalSeconds;
      if (start > toMs) continue;
      if (call.call_status !== "ended") continue;

      const end = call.end_timestamp;
      if (typeof end !== "number" || end <= start) continue;
      totalSeconds += (end - start) / 1000;
    }

    if (calls.length < PAGE_SIZE) break;
    paginationKey = calls[calls.length - 1]?.call_id;
    if (!paginationKey) break;
  }

  return totalSeconds;
}

/**
 * Included minutes per voice plan, read from the Schedule A the client actually signed.
 *
 * The grouping logic lives in `@jdd/schema` so it can be unit tested without Retell or
 * Stripe, and takes its caps as an argument for exactly this reason: the numbers belong to
 * the agreement, and a second copy of "350" in a shared package would be free to drift from
 * the contract.
 */
function minuteCaps(): MinuteCaps {
  return {
    growth: getSchedule("growth").callMinutes ?? 0,
    enterprise: getSchedule("enterprise").callMinutes ?? 0,
  };
}

/**
 * Split an account's voice sites into the allowances they actually draw on.
 *
 * Growth is metered per site, Enterprise as one pool — see `@jdd/schema`'s `metering` module
 * for why that distinction is load-bearing. This wrapper exists only to supply the caps.
 */
export function meteringGroups(sites: PortalSite[]): MeteringGroup[] {
  return schemaMeteringGroups(sites, minuteCaps());
}

/** The allowance a given site draws on, or null when it has no voice agent. */
export function meteringGroupFor(sites: PortalSite[], slug: string): MeteringGroup | null {
  return schemaMeteringGroupFor(sites, slug, minuteCaps());
}

/**
 * Billable **seconds** across the given sites, for one window.
 *
 * Callers pass one `MeteringGroup`'s sites, not a whole account — that is one site for
 * Growth and the whole bundle for Enterprise. Passing every voice site on an account is the
 * bug this signature used to invite.
 *
 * This used to return `Math.ceil(seconds / 60)`, and that single integer fed the tile, the
 * cap comparison, the overage and the Stripe invoice at once. Rounding here meant a client
 * shown "5 minutes" for a 4m 44s call, and overage billed on whole minutes the client never
 * used. Precision is kept all the way down now; the only rounding left is to the nearest
 * cent, in usage-billing.ts, at the moment money is actually computed.
 *
 * This is the single definition used by BOTH the billing cron and the portal. They must
 * never disagree: a client shown 300 minutes and invoiced for 400 is a support ticket that
 * ends in a refund.
 */
export async function sumAgentSeconds(
  apiKey: string,
  sites: PortalSite[],
  fromMs: number,
  toMs: number,
): Promise<number> {
  let totalSeconds = 0;
  for (const site of sites) {
    if (!site.retellAgentId) continue;
    totalSeconds += await fetchAgentSeconds(apiKey, site.retellAgentId, fromMs, toMs);
  }
  return totalSeconds;
}
