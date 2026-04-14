import Link from "next/link";

export const metadata = {
    title: "Privacy Policy | Juneau Digital Designs",
    description: "How Juneau Digital Designs collects and uses information submitted through contact and quote forms.",
};

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-12 sm:px-6 lg:px-8">
            <article className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10">
                <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">Privacy Policy</h1>
                <p className="mt-3 text-sm text-slate-600">Effective date: April 14, 2026</p>

                <section className="mt-8 space-y-3 text-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900">Information we collect</h2>
                    <p>
                        We collect information you voluntarily submit through our website forms, including your name, business name,
                        email address, phone number, service interest, project details, budget, and timeline.
                    </p>
                </section>

                <section className="mt-8 space-y-3 text-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900">How we use your information</h2>
                    <p>Your information is used to:</p>
                    <ul className="list-disc space-y-2 pl-5">
                        <li>Respond to quote and contact requests.</li>
                        <li>Communicate about your project and potential services.</li>
                        <li>Maintain internal business records for active and prospective client communications.</li>
                    </ul>
                    <p>We do not sell your personal data to third parties.</p>
                </section>

                <section className="mt-8 space-y-3 text-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900">Third-party services</h2>
                    <p>
                        We use Resend to securely transmit form submissions by email. Submitted form content may be processed by Resend
                        solely for message delivery and service reliability.
                    </p>
                </section>

                <section className="mt-8 space-y-3 text-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900">Data retention</h2>
                    <p>
                        We retain submitted information only as long as needed to respond to your inquiry, manage project communication,
                        and meet legal or operational obligations.
                    </p>
                </section>

                <section className="mt-8 space-y-3 text-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900">Your choices</h2>
                    <p>
                        You may request correction or deletion of your submitted personal information by contacting us directly. We will
                        honor valid requests where required by law.
                    </p>
                </section>

                <section className="mt-8 space-y-3 text-slate-700">
                    <h2 className="text-xl font-semibold text-slate-900">Contact</h2>
                    <p>
                        For privacy-related questions, visit our <Link href="/contact" className="font-semibold underline underline-offset-4">contact page</Link>.
                    </p>
                </section>
            </article>
        </main>
    );
}
