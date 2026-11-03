import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
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

/**
 * Fails closed, same as plan-sync. Consent records carry IP addresses and phone numbers; an
 * unset secret must never read as "no check required".
 */
function authorize(request: Request): NextResponse | null {
  return authorizeOps(request, "OPS_SHARED_SECRET", "ops/sms-consent");
}
