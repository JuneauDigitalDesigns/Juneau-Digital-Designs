import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getPortalRatelimit } from "@/app/lib/portal-kv";
import { isTourDevice, nextTour } from "@/app/lib/portal-tour-seen";

export const runtime = "nodejs";

/**
 * Remember how far a person got with the portal tour, on a computer or on a phone.
 *
 * Stored in Clerk `publicMetadata.tour` (`app/lib/portal-tour-seen.ts`): readable by the layout,
 * which decides on the server whether the tour starts by itself, but writable only here, so a
 * browser can't forge "seen". One flag per device, per person: the tour plays once on a computer
 * and once on a phone, for everyone who signs in (Xander, 19 Nov 2026).
 *
 * Body: `{ device: "desktop" | "mobile", completed?: true, step?: number }`.
 */
export async function POST(request: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = await getPortalRatelimit().limit(userId);
    if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as { device?: unknown; completed?: unknown; step?: unknown };
    if (!isTourDevice(body.device)) {
        return NextResponse.json({ error: "Unknown device" }, { status: 400 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const tour = nextTour(user.publicMetadata?.tour, { device: body.device, completed: body.completed, step: body.step }, new Date().toISOString());

    // Spread existing publicMetadata so other keys survive this write.
    await client.users.updateUserMetadata(userId, {
        publicMetadata: { ...user.publicMetadata, tour },
    });

    return NextResponse.json({ ok: true, tour });
}
