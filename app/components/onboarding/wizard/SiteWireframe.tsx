"use client";

/**
 * A grey wireframe of the client's site, filled from their answers as they go.
 *
 * Deliberately not a preview. It shows where each answer will appear and never shows colors or
 * final copy: headlines are grey bars marked "written by us", photos are greyscale, and the caption
 * says "not the final design". The part the current question fills gets a teal outline.
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { serviceSlug } from "@jdd/schema";
import {
    TRADE_OPTIONS,
    emptyFacts,
    isAround247,
    profilesForPayload,
    serviceStatuses,
    servicesMenu,
    statValuesFor,
    STAT_LABELS,
    slotsFor,
    type WireFocus,
    type WizardState,
} from "./model";
import { C, PROFILE_SHORT } from "./copy-service-details";
import s from "./wizard.module.css";

/** The address as the site shows it: a service-area business shows town, state and ZIP only. */
function shownAddress(state: WizardState): string {
    const a = state.address.trim();
    if (state.visitAddress !== "no") return a;
    const parts = a.split(",").map((p) => p.trim()).filter(Boolean);
    return parts.length >= 2 ? parts.slice(1).join(", ") : "";
}

function Chrome({ path, state, children }: { path: string; state: WizardState; children: ReactNode }) {
    const host = (state.website.trim() || "yourbusiness.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return (
        <div className={s.site} aria-hidden="true">
            <div className={s.sbar}>
                <i /><i /><i />
                <span>{host}{path}</span>
            </div>
            <div className={s.sc}>
                <div className={s.sNav}>
                    <span className={s.sLogo}>
                        <span className={s.sMk} />
                        <span style={{ display: "grid", minWidth: 0 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{state.name.trim() || "Your business"}</span>
                            {/* The tagline sits under the name (F-C2a, 2026-11-11). */}
                            {state.tagline?.trim() ? (
                                <small style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 400, opacity: 0.75 }}>{state.tagline.trim()}</small>
                            ) : null}
                        </span>
                    </span>
                    <span className={s.sLinks}><span><b>Services ▾</b></span><span>About</span></span>
                    <span className={s.sCall}>Call {state.phone.trim() || "now"}</span>
                </div>
                {children}
            </div>
        </div>
    );
}

/** On the service-details list: the site's pages, with each service's own page as it earns one. */
export function PagesWireframe({ state }: { state: WizardState }) {
    const statuses = useMemo(() => serviceStatuses(state), [state]);
    return (
        <Chrome path="" state={state}>
            <div className={s.pgList}>
                <div className={s.pg}>Home</div>
                <div className={s.pg}>Services<small>{C.pgAll(state.services.length)}</small></div>
                {state.services.map((sv, i) => {
                    const st = statuses[i]?.state ?? "none";
                    if (st === "none") return null;
                    return (
                        <div key={sv.name} className={`${s.pg} ${st === "ready" ? `${s.pgOwn} ${s.hl}` : s.pgDash}`}>
                            {sv.name}
                            <small>{st === "ready" ? C.pgOwn : st === "near" ? C.pgNear : C.pgCore}</small>
                        </div>
                    );
                })}
                <div className={s.pg}>About</div>
                <div className={s.pg}>Contact</div>
            </div>
        </Chrome>
    );
}

/**
 * On one service's details: that service's own page, blocks filling in as the client answers,
 * in the order the page shows them (service-page-spec.md §3). Empty blocks are dashed hints.
 */
