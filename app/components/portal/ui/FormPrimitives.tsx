import type { CSSProperties, ReactNode } from "react";

/**
 * Form chrome shared by Settings and Billing.
 *
 * Extracted when Cancellation moved out of Settings into Billing — both needed the same
 * card and field shapes, and the colours here were `rgba(255,255,255,0.03)` surfaces left
 * over from the dark navy dashboard, which render as nothing at all on the cream theme.
 */

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section
            className="rounded-lg overflow-hidden mb-6 border"
            style={{ borderColor: "var(--rule)" }}
        >
            <h2
                className="px-5 py-3.5 text-xs uppercase border-b"
                style={{
                    background: "var(--surface)",
                    borderColor: "var(--rule)",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "var(--tracking-widest)",
                    color: "var(--fg-3)",
                }}
            >
                {title}
            </h2>
            <div className="p-5">{children}</div>
        </section>
    );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 mb-4">
            <label className="text-sm" style={{ color: "var(--fg-3)" }}>
                {label}
            </label>
            {children}
        </div>
    );
}

export const inputStyle: CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--rule-strong)",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 14,
    color: "var(--fg)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
};

/** A read-only value rendered as a field, for things the client can't change. */
export function StaticField({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 mb-4">
            <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                {label}
            </span>
            <span style={{ color: "var(--fg)" }}>{value}</span>
        </div>
    );
}
