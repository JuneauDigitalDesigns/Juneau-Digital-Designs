"use client";

interface Site {
    slug: string;
    name: string;
    hasTraffic: boolean;
}

interface SiteSelectorProps {
    sites: Site[];
    selected: string | null;
    onChange: (slug: string) => void;
}

export default function SiteSelector({ sites, selected, onChange }: SiteSelectorProps) {
    return (
        <select
            value={selected ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm px-3 py-1.5 rounded border outline-none"
            style={{
                background: "rgba(255,255,255,0.06)",
                borderColor: "var(--rule-strong)",
                color: "var(--fg)",
            }}
        >
            {sites.map((s) => (
                <option key={s.slug} value={s.slug} style={{ background: "#0d1b2e" }}>
                    {s.name}
                </option>
            ))}
        </select>
    );
}