export function ServiceWireframe({ state, name }: { state: WizardState; name: string }) {
    const f = state.serviceFacts[name] ?? emptyFacts();
    const slug = serviceSlug({ t: name }, []);
    const areas = f.areasMode === "some" ? f.areas : [];
    return (
        <Chrome path={`/services/${slug}`} state={state}>
            <div className={s.sSec} style={{ padding: "12px 14px" }}>
                <div className={s.sCrumb}>Home › Services › {name}</div>
                <div className={s.sH} style={{ width: "85%" }} />
                <div className={s.sL} style={{ marginTop: 6 }} />
                <div className={s.sL} style={{ width: "75%" }} />
            </div>
            {f.included.length ? (
                <div className={s.sSec}><h6>What&apos;s included</h6><div className={s.sList}>{f.included.slice(0, 8).map((x) => <span key={x}>{x}</span>)}</div></div>
            ) : null}
            {f.typicalJobs.length ? (
                <div className={s.sSec}><h6>Signs it&apos;s time to call</h6><div className={s.sTowns}>{f.typicalJobs.slice(0, 6).map((x) => <span key={x}>{x}</span>)}</div></div>
            ) : <div className={s.sGhost}>{C.ghostJobs}</div>}
            {f.duration.trim() ? (
                <div className={s.sSec}><h6>What to expect</h6><div className={s.sTowns}><span>{f.duration.trim()}</span></div></div>
            ) : <div className={s.sGhost}>{C.ghostExpect}</div>}
            {f.priceFrom.trim() ? (
                <div className={s.sSec}><b style={{ fontSize: 12 }}>Starting at {f.priceFrom.trim()}</b></div>
            ) : <div className={s.sGhost}>{C.ghostPrice}</div>}
            {areas.length ? (
                <div className={s.sSec}><h6>Areas we serve</h6><div className={s.sTowns}>{areas.map((t) => <span key={t}>{t}</span>)}</div></div>
            ) : state.towns.length >= 2 ? <div className={s.sGhost}>{C.ghostAreas}</div> : null}
            {f.brands.length ? (
                <div className={s.sSec}><h6>Brands we work with</h6><div className={s.sTrust}>{f.brands.map((b) => <span key={b}>{b}</span>)}</div></div>
            ) : null}
            {f.questions.length ? (
                <div className={s.sSec}><h6>Common questions</h6>{f.questions.map((q) => <div key={q.q} style={{ fontSize: 9.5, fontWeight: 700, marginBottom: 3 }}>{q.q}</div>)}</div>
            ) : <div className={s.sGhost}>{C.ghostQuestions}</div>}
            {f.photos.length ? (
                <div className={s.sSec}><div className={s.thumbs}>{f.photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.url} src={p.url} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 6, filter: "grayscale(1)" }} />
                ))}</div></div>
            ) : <div className={s.sGhost}>{C.ghostPhotos}</div>}
            <div className={s.sFoot}><span>Call {state.phone.trim() || "now"}</span><span>Ask for a quote</span></div>
        </Chrome>
    );
}

/** HVAC's four stats when the trade has no template, so the band still shows where numbers go. */
const FALLBACK_STATS = ["yearsTrading", "rating", "coverageTowns", "emergencyAvailability"];

