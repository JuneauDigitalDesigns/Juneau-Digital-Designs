import "server-only";
import type { PortalSite } from "@jdd/schema";
import { latestDeployment, projectDomains, hasVercelCredentials } from "./portal-vercel";
import { probeUrl } from "./portal-probe";
import { getCached, setCached, INFRA_TTL, infraKey, accountScope } from "./portal-kv";
import { describeReason, type FailureReason } from "./portal-failure";

/**
 * The Overview health strip's data.
 *
 * Every segment carries its own state. A client whose Vercel project id was never recorded
 * should still see that their site is up — one missing credential must not blank the whole
 * strip, which is why this is `allSettled` over independent sources rather than one
 * transaction. "unknown" means *we* couldn't measure it, and the UI says so; it never
 * renders as a problem with the client's site.
 */

export type SegmentState = "ok" | "warn" | "down" | "pending" | "unknown";

export interface InfraSnapshot {
    site: {
        state: SegmentState;
        url: string | null;
        status: number | null;
        ms: number | null;
    };
    deploy: {
        state: SegmentState;
        readyAt: number | null;
        raw: string | null;
        commitMessage: string | null;
    };
    domain: {
        state: SegmentState;
        name: string | null;
        verified: boolean | null;
    };
    /**
     * Operator-facing. False means the portal has no `VERCEL_TOKEN`, so deploy and domain
     * are "unknown" because we never asked — not because anything is wrong with the site.
     * Without this, a missing credential is indistinguishable from a Vercel outage.
     */
    credentialsConfigured: boolean;
    fetchedAt: number;
}

export async function getInfraSnapshot(
    site: PortalSite,
    accountEmail: string,
): Promise<InfraSnapshot> {
    const key = infraKey(accountScope(accountEmail), site.slug);
    const cached = await getCached<InfraSnapshot>(key);
    if (cached) return cached;

    const canonical = site.canonical?.trim() || null;
    const projectId = site.vercelProjectId ?? null;
    const configured = hasVercelCredentials();

    if (!configured && projectId) {
        console.error(
            `[portal/infra] ${site.slug} ${"not-configured" satisfies FailureReason}: ` +
                describeReason("not-configured"),
        );
    }

    const [probe, deployment, domains] = await Promise.allSettled([
        canonical ? probeUrl(canonical) : Promise.resolve(null),
        projectId ? latestDeployment(projectId) : Promise.resolve(null),
        projectId ? projectDomains(projectId) : Promise.resolve(null),
    ]);

    const probeVal = probe.status === "fulfilled" ? probe.value : null;
    const deployVal = deployment.status === "fulfilled" ? deployment.value : null;
    const domainVal = domains.status === "fulfilled" ? domains.value : null;

    const building = site.status === "building" || site.status === "pending-onboarding";

    const snapshot: InfraSnapshot = {
        site: {
            state: !canonical
                ? building
                    ? "pending"
                    : "unknown"
                : probeVal === null
                  ? "unknown"
                  : probeVal.ok
                    ? "ok"
                    : "down",
            url: canonical,
            status: probeVal?.status ?? null,
            ms: probeVal?.ms ?? null,
        },
        deploy: {
            state: deployStateOf(deployVal?.state ?? null, building),
            readyAt: deployVal?.readyAt ?? deployVal?.createdAt ?? null,
            raw: deployVal?.state ?? null,
            commitMessage: deployVal?.commitMessage ?? null,
        },
        domain: domainState(domainVal, building, canonical),
        credentialsConfigured: configured,
        fetchedAt: Date.now(),
    };

    await setCached(key, INFRA_TTL, snapshot);
    return snapshot;
}

function deployStateOf(raw: string | null, building: boolean): SegmentState {
    if (!raw) return building ? "pending" : "unknown";
    switch (raw.toUpperCase()) {
        case "READY":
            return "ok";
        case "BUILDING":
        case "QUEUED":
        case "INITIALIZING":
            return "pending";
        case "ERROR":
            return "down";
        case "CANCELED":
            return "warn";
        default:
            return "unknown";
    }
}

function domainState(
    domains: Awaited<ReturnType<typeof projectDomains>>,
    building: boolean,
    canonical: string | null,
): InfraSnapshot["domain"] {
    if (!domains) return { state: building ? "pending" : "unknown", name: null, verified: null };

    if (domains.length === 0) {
        // No *custom* domain — but if the site's canonical is its own .vercel.app URL, that
        // isn't a missing domain, it's the address the site actually lives at. Reporting it
        // as "not attached" would flag a correctly-deployed site as a problem.
        const host = hostOf(canonical);
        if (host?.endsWith(".vercel.app")) {
            return { state: "ok", name: host, verified: true };
        }
        // A custom canonical with nothing attached is a real gap. During a build it isn't.
        return { state: building ? "pending" : "warn", name: null, verified: false };
    }

    // Prefer the apex/primary for display; report a warning if *any* attached domain is
    // unverified, since a half-verified setup is the case worth surfacing.
    const primary = domains.find((d) => d.apexName === d.name) ?? domains[0];
    const allVerified = domains.every((d) => d.verified);

    return {
        state: allVerified ? "ok" : "warn",
        name: primary.name,
        verified: allVerified,
    };
}

/** Bare host from a canonical URL, tolerating values stored without a scheme. */
function hostOf(canonical: string | null): string | null {
    if (!canonical) return null;
    try {
        return new URL(canonical).hostname.toLowerCase() || null;
    } catch {
        return canonical.replace(/^https?:\/\//, "").split("/")[0].toLowerCase() || null;
    }
}
