import "server-only";

/**
 * Minimal Vercel REST client for the portal's infra strip.
 *
 * Mirrors the shapes `jdd-ops/lib/vercel-sync.js` already normalises, reimplemented rather
 * than imported: jdd-ops is a sibling folder, not a workspace package, and this app's
 * tsconfig only aliases `@/*`. Keep the two in sync if the ops helpers change.
 *
 * Same auth pattern as app/api/portal/traffic/route.ts.
 */

const API = "https://api.vercel.com";
const TIMEOUT_MS = 6000;

export interface VercelDeployment {
    state: string | null;          // READY | BUILDING | ERROR | QUEUED | CANCELED
    readyAt: number | null;
    createdAt: number | null;
    target: string | null;         // "production" | "preview" | null
    commitSha: string | null;
    commitMessage: string | null;
}

export interface VercelDomain {
    name: string;
    apexName: string | null;
    verified: boolean;
}

/**
 * Is the portal able to talk to Vercel at all?
 *
 * Exported so callers can tell "we never configured this" apart from "Vercel said no" —
 * without that distinction every misconfiguration looks like an outage.
 */
export function hasVercelCredentials(): boolean {
    return Boolean(process.env.VERCEL_TOKEN);
}

function teamQuery(): string {
    const teamId = process.env.VERCEL_TEAM_ID;
    return teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";
}

async function vercelFetch<T>(path: string): Promise<T | null> {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
        console.error("[portal/vercel] VERCEL_TOKEN is not set");
        return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${API}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
            next: { revalidate: 0 },
        });
        if (!res.ok) {
            console.error(`[portal/vercel] ${path} → ${res.status}`);
            return null;
        }
        return (await res.json()) as T;
    } catch (e) {
        console.error(`[portal/vercel] ${path} failed`, e);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** The most recent production deployment, or null when it can't be determined. */
export async function latestDeployment(projectId: string): Promise<VercelDeployment | null> {
    const data = await vercelFetch<{ deployments?: RawDeployment[] }>(
        `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=1&target=production${teamQuery()}`,
    );
    const d = data?.deployments?.[0];
    if (!d) return null;

    return {
        state: d.state ?? d.readyState ?? null,
        readyAt: d.ready ?? null,
        createdAt: d.createdAt ?? d.created ?? null,
        target: d.target ?? null,
        commitSha: d.meta?.githubCommitSha ?? null,
        commitMessage: d.meta?.githubCommitMessage ?? null,
    };
}

/**
 * Production domains attached to the project.
 *
 * Filters out preview/branch domains and Vercel's own `*.vercel.app` host: a client cares
 * whether *their* domain is attached, and the platform host is always "verified", which
 * would make a genuinely misconfigured custom domain look fine.
 *
 * A site whose canonical genuinely *is* its `.vercel.app` URL is handled by the caller
 * (see `domainState` in portal-infra.ts) — that isn't a missing domain, it's the address.
 */
export async function projectDomains(projectId: string): Promise<VercelDomain[] | null> {
    const data = await vercelFetch<{ domains?: RawDomain[] }>(
        `/v9/projects/${encodeURIComponent(projectId)}/domains?limit=50${teamQuery()}`,
    );
    if (!data?.domains) return null;

    return data.domains
        .filter((d) => !d.gitBranch && !d.redirect && !d.name.endsWith(".vercel.app"))
        .map((d) => ({
            name: d.name,
            apexName: d.apexName ?? null,
            verified: d.verified === true,
        }));
}

/*
 * Deliberately absent: a `projectMeta` helper reading `analytics` off
 * `GET /v9/projects/{id}` to decide whether Web Analytics is on.
 *
 * That field reports the legacy Audiences product. It is `undefined` on projects that are
 * actively collecting Web Analytics — confirmed against a project simultaneously returning
 * real deviceType and browserName rows from the Web Analytics API. Trusting it marks healthy
 * clients as broken.
 *
 * Web Analytics state is inferred from the query response instead; see `reasonForStatus` in
 * portal-traffic.ts.
 */

interface RawDeployment {
    state?: string;
    readyState?: string;
    ready?: number;
    createdAt?: number;
    created?: number;
    target?: string | null;
    meta?: { githubCommitSha?: string; githubCommitMessage?: string };
}

interface RawDomain {
    name: string;
    apexName?: string;
    verified?: boolean;
    redirect?: string | null;
    gitBranch?: string | null;
}
