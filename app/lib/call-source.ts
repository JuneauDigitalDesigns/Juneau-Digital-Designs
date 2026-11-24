import { siteFeature, type PortalSite } from "@jdd/schema";

/**
 * Where a site's calls are read from, for the calls, recording and transcript routes.
 *
 * - `live`: the receptionist is wired up, so the live base and agent.
 * - `past`: a site on the website plan that used to have the receptionist (B4, 24 Nov 2026:
 *   "Keep them viewable"). The live ids were cleared when it moved down, but the downgrade copied
 *   them to `callHistory` first, and the schema's `pastCalls` feature is ready only then. Read-only:
 *   nothing here writes, and the Inbox gives a past call no actions.
 * - `null`: no calls to show. The routes answer exactly as they did before.
 *
 * The two never overlap: `pastCalls` is `not-on-plan` while the site still has a receptionist.
 */
export type CallSource = { kind: "live" | "past"; baseId: string; agentId: string | null };

export function callSource(site: PortalSite): CallSource | null {
    if (siteFeature(site, "calls").state === "ready") {
        return { kind: "live", baseId: site.airtableBaseId as string, agentId: site.retellAgentId ?? null };
    }
    if (siteFeature(site, "pastCalls").state === "ready" && site.callHistory) {
        return {
            kind: "past",
            baseId: site.callHistory.airtableBaseId,
            agentId: site.callHistory.retellAgentId,
        };
    }
    return null;
}
