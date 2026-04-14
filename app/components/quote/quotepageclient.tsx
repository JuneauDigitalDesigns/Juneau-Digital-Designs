"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type QuoteFormData = {
    fullName: string;
    businessName: string;
    email: string;
    phone: string;
    services: string;
    budget: string;
    timeline: string;
    projectDetails: string;
    website: string;
    consent: boolean;
};

type SubmitState = {
    type: "idle" | "success" | "error";
    message: string;
};

const initialFormData: QuoteFormData = {
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    services: "New website",
    budget: "< $2,500",
    timeline: "As soon as possible",
    projectDetails: "",
    website: "",
    consent: false,
};

export default function QuotePageClient() {
    const [formData, setFormData] = useState<QuoteFormData>(initialFormData);
    const [submitting, setSubmitting] = useState(false);
    const [submitState, setSubmitState] = useState<SubmitState>({
        type: "idle",
        message: "",
    });

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setSubmitState({ type: "idle", message: "" });

        try {
            const response = await fetch("/api/quote", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            const data = (await response.json()) as { message?: string };

            if (!response.ok) {
                throw new Error(data.message || "Unable to submit your quote request right now.");
            }

            setSubmitState({
                type: "success",
                message: "Thanks! Your quote request has been sent. We will reach out soon.",
            });
            setFormData(initialFormData);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Something went wrong.";
            setSubmitState({ type: "error", message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-12 sm:px-6 lg:px-8">
            <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-2">
                <div className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl sm:p-8">
                    <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">
                        Request a Quote
                    </span>
                    <h1 className="mt-4 text-3xl font-black leading-tight text-zinc-900 sm:text-5xl">
                        Let&apos;s talk about your next website
                    </h1>
                    <p className="mt-4 text-zinc-700 leading-relaxed">
                        Tell us what you are building and what outcome matters most. We will send a clear next step,
                        practical recommendations, and a timeline you can trust.
                    </p>

                    <div className="mt-8 space-y-4">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <h2 className="text-base font-bold text-zinc-900">Response Time</h2>
                            <p className="mt-1 text-sm text-zinc-700">Most inquiries receive a response within 1 business day.</p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <h2 className="text-base font-bold text-zinc-900">What to Include</h2>
                            <p className="mt-1 text-sm text-zinc-700">
                                Your goals, target audience, and any deadline constraints help us scope quickly.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <h2 className="text-base font-bold text-zinc-900">What You Can Expect</h2>
                            <p className="mt-1 text-sm text-zinc-700">
                                A practical recommendation, scope direction, and clear next actions after review.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl backdrop-blur sm:p-8">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Tell us about your project</h2>
                        <p className="mt-3 text-slate-700">
                            Share your goals, timeline, and budget. We will send back a clear scope and next steps.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2" noValidate>
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-800">Full name</span>
                        <input
                            required
                            type="text"
                            value={formData.fullName}
                            onChange={(event) => setFormData((prev) => ({ ...prev, fullName: event.target.value }))}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-800">Business name</span>
                        <input
                            required
                            type="text"
                            value={formData.businessName}
                            onChange={(event) => setFormData((prev) => ({ ...prev, businessName: event.target.value }))}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-800">Email address</span>
                        <input
                            required
                            type="email"
                            value={formData.email}
                            onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-800">Phone number</span>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-800">Primary service</span>
                        <select
                            value={formData.services}
                            onChange={(event) => setFormData((prev) => ({ ...prev, services: event.target.value }))}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        >
                            <option>New website</option>
                            <option>Website redesign</option>
                            <option>E-commerce</option>
                            <option>Maintenance and support</option>
                            <option>Full stack application</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-800">Estimated budget</span>
                        <select
                            value={formData.budget}
                            onChange={(event) => setFormData((prev) => ({ ...prev, budget: event.target.value }))}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        >
                            <option>&lt; $2,500</option>
                            <option>$2,500 - $5,000</option>
                            <option>$5,000 - $10,000</option>
                            <option>$10,000+</option>
                            <option>Need help deciding</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-slate-800">Ideal timeline</span>
                        <select
                            value={formData.timeline}
                            onChange={(event) => setFormData((prev) => ({ ...prev, timeline: event.target.value }))}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        >
                            <option>As soon as possible</option>
                            <option>Within 1 month</option>
                            <option>Within 2-3 months</option>
                            <option>Flexible timeline</option>
                        </select>
                    </label>

                    <label className="hidden" aria-hidden="true">
                        <span>Website</span>
                        <input
                            tabIndex={-1}
                            autoComplete="off"
                            type="text"
                            value={formData.website}
                            onChange={(event) => setFormData((prev) => ({ ...prev, website: event.target.value }))}
                        />
                    </label>

                    <label className="flex flex-col gap-2 md:col-span-2">
                        <span className="text-sm font-semibold text-slate-800">Project details</span>
                        <textarea
                            required
                            rows={7}
                            value={formData.projectDetails}
                            onChange={(event) => setFormData((prev) => ({ ...prev, projectDetails: event.target.value }))}
                            placeholder="What are you building, who is it for, and what outcome do you want?"
                            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                    </label>

                    <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <input
                            required
                            type="checkbox"
                            checked={formData.consent}
                            onChange={(event) => setFormData((prev) => ({ ...prev, consent: event.target.checked }))}
                            className="mt-1 h-4 w-4 rounded border-slate-400 text-slate-900"
                        />
                        <span>
                            I agree to the collection and processing of my information for quote follow-up as described in the{" "}
                            <Link href="/privacy-policy" className="font-semibold underline underline-offset-4 hover:text-slate-900">
                                Privacy Policy
                            </Link>
                            .
                        </span>
                    </label>

                    <div className="md:col-span-2 flex flex-col gap-3">
                        <button
                            disabled={submitting}
                            type="submit"
                            className="inline-flex items-center justify-center rounded-xl border border-[#0E1A2B] bg-[#0E1A2B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#132745] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {submitting ? "Sending quote request..." : "Send quote request"}
                        </button>

                        {submitState.type !== "idle" && (
                            <p
                                role="status"
                                className={`rounded-lg px-4 py-3 text-sm ${
                                    submitState.type === "success"
                                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                        : "border border-red-200 bg-red-50 text-red-700"
                                }`}
                            >
                                {submitState.message}
                            </p>
                        )}
                    </div>
                    </form>
                </div>
            </section>
        </main>
    );
}
