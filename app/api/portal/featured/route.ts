import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { upsertSite } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveAccount } from "@/app/lib/account-store";
import { writeFeaturedRequest, deleteFeaturedRequest, getFeaturedRequestRecord } from "@/app/lib/cancel-kv";
import { isValidBlobUrl } from "@/app/lib/blob-url";
import { resolveShotUrl, captureScreenshot } from "@/app/lib/screenshot";
import { resizeToCard } from "@/app/lib/image-resize";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    if (!ctx.site.featured) {
        return NextResponse.json({ featured: null });
    }

    const record = await getFeaturedRequestRecord(ctx.site.slug).catch(() => null);
    return NextResponse.json({
        featured: {
            ...ctx.site.featured,
            image: record?.image ?? null,
            imageMode: record?.imageMode ?? null,
        },
    });
}

export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const { optIn, quote, showName, showLink, image, imageMode } = body as Record<string, unknown>;

    if (typeof optIn !== "boolean") {
        return NextResponse.json({ error: "optIn must be boolean" }, { status: 400 });
    }

    const now = Date.now();

    if (!optIn) {
        // Revoke consent — clear the featured field and remove the signal, which drops any
        // image on file along with it. A later opt-in therefore starts fresh, including a
        // fresh capture/upload — this is the intended way to change the image.
        const updated = upsertSite(ctx.account, { slug: ctx.site.slug, featured: undefined }, now);
        await saveAccount(updated);
        await deleteFeaturedRequest(ctx.site.slug).catch(() => {});
        return NextResponse.json({ ok: true, featured: null });
    }

    const quoteStr = typeof quote === "string" ? quote.trim().slice(0, 300) : undefined;
    const showNameBool = showName !== false;
    // Anonymous listings are never linked, whatever the payload says — name and link move
    // together. This is the server-side half of the portal's single Credit/Anonymous choice.
    const showLinkBool = showNameBool && showLink !== false;

    const featuredData = {
        optedInAt: ctx.site.featured?.optedInAt ?? now,
        quote: quoteStr || undefined,
        showName: showNameBool,
        showLink: showLinkBool,
    };

    const updated = upsertSite(ctx.account, { slug: ctx.site.slug, featured: featuredData }, now);
    await saveAccount(updated);

    // Whether this is a brand-new opt-in or an edit (quote/credit change) to one already on
    // file — `ctx.site.featured` reflects the account record's state from *before* this
    // request's upsertSite call above. Only a fresh opt-in ever sources or overwrites the
    // image: this is the re-submission guard documented on FeaturedRequestRecord.image. A
    // client who re-saves their quote a dozen times must never re-trigger a screenshot
    // capture or a fresh upload write — they change the image by opting out and back in.
    const isFreshOptIn = !ctx.site.featured;

    let imageUrl: string | undefined;
    let resolvedImageMode: "upload" | "auto" | undefined;

    if (!isFreshOptIn) {
        // Edit — carry the existing image/mode forward untouched.
        const existing = await getFeaturedRequestRecord(ctx.site.slug).catch(() => null);
        imageUrl = existing?.image;
        resolvedImageMode = existing?.imageMode;
    } else if (imageMode === "upload") {
        resolvedImageMode = "upload";
        const candidate = typeof image === "string" ? image.trim() : "";
        // A missing/invalid upload URL isn't fatal — the opt-in still succeeds with no
        // image on file, and the operator can supply one at publish time.
        if (candidate && isValidBlobUrl(candidate)) {
            imageUrl = candidate;
        }
    } else {
        resolvedImageMode = "auto";
        const shotTarget = resolveShotUrl(ctx.site.canonical);
        if (shotTarget) {
            try {
                const { bytes: rawBytes } = await captureScreenshot(shotTarget);
                // Microlink's capture is a full 1280x800 viewport shot; resize to the card's
                // own footprint before it ever reaches Blob storage, both to shrink what
                // gets stored and to keep the optimizer from having to process it later.
                const { bytes, contentType } = await resizeToCard(rawBytes);
                const blob = await put(`featured/${ctx.site.slug}`, bytes, {
                    access: "public",
                    addRandomSuffix: true,
                    contentType,
                });
                imageUrl = blob.url;
            } catch {
                // Auto-capture is best-effort — Microlink's free tier can fail or
                // rate-limit, or the site may not resolve yet. The opt-in still saves with
                // no image; the console can capture or accept an upload at publish time.
            }
        }
    }

    await writeFeaturedRequest({
        slug: ctx.site.slug,
        siteName: ctx.site.name ?? ctx.site.slug,
        siteUrl: ctx.site.canonical,
        accountEmail: ctx.account.email,
        optedInAt: featuredData.optedInAt,
        quote: quoteStr,
        showName: showNameBool,
        showLink: showLinkBool,
        image: imageUrl,
        imageMode: resolvedImageMode,
    }).catch(() => {});

    return NextResponse.json({
        ok: true,
        featured: featuredData,
        image: imageUrl ?? null,
        imageMode: resolvedImageMode ?? null,
    });
}
