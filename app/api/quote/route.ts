import { NextResponse } from "next/server";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const toEmail = process.env.QUOTE_TO_EMAIL;
const fromEmail = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY;

type QuotePayload = {
    fullName?: string;
    businessName?: string;
    email?: string;
    phone?: string;
    services?: string;
    budget?: string;
    timeline?: string;
    projectDetails?: string;
    website?: string;
    consent?: boolean;
    turnstileToken?: string;
};

type TurnstileVerifyResponse = {
    success: boolean;
    "error-codes"?: string[];
};

type TurnstileVerificationResult = {
    success: boolean;
    errorCodes: string[];
};

const maxFieldLength = 2000;

function sanitize(value: unknown, limit = maxFieldLength): string {
    if (typeof value !== "string") {
        return "";
    }

    return value.trim().slice(0, limit);
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function verifyTurnstileToken(token: string, remoteIp: string): Promise<TurnstileVerificationResult> {
    if (!turnstileSecretKey) {
        return { success: false, errorCodes: ["missing-input-secret"] };
    }

    const payload = new URLSearchParams({
        secret: turnstileSecretKey,
        response: token,
    });

    if (remoteIp) {
        payload.set("remoteip", remoteIp);
    }

    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
    });

    if (!verifyResponse.ok) {
        return { success: false, errorCodes: ["verification-request-failed"] };
    }

    const verifyResult = (await verifyResponse.json()) as TurnstileVerifyResponse;
    return {
        success: Boolean(verifyResult.success),
        errorCodes: verifyResult["error-codes"] || [],
    };
}

export async function POST(request: Request) {
    try {
        if (!resend || !toEmail || !turnstileSecretKey) {
            return NextResponse.json(
                {
                    message: "Server is not configured for quote requests yet.",
                },
                { status: 500 }
            );
        }

        const body = (await request.json()) as QuotePayload;

        const fullName = sanitize(body.fullName, 120);
        const businessName = sanitize(body.businessName, 160);
        const email = sanitize(body.email, 160);
        const phone = sanitize(body.phone, 60);
        const services = sanitize(body.services, 120);
        const budget = sanitize(body.budget, 120);
        const timeline = sanitize(body.timeline, 120);
        const projectDetails = sanitize(body.projectDetails, 3000);
        const website = sanitize(body.website, 120);
        const turnstileToken = sanitize(body.turnstileToken, 4000);
        const consent = Boolean(body.consent);
        const forwardedFor = request.headers.get("x-forwarded-for") || "";
        const remoteIp = forwardedFor.split(",")[0]?.trim() || "";

        if (website) {
            return NextResponse.json({ message: "Submission accepted." }, { status: 200 });
        }

        if (!turnstileToken) {
            return NextResponse.json(
                { message: "Please complete security verification before submitting." },
                { status: 400 }
            );
        }

        const turnstileVerification = await verifyTurnstileToken(turnstileToken, remoteIp);
        if (!turnstileVerification.success) {
            console.error("Turnstile verification failed", {
                errorCodes: turnstileVerification.errorCodes,
                hasRemoteIp: Boolean(remoteIp),
            });
            return NextResponse.json(
                { message: "Security verification failed. Please try again." },
                { status: 400 }
            );
        }

        if (!fullName || !businessName || !email || !projectDetails) {
            return NextResponse.json(
                { message: "Please complete all required fields." },
                { status: 400 }
            );
        }

        if (!isValidEmail(email)) {
            return NextResponse.json(
                { message: "Please provide a valid email address." },
                { status: 400 }
            );
        }

        if (!consent) {
            return NextResponse.json(
                { message: "Privacy consent is required before submission." },
                { status: 400 }
            );
        }

        const subject = `Quote Request: ${businessName} (${fullName})`;

        const safeFullName = escapeHtml(fullName);
        const safeBusinessName = escapeHtml(businessName);
        const safeEmail = escapeHtml(email);
        const safePhone = escapeHtml(phone || "Not provided");
        const safeServices = escapeHtml(services || "Not selected");
        const safeBudget = escapeHtml(budget || "Not selected");
        const safeTimeline = escapeHtml(timeline || "Not selected");
        const safeProjectDetails = escapeHtml(projectDetails);

        const text = [
            "New quote request submitted",
            "",
            `Name: ${fullName}`,
            `Business: ${businessName}`,
            `Email: ${email}`,
            `Phone: ${phone || "Not provided"}`,
            `Service: ${services || "Not selected"}`,
            `Budget: ${budget || "Not selected"}`,
            `Timeline: ${timeline || "Not selected"}`,
            `Consent: ${consent ? "Yes" : "No"}`,
            "",
            "Project details:",
            projectDetails,
        ].join("\n");

        const html = `
            <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 680px; margin: 0 auto;">
              <h1 style="font-size: 24px; margin-bottom: 16px;">New Quote Request</h1>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tbody>
                                    <tr><td style="padding: 8px 0; font-weight: 700; width: 180px;">Name</td><td style="padding: 8px 0;">${safeFullName}</td></tr>
                                    <tr><td style="padding: 8px 0; font-weight: 700;">Business</td><td style="padding: 8px 0;">${safeBusinessName}</td></tr>
                                    <tr><td style="padding: 8px 0; font-weight: 700;">Email</td><td style="padding: 8px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
                                    <tr><td style="padding: 8px 0; font-weight: 700;">Phone</td><td style="padding: 8px 0;">${safePhone}</td></tr>
                                    <tr><td style="padding: 8px 0; font-weight: 700;">Service</td><td style="padding: 8px 0;">${safeServices}</td></tr>
                                    <tr><td style="padding: 8px 0; font-weight: 700;">Budget</td><td style="padding: 8px 0;">${safeBudget}</td></tr>
                                    <tr><td style="padding: 8px 0; font-weight: 700;">Timeline</td><td style="padding: 8px 0;">${safeTimeline}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: 700;">Privacy Consent</td><td style="padding: 8px 0;">${consent ? "Yes" : "No"}</td></tr>
                </tbody>
              </table>
              <h2 style="font-size: 18px; margin: 20px 0 8px;">Project Details</h2>
                            <p style="white-space: pre-wrap; line-height: 1.6; margin: 0;">${safeProjectDetails}</p>
            </div>
        `;

        const { error } = await resend.emails.send({
            from: fromEmail,
            to: [toEmail],
            replyTo: email,
            subject,
            text,
            html,
        });

        if (error) {
            return NextResponse.json(
                {
                    message: "There was a problem sending your request. Please try again.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: "Quote request sent successfully." }, { status: 200 });
    } catch {
        return NextResponse.json(
            {
                message: "Unexpected server error while sending quote request.",
            },
            { status: 500 }
        );
    }
}
