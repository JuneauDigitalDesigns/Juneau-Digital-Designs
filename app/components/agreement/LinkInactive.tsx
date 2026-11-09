import { CONTACT_EMAIL } from "@/app/lib/plan-change-copy";

/** Shown for a payment or agreement link that no longer works. Says nothing about why. */
export default function LinkInactive() {
    return (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 32, lineHeight: 1.15, color: "var(--fg)" }}>Link inactive</h1>
            <p style={{ margin: 0, color: "var(--fg-2)", fontSize: 14.5, lineHeight: 1.6 }}>
                New links are issued by Juneau Digital Designs:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--fg)", fontWeight: 600 }}>
                    {CONTACT_EMAIL}
                </a>
            </p>
        </div>
    );
}
