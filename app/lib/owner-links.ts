import "server-only";
import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";
import { accountScope } from "./portal-kv";

/**
 * Links in the owner's texts that open the portal on that one lead.
 *
 * ── Switched OFF until Twilio approves ──────────────────────────────────────────────────────
 * JDD's ACCOUNT_NOTIFICATION campaign is registered `has_embedded_links: false`, and an approved
 * campaign can't be edited from our side. A text carrying a link before that registration
 * changes is a text the campaign never declared, which is exactly what carriers filter. So
 * `OWNER_TEXT_LINKS=on` is the only value that adds one. Unset, or anything else, and both
 * owner texts are today's, byte for byte. The wording these produce is the sample set in
 * jdd-ops/TWILIO-SUPPORT-campaign-update.md, which is what the campaign will be re-vetted against.
 *
 * ── The link ────────────────────────────────────────────────────────────────────────────────
 * `https://www.juneaudigitaldesigns.com/portal/l/<8 chars>`. Always `www`: the apex 307-redirects,
 * and a registered sample naming one host while texts carry another is a mismatch a reviewer
 * can flag. Never a shortener — the campaign declares our own domain.
 *
 * The id is ours, random and opaque, never anything a stranger typed. It maps (in KV) to the
 * account, site and Inbox item, so the text never carries a record id, a phone number or a name
 * in its URL. Possession of the link grants nothing: `/portal/l/[id]` is behind sign-in and
 * opens only for the account the link was made for.
 */

export const OWNER_TEXT_ORIGIN = "https://www.juneaudigitaldesigns.com";
export const OWNER_LINK_ID = /^[A-Za-z0-9]{8}$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** Long enough to cover a slow week's follow-up; short enough that dead links don't pile up. */
const LINK_TTL_SECONDS = 60 * 60 * 24 * 180;

export function ownerTextLinksEnabled(env: Record<string, string | undefined> = process.env): boolean {
    return env.OWNER_TEXT_LINKS?.trim() === "on";
}

/** The URL a text carries. Throws on anything but a well-formed id — a link is never improvised. */
export function ownerLinkUrl(id: string): string {
    if (!OWNER_LINK_ID.test(id)) throw new Error("owner link id must be 8 alphanumerics");
    return `${OWNER_TEXT_ORIGIN}/portal/l/${id}`;
}

/** Where a resolved link lands: the Inbox, opened on that item (`?open=`, agreed with the CRM work). */
export function portalOpenPath({ slug, itemId }: { slug: string; itemId: string }): string {
    return `/portal/calls?site=${encodeURIComponent(slug)}&open=${encodeURIComponent(itemId)}`;
}

/** What any link that doesn't resolve for THIS viewer opens: the plain Inbox. Same for "missing" and "not yours". */
export const OWNER_LINK_FALLBACK_PATH = "/portal/calls";

function newId(): string {
    // 62^8 ≈ 2.2e14. Rejection-free mapping: 256 % 62 = 8 adds a slight bias, irrelevant here
    // since the id is not a secret — sign-in and the account check are the protection.
    return [...randomBytes(8)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) {
        if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
            throw new Error("Vercel KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN");
        }
        _redis = Redis.fromEnv();
    }
    return _redis;
}

const linkKey = (id: string) => `portal:owner-link:v1:${id}`;

export interface OwnerLinkRecord {
    acctScope: string;
    slug: string;
    /** The Inbox item id, exactly `InboxItem.id`: `lead:<leadId>` or an Airtable `rec…`. */
    itemId: string;
    createdAt: string;
}

/** Inbox item ids we will point a link at. Anything else is refused rather than stored. */
// leadIds are UUID v4 today (portal-leads.ts: randomUUID()). Loose on purpose: a too-tight bound would
// silently drop a real lead's link, while a junk id only ever resolves to the plain Inbox.
export const INBOX_ITEM_ID = /^(lead:[A-Za-z0-9_-]{1,200}|rec[A-Za-z0-9]{14})$/;

/**
 * Mint the URL for one owner text, or `null` when no link should be sent: the switch is off, the
 * item id is missing or malformed, or KV refused the write. **Never throws** — a caller falls
 * back to today's text, so a link problem can never cost the owner the alert itself.
 */
export async function ownerItemLink({
    acctScope,
    slug,
    itemId,
}: {
    acctScope: string;
    slug: string;
    itemId: string | null | undefined;
}): Promise<string | null> {
    if (!ownerTextLinksEnabled()) return null;
    if (!itemId || !INBOX_ITEM_ID.test(itemId)) return null;
    const record: OwnerLinkRecord = { acctScope, slug, itemId, createdAt: new Date().toISOString() };
    try {
        for (let attempt = 0; attempt < 3; attempt++) {
            const id = newId();
            const set = await getRedis().set(linkKey(id), record, { nx: true, ex: LINK_TTL_SECONDS });
            if (set === "OK") return ownerLinkUrl(id);
        }
        console.error(`[owner-links] three id collisions in a row for ${slug}; sending without a link`);
        return null;
    } catch (e) {
        console.error(`[owner-links] could not mint a link for ${slug}; sending without a link`, e);
        return null;
    }
}

/**
 * Where `/portal/l/[id]` sends this viewer. The item, if the link exists AND was made for the
 * viewer's own account AND that account still has the site; otherwise the fallback, identically,
 * so the response never tells a viewer whether an id exists or whose it is.
 */
export async function resolveOwnerLink({
    id,
    viewer,
}: {
    id: string;
    viewer: { email: string; sites: { slug: string }[] } | null;
}): Promise<string> {
    if (!viewer || !OWNER_LINK_ID.test(id)) return OWNER_LINK_FALLBACK_PATH;
    let rec: OwnerLinkRecord | null = null;
    try {
        rec = await getRedis().get<OwnerLinkRecord>(linkKey(id));
    } catch (e) {
        console.error("[owner-links] link lookup failed", e);
        return OWNER_LINK_FALLBACK_PATH;
    }
    if (!rec) return OWNER_LINK_FALLBACK_PATH;
    if (rec.acctScope !== accountScope(viewer.email)) return OWNER_LINK_FALLBACK_PATH;
    if (!viewer.sites.some((s) => s.slug === rec.slug)) return OWNER_LINK_FALLBACK_PATH;
    if (!INBOX_ITEM_ID.test(rec.itemId)) return OWNER_LINK_FALLBACK_PATH;
    return portalOpenPath({ slug: rec.slug, itemId: rec.itemId });
}
