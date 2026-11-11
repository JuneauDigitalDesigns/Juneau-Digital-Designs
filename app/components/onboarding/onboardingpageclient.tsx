"use client";

/**
 * The client onboarding wizard: Option B, "Build-along" (Xander, 2026-11-04).
 *
 * Full screen. A chapter rail on the left, one question in the middle, and a grey wireframe of
 * the client's site on the right that fills in as they answer. On a phone the rail becomes a slim
 * top bar and the wireframe a bottom sheet. One question per screen, sized to fit without scrolling.
 *
 * What it asks, what blocks and what it sends live in `wizard/model.ts` (pure, tested). The copy
 * lives in `wizard/screens.tsx` and was approved word for word. This file owns state, the draft,
 * uploads, browser history and sending.
 *
 * ── Sending ─────────────────────────────────────────────────────────────────
 *
 * Only an explicit click on Send sends. The form's own submit event is always cancelled (Enter in
 * a lone text field is an implicit submit), the footer's Next and Send are distinct keyed
 * type="button" elements so React never reuses one as the other, and Send ignores clicks for a
 * moment after Review appears so a double-click on Next can't land on it.
 * `test/onboarding-submit.test.mjs` holds that line; it reads this file.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { upload } from "@vercel/blob/client";
import { PrepError, precheck, prepareImage, type PrepKind } from "@/app/lib/image-prep";
import type { ImageMeta } from "@jdd/schema";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { findTaxIdPaths } from "@/app/lib/tax-id-guard.mjs";
import {
    CHAPTERS,
    MAX_WORK_PHOTOS,
    SERVICE_CAPS,
    buildPayload,
    detailBack,
    detailFinish,
    detailForward,
    emptyFacts,
    initialState,
    isAnswered,
    requiredGaps,
    restoreDraft,
    screenErrors,
    screensFor,
    type PlanSlug,
    type ReceptionistMode,
    type WizardPrefill,
    type WizardState,
} from "./wizard/model";
import { ScreenBody, copyFor } from "./wizard/screens";
import SiteWireframe, { PagesWireframe, ServiceWireframe } from "./wizard/SiteWireframe";
import { C } from "./wizard/copy-service-details";
import s from "./wizard/wizard.module.css";

const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AUTOSAVE_MS = 800;

/** How long Send ignores clicks after Review appears, so a double-click on Next can't send. */
const SEND_ARM_DELAY_MS = 600;

/**
 * Scoped to the site, not just the user: a client can have two sites waiting for their wizard,
 * and one shared draft let the second show (and overwrite) the first one's answers.
 */
function portalStorageKey(clerkUserId: string, siteRef: string): string | null {
    if (!clerkUserId) return null;
    return siteRef ? `jdd-onboarding-portal-${clerkUserId}-${siteRef}` : `jdd-onboarding-portal-${clerkUserId}`;
}

/**
 * Every image is cleaned in the browser before upload (app/lib/image-prep.ts): metadata and GPS
 * dropped, orientation applied, the long edge capped at 2560px, the logo's transparency kept.
 * The client still sees the name of the file they picked.
 */
async function uploadFile(file: File, kind: PrepKind): Promise<ImageMeta> {
    const clean = await prepareImage(file, kind);
    const blob = await upload(clean.name, clean, { access: "public", handleUploadUrl: "/api/upload" });
    return { url: blob.url, filename: file.name, alt: "" };
}

