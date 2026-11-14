import "server-only";
import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import { accountScope } from "./portal-kv";
import { accountKey } from "./upload-guard";
import { factsNeeded, noticeFor, stageOf, type ClientFacts, type ClientJob, type ClientPhoto, type ClientReview, type Notice, type PageProposal } from "./page-additions";
import { listProposals, proposalKey, readProfile } from "./seo-store";
import type { SearchProfile } from "./seo-demand";

/**
 * KV for page additions in the portal. The proposal records are the nightly job's
 * (`jdd:seo:proposal:v1:…`); the portal adds the stage the client moves it to, when the client
 * first saw each notice, and the client's facts.
 *
 * Client facts are a CONTRACT with the console intake (intake-wizard session, 2026-11-14):
 *   jdd:seo:clientfacts:v1:{acct}:{slug}:{proposalId}   ClientFacts (page-additions.ts)
 *   jdd:seo:clientfacts:index:v1:{acct}:{slug}          zset of proposalIds by updatedAt (ms)
 * The console writes back only each item's `status` (accepted | rejected) and `decidedAt`, and
 * nothing ever deletes an item the client sent: a client decline never deletes facts.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

export const clientFactsKey = (acct: string, slug: string, id: string) => `jdd:seo:clientfacts:v1:${acct}:${slug}:${id}`;
export const clientFactsIndexKey = (acct: string, slug: string) => `jdd:seo:clientfacts:index:v1:${acct}:${slug}`;

/** Stages in which the client can add facts or decline (W112). */
const OPEN_TO_CLIENT = new Set(["waiting", "received"]);

export interface SiteNotice extends Notice {
    /** Enterprise: the site the page is for (one notice list per site, labelled). */
    siteName: string | null;
}

async function readFacts(acct: string, slug: string, id: string): Promise<ClientFacts | null> {
    return (await getRedis().get<ClientFacts>(clientFactsKey(acct, slug, id))) ?? null;
}

async function writeFacts(acct: string, slug: string, facts: ClientFacts): Promise<void> {
    await getRedis().set(clientFactsKey(acct, slug, facts.proposalId), facts);
    await getRedis().zadd(clientFactsIndexKey(acct, slug), { score: Date.parse(facts.updatedAt), member: facts.proposalId });
}

async function readProposal(acct: string, slug: string, id: string): Promise<PageProposal | null> {
    return (await getRedis().get<PageProposal>(proposalKey(acct, slug, id))) ?? null;
}

async function writeProposal(acct: string, slug: string, p: PageProposal): Promise<void> {
    await getRedis().set(proposalKey(acct, slug, p.id), p);
}

/**
 * The notices this site's portal shows now, newest first. Rendering one IS the client seeing it:
 * the first time a notice for a stage is shown, its `seen` is stamped, which starts the 7 days a
 * final notice stays (a client who never signs in never misses one).
 */
export async function siteNotices(account: PortalAccount, site: PortalSite, now = new Date()): Promise<SiteNotice[]> {
    const acct = accountScope(account.email);
    const profile = await readProfile(acct, site.slug);
    if (!profile) return [];
    const proposals = await listProposals(acct, site.slug);
    const siteName = account.sites.length > 1 ? (site.name ?? site.slug) : null;
    const out: Array<SiteNotice & { at: number }> = [];
    for (const p of proposals) {
        const stage = stageOf(p);
        const facts = OPEN_TO_CLIENT.has(stage) ? await readFacts(acct, site.slug, p.id) : null;
        const notice = noticeFor({ proposal: p, profile, facts, now });
        if (!notice) continue;
        if (!p.seen || p.seen.stage !== notice.stage) {
            await writeProposal(acct, site.slug, { ...p, seen: { stage: notice.stage, at: now.toISOString() } }).catch(() => {});
        }
        out.push({ ...notice, siteName, at: Date.parse(p.stageAt ?? p.decidedAt ?? p.createdAt) });
    }
    return out.sort((a, b) => b.at - a.at);
}

export interface WizardData {
    proposal: PageProposal;
    profile: SearchProfile;
    facts: ClientFacts;
    serviceName: string | null;
    needed: number;
}

/** What the wizard needs, or null when this page isn't waiting for the client. */
export async function wizardData(account: PortalAccount, site: PortalSite, id: string): Promise<WizardData | null> {
    const acct = accountScope(account.email);
    const [profile, proposal] = await Promise.all([readProfile(acct, site.slug), readProposal(acct, site.slug, id)]);
    if (!profile || !proposal || !OPEN_TO_CLIENT.has(stageOf(proposal))) return null;
    const facts = (await readFacts(acct, site.slug, id)) ?? emptyFacts(proposal, site.slug);
    return {
        proposal,
        profile,
        facts,
        serviceName: proposal.service ? (profile.services.find((s) => s.slug === proposal.service)?.name ?? proposal.service) : null,
        needed: factsNeeded({ proposal, profile, facts }),
    };
}

function emptyFacts(p: PageProposal, slug: string): ClientFacts {
    return { v: 1, proposalId: p.id, siteSlug: slug, town: p.town, service: p.service ?? null, updatedAt: new Date(0).toISOString(), submittedAt: null, photos: [], reviews: [], jobs: [] };
}

