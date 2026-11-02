import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getPortalRatelimit } from "@/app/lib/portal-kv";

export const runtime = "nodejs";

/**
 * Persist first-run tutorial progress on the Clerk user.
 *
 * State lives in `publicMetadata.tour` — client-readable (so the layout can decide whether to
 * auto-launch) but server-only-writable (so the browser can't forge "completed"). Per user, not
 * per account: each person who signs in gets taught once.
 */

interface TourMeta {
    completed?: boolean;
    lastStepIndex?: number;
    updatedAt?: string;
}

export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = await getPortalRatelimit().limit(userId);
    if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as {
        completed?: unknown;
        lastStepIndex?: unknown;
    };

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const prev = (user.publicMetadata?.tour ?? {}) as TourMeta;

    const tour: TourMeta = {
        completed: typeof body.completed === "boolean" ? body.completed : (prev.completed ?? false),
        lastStepIndex:
            typeof body.lastStepIndex === "number"
                ? body.lastStepIndex
                : (prev.lastStepIndex ?? 0),
        updatedAt: new Date().toISOString(),
    };

    // Spread existing publicMetadata so other keys (if any) survive this write.
    await client.users.updateUserMetadata(userId, {
        publicMetadata: { ...user.publicMetadata, tour },
    });

    return NextResponse.json({ ok: true, tour });
}
