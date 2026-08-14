import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  getConsentLog,
  getConsentState,
  getConsentStateForAccount,
  normalizeE164,
} from "@/app/lib/sms-consent";

export const runtime = "nodejs";

/**
 * Consent proof lookup for the ops console.
 *
 * Read-only by design. This is the route you hit when a carrier or a client asks "why did
 * you text this number", and the answer has to be the record exactly as stored. A route
 * that could also write would make its own output less trustworthy.
 */
export async function GET(request: Request) {
  const gate = authorize(request);
  if (gate) return gate;

  const url = new URL(request.url);
  const phoneParam = url.searchParams.get("phone")?.trim();
  const email = url.searchParams.get("email")?.trim();

  if (!phoneParam && !email) {
    return NextResponse.json({ error: "phone or email is required." }, { status: 400 });
  }

  // An email lookup resolves to whatever number that account currently has, then reads the
  // number's log. Consent lives against a phone number, not an account: the number is what
  // gets texted and what a complaint would name.
  let phone = phoneParam ? normalizeE164(phoneParam) : null;
  if (!phone && email) {
    const state = await getConsentStateForAccount(email);
    phone = state?.phone ?? null;
  }

  if (!phone) {
    return NextResponse.json(
      { ok: true, found: false, state: null, events: [] },
      { status: 200 },
    );
  }

  const [state, events] = await Promise.all([getConsentState(phone), getConsentLog(phone)]);

  return NextResponse.json({
    ok: true,
    found: events.length > 0,
    phone,
    state,
    events,
  });
}

function authorize(request: Request): NextResponse | null {
  const expected = process.env.OPS_SHARED_SECRET;
  if (!expected) {
    // Fail closed, same as plan-sync. Consent records carry IP addresses and phone
    // numbers; an unset secret must never read as "no check required".
    console.error("[ops/sms-consent] OPS_SHARED_SECRET is not set — refusing");
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-ops-secret"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Constant-time compare so the secret can't be probed a byte at a time. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