export interface FactsInput {
    photos?: Array<{ id?: string; url?: unknown; filename?: unknown; town?: unknown }>;
    reviews?: Array<{ id?: string; text?: unknown; name?: unknown; verbatim?: unknown; town?: unknown }>;
    job?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/**
 * Save the client's facts, and on `submit` hand them to JDD. Items already sent are kept exactly
 * as they are (the console decides them); items not yet sent can be edited or removed. A photo must
 * be one of this account's own uploads for this site, from the same upload route onboarding uses;
 * a review must carry the word-for-word tick; a town must be one of the client's towns.
 */
export async function saveFacts(
    account: PortalAccount,
    site: PortalSite,
    id: string,
    input: FactsInput,
    { submit, now = new Date() }: { submit: boolean; now?: Date },
): Promise<{ ok: true; needed: number; stage: string } | { ok: false; status: number; error: string }> {
    const acct = accountScope(account.email);
    const data = await wizardData(account, site, id);
    if (!data) return { ok: false, status: 409, error: "Not open" };
    const { proposal, profile } = data;
    const prev = data.facts;
    const at = now.toISOString();
    const sent = (addedAt: string) => Boolean(prev.submittedAt) && addedAt <= (prev.submittedAt as string);
    const towns = new Map(profile.towns.map((t) => [t.name.toLowerCase(), t.name]));
    const townOf = (v: unknown) => towns.get(str(v, 120).toLowerCase()) ?? null;
    const service = proposal.service ?? null;
    const blobPrefix = `/onboarding/${accountKey(account.email)}/${site.slug}/`;
    const ownBlob = (u: string) => {
        try {
            const url = new URL(u);
            return url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com") && url.pathname.startsWith(blobPrefix);
        } catch {
            return false;
        }
    };

    const keepSent = <T extends { addedAt: string }>(items: T[]) => items.filter((f) => sent(f.addedAt));
    const prior = <T extends { id: string; addedAt: string }>(items: T[], i?: string) => items.find((f) => f.id === i && !sent(f.addedAt));

    const photos: ClientPhoto[] = keepSent(prev.photos);
    for (const p of (input.photos ?? []).slice(0, 12)) {
        if (prev.photos.some((f) => f.id === p.id && sent(f.addedAt))) continue;
        const url = str(p.url, 600);
        const town = townOf(p.town);
        if (!ownBlob(url) || !town) continue;
        const was = prior(prev.photos, p.id);
        photos.push({ id: was?.id ?? randomUUID(), url, filename: str(p.filename, 200), alt: "", town, service, addedAt: was?.addedAt ?? at, status: "pending" });
    }

    const reviews: ClientReview[] = keepSent(prev.reviews);
    for (const r of (input.reviews ?? []).slice(0, 12)) {
        if (prev.reviews.some((f) => f.id === r.id && sent(f.addedAt))) continue;
        const text = typeof r.text === "string" ? r.text.trim().slice(0, 2000) : "";
        const town = townOf(r.town) ?? proposal.town;
        if (!text || r.verbatim !== true) continue;
        const was = prior(prev.reviews, r.id);
        reviews.push({ id: was?.id ?? randomUUID(), text, name: str(r.name, 60) || null, town, service, verbatim: true, addedAt: was?.addedAt ?? at, status: "pending" });
    }

    const jobs: ClientJob[] = keepSent(prev.jobs);
    const jobText = typeof input.job === "string" ? input.job.trim().slice(0, 1500) : "";
    const unsentJob = prev.jobs.find((j) => !sent(j.addedAt));
    if (jobText) jobs.push({ id: unsentJob?.id ?? randomUUID(), text: jobText, town: proposal.town, service, addedAt: unsentJob?.addedAt ?? at, status: "pending" });

    const facts: ClientFacts = { ...prev, photos, reviews, jobs, updatedAt: at, submittedAt: submit ? at : prev.submittedAt };
    await writeFacts(acct, site.slug, facts);

    const needed = factsNeeded({ proposal, profile, facts });
    let stage = stageOf(proposal);
    if (submit && needed === 0 && stage === "waiting") {
        stage = "received";
        await writeProposal(acct, site.slug, { ...proposal, stage, stageAt: at });
    }
    return { ok: true, needed, stage };
}

/** "I don't want this page" (W112): the page pauses for JDD to follow up. Facts already sent stay. */
export async function declinePage(
    account: PortalAccount,
    site: PortalSite,
    id: string,
    reason: unknown,
    now = new Date(),
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const acct = accountScope(account.email);
    const proposal = await readProposal(acct, site.slug, id);
    if (!proposal || !OPEN_TO_CLIENT.has(stageOf(proposal))) return { ok: false, status: 409, error: "Not open" };
    const at = now.toISOString();
    await writeProposal(acct, site.slug, {
        ...proposal,
        stage: "paused",
        stageAt: at,
        clientDecline: { at, reason: typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 500) : null },
    });
    return { ok: true };
}
