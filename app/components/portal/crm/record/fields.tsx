"use client";

import { useState } from "react";

/**
 * The record's small form parts, shared by its tabs. Moved out of `CustomerRecord.tsx` unchanged
 * when the record grew tabs (2026-11-12).
 */

/**
 * One correctable detail.
 *
 * Drawn as an ordinary portal input rather than as text that turns into one on hover: the
 * global form reset in `globals.css` sets a border and a background on every input with
 * `!important`, so a borderless rest state is not available to us here, and a field that
 * half-wins that fight looks broken. It also matches Job value and Your notes directly below,
 * which have always been plain inputs.
 *
 * Saves on blur — no Save button to forget, and no PATCH per keystroke. A refused save (a
 * phone number another customer already holds) puts the stored value back, so the field never
 * shows something that was not written.
 */
export function EditableField({
    id,
    label,
    value,
    onSave,
    type = "text",
    placeholder,
    multiline = false,
    hideLabel = false,
    big = false,
}: {
    id: string;
    label: string;
    value: string;
    onSave: (v: string) => Promise<boolean>;
    type?: string;
    placeholder?: string;
    multiline?: boolean;
    hideLabel?: boolean;
    big?: boolean;
}) {
    const [draft, setDraft] = useState(value);
    const [seen, setSeen] = useState(value);

    // The stored value wins whenever it changes under us — a reload, or a save that was
    // refused. Adjusted during render rather than in an effect: an effect would paint the
    // stale value first and then correct it, which is a visible flicker on a rejected edit.
    if (seen !== value) {
        setSeen(value);
        setDraft(value);
    }

    const shared = {
        id,
        value: draft,
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setDraft(e.target.value),
        onBlur: async () => {
            if (draft === value) return;
            const ok = await onSave(draft.trim());
            if (!ok) setDraft(value);
        },
        className:
            "w-full rounded-lg border px-3 py-2 font-[inherit] outline-none " +
            (big ? "text-[17px] font-semibold" : "text-[13.5px]"),
        style: {
            background: "var(--bg)",
            borderColor: "var(--rule-strong)",
            color: "var(--fg)",
            minHeight: 38,
        },
    };

    return (
        <div className="min-w-0">
            <label
                htmlFor={id}
                className={hideLabel ? "sr-only" : "block text-[11.5px] mb-px"}
                style={hideLabel ? undefined : { color: "var(--fg-2)" }}
            >
                {label}
            </label>
            {multiline ? (
                <textarea {...shared} rows={2} className={`${shared.className} resize-y leading-snug`} />
            ) : (
                <input {...shared} type={type} />
            )}
        </div>
    );
}

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
    const [adding, setAdding] = useState(false);
    const [val, setVal] = useState("");
    return (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tags.map((t) => (
                <button
                    key={t}
                    type="button"
                    onClick={() => onChange(tags.filter((x) => x !== t))}
                    title="Remove"
                    className="text-[10.5px] px-2 py-0.5 rounded-full cursor-pointer"
                    style={{
                        fontFamily: "var(--font-mono)",
                        background: "var(--surface)",
                        color: "var(--fg-2)",
                    }}
                >
                    {t} ✕
                </button>
            ))}
            {adding ? (
                <input
                    autoFocus
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onBlur={() => {
                        if (val.trim()) onChange([...tags, val.trim()]);
                        setVal("");
                        setAdding(false);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                            setVal("");
                            setAdding(false);
                        }
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-full border outline-none w-24"
                    style={{
                        borderColor: "var(--rule-strong)",
                        background: "var(--bg)",
                        color: "var(--fg)",
                    }}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="text-[10.5px] px-2 py-0.5 rounded-full border border-dashed cursor-pointer"
                    style={{ fontFamily: "var(--font-mono)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                >
                    + Add
                </button>
            )}
        </div>
    );
}

export function Label({ children }: { children: React.ReactNode }) {
    return (
        <p
            className="text-[10px] uppercase tracking-wider m-0"
            style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}
        >
            {children}
        </p>
    );
}
