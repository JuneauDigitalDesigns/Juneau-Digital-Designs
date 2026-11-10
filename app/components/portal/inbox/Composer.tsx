"use client";

import { useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import { createTemplate, deleteTemplate, updateTemplate, type ReplyTemplate } from "./api";
import { prefillReply } from "./model";
import Sheet from "./Sheet";

/**
 * The text composer on the lead pane, with quick replies above it (Growth).
 *
 * A quick reply only ever fills the box — "Hi Dave, " plus its body — and never sends on its
 * own. The owner reads it, changes it if they like, and presses Send; sending is still the one
 * `/api/portal/messages` path with its consent checks (see `textLead` in `api.ts`).
 *
 * The footer says "Sends from your business number" without the number itself: the approved
 * line includes it, but the number is not in anything the portal client receives today. Listed
 * in the PR.
 */

type Templates = { state: "loading" | "ready" | "unsupported"; templates: ReplyTemplate[]; reload: () => void };

export default function Composer({
    site,
    name,
    draft,
    setDraft,
    templates,
    sending,
    error,
    onSend,
}: {
    site: string;
    name: string | null;
    draft: string;
    setDraft: (v: string) => void;
    templates: Templates;
    sending: boolean;
    error: string | null;
    onSend: () => void;
}) {
    const [editing, setEditing] = useState<{ id: string | null; body: string } | null>(null);
    const [editError, setEditError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function save() {
        if (!editing || !editing.body.trim()) return;
        setSaving(true);
        setEditError(null);
        const r = editing.id
            ? await updateTemplate(site, editing.id, editing.body.trim())
            : await createTemplate(site, editing.body.trim());
        setSaving(false);
        if (!r.ok) {
            setEditError(r.error ?? "That change didn't save. Please try again.");
            return;
        }
        setEditing(null);
        templates.reload();
    }

    async function remove() {
        if (!editing?.id) return;
        setSaving(true);
        const r = await deleteTemplate(site, editing.id);
        setSaving(false);
        if (!r.ok) {
            setEditError(r.error ?? "That change didn't save. Please try again.");
            return;
        }
        setEditing(null);
        templates.reload();
    }

    return (
        <div
            className="flex flex-col rounded-[10px] border"
            style={{
                background: "var(--elev-1)",
                borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
                boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 8%, transparent)",
            }}
        >
            {templates.state === "ready" && (
                <div className="hidden lg:flex flex-wrap gap-1.5 items-center px-3 py-2.5 border-b" style={{ borderColor: "var(--rule-weak)" }}>
                    <span
                        className="text-[10.5px] uppercase tracking-[0.06em] mr-1"
                        style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
                    >
                        Quick replies
                    </span>
                    {templates.templates.map((t) => (
                        <span key={t.id} className="inline-flex items-center">
                            <button
                                type="button"
                                onClick={() => setDraft(prefillReply(name, t.body))}
                                className="text-[12.5px] px-2.5 py-1.5 rounded-full border cursor-pointer hover:border-[var(--accent)]"
                                style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                            >
                                {t.body}
                            </button>
                            {!t.builtIn && (
                                <button
                                    type="button"
                                    aria-label={`Edit: ${t.body}`}
                                    title="Edit"
                                    onClick={() => {
                                        setEditError(null);
                                        setEditing({ id: t.id, body: t.body });
                                    }}
                                    className="ml-0.5 w-6 h-6 rounded-full inline-flex items-center justify-center cursor-pointer"
                                    style={{ color: "var(--fg-3)" }}
                                >
                                    <PencilSimple size={12} />
                                </button>
                            )}
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            setEditError(null);
                            setEditing({ id: null, body: "" });
                        }}
                        className="text-[12.5px] px-2.5 py-1.5 rounded-full border border-dashed cursor-pointer"
                        style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--elev-1)" }}
                    >
                        + New quick reply
                    </button>
                </div>
            )}

            {editing && (
                <div className="hidden lg:flex flex-col gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--rule-weak)" }}>
                    <label className="sr-only" htmlFor="inbox-template">
                        Quick replies
                    </label>
                    <textarea
                        id="inbox-template"
                        autoFocus
                        rows={2}
                        value={editing.body}
                        onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                        className="w-full rounded-md border px-2.5 py-2 text-sm outline-none resize-none"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                    />
                    {editError && (
                        <p className="text-xs" style={{ color: "var(--chart-neg)" }}>
                            {editError}
                        </p>
                    )}
                    <div className="flex gap-2 justify-end">
                        {editing.id && (
                            <button
                                type="button"
                                onClick={remove}
                                disabled={saving}
                                className="mr-auto text-[13px] font-medium px-2 cursor-pointer disabled:opacity-60"
                                style={{ color: "var(--chart-neg)" }}
                            >
                                Delete
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="h-8 px-3 rounded-md border text-[13px] cursor-pointer"
                            style={{ borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving || !editing.body.trim()}
                            className="h-8 px-3 rounded-md text-[13px] font-semibold cursor-pointer disabled:opacity-50"
                            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}

            <label className="sr-only" htmlFor="inbox-sms">
                Text
            </label>
            <textarea
                id="inbox-sms"
                autoFocus
                rows={3}
                value={draft}
                maxLength={1000}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full px-3 py-3 text-sm leading-relaxed outline-none resize-none border-0"
                style={{ color: "var(--fg)", background: "var(--elev-1)", minHeight: 58 }}
            />
            {error && (
                <p className="px-3 pb-2 text-xs" style={{ color: "var(--chart-neg)" }}>
                    {error}
                </p>
            )}
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t" style={{ borderColor: "var(--rule-weak)" }}>
                <span className="text-[12.5px]" style={{ color: "var(--fg-3)" }}>
                    {/* TODO(wording): approved line ends ", (512) 555-0100" — the number is not
                        sent to the client yet. */}
                    Sends from your business number
                </span>
                <button
                    type="button"
                    onClick={onSend}
                    disabled={sending || !draft.trim()}
                    className="shrink-0 h-11 lg:h-[34px] px-4 rounded-[7px] text-[13px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                >
                    {sending ? "Sending…" : "Send"}
                </button>
            </div>
        </div>
    );
}

/** Phone: the quick replies as a sheet, each already greeted, plus "+ Write your own". */
export function QuickReplySheet({
    name,
    templates,
    onPick,
    onClose,
}: {
    name: string | null;
    templates: ReplyTemplate[];
    onPick: (text: string | null) => void;
    onClose: () => void;
}) {
    return (
        <Sheet label="Quick replies" onClose={onClose}>
            <strong className="text-base pt-1 pb-2" style={{ color: "var(--fg)" }}>
                Quick replies
            </strong>
            {templates.map((t) => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => onPick(prefillReply(name, t.body))}
                    className="block w-full text-left px-3.5 py-3 rounded-[10px] border text-sm mb-1.5 cursor-pointer"
                    style={{ background: "var(--bg)", borderColor: "var(--rule)", color: "var(--fg)" }}
                >
                    {prefillReply(name, t.body)}
                </button>
            ))}
            <button
                type="button"
                onClick={() => onPick(null)}
                className="block w-full text-left px-3.5 py-3 rounded-[10px] border border-dashed text-sm mb-1.5 cursor-pointer"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
            >
                + Write your own
            </button>
            <span className="text-[12.5px]" style={{ color: "var(--fg-3)" }}>
                Sends from your business number
            </span>
        </Sheet>
    );
}
