"use client";

import { useState } from "react";
import type { CustomerNote } from "@/app/lib/crm-jobs";
import type { CustomerRow } from "../stages";
import { SAVE_FAILED } from "./JobsTab";

/**
 * The Notes tab: free-form notes about this customer, newest first.
 *
 * Xander, 2026-11-12: "a notes tab for keeping any freeform notes for that customer". It replaces
 * the single "Your notes" box that sat in the details column. That box's text is kept: the
 * record's GET returns it as the oldest note, and the route turns it into a real one the first
 * time it is edited.
 *
 * Notes also appear on the timeline under "Your notes", folded in on read, so an edit or a
 * delete here shows there too.
 */
export default function NotesTab({
    customer,
    notes,
    siteSlug,
    onChanged,
    className,
}: {
    customer: CustomerRow;
    notes: CustomerNote[];
    siteSlug: string;
    onChanged: () => void;
    className?: string;
}) {
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const first = customer.name?.trim().split(/\s+/)[0] ?? null;

    async function send(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): Promise<boolean> {
        setError(null);
        const res = await fetch(`/api/portal/notes?site=${encodeURIComponent(siteSlug)}`, {
            method,
            headers: { "Content-Type": "application/json" },
            // The old single note has no record of its own; the route finds it by customer.
            body: JSON.stringify({ customerId: customer.customerId, ...body }),
        }).catch(() => null);
        if (!res?.ok) {
            setError(SAVE_FAILED);
            return false;
        }
        onChanged();
        return true;
    }

    return (
        <div className={`flex flex-col gap-4 min-w-0 ${className ?? ""}`} style={{ maxWidth: 760 }}>
            {/* A plain field and its button. It was a bordered box around a borderless field, but
                the global form reset gives every textarea its own border and fill, so it drew a
                box in a box. */}
            <div className="flex flex-col gap-2">
                <label htmlFor="crm-note-new" className="sr-only">
                    New note
                </label>
                <textarea
                    id="crm-note-new"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder={first ? `Write a note about ${first}…` : "Write a note…"}
                    className="w-full rounded-lg border px-3 py-2 text-[14px] leading-relaxed outline-none resize-y"
                    style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                />
                <div className="flex justify-end">
                    <button
                        type="button"
                        disabled={saving || !draft.trim()}
                        onClick={async () => {
                            setSaving(true);
                            if (await send("POST", { body: draft })) setDraft("");
                            setSaving(false);
                        }}
                        className="rounded-lg px-4 text-[13px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ minHeight: 40, background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        Save note
                    </button>
                </div>
            </div>

            {error && (
                <p role="alert" className="m-0 text-[12.5px]" style={{ color: "var(--chart-neg)" }}>
                    {error}
                </p>
            )}

            {notes.length === 0 ? (
                <div className="py-6 text-center">
                    <p className="m-0 text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                        No notes yet
                    </p>
                    <p className="m-0 mt-1 text-[13px] mx-auto" style={{ color: "var(--fg-2)", maxWidth: "48ch" }}>
                        Anything worth remembering about them: gate codes, pets, the best time to call.
                    </p>
                </div>
            ) : (
                <ul className="list-none m-0 p-0">
                    {notes.map((n, i) => (
                        <NoteRow
                            key={n.noteId}
                            note={n}
                            last={i === notes.length - 1}
                            onSave={(body) => send("PATCH", { noteId: n.noteId, body })}
                            onDelete={() => void send("DELETE", { noteId: n.noteId })}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

function stamp(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    })}`;
}

function NoteRow({
    note,
    last,
    onSave,
    onDelete,
}: {
    note: CustomerNote;
    last: boolean;
    onSave: (body: string) => Promise<boolean>;
    onDelete: () => void;
}) {
    const [mode, setMode] = useState<"read" | "edit" | "delete">("read");
    const [text, setText] = useState(note.body);
    const edited = note.updatedAt
        ? ` · edited ${new Date(note.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : "";

    return (
        <li className={`py-3.5 ${last ? "" : "border-b"}`} style={{ borderColor: "var(--rule-weak)" }}>
            <div className="flex items-baseline gap-3 mb-1">
                <span className="text-[10.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                    {stamp(note.createdAt)}
                    {edited}
                </span>
                {mode === "read" && (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setText(note.body);
                                setMode("edit");
                            }}
                            className="ml-auto text-[12.5px] cursor-pointer"
                            style={{ color: "var(--accent)" }}
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("delete")}
                            className="text-[12.5px] cursor-pointer"
                            style={{ color: "var(--fg-2)" }}
                        >
                            Delete
                        </button>
                    </>
                )}
            </div>

            {mode === "edit" ? (
                <div className="flex flex-col gap-2">
                    <label htmlFor={`crm-note-${note.noteId}`} className="sr-only">
                        Edit note
                    </label>
                    <textarea
                        id={`crm-note-${note.noteId}`}
                        autoFocus
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border px-3 py-2 text-[14px] leading-relaxed outline-none resize-y"
                        style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                    />
                    <div className="flex gap-3 items-center">
                        <button
                            type="button"
                            disabled={!text.trim()}
                            onClick={async () => {
                                if (await onSave(text)) setMode("read");
                            }}
                            className="rounded-lg px-4 text-[13px] font-semibold cursor-pointer disabled:opacity-50"
                            style={{ minHeight: 40, background: "var(--accent)", color: "var(--on-accent)" }}
                        >
                            Save note
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("read")}
                            className="text-[12.5px] cursor-pointer"
                            style={{ color: "var(--fg-2)" }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <p className="m-0 text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--fg)" }}>
                    {note.body}
                </p>
            )}

            {mode === "delete" && (
                <div className="mt-2 flex items-center gap-3 text-[12.5px]" role="group" aria-label="Delete note">
                    <span style={{ color: "var(--fg)" }}>Delete this note?</span>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="font-semibold cursor-pointer"
                        style={{ color: "var(--chart-neg)" }}
                    >
                        Delete
                    </button>
                    <button type="button" onClick={() => setMode("read")} className="cursor-pointer" style={{ color: "var(--fg-2)" }}>
                        Keep it
                    </button>
                </div>
            )}
        </li>
    );
}
