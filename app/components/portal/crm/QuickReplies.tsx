"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import {
    createTemplate,
    deleteTemplate,
    prefillReply,
    updateTemplate,
} from "./replyTemplates";
import { useReplyTemplates } from "./useReplyTemplates";

/**
 * Quick replies above the customer card's composer.
 *
 * Rendered only inside the composer's `messagingState === "ready"` branch in
 * `CustomerRecord.tsx` — the existing gate, which already means Growth/Enterprise with A2P
 * verified, and which `/api/portal/messages` enforces server-side. This adds no gate of its
 * own and sends nothing: a chip fills the box with "Hi {first name}, " + its body, and the
 * owner reads it and presses Send as before.
 *
 * Draws nothing at all until `GET /api/portal/reply-templates` answers with `{ templates }`.
 */
export default function QuickReplies({
    siteSlug,
    name,
    onPick,
}: {
    siteSlug: string;
    name: string | null;
    onPick: (text: string) => void;
}) {
    const templates = useReplyTemplates(siteSlug);
    const [editing, setEditing] = useState<{ id: string | null; body: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    if (templates.state !== "ready") return null;

    async function save() {
        if (!editing || !editing.body.trim()) return;
        setSaving(true);
        setError(null);
        const body = editing.body.trim();
        const r = editing.id
            ? await updateTemplate(siteSlug, editing.id, body)
            : await createTemplate(siteSlug, body);
        setSaving(false);
        if (!r.ok) {
            setError(r.error ?? "That change didn't save. Please try again.");
            return;
        }
        setEditing(null);
        templates.reload();
    }

    async function remove() {
        if (!editing?.id) return;
        setSaving(true);
        setError(null);
        const r = await deleteTemplate(siteSlug, editing.id);
        setSaving(false);
        if (!r.ok) {
            setError(r.error ?? "That change didn't save. Please try again.");
            return;
        }
        setEditing(null);
        templates.reload();
    }

    const open = (id: string | null, body: string) => {
        setError(null);
        setEditing({ id, body });
    };

    return (
        <div className="mb-2.5 space-y-2 min-w-0">
            <div className="flex flex-wrap gap-1.5 items-center">
                <span
                    className="text-[10.5px] uppercase tracking-[0.06em] mr-1"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
                >
                    Quick replies
                </span>
                {templates.templates.map((t) => (
                    <span key={t.id} className="inline-flex items-center min-w-0 max-w-full">
                        <button
                            type="button"
                            onClick={() => onPick(prefillReply(name, t.body))}
                            className="portal-hit min-w-0 max-w-full truncate text-[12.5px] px-2.5 py-1.5 rounded-full border cursor-pointer hover:border-[var(--accent)]"
                            style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                        >
                            {t.body}
                        </button>
                        {!t.builtIn && (
                            <button
                                type="button"
                                aria-label={`Edit: ${t.body}`}
                                title="Edit"
                                onClick={() => open(t.id, t.body)}
                                className="portal-hit shrink-0 ml-0.5 w-6 h-6 rounded-full inline-flex items-center justify-center cursor-pointer"
                                style={{ color: "var(--fg-3)" }}
                            >
                                <PencilSimple size={12} />
                            </button>
                        )}
                    </span>
                ))}
                <button
                    type="button"
                    onClick={() => open(null, "")}
                    className="portal-hit text-[12.5px] px-2.5 py-1.5 rounded-full border border-dashed cursor-pointer"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--elev-1)" }}
                >
                    + New quick reply
                </button>
            </div>

            {editing && (
                <div
                    className="flex flex-col gap-2 p-2.5 rounded-lg border"
                    style={{ background: "var(--elev-1)", borderColor: "var(--rule)" }}
                >
                    <label className="sr-only" htmlFor="crm-quick-reply">
                        Quick replies
                    </label>
                    <textarea
                        id="crm-quick-reply"
                        autoFocus
                        rows={2}
                        maxLength={1000}
                        value={editing.body}
                        onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                        className="w-full rounded-md border px-2.5 py-2 text-sm outline-none resize-none"
                        style={{ borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                    />
                    {error && (
                        <p className="text-xs" style={{ color: "var(--chart-neg)" }}>
                            {error}
                        </p>
                    )}
                    <div className="flex gap-2 justify-end items-center">
                        {editing.id && (
                            <button
                                type="button"
                                onClick={remove}
                                disabled={saving}
                                className="mr-auto min-h-9 text-[13px] font-medium px-2 cursor-pointer disabled:opacity-60"
                                style={{ color: "var(--chart-neg)" }}
                            >
                                Delete
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="min-h-9 px-3 rounded-md border text-[13px] cursor-pointer"
                            style={{ borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving || !editing.body.trim()}
                            className="min-h-9 px-3 rounded-md text-[13px] font-semibold cursor-pointer disabled:opacity-50"
                            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
