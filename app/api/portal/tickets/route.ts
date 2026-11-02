import { NextResponse } from "next/server";
import {
  TICKET_CATEGORIES,
  createTicket,
  appendTicketMessage,
  applyTicketStatus,
  type TicketCategory,
} from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getTicket, listTicketsForScope, saveTicket, ticketStoreConfigured } from "@/app/lib/ticket-store";

export const runtime = "nodejs";

const SUBJECT_MAX = 200;
const BODY_MAX = 5000;

/** The only two status moves a client may make: reopen, or confirm a close. */
const CLIENT_ALLOWED_STATUS = new Set(["open", "closed"] as const);

function notConfigured() {
  return NextResponse.json(
    { error: "Support is temporarily unavailable. Please try again shortly." },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;
  if (!ticketStoreConfigured()) return notConfigured();

  try {
    const tickets = await listTicketsForScope(ctx.account.email, ctx.site.slug);
    return NextResponse.json({ tickets });
  } catch (e) {
    console.error("[portal/tickets] list failed", e);
    return NextResponse.json({ error: "We couldn't load your tickets just now." }, { status: 502 });
  }
}

interface CreateBody {
  subject?: string;
  category?: string;
  body?: string;
}

export async function POST(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;
  if (!ticketStoreConfigured()) return notConfigured();

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const messageBody = typeof body.body === "string" ? body.body.trim() : "";
  const category = body.category as TicketCategory | undefined;

  if (!subject) return NextResponse.json({ error: "A subject is required." }, { status: 400 });
  if (subject.length > SUBJECT_MAX) {
    return NextResponse.json({ error: "That subject is too long." }, { status: 400 });
  }
  if (!messageBody) return NextResponse.json({ error: "Please describe the issue." }, { status: 400 });
  if (messageBody.length > BODY_MAX) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  }
  if (!category || !(TICKET_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Please choose a category." }, { status: 400 });
  }

  // Identity is stamped server-side from the resolved context, never from the request body.
  const ticket = createTicket({
    id: crypto.randomUUID(),
    accountEmail: ctx.account.email,
    siteSlug: ctx.site.slug,
    subject,
    category,
    body: messageBody,
  });

  try {
    await saveTicket(ticket);
    return NextResponse.json({ ticket });
  } catch (e) {
    console.error("[portal/tickets] create failed", e);
    return NextResponse.json({ error: "We couldn't open that ticket just now." }, { status: 502 });
  }
}

interface PatchBody {
  id?: string;
  /** A reply the client adds to the thread. */
  message?: string;
  /** Reopen ('open') or confirm-close ('closed') only — any other value is rejected. */
  status?: string;
}

export async function PATCH(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;
  if (!ticketStoreConfigured()) return notConfigured();

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const wantsMessage = message.length > 0;
  const wantsStatus = body.status !== undefined;

  if (body.message !== undefined && !wantsMessage) {
    return NextResponse.json({ error: "A reply can't be empty." }, { status: 400 });
  }
  if (wantsMessage && message.length > BODY_MAX) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  }
  if (wantsStatus && !CLIENT_ALLOWED_STATUS.has(body.status as "open" | "closed")) {
    // Clients may only reopen or confirm-close; everything else is the operator's to set.
    return NextResponse.json({ error: "You can only reopen or close a ticket." }, { status: 400 });
  }
  if (!wantsMessage && !wantsStatus) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const existing = await getTicket(body.id);
  if (!existing) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  // Ownership: the ticket must belong to this account AND the resolved site. A mismatch is a
  // not-found to the client, never a hint that the ticket exists for someone else.
  if (existing.accountEmail !== ctx.account.email || existing.siteSlug !== ctx.site.slug) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  let next = existing;
  if (wantsMessage) next = appendTicketMessage(next, { author: "client", text: message });
  if (wantsStatus) next = applyTicketStatus(next, body.status as "open" | "closed");

  try {
    await saveTicket(next);
    return NextResponse.json({ ticket: next });
  } catch (e) {
    console.error("[portal/tickets] patch failed", e);
    return NextResponse.json({ error: "We couldn't save that just now." }, { status: 502 });
  }
}
