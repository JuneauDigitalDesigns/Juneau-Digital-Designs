"use client";

/**
 * A grey wireframe of the client's site, filled from their answers as they go.
 *
 * Deliberately not a preview. It shows where each answer will appear and never shows colors or
 * final copy: headlines are grey bars marked "written by us", photos are greyscale, and the caption
 * says "not the final design". The part the current question fills gets a teal outline.
 */

import { useEffect, useRef } from "react";
import { TRADE_OPTIONS, isAround247, servicesMenu, statValuesFor, STAT_LABELS, slotsFor, type WireFocus, type WizardState } from "./model";
import s from "./wizard.module.css";

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
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
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
                    <span className={hl("contact")}>{state.address.trim() || "Your address"}</span>
                    <span className={hl("hours")}>{(state.hours === "custom" ? state.customHours.trim() : state.hours) || "Your hours"}</span>
                </div>
            </div>
        </div>
    );
}
