"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { Card } from "@/app/components/portal/ui/Card";
import { ACCEPT_ATTR, PrepError, precheck, prepareImage } from "@/app/lib/image-prep";
import { guessPhotoTown } from "@/app/lib/town-match";
import { PA } from "@/app/lib/page-additions";

/**
 * The facts wizard a "We need your help" notice opens (Xander, 2026-11-14; W93–W112 approved word
 * for word). The client adds photos from jobs in the town (the onboarding upload: cleaned in the
 * browser, stored per account, the Q1 town question with GPS pre-select) and real customers'
 * reviews (word for word, ticked), optionally a job in their own words; then sends, or saves and
 * comes back. "I don't want this page" pauses it for JDD to follow up.
 *
 * Nothing here publishes. What they send reaches the console intake tagged Client and JDD checks
 * it before any export. Items already sent are shown and kept; only unsent ones can be removed.
 */

interface Photo {
    id?: string;
    url: string;
    filename: string;
    town: string;
    sent: boolean;
}
interface Review {
    id?: string;
    text: string;
    name: string;
    verbatim: boolean;
    sent: boolean;
}

export function PageAdditionWizard({
    siteSlug,
    id,
    service,
    town,
    towns,
    state,
    initial,
    initialNeeded,
}: {
    siteSlug: string;
    id: string;
    /** The service's name; null for a town page. */
    service: string | null;
    town: string;
    /** The client's own towns, for the Q1 picker. */
    towns: string[];
    /** Two-letter state, for the GPS pre-select; "" when unknown. */
    state: string;
    initial: { photos: Photo[]; reviews: Review[]; job: string };
    initialNeeded: number;
}) {
    const router = useRouter();
    const [photos, setPhotos] = useState<Photo[]>(initial.photos);
    const [reviews, setReviews] = useState<Review[]>(initial.reviews.length ? initial.reviews : [{ text: "", name: "", verbatim: false, sent: false }]);
    const [job, setJob] = useState(initial.job);
    const [needed, setNeeded] = useState(initialNeeded);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [reason, setReason] = useState("");
    const qs = `?site=${encodeURIComponent(siteSlug)}`;

    async function addPhotos(files: FileList | null) {
        setUploadError("");
        for (const file of Array.from(files ?? []).slice(0, 12)) {
            const refused = precheck(file);
            if (refused) {
                setUploadError(refused);
                continue;
            }
            try {
                // Q1 pre-select from the photo's GPS, read before the clean-up strips it.
                const guess = state ? await guessPhotoTown(file, towns, `${state} 00000`).catch(() => "") : "";
                const clean = await prepareImage(file, "photo");
                const blob = await upload(clean.name, clean, { access: "public", handleUploadUrl: `/api/upload${qs}` });
                setPhotos((p) => [...p, { url: blob.url, filename: file.name, town: guess || town, sent: false }]);
                setSaved(false);
            } catch (e) {
                setUploadError(e instanceof PrepError ? e.message : "Upload failed. Please try again.");
            }
        }
    }

    async function save(submit: boolean) {
        setBusy(true);
        setSaved(false);
        try {
            const res = await fetch(`/api/portal/page-additions/facts${qs}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    id,
                    submit,
                    photos: photos.map((p) => ({ id: p.id, url: p.url, filename: p.filename, town: p.town })),
                    reviews: reviews.filter((r) => r.text.trim()).map((r) => ({ id: r.id, text: r.text, name: r.name, verbatim: r.verbatim, town })),
                    job,
                }),
            });
            if (!res.ok) return;
            const out = (await res.json()) as { needed: number; stage: string };
            setNeeded(out.needed);
            setSaved(true);
            if (submit) router.push(`/portal${qs}`);
            else router.refresh();
        } finally {
            setBusy(false);
        }
    }

    async function decline() {
        setBusy(true);
        try {
            const res = await fetch(`/api/portal/page-additions/decline${qs}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id, reason }),
            });
            if (res.ok) router.push(`/portal${qs}`);
        } finally {
            setBusy(false);
        }
    }

    const fieldStyle = { border: "1px solid var(--rule)", borderRadius: 6, padding: "8px 10px", background: "var(--panel, #fff)", color: "var(--fg)", width: "100%", maxWidth: 520, font: "inherit" } as const;
    const muted = { color: "var(--fg-3)" } as const;

    return (
        <div className="flex flex-col gap-3 lg:gap-4">
            <Card density="roomy" elevation={2} className="flex flex-col gap-2">
                <h1 className="text-xl font-semibold" style={{ color: "var(--fg)" }}>
                    {PA.wizardTitle(service, town)}
                </h1>
                <p className="text-sm max-w-prose" style={{ color: "var(--fg-2)" }}>
                    {PA.rule(service, town)}
                </p>
                {needed > 0 && (
                    <p className="text-[13px]" style={muted}>
                        {PA.moreNeeded(needed)}
                    </p>
                )}
            </Card>

            <div className="grid gap-3 lg:gap-4 md:grid-cols-2">
                <Card className="flex flex-col gap-2.5">
                    <h2 className="text-[15px] font-semibold">{PA.photosTitle(town)}</h2>
                    {service && (
                        <p className="text-[13px]" style={muted}>
                            {PA.photosHelp(service, town)}
                        </p>
                    )}
                    {photos.length > 0 && (
                        <ul className="flex flex-col gap-2">
                            {photos.map((p, i) => (
                                <li key={p.url} className="flex items-center gap-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- a just-uploaded blob preview */}
                                    <img src={p.url} alt="" width={64} height={64} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                                    <label className="flex flex-col gap-1 text-[13px]">
                                        <span style={{ color: "var(--fg-2)" }}>{PA.photoTownQ}</span>
                                        <select
                                            value={p.town}
                                            disabled={p.sent}
                                            onChange={(e) => setPhotos((all) => all.map((x, j) => (j === i ? { ...x, town: e.target.value } : x)))}
                                            style={{ ...fieldStyle, padding: "4px 8px", maxWidth: 220 }}
                                        >
                                            {towns.map((t) => (
                                                <option key={t} value={t}>
                                                    {t}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="text-[13px]" style={muted}>
                        {PA.photoTownHelp}
                    </p>
                    {uploadError && (
                        <p role="alert" className="text-[13px]" style={{ color: "var(--chart-neg)" }}>
                            {uploadError}
                        </p>
                    )}
                    <div>
                        <label className="btn" style={{ display: "inline-flex", cursor: busy ? "default" : "pointer" }}>
                            {PA.addPhotos}
                            <input type="file" accept={ACCEPT_ATTR} multiple className="sr-only" disabled={busy} onChange={(e) => void addPhotos(e.target.files)} />
                        </label>
                    </div>
                </Card>

                <Card className="flex flex-col gap-2.5">
                    <h2 className="text-[15px] font-semibold">{PA.reviewsTitle(town)}</h2>
                    {reviews.map((r, i) => {
                        const set = (patch: Partial<Review>) => {
                            setSaved(false);
                            setReviews((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                        };
                        return (
                            <div key={r.id ?? `new-${i}`} className="flex flex-col gap-2">
                                <label className="flex flex-col gap-1 text-[13px] font-semibold">
                                    {PA.review}
                                    <textarea rows={3} value={r.text} disabled={r.sent} onChange={(e) => set({ text: e.target.value })} style={fieldStyle} />
                                </label>
                                <label className="flex flex-col gap-1 text-[13px] font-semibold">
                                    {PA.firstName}
                                    <input value={r.name} disabled={r.sent} onChange={(e) => set({ name: e.target.value })} style={{ ...fieldStyle, maxWidth: 260 }} />
                                    <small className="font-normal" style={muted}>
                                        {PA.optional}
                                    </small>
                                </label>
                                <label className="flex items-start gap-2 text-[13px]" style={{ color: "var(--fg-2)" }}>
                                    <input type="checkbox" checked={r.verbatim} disabled={r.sent} onChange={(e) => set({ verbatim: e.target.checked })} />
                                    {PA.verbatimTick}
                                </label>
                            </div>
                        );
                    })}
                    <div>
                        <button type="button" className="btn" disabled={busy} onClick={() => setReviews((all) => [...all, { text: "", name: "", verbatim: false, sent: false }])}>
                            {PA.addReview}
                        </button>
                    </div>
                </Card>
            </div>

            <Card className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-[13px] font-semibold">
                    {PA.jobTitle(town)}
                    <textarea rows={3} value={job} onChange={(e) => (setSaved(false), setJob(e.target.value))} style={fieldStyle} />
                    <small className="font-normal" style={muted}>
                        {PA.jobHelp}
                    </small>
                </label>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn primary" disabled={busy} onClick={() => void save(true)}>
                    {PA.send}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void save(false)}>
                    {PA.saveLater}
                </button>
                {saved && (
                    <span className="text-[13px]" style={muted}>
                        {PA.saved}
                    </span>
                )}
            </div>
            {needed > 0 && (
                <p className="text-[13px]" style={muted}>
                    {PA.sendNote(needed)}
                </p>
            )}

            <Card className="flex flex-col gap-2">
                <h2 className="text-[15px] font-semibold">{PA.declineTitle}</h2>
                <p className="text-sm max-w-prose" style={{ color: "var(--fg-2)" }}>
                    {PA.declineBody}
                </p>
                <label className="flex flex-col gap-1 text-[13px] font-semibold">
                    {PA.declineReason}
                    <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={fieldStyle} />
                    <small className="font-normal" style={muted}>
                        {PA.optional}
                    </small>
                </label>
                <div>
                    <button type="button" className="btn" disabled={busy} onClick={() => void decline()}>
                        {PA.declineButton}
                    </button>
                </div>
            </Card>
        </div>
    );
}
