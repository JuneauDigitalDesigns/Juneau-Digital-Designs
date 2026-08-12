import "server-only";
import type { PortalSite } from "@jdd/schema";

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
 * Returns total seconds; divide by 60 and ceil to get billable minutes.
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
 * The sites on an account whose minutes count against its allowance.
 *
 * A site still in `pending-onboarding` has no agent answering anything yet, so metering it
 * would bill a client for a receptionist they don't have. Everything else with a provisioned
 * agent counts, including `building` — the agent is live on the phone number from the moment
 * onboard.js creates it, whether or not the website has finished deploying.
 */
export function voiceSitesOf(sites: PortalSite[]): PortalSite[] {
  return sites.filter(
    (s) =>
      (s.plan === "growth" || s.plan === "enterprise") &&
      s.retellAgentId &&
      s.status !== "pending-onboarding",
  );
}

/**
 * Billable minutes across every voice agent on an account, for one window.
 *
 * Enterprise pools its allowance across all of its sites, so this sums the agents rather
 * than reporting per-site. Rounding happens once, on the total — rounding each agent up
 * first would overcharge a 3-site client by up to two minutes a period.
 *
 * This is the single definition used by BOTH the billing cron and the portal. They must
 * never disagree: a client shown 300 minutes and invoiced for 400 is a support ticket that
 * ends in a refund.
 */
export async function sumAgentMinutes(
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
  return Math.ceil(totalSeconds / 60);
}