export default function OnboardingPageClient({
    plan,
    prefillEmail = "",
    signedReceptionistMode,
    signerName = "",
    prefill = null,
    clerkUserId = "",
    siteRef = "",
}: {
    plan: PlanSlug;
    prefillEmail?: string;
    /**
     * The phone choice made at signing. Pre-selects the phone step and locks the website-only
     * boundary: switching into or out of website-only is a terms change, not an edit.
     */
    signedReceptionistMode?: ReceptionistMode;
    /** The agreement signer, for the welcome line. Blank means no name in the greeting. */
    signerName?: string;
    /**
     * What we already hold (agreement, and the order for a sales-call close), to seed a blank
     * start so the client only checks it. A saved draft always wins over it.
     */
    prefill?: WizardPrefill | null;
    /** Part of the draft's localStorage key. */
    clerkUserId?: string;
    /** Which site this wizard fills in. Scopes the draft and is sent with the submission. */
    siteRef?: string;
}) {
    const ctx = useMemo(() => ({ plan, signedMode: signedReceptionistMode }), [plan, signedReceptionistMode]);
    // The server render and first client render must match, so the draft is read in an effect.
    const [state, setState] = useState<WizardState>(() => initialState(prefillEmail, signedReceptionistMode, prefill));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [dir, setDir] = useState<"f" | "b">("f");
    const [savedOnce, setSavedOnce] = useState(false);
    const [welcomeBack, setWelcomeBack] = useState<string | null>(null);
    const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [done, setDone] = useState<{ slug: string | null } | null>(null);
    const [busy, setBusy] = useState<Set<string>>(new Set());
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

    /** Set once the draft restore has finished, so autosave can't overwrite it with blanks. */
    const didRestoreRef = useRef(false);
    /** When Review last appeared; Send ignores clicks for SEND_ARM_DELAY_MS after it. */
    const reviewShownAtRef = useRef(0);

    const draftUrl = `/api/portal/onboarding/draft${siteRef ? `?site=${encodeURIComponent(siteRef)}` : ""}`;
    const storageKey = portalStorageKey(clerkUserId, siteRef);

    const screens = useMemo(
        () => screensFor(state, ctx),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state.trade, state.hours, state.emergency, state.services.length, ctx],
    );
    const index = Math.max(0, screens.findIndex((x) => x.id === state.screen));
    const def = screens[index];
    const questionScreens = screens.filter((x) => x.chapter >= 0);
    const position = questionScreens.indexOf(def);
    const gaps = requiredGaps(state, ctx);
    const schedule = SCHEDULES[plan];
    const extra = { firstName: (signerName || "").trim().split(/\s+/)[0] ?? "", planLabel: schedule.name, maxSites: schedule.maxSites };

    const showToast = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 2800);
        return () => clearTimeout(t);
    }, [toast]);

    // ── Draft restore (after mount) ──
    useEffect(() => {
        async function restore() {
            let local: { data: unknown; at: Date | null } | null = null;
            if (storageKey) {
                try {
                    const raw = localStorage.getItem(storageKey);
                    if (raw) {
                        const parsed = JSON.parse(raw) as { savedAt?: string };
                        if (parsed.savedAt && Date.now() - new Date(parsed.savedAt).getTime() > STORAGE_TTL_MS) localStorage.removeItem(storageKey);
                        else local = { data: parsed, at: parsed.savedAt ? new Date(parsed.savedAt) : null };
                    }
                } catch {
                    /* corrupt draft: ignore */
                }
            }
            let chosen = local?.data ?? null;
            try {
                const res = await fetch(draftUrl, { cache: "no-store" });
                if (res.ok) {
                    const body = (await res.json()) as { data: unknown; savedAt: string | null };
                    if (body.data && body.savedAt && (!local?.at || new Date(body.savedAt) > local.at)) chosen = body.data;
                }
            } catch {
                /* server draft unavailable: use local */
            }
            const startAt = chosen ? restoreDraft(chosen, initialState(prefillEmail, signedReceptionistMode, prefill)) : null;
            window.history.replaceState({ ...(window.history.state ?? {}), wiz: startAt?.screen ?? "welcome" }, "");
            if (chosen && startAt) {
                const restored = startAt;
                setState(restored);
                const at = screensFor(restored, ctx).find((x) => x.id === restored.screen);
                if (at && at.id !== "welcome") setWelcomeBack(at.nav);
            }
            didRestoreRef.current = true;
        }
        void restore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Draft autosave ──
    useEffect(() => {
        if (!didRestoreRef.current || done) return;
        const id = setTimeout(() => {
            const record = { ...state, savedAt: new Date().toISOString() };
            /**
             * The wizard collects no EIN at all; the operator types registration details in the
             * console. This value-shape tripwire stays so one can never be autosaved anyway (a
             * pasted note, a future field). Loud, not silent: losing one autosave is the right
             * trade against a 30-day leak, and the path (never the value) says where to fix it.
             */
            const leaked = findTaxIdPaths(record);
            if (leaked.length) {
                console.error(`[onboarding] draft autosave refused: tax-ID-shaped value at ${leaked.join(", ")}`);
                return;
            }
            if (storageKey) {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(record));
                } catch {
                    /* storage full or blocked: the server copy still saves */
                }
            }
            fetch(draftUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: record }),
                keepalive: true,
            })
                .then((r) => r.ok && setSavedOnce(true))
                .catch(() => {});
        }, AUTOSAVE_MS);
        return () => clearTimeout(id);
    }, [state, done, draftUrl, storageKey]);

    // ── Screen changes and browser history ──
    /**
     * Every screen change is a browser history entry, so the browser's own Back steps back one
     * question instead of leaving the wizard.
     */
    const goTo = useCallback(
        (id: string, opts: { push?: boolean } = {}) => {
            setErrors({});
            setWelcomeBack(null);
            setSheetOpen(false);
            setDir(screens.findIndex((x) => x.id === id) < index ? "b" : "f");
            setState((prev) => ({ ...prev, screen: id, visited: prev.visited.includes(id) ? prev.visited : [...prev.visited, id] }));
            if (opts.push !== false) window.history.pushState({ ...(window.history.state ?? {}), wiz: id }, "");
        },
        [screens, index],
    );
    const goToRef = useRef(goTo);
    useEffect(() => {
        goToRef.current = goTo;
    }, [goTo]);
    useEffect(() => {
        const onPop = (e: PopStateEvent) => {
            const id = (e.state as { wiz?: string } | null)?.wiz;
            if (id) goToRef.current(id, { push: false });
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    // A photo dropped outside every photo box used to open in the tab and leave the wizard
    // (2026-11-11). The boxes call preventDefault on their own drags, so anything still undecided
    // when it reaches the window is a stray file drop: show "no drop" and ignore it.
    useEffect(() => {
        const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
        const onDragOver = (e: DragEvent) => {
            if (e.defaultPrevented || !carriesFiles(e)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
        };
        const onDrop = (e: DragEvent) => {
            if (!e.defaultPrevented && carriesFiles(e)) e.preventDefault();
        };
        window.addEventListener("dragover", onDragOver);
        window.addEventListener("drop", onDrop);
        return () => {
            window.removeEventListener("dragover", onDragOver);
            window.removeEventListener("drop", onDrop);
        };
    }, []);

    useEffect(() => {
        if (def.id === "review") reviewShownAtRef.current = Date.now();
    }, [def.id]);

    const update = useCallback((patch: Partial<WizardState>) => {
        setState((prev) => ({ ...prev, ...patch }));
        setErrors((prev) => {
            const keys = Object.keys(patch);
            if (!keys.some((k) => k in prev)) return prev;
            const next = { ...prev };
            for (const k of keys) delete next[k];
            return next;
        });
    }, []);

    /**
     * On service details with a service open, the footer walks that service's short steps:
     * Next (and Enter) and Skip move forward, Back moves back, and "Done with this service" jumps
     * to its summary. From the summary, Next opens the following service.
     */
    const detailOpen = def.id === "details" && state.services.some((x) => x.name === state.detailOpen);
    const onDone = detailOpen && state.detailStep === "done";
    const followingService = state.services[state.services.findIndex((x) => x.name === state.detailOpen) + 1];
    const moveDetail = (patch: Partial<WizardState>) => {
        update(patch);
        document.querySelector(`.${s.scr}`)?.scrollTo({ top: 0 });
    };
    const next = () => {
        if (detailOpen) return moveDetail(detailForward(state));
        if (def.id === "review") return;
        const errs = screenErrors(def.id, state, ctx);
        if (Object.keys(errs).length) {
            setErrors(errs);
            return;
        }
        setState((prev) => ({ ...prev, skipped: prev.skipped.filter((x) => x !== def.id) }));
        const target = screens[Math.min(index + 1, screens.length - 1)];
        goTo(target.id);
    };
    const skip = () => {
        setState((prev) => ({ ...prev, skipped: prev.skipped.includes(def.id) ? prev.skipped : [...prev.skipped, def.id] }));
        goTo(screens[Math.min(index + 1, screens.length - 1)].id);
    };
    const back = () => {
        if (detailOpen) return moveDetail(detailBack(state));
        if (index > 0) goTo(screens[index - 1].id);
    };

    /** Enter means Continue in any text field, except the "add your own" boxes, where it adds. */
    const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
        const t = e.target as HTMLElement;
        if (e.key !== "Enter" || t.tagName !== "INPUT" || (t as HTMLInputElement).dataset.add) return;
        e.preventDefault();
        next();
    };

    // ── Uploads ──
    const markBusy = (slot: string, on: boolean) =>
        setBusy((prev) => {
            const n = new Set(prev);
            if (on) n.add(slot);
            else n.delete(slot);
            return n;
        });
    const setUploadError = (slot: string, msg: string | null) =>
        setUploadErrors((prev) => {
            const n = { ...prev };
            if (msg) n[slot] = msg;
            else delete n[slot];
            return n;
        });
    async function runUpload(slot: string, files: File[], apply: (metas: ImageMeta[]) => void) {
        for (const f of files) {
            const err = precheck(f);
            if (err) return setUploadError(slot, err);
        }
        setUploadError(slot, null);
        markBusy(slot, true);
        const kind: PrepKind = slot === "logo" ? "logo" : "photo";
        try {
            apply(await Promise.all(files.map((f) => uploadFile(f, kind))));
        } catch (e) {
            setUploadError(slot, e instanceof PrepError ? e.message : "Upload failed. Please try again.");
        } finally {
            markBusy(slot, false);
        }
    }
    const uploads = {
        busy,
        errors: uploadErrors,
        logo: (files: File[]) =>
            void runUpload("logo", files.slice(0, 1), ([meta]) => setState((p) => ({ ...p, logoChoice: "", images: { ...p.images, logo: meta } }))),
        work: (files: File[]) =>
            void runUpload("hero", files.slice(0, MAX_WORK_PHOTOS - state.images.heroSlides.length), (metas) =>
                setState((p) => ({ ...p, images: { ...p.images, heroSlides: [...p.images.heroSlides, ...metas].slice(0, MAX_WORK_PHOTOS) } })),
            ),
        team: (files: File[]) =>
            void runUpload("about-feature", files.slice(0, 1), ([meta]) => setState((p) => ({ ...p, images: { ...p.images, aboutFeature: meta } }))),
        service: (name: string, files: File[]) =>
            void runUpload(`svc:${name}`, files.slice(0, SERVICE_CAPS.photos), (metas) =>
                setState((p) => {
                    const f = p.serviceFacts[name] ?? emptyFacts();
                    return { ...p, serviceFacts: { ...p.serviceFacts, [name]: { ...f, photos: [...f.photos, ...metas].slice(0, SERVICE_CAPS.photos) } } };
                }),
            ),
    };

    // ── Sending ──
    const handleSubmit = async () => {
        if (submitting || requiredGaps(state, ctx).length) return;
        setSubmitting(true);
        setSubmitError("");
        try {
            const res = await fetch(`/api/portal/onboarding${siteRef ? `?site=${encodeURIComponent(siteRef)}` : ""}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(state, ctx)),
            });
            const data = (await res.json().catch(() => ({}))) as { message?: string; slug?: string };
            if (!res.ok) throw new Error(data.message || "Unable to submit your onboarding form right now.");
            if (storageKey) localStorage.removeItem(storageKey);
            setDone({ slug: data.slug ?? null });
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Unable to submit your onboarding form right now.");
        } finally {
            setSubmitting(false);
        }
    };

    const finishLater = () => {
        showToast("Saved. Next time you'll pick up right here.");
        setTimeout(() => window.location.assign("/portal"), 1400);
    };

    // ── Render ──
    const copy = copyFor(def.id, state, extra);
    const eyebrow = def.chapter >= 0 ? `${String(def.chapter + 1).padStart(2, "0")} · ${CHAPTERS[def.chapter].label}` : def.id === "review" ? "Review" : "Welcome";
    const meter = def.id === "welcome" ? 0 : def.id === "review" ? 100 : Math.round(((position + 1) / questionScreens.length) * 100);
    // Service details shows the site's pages, or the open service's own page, instead of the home page.
    const wireframe = done ? (
        <SiteWireframe state={state} focus="none" />
    ) : detailOpen && !onDone ? (
        <ServiceWireframe state={state} name={state.detailOpen} />
    ) : def.id === "details" ? (
        <PagesWireframe state={state} />
    ) : (
        <SiteWireframe state={state} focus={def.focus} />
    );
    const portalTarget = done?.slug ? `/portal?site=${encodeURIComponent(done.slug)}` : "/portal";

    const rail = CHAPTERS.map((c, i) => {
        const inCh = screens.filter((x) => x.chapter === i);
        const firstIdx = screens.indexOf(inCh[0]);
        const lastIdx = screens.indexOf(inCh[inCh.length - 1]);
        const reached = state.visited.includes(inCh[0].id);
        const cur = def.chapter === i;
        const isDone = index > lastIdx;
        const gap = inCh.some((x) => x.required && reached && !cur && Object.keys(screenErrors(x.id, state, ctx)).length);
        return (
            <div key={c.label}>
                <button
                    type="button"
                    className={`${s.ch} ${cur ? s.chCur : ""} ${isDone ? s.chDone : ""}`}
                    disabled={!reached || !!done}
                    onClick={() => goTo(screens[firstIdx].id)}
                    aria-current={cur ? "step" : undefined}
                >
                    <span className={s.chNum}>{isDone ? "✓" : i + 1}</span>
                    <span>
                        <b>{c.label}{gap ? <span className={s.gapDot} aria-hidden="true">●</span> : null}</b>
                        <span className={s.chMins}>{c.mins}</span>
                    </span>
                </button>
                {cur ? (
                    <ul className={s.sub}>
                        {inCh.map((x) => {
                            const xi = screens.indexOf(x);
                            const ok = xi < index && isAnswered(x.id, state);
                            return (
                                <li key={x.id} className={`${x.id === def.id ? s.subCur : ""} ${ok ? s.subOk : ""}`}>
                                    <button type="button" disabled={!state.visited.includes(x.id)} onClick={() => goTo(x.id)}>{x.nav}</button>
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
            </div>
        );
    });

    return (
        <main className={s.root}>
            <aside className={s.rail} aria-label="Onboarding chapters">
                <span className={s.mark}>Juneau Digital</span>
                {rail}
                <div className={s.railFoot}>
                    {savedOnce ? <span className={s.saved}>Saved just now</span> : null}
                    {!done ? <button type="button" className={`${s.lnk} ${s.lnkInline}`} onClick={finishLater}>Finish later</button> : null}
                </div>
            </aside>

            <div className={s.mtop}>
                <div className={s.mtopT}>
                    <span>{def.chapter >= 0 ? `Chapter ${def.chapter + 1} of 5` : def.id === "review" ? "Review" : "Welcome"}</span>
                    {def.chapter >= 0 ? <b>{CHAPTERS[def.chapter].label}</b> : null}
                    <div className={s.meter}><i style={{ width: `${meter}%` }} /></div>
                </div>
                <button type="button" className={s.pill} onClick={() => setSheetOpen(true)}>◧ Wireframe</button>
            </div>

            {/* Never submits natively: the Send button calls the sender directly. */}
            <form className={s.form} onSubmit={(e: FormEvent<HTMLFormElement>) => e.preventDefault()} onKeyDown={onKeyDown} noValidate>
                <div className={s.scr}>
                    {done ? (
                        <div className={`${s.scrIn} ${s.enterF}`}>
                            <h1 className={s.q}>{extra.firstName ? `Thank you, ${extra.firstName}. We're on it.` : "Thank you. We're on it."}</h1>
                            <p className={s.help}>You&apos;ll have a preview site within 72 hours. Your portal is where your calls and leads will live.</p>
                        </div>
                    ) : (
                        <div key={def.id} className={`${s.scrIn} ${dir === "b" ? s.enterB : s.enterF}`}>
                            {welcomeBack ? <p className={s.welcomeBack}>Welcome back. You were on {welcomeBack}.</p> : null}
                            {/* An open service has its own heading (its name), in the panel. */}
                            {detailOpen ? null : (
                                <>
                                    <div className={s.eyebrow}>{eyebrow}</div>
                                    <h1 className={s.q}>{copy.q}</h1>
                                    {copy.help ? <p className={s.help}>{copy.help}</p> : null}
                                </>
                            )}
                            <ScreenBody
                                def={def}
                                screens={screens}
                                state={state}
                                ctx={ctx}
                                errors={errors}
                                update={update}
                                toast={showToast}
                                goTo={goTo}
                                uploads={uploads}
                                extra={extra}
                                prefill={prefill}
                            />
                            {def.id === "review" && submitError ? <p className={s.err} role="alert" style={{ marginTop: 12 }}>{submitError}</p> : null}
                        </div>
                    )}
                </div>

                <div className={s.bar}>
                    {done ? (
                        <>
                            <span className={s.barSp} />
                            <button type="button" className={s.btn} onClick={() => window.location.assign(portalTarget)}>Go to your portal</button>
                        </>
                    ) : (
                        <>
                            {def.id === "welcome" ? <span /> : <button type="button" className={s.lnk} onClick={back}>← Back</button>}
                            <span className={s.barSp}>
                                {detailOpen && !onDone ? (
                                    <button type="button" className={`${s.lnk} ${s.deskOnly}`} onClick={() => moveDetail(detailFinish(state))}>{C.doneWithService}</button>
                                ) : detailOpen ? null : (
                                    <>
                                        {position >= 0 ? <span className={s.hint}>{position + 1} of {questionScreens.length}</span> : null}
                                        {def.id !== "review" ? <span className={s.hint} style={{ marginLeft: 14 }}>or press Enter</span> : null}
                                    </>
                                )}
                            </span>
                            {detailOpen && !onDone ? <button type="button" className={s.lnk} onClick={next}>{C.skip}</button> : null}
                            {onDone && followingService ? <button type="button" className={`${s.lnk} ${s.deskOnly}`} onClick={() => moveDetail({ detailOpen: "", detailStep: "" })}>{C.backToAll}</button> : null}
                            {def.skippable && !detailOpen && !isAnswered(def.id, state) ? <button type="button" className={s.lnk} onClick={skip}>Skip for now</button> : null}
                            {/* Distinct keys and type="button" on both: React must never reuse the Next
                                node as the Send node, and neither may ever be a native submit. */}
                            {def.id === "review" ? (
                                <button
                                    key="send"
                                    type="button"
                                    className={s.btn}
                                    disabled={submitting || busy.size > 0 || gaps.length > 0}
                                    onClick={() => {
                                        // A double-click on Next lands its second click here, on the
                                        // Send button that just replaced Next in the same spot.
                                        if (Date.now() - reviewShownAtRef.current < SEND_ARM_DELAY_MS) return;
                                        void handleSubmit();
                                    }}
                                >
                                    {submitting ? "Sending…" : "Send it to us"}
                                </button>
                            ) : (
                                <button key="next" type="button" className={s.btn} onClick={next} disabled={busy.size > 0}>
                                    {onDone
                                        ? followingService ? <><span className={s.deskOnly}>{C.nextServiceNamed(followingService.name)}</span><span className={s.phoneOnly}>{C.nextServiceShort}</span></> : C.backToAll
                                        : detailOpen ? C.next : def.id === "welcome" ? "Let's start" : "Continue"}{" "}
                                    <span className={s.kbd} aria-hidden="true">↵</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </form>

            <section className={s.prev} aria-label="Wireframe of your site">
                <div className={s.cap}>
                    <span>{detailOpen && !onDone && !done ? C.capService : "Wireframe of your site"}</span>
                    <span>{def.id === "details" && (!detailOpen || onDone) && !done ? C.capPages : "Shows what goes where, not the final design"}</span>
                </div>
                {wireframe}
            </section>

            {sheetOpen ? (
                <div className={s.sheet} onClick={(e) => e.target === e.currentTarget && setSheetOpen(false)}>
                    <div className={s.sheetIn} role="dialog" aria-label="Wireframe of your site">
                        <div className={s.grab} />
                        <div className={s.cap}>
                            <span>{detailOpen && !onDone ? C.capServicePhone : "Wireframe of your site, not the final design"}</span>
                            <button type="button" className={`${s.lnk} ${s.lnkInline}`} onClick={() => setSheetOpen(false)}>Close</button>
                        </div>
                        {wireframe}
                    </div>
                </div>
            ) : null}

            {toast ? <div key={toast.id} className={s.toast} role="status">{toast.msg}</div> : null}
        </main>
    );
}
