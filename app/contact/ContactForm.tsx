"use client";

import { useRouter } from "next/navigation";
import LeadForm from "@/app/components/lead/LeadForm";
import { markLeadSent } from "@/app/lib/lead-conversion";

/**
 * The /contact page's copy of the Get Started form — the same `LeadForm`, so no second form.
 *
 * The one thing it does differently from the slide-over: a successful send leaves the one-time
 * marker and sends the visitor to /contact/thank-you, where the Google Ads conversion fires. The
 * form is not auto-focused: it sits on a page the visitor scrolled to, so stealing the cursor and
 * jumping the scroll on load would be wrong.
 */
export default function ContactForm() {
  const router = useRouter();
  return (
    <LeadForm
      onSuccess={(business) => {
        markLeadSent(business);
        router.push("/contact/thank-you");
      }}
    />
  );
}
