import { SCHEDULES } from "@/app/lib/legal/schedules";
import type { PlanSlug } from "@/app/lib/agreement-types";

/** Derived from Schedule A so the chip can never disagree with the contract. */
function metaFor(plan: string) {
    const s = SCHEDULES[plan as PlanSlug] ?? SCHEDULES.growth;
    return {
        label: s.name,
        price: `$${s.monthlyPrice}/mo`,
        setup: s.onboardingFee > 0 ? `$${s.onboardingFee} setup` : undefined,
    };
}

export default function PlanChip({ plan }: { plan: string }) {
    const meta = metaFor(plan);
    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(245, 237, 214, 0.07)",
                border: "1px solid rgba(245, 237, 214, 0.20)",
                color: "var(--fg)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.04em",
            }}
        >
            <span style={{ color: "var(--accent)", fontSize: 10 }}>●</span>
            Plan:{" "}
            <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{meta.label}</strong> ·{" "}
            <span style={{ color: "var(--fg-2)" }}>{meta.price}</span>
            {meta.setup && (
                <>
                    {" "}
                    · <span style={{ color: "var(--fg-2)" }}>{meta.setup}</span>
                </>
            )}
        </div>
    );
}

