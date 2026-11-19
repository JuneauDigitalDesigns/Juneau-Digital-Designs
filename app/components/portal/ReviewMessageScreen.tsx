"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react";
import { tabHref } from "@/app/portal/types";
import { REVIEW_TEMPLATE_MAX } from "@/app/lib/review-template";
import { usePortalChrome } from "./PortalChromeContext";

/**
 * More › Review message (2026-11-19, Xander: "this is where they should go to set their review
 * text if they want to customize it. They already get a default one").
 *
 * The Review button on a customer is one tap and sends this text, made out to that customer.
 * The Google link and the STOP line are always added on the server, which is what the existing
 * sentence under the box says.
 *
 * DRAFT WORDING, awaiting Xander's word-for-word approval before merge: "Review message" (row
 * and title), the intro sentence, and "Use the default". "Save changes" / "Saving…" / "Saved",
 * the auto-added sentence and the Growth note are existing portal copy.
 */
interface Data {
    template: string;
    isDefault: boolean;
    defaultTemplate: string;
}

export default function ReviewMessageScreen() {
    const { selected } = usePortalChrome();
    const crmReady = selected.features.crm.state === "ready";
    const url = `/api/portal/review-message?site=${encodeURIComponent(selected.slug)}`;
    const [data, setData] = useState<Data | null>(null);
    const [draft, setDraft] = useState("");
    const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!crmReady) return;
        let live = true;
        fetch(url)
            .then((r) => (r.ok ? r.json() : null))
            .then((d: Data | null) => {
                if (!live || !d) return;
                setData(d);
                setDraft(d.template);
            })
            .catch(() => {});
        return () => {
            live = false;
        };
    }, [url, crmReady]);

    async function save(template: string) {
        setState("saving");
        setError(null);
        try {
            const res = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template }),
            });
            const d = (await res.json().catch(() => null)) as (Data & { error?: string }) | null;
            if (!res.ok || !d) throw new Error(d?.error ?? "That change didn't save. Please try again.");
            setData(d);
            setDraft(d.template);
            setState("saved");
        } catch (e) {
            setError(e instanceof Error ? e.message : "That change didn't save. Please try again.");
            setState("idle");
        }
    }

    const dirty = data !== null && draft.trim() !== data.template.trim();

    return (
        <div className="flex flex-col gap-4 max-w-xl">
            <Link
                href={tabHref("more", selected.slug)}
                className="lg:hidden inline-flex items-center gap-1 -ml-1 text-[17px] font-semibold self-start min-h-11"
                style={{ color: "var(--accent)" }}
            >
                <CaretLeft size={20} weight="bold" /> More
            </Link>
            <h1 className="m-0">Review message</h1>

            {!crmReady ? (
                <p className="m-0" style={{ color: "var(--fg-2)" }}>
                    Review requests come with Growth.
                </p>
            ) : (
                <>
                    <p className="m-0 text-[15px] lg:text-sm" style={{ color: "var(--fg-2)" }}>
                        This is the text a customer gets when you tap Review on their card. Write [first name] where
                        their first name should go.
                    </p>
                    <label htmlFor="review-message" className="sr-only">
                        Review message
                    </label>
                    <textarea
                        id="review-message"
                        value={draft}
                        disabled={!data}
                        maxLength={REVIEW_TEMPLATE_MAX}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            setState("idle");
                        }}
                        rows={6}
                        className="w-full rounded-[12px] border px-3.5 py-3 text-[16px] lg:text-sm leading-relaxed outline-none resize-y"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                    />
                    <p className="m-0 text-[13px]" style={{ color: "var(--fg-3)" }}>
                        Your Google review link and “Reply STOP to opt out” are added automatically.
                    </p>
                    {error && (
                        <p className="m-0 text-sm" style={{ color: "var(--chart-neg)" }}>
                            {error}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => void save(draft)}
                            disabled={!dirty || state === "saving"}
                            className="h-12 lg:h-10 px-5 rounded-[12px] lg:rounded-[8px] text-[16px] lg:text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                        >
                            {state === "saving" ? "Saving…" : state === "saved" && !dirty ? "Saved" : "Save changes"}
                        </button>
                        {data && !data.isDefault && (
                            <button
                                type="button"
                                onClick={() => void save(data.defaultTemplate)}
                                disabled={state === "saving"}
                                className="h-12 lg:h-10 px-3 text-[16px] lg:text-sm font-semibold cursor-pointer"
                                style={{ color: "var(--accent)" }}
                            >
                                Use the default
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
