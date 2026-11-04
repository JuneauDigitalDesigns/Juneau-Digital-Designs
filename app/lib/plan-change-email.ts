import "server-only";
import { Resend } from "resend";
import { brandedEmailHtml } from "./email-template";
import { EMAIL, EMAIL_FONT } from "./email-tokens";
import { SCHEDULES } from "./legal/schedules";
import type { PlanSlug } from "./agreement-types";

/**
 * The two client emails a scheduled downgrade sends. Wording approved word for word by Xander on
 * 2026-11-04; change it only with his OK.
 *
 *   1. The accept link, sent when Xander schedules the downgrade from the console on the client's
 *      written request. Contract v5.3 §15.2: the client accepts a new agreement for the new plan.
 *   2. The confirmation, sent once they have accepted and the Stripe schedule exists.
 *
 * Neither throws: the request or the schedule has already been recorded by the time they run,
 * and a mail failure must not turn that into an error. Both log their own failures.
 */

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** "$197 a month" or "$1,970 a year": the price of the new plan on the period that carries over. */
export function pricePerPeriod(plan: PlanSlug, interval: "month" | "year"): string {
    const s = SCHEDULES[plan];
    return interval === "year" ? `${money(s.annualPrice)} a year` : `${money(s.monthlyPrice)} a month`;
}

function paragraph(html: string): string {
    return `<p style="margin:0 0 16px;color:${EMAIL.ink};font-size:15px;line-height:1.6;">${html}</p>`;
}

function button(href: string, label: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:${EMAIL.accent};border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:11px 20px;color:${EMAIL.card};font-family:${EMAIL_FONT.body};font-size:14px;font-weight:600;text-decoration:none;">${label}</a>
    </td></tr></table>`;
}

async function send(to: string, subject: string, html: string, tag: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn(`[plan-change-email] RESEND_API_KEY not set, ${tag} not sent to`, to);
        return;
    }
    const from = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";
    // Both emails ask the client to reply, so the reply has to reach Xander.
    const replyTo = process.env.QUOTE_TO_EMAIL;
    try {
        const { error } = await new Resend(apiKey).emails.send({
            from,
            to: [to],
            subject,
            html,
            ...(replyTo ? { replyTo } : {}),
        });
        if (error) console.error(`[plan-change-email] ${tag} rejected`, to, error);
    } catch (e) {
        console.error(`[plan-change-email] ${tag} failed`, to, e);
    }
}

export interface DowngradeEmailInput {
    to: string;
    siteName: string;
    fromPlan: PlanSlug;
    toPlan: PlanSlug;
    effectiveAt: number;
    interval: "month" | "year";
}

/** The accept-link email. `acceptUrl` is the signing page for the lower plan. */
export function downgradeAcceptEmail(input: DowngradeEmailInput & { acceptUrl: string }): {
    subject: string;
    html: string;
} {
    const from = SCHEDULES[input.fromPlan].name;
    const to = SCHEDULES[input.toPlan].name;
    const date = formatDate(input.effectiveAt);
    const subject = `Your move to ${to}: please accept the terms`;
    const body =
        paragraph(
            `You asked to move ${input.siteName} from ${from} to ${to}. Before we make the change, please read and accept the ${to} service agreement.`,
        ) +
        button(input.acceptUrl, "Review and accept") +
        paragraph(
            `Once you accept, your plan changes on ${date}, at the end of the ${input.interval} you've already paid for. Nothing changes before then. If you didn't ask for this, reply to this email and we'll leave your plan as it is.`,
        );
    return { subject, html: brandedEmailHtml({ title: subject, subtitle: input.siteName, body }) };
}

/** The confirmation, once the client has accepted and the change is scheduled. */
export function downgradeConfirmedEmail(input: DowngradeEmailInput): { subject: string; html: string } {
    const from = SCHEDULES[input.fromPlan].name;
    const to = SCHEDULES[input.toPlan].name;
    const date = formatDate(input.effectiveAt);
    const subject = `Your plan change to ${to}`;
    const body = paragraph(
        `Your plan changes from ${from} to ${to} on ${date}, at the end of the ${input.interval} you've already paid for. Until then nothing changes. From ${date} you're billed ${pricePerPeriod(input.toPlan, input.interval)}. Your number, receptionist and call history all stay. Questions? Reply to this email.`,
    );
    return { subject, html: brandedEmailHtml({ title: subject, subtitle: input.siteName, body }) };
}

export async function sendDowngradeAcceptEmail(input: DowngradeEmailInput & { acceptUrl: string }): Promise<void> {
    const { subject, html } = downgradeAcceptEmail(input);
    await send(input.to, subject, html, "downgrade accept link");
}

export async function sendDowngradeConfirmedEmail(input: DowngradeEmailInput): Promise<void> {
    const { subject, html } = downgradeConfirmedEmail(input);
    await send(input.to, subject, html, "downgrade confirmation");
}
