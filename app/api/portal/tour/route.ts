import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getPortalRatelimit } from "@/app/lib/portal-kv";
import { nextSeen } from "@/app/lib/portal-tour-seen";

export const runtime = "nodejs";

/**
 * Persist first-run tutorial progress on the Clerk user.
 *
 * State lives in `publicMetadata.tour` — client-readable (so the layout can decide whether to
 * auto-launch) but server-only-writable (so the browser can't forge "completed"). Per user, not
 * per account: each person who signs in gets taught once.
 *
 * Tours v2 (2026-11-12): `completed` is the welcome tour; `seen` lists the tab tours this person
 * has had (`portal-tour-seen.ts`). "Replay all tours" sends `resetSeen`, which clears `seen` so
 * every tab teaches again, and never touches `completed`: the welcome tour it replays is started
 * by hand, not by auto-launch.
 */

interface TourMeta {
    completed?: boolean;
    lastStepIndex?: number;
    seen?: string[];
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
        seen?: unknown;
        resetSeen?: unknown;
    };

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const prev = (user.publicMetadata?.tour ?? {}) as TourMeta;

    // "Seen" only ever goes one way. Nothing in the portal un-sees the tour (the Help button
    // replays it without re-arming auto-launch), so a stray `completed: false`, or a write that
    // raced past this one, must not bring it back on every visit.
    const tour: TourMeta = {
        completed: body.completed === true || prev.completed === true,
        lastStepIndex:
            typeof body.lastStepIndex === "number"
                ? body.lastStepIndex
                : (prev.lastStepIndex ?? 0),
        seen: nextSeen(prev.seen, body.seen, body.resetSeen === true),
        updatedAt: new Date().toISOString(),
    };

    // Spread existing publicMetadata so other keys (if any) survive this write.
    await client.users.updateUserMetadata(userId, {
        publicMetadata: { ...user.publicMetadata, tour },
    });

    return NextResponse.json({ ok: true, tour });
}
