import { NextResponse } from "next/server";
import { upsertSite } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveAccount } from "@/app/lib/account-store";
import { writeFeaturedRequest, deleteFeaturedRequest } from "@/app/lib/cancel-kv";

export const runtime = "nodejs";

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

    const { optIn, quote, showName, showLink } = body as Record<string, unknown>;

    if (typeof optIn !== "boolean") {
        return NextResponse.json({ error: "optIn must be boolean" }, { status: 400 });
    }

    const now = Date.now();

    if (!optIn) {
        // Revoke consent — clear the featured field and remove the signal.
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

    await writeFeaturedRequest({
        slug: ctx.site.slug,
        siteName: ctx.site.name ?? ctx.site.slug,
        siteUrl: ctx.site.canonical,
        accountEmail: ctx.account.email,
        optedInAt: featuredData.optedInAt,
        quote: quoteStr,
        showName: showNameBool,
        showLink: showLinkBool,
    }).catch(() => {});

    return NextResponse.json({ ok: true, featured: featuredData });
}
