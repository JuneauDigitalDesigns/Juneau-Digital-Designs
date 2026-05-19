type PlanMeta = { label: string; price: string; setup?: string };

const PLAN_META: Record<string, PlanMeta> = {
    starter: { label: "Starter", price: "$117/mo", setup: "$100 setup" },
    growth: { label: "Growth", price: "$297/mo" },
    enterprise: { label: "Enterprise", price: "$697/mo" },
};

export default function PlanChip({ plan }: { plan: string }) {
    const meta = PLAN_META[plan] ?? PLAN_META.growth;
    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(182, 168, 255, 0.08)",
                border: "1px solid rgba(182, 168, 255, 0.22)",
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

export { PLAN_META };