export default function SiteWireframe({ state, focus }: { state: WizardState; focus: WireFocus }) {
    const hl = (k: WireFocus) => (focus === k ? s.hl : "");
    // On short screens the wireframe is taller than its column, so bring the outlined part into view.
    const scRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = scRef.current?.querySelector(`.${s.hl}`) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [focus]);
    const name = state.name.trim() || "Your business";
    const trade = TRADE_OPTIONS.find((t) => t.id === state.trade)?.label.split(" /")[0];
    const tags = Object.fromEntries(servicesMenu(state.trade).map((m) => [m.label, m.tag]));
    const values = statValuesFor(state);
    const statKeys = slotsFor(state.trade)?.stats.map((x) => x.key) ?? FALLBACK_STATS;
    const shownStats = statKeys.slice(0, 4).map((k) => ({
        k,
        // The rating tile shows the score alone; the count goes in its caption.
        v: k === "rating" ? (state.rating.trim() ? `${state.rating.trim()}★` : "") : values[k] ?? (k === "emergencyAvailability" && isAround247(state) ? "24/7" : ""),
        l: k === "rating" && state.reviewCount.trim() ? `${state.reviewCount.trim()} reviews` : STAT_LABELS[k] ?? k,
    }));
    const services = state.services.length ? state.services.slice(0, 6).map((x) => x.name) : ["Your services", "appear here", "as you pick them"];
    const towns = state.towns.length ? state.towns : ["your towns"];
    const firstPhoto = state.images.heroSlides[0]?.url;
    const profileNames = profilesForPayload(state.profiles).map((p) => PROFILE_SHORT[p.kind]);

    return (
        <div className={s.site} aria-hidden="true">
            <div className={s.sbar}>
                <i /><i /><i />
                <span className={hl("website")}>{(state.website.trim() || "yourbusiness.com").replace(/^https?:\/\//, "")}</span>
            </div>
            <div className={s.sc} ref={scRef}>
                <div className={s.sNav}>
                    <span className={`${s.sLogo} ${hl("brand")}`}>
                        {state.images.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={state.images.logo.url} alt="" />
                        ) : (
                            <span className={s.sMk} />
                        )}
                        <span style={{ display: "grid", minWidth: 0 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                            {/* The tagline sits under the name (F-C2a, 2026-11-11). */}
                            {state.tagline?.trim() ? (
                                <small style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 400, opacity: 0.75 }}>{state.tagline.trim()}</small>
                            ) : null}
                        </span>
                        {state.logoChoice === "design" && !state.images.logo ? <span className={s.sTbd}>logo by JDD</span> : null}
                    </span>
                    <span className={s.sLinks}><span>Services</span><span>About</span><span>Reviews</span></span>
                    <span className={`${s.sCall} ${hl("call")} ${hl("contact")}`}>Call {state.phone.trim() || "now"}</span>
                </div>

                <div className={s.sHero}>
                    <div className={hl("hero")}>
                        <div className={s.sEb}>{[state.towns[0] || "Your town", trade || "Your trade"].join(" · ")}</div>
                        <div className={s.sH} />
                        <div className={`${s.sH} ${s.sH2}`} />
                        <div className={s.sCopy}>your headline, written by us</div>
                        <div className={s.sL} />
                        <div className={s.sL} style={{ width: "80%" }} />
                        <div className={s.sCtas}>
                            <span className={s.sP}>Book a visit</span>
                            <span className={s.sG}>{state.response.trim() || "Our services"}</span>
                        </div>
                    </div>
                    <div className={`${s.sPhoto} ${hl("photos")}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {firstPhoto ? <img src={firstPhoto} alt="" /> : null}
                        <span className={s.sStock}>{firstPhoto ? "your photos" : "stock photo until you add yours"}</span>
                    </div>
                </div>

                <div className={`${s.sStats} ${hl("stats")}`}>
                    {shownStats.map(({ k, v, l }) => (
                        <div key={k} className={v ? "" : s.sEmpty}>
                            <b>{v || "·"}</b>
                            <span>{l}</span>
                        </div>
                    ))}
                </div>

                <div className={`${s.sSec} ${hl("services")}`}>
                    <h6>Services</h6>
                    <div className={s.sSvc}>
                        {services.map((x) => (
                            <div key={x}><small>{tags[x] ?? ""}</small>{x}</div>
                        ))}
                    </div>
                </div>

                <div className={`${s.sSec} ${hl("pillars")}`}>
                    <h6>Why {name.split(" ")[0]}</h6>
                    <div className={s.sTrust}>
                        {(state.diffs.length ? state.diffs.slice(0, 4) : ["what sets you apart"]).map((d) => <span key={d}>{d}</span>)}
                    </div>
                </div>

                <div className={`${s.sSec} ${hl("trust")}`}>
                    <div className={s.sTrust}>
                        {state.license.trim() ? <span>Lic. {state.license.trim()}</span> : null}
                        {state.certs.map((c) => <span key={`c-${c}`}>{c}</span>)}
                        {state.brands.map((b) => <span key={`b-${b}`}><b>{b}</b></span>)}
                        {state.owner.trim() ? <span>Owner: {state.owner.trim()}</span> : null}
                    </div>
                </div>

                <div className={`${s.sSec} ${hl("towns")}`}>
                    <h6>Areas we serve</h6>
                    <div className={s.sTowns}>{towns.map((t) => <span key={t}>{t}</span>)}</div>
                </div>

                <div className={s.sFoot}>
                    <span className={hl("contact")}>{shownAddress(state) || "Your address"}</span>
                    <span className={hl("hours")}>{(state.hours === "custom" ? state.customHours.trim() : state.hours) || "Your hours"}</span>
                    {profileNames.length || focus === "profiles" ? (
                        <span className={hl("profiles")} style={{ marginLeft: "auto" }}>{profileNames.join(" · ") || C.profilesPlaceholder}</span>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
