"use client";

/**
 * One question per screen. Every client-facing string here was approved word for word by Xander
 * (onboarding copy deck, 2026-11-04). Change none of them without that approval.
 */

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import {
    BRAND_SUGGESTIONS,
    CERT_SUGGESTIONS,
    CHAPTERS,
    CUSTOM_HOURS,
    EMERGENCY_LINE,
    HOURS_PRESETS,
    MAX_SERVICES,
    MAX_VOICES,
    MAX_WORK_PHOTOS,
    TRADE_OPTIONS,
    askedStats,
    cleanEntry,
    customerOptions,
    diffOptions,
    isAnswered,
    modesFor,
    screenErrors,
    servicesMenu,
    slotsFor,
    townFromAddress,
    yearsInBusiness,
    type ReceptionistMode,
    type ScreenDef,
    type WizardContext,
    type WizardState,
} from "./model";
import { VOICE_OPTIONS } from "@jdd/schema";
import s from "./wizard.module.css";

/** The live, already-approved receptionist options (unchanged from the previous wizard). */
export const RECEPTIONIST_OPTIONS: { id: ReceptionistMode; label: string; detail: string }[] = [
    {
        id: "forwarded",
        label: "Forward my existing number",
        detail: "You keep the number you already advertise. We give you a number to forward to, and calls you do not pick up roll to your receptionist instead of voicemail.",
    },
    {
        id: "published",
        label: "Use the new number as my business number",
        detail: "We give you a number and you start using it: cards, truck, Google listing. Calls come straight in, ring your phone first, and reach the receptionist if you miss them.",
    },
    {
        id: "declined",
        label: "No receptionist for now, website only",
        detail: "We build the site and skip the phone side entirely. Same price, and you can switch it on later with no extra onboarding fee.",
    },
];

const TRADE_ICONS: Record<string, string> = { hvac: "❄", plumbing: "≈", roofing: "⌂", "lawn-care": "✿", "car-detailing": "◆", health: "✚" };

export type ScreenCopy = { q: string; help: string };

/** The question and the line under it, per screen. */
export function copyFor(id: string, state: WizardState, extra: { firstName: string; planLabel: string; maxSites: number }): ScreenCopy {
    switch (id) {
        case "welcome":
            return {
                q: extra.firstName ? `Let's build your site, ${extra.firstName}.` : "Let's build your site.",
                help: "Five short chapters, about eight minutes. Everything saves as you go, so you can stop and come back any time.",
            };
        case "trade": return { q: "What kind of work do you do?", help: "This shapes everything we suggest from here." };
        case "name": return { q: "What's your business called?", help: "Exactly as you want it on your site." };
        case "contact": return { q: "How do customers reach you?", help: "These go on your site. Your email is already filled in from your agreement." };
        case "area": return { q: "Which towns do you cover?", help: 'Named towns read better than "the surrounding area". Your receptionist uses them too.' };
        case "website": return { q: "Do you have a website now?", help: "We'll read it so you don't have to retype anything." };
        case "sites": return { q: "Additional sites", help: `Your ${extra.planLabel} plan includes up to ${extra.maxSites} sites. Add facts for each extra location or brand, and we write their copy too.` };
        case "services": return { q: "What do you offer?", help: "Tap everything you do. We write the descriptions." };
        case "apart": return { q: "What sets you apart?", help: "Pick anything that's true. This is the most useful thing we can know." };
        case "customers": return { q: "Who do you mostly work for?", help: "It tells us who your site is talking to." };
        case "since": return { q: "When did you start, and are you licensed?", help: "We use these exactly as you give them and never guess." };
        case "people": return { q: `Who's behind ${state.name.trim() || "your business"}?`, help: "People hire people. These make your site sound like you." };
        case "brands": return { q: "Which brands do you install or service?", help: "Recognizable names build trust fast. Tap any that apply, or add your own." };
        case "certs": return { q: "Any certifications or awards?", help: "Shown as badges on your site. Tap any you hold, or add your own exactly as you want it written." };
        case "reviews": return { q: "How do customers rate you?", help: "Shown as a rating badge on your site. Leave these blank if you'd rather not show one." };
        case "numbers": return { q: "A few numbers for your site", help: "We'll never make these up. Leave any blank and we'll leave it off." };
        // The four trade-template screens below carry the previous wizard's live wording.
        case "prices": return { q: "Starting prices", help: 'Shown as "Starting at $X" on that service. Leave any blank to show no price.' };
        case "seasons": return { q: "Seasonal programs", help: "" };
        case "radius": return { q: "How far do you travel for mobile service?", help: "In miles. Leave blank if you don't offer mobile service." };
        case "offer": return { q: "Any current promotional offer?", help: "Shown as a small ribbon on the site. Leave blank if none." };
        case "logo": return { q: "Do you have a logo?", help: "PNG, JPG or WebP, up to 10 MB. A clear, high-quality version is best." };
        case "photos": return { q: "Show us your work", help: "Real photos of your jobs, vans and team beat stock photos every time. Add what you have." };
        case "voice": return { q: "How should your site sound?", help: "Pick up to three. It steers how we write." };
        case "setup": return { q: "How will calls reach your receptionist?", help: "Your receptionist never answers before you do. It only picks up when nobody else does." };
        case "hours": return { q: "When are you open?", help: "Shown on your site, and your receptionist can tell callers." };
        case "review": return { q: "Ready to build?", help: "Check it over. Anything you skipped, we'll ask about before we start." };
        default: return { q: "", help: "" };
    }
}

export type ScreenProps = {
    def: ScreenDef;
    screens: ScreenDef[];
    state: WizardState;
    ctx: WizardContext;
    errors: Record<string, string>;
    update: (patch: Partial<WizardState>) => void;
    toast: (msg: string) => void;
    goTo: (id: string) => void;
    uploads: {
        busy: Set<string>;
        errors: Record<string, string>;
        logo: (files: File[]) => void;
        work: (files: File[]) => void;
        team: (files: File[]) => void;
    };
    extra: { firstName: string; planLabel: string; maxSites: number };
};

// ── Small building blocks ────────────────────────────────────────────────────

function Field({ label, optional, error, note, children }: { label?: string; optional?: boolean; error?: string; note?: ReactNode; children: ReactNode }) {
    return (
        <label className={`${s.fld} ${error ? s.bad : ""}`}>
            {label ? <span className={s.fldLab}>{label}{optional ? <small>Optional</small> : null}</span> : null}
            {children}
            {error ? <span className={s.err}>{error}</span> : note ? <span className={s.note}>{note}</span> : null}
        </label>
    );
}

function Text({ value, onChange, placeholder, type = "text", inputMode, ariaLabel, autoComplete = "off" }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
    inputMode?: "text" | "tel" | "email" | "numeric" | "decimal" | "url"; ariaLabel?: string; autoComplete?: string;
}) {
    return (
        <input
            className={s.input}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            type={type}
            inputMode={inputMode}
            aria-label={ariaLabel}
            autoComplete={autoComplete}
        />
    );
}

function Chip({ label, on, onClick, ghost, removable }: { label: string; on?: boolean; onClick: () => void; ghost?: boolean; removable?: boolean }) {
    return (
        <button
            type="button"
            className={`${s.chip} ${ghost ? s.chipGhost : ""} ${removable ? s.chipRm : ""}`}
            aria-pressed={ghost ? undefined : !!on}
            onClick={onClick}
        >
            {label}
            {removable ? <span className={s.x} aria-hidden="true">×</span> : null}
        </button>
    );
}

/**
 * Suggestion chips plus the client's own entries, all in one list. Long lists show 8 and a
 * "+ {n} more" chip; anything picked stays visible.
 */
function ChipList({ options, selected, onToggle, limit }: { options: string[]; selected: string[]; onToggle: (v: string) => void; limit?: number }) {
    const [open, setOpen] = useState(false);
    const all = [...options, ...selected.filter((v) => !options.includes(v))];
    const shown = open || !limit || all.length <= limit ? all : all.filter((o, i) => i < limit || selected.includes(o));
    const hidden = all.length - shown.length;
    return (
        <div className={s.chips}>
            {shown.map((o) => <Chip key={o} label={o} on={selected.includes(o)} onClick={() => onToggle(o)} />)}
            {hidden ? <Chip ghost label={`+ ${hidden} more`} onClick={() => setOpen(true)} /> : null}
        </div>
    );
}

/** "Add your own" box. Enter adds (the wizard's Enter-means-Continue skips inputs marked data-add). */
function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
    const [v, setV] = useState("");
    const add = () => {
        const clean = cleanEntry(v);
        if (clean) onAdd(clean);
        setV("");
    };
    return (
        <div className={s.addrow}>
            <input
                className={s.addInput}
                value={v}
                onChange={(e) => setV(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                data-add="1"
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        add();
                    }
                }}
            />
            <button type="button" className={s.addBtn} onClick={add}>Add</button>
        </div>
    );
}

function toggleIn(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function FilePicker({ accept, multiple, onFiles, children, className, ariaLabel }: {
    accept: string; multiple?: boolean; onFiles: (f: File[]) => void; children: ReactNode; className: string; ariaLabel?: string;
}) {
    const ref = useRef<HTMLInputElement | null>(null);
    const [over, setOver] = useState(false);
    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    };
    return (
        <>
            <button
                type="button"
                className={`${className} ${over ? s.dropOver : ""}`}
                aria-label={ariaLabel}
                onClick={() => ref.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
            >
                {children}
            </button>
            <input
                ref={ref}
                type="file"
                accept={accept}
                multiple={multiple}
                className={s.hidden}
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length) onFiles(files);
                }}
            />
        </>
    );
}

const ACCEPT = "image/png,image/jpeg,image/webp";

// ── Screens ──────────────────────────────────────────────────────────────────

export function ScreenBody(p: ScreenProps) {
    const { def, state, update, errors, toast } = p;
    switch (def.id) {
        case "welcome":
            return (
                <div className={`${s.callout} ${s.narrow}`}>
                    <b>Good to have nearby</b>
                    <br />
                    Your logo and a few photos of your work. No logo or photos yet? That&apos;s fine, we&apos;ll sort it.
                </div>
            );

        case "trade":
            return (
                <>
                    <div className={s.tiles} role="group" aria-label="Your trade">
                        {TRADE_OPTIONS.map((t) => (
                            <button key={t.id} type="button" className={s.tile} aria-pressed={state.trade === t.id} onClick={() => update({ trade: t.id })}>
                                <span className={s.tileIc} aria-hidden="true">{TRADE_ICONS[t.id] ?? "…"}</span>
                                <span>{t.label}</span>
                            </button>
                        ))}
                    </div>
                    {errors.trade ? <p className={s.err} role="alert">{errors.trade}</p> : null}
                </>
            );

        case "name":
            return (
                <div className={s.narrow}>
                    <Field label="Business name" error={errors.name}>
                        <Text value={state.name} onChange={(v) => update({ name: v })} placeholder="Ridgeline Heating & Air" autoComplete="organization" />
                    </Field>
                </div>
            );

        case "contact":
            return (
                <>
                    <div className={s.row2}>
                        <Field label="Business phone" error={errors.phone}>
                            <Text value={state.phone} onChange={(v) => update({ phone: v })} placeholder="(407) 555-0142" type="tel" inputMode="tel" autoComplete="tel" />
                        </Field>
                        <Field label="Business email" error={errors.email} note="From your agreement. Change it if leads should go somewhere else.">
                            <Text value={state.email} onChange={(v) => update({ email: v })} placeholder="you@yourbusiness.com" type="email" inputMode="email" autoComplete="email" />
                        </Field>
                    </div>
                    <Field label="Business address" error={errors.address} note="Used to find your local area and shown on your site.">
                        <Text value={state.address} onChange={(v) => update({ address: v })} placeholder="Street, city, state, ZIP" autoComplete="street-address" />
                    </Field>
                </>
            );

        case "area": {
            const town = townFromAddress(state.address);
            return (
                <>
                    <div className={s.chips}>
                        {state.towns.map((t) => <Chip key={t} label={t} on removable onClick={() => update({ towns: state.towns.filter((x) => x !== t) })} />)}
                        {town && !state.towns.includes(town) ? <Chip ghost label={`+ ${town} (from your address)`} onClick={() => update({ towns: [...state.towns, town] })} /> : null}
                    </div>
                    <AddRow placeholder="Add a town" onAdd={(v) => !state.towns.includes(v) && update({ towns: [...state.towns, v] })} />
                </>
            );
        }

        case "website":
            return (
                <div className={s.narrow}>
                    <Field label="Your current website" optional>
                        <Text value={state.website} onChange={(v) => update({ website: v })} placeholder="yourbusiness.com" inputMode="url" autoComplete="url" />
                    </Field>
                </div>
            );

        case "sites":
            return <SitesScreen {...p} />;

        case "services": {
            const menu = servicesMenu(state.trade);
            const names = state.services.map((x) => x.name);
            const toggle = (label: string) => {
                if (names.includes(label)) return update({ services: state.services.filter((x) => x.name !== label) });
                if (state.services.length >= MAX_SERVICES) return toast("Up to 12 services.");
                update({ services: [...state.services, { name: label, tag: menu.find((m) => m.label === label)?.tag ?? "" }] });
            };
            return (
                <>
                    <ChipList options={menu.map((m) => m.label)} selected={names} onToggle={toggle} limit={8} />
                    <AddRow placeholder="Something we missed?" onAdd={(v) => !names.includes(v) && toggle(v)} />
                    <p className={`${s.hint} ${s.count}`}>{state.services.length} picked, up to 12</p>
                </>
            );
        }

        case "apart":
            return (
                <>
                    <ChipList options={diffOptions(state.trade)} selected={state.diffs} onToggle={(v) => update({ diffs: toggleIn(state.diffs, v) })} limit={8} />
                    <AddRow placeholder="Something else? e.g. We clean up before we leave" onAdd={(v) => !state.diffs.includes(v) && update({ diffs: [...state.diffs, v] })} />
                </>
            );

        case "customers":
            return <ChipList options={customerOptions(state.trade)} selected={state.customers} onToggle={(v) => update({ customers: toggleIn(state.customers, v) })} />;

        case "since": {
            const years = yearsInBusiness(state.established);
            return (
                <div className={s.row2}>
                    <Field label="Year you started" optional note={years ? <span className={s.derived}>✓ {years} years in business. We&apos;ll show that on your site.</span> : undefined}>
                        <Text value={state.established} onChange={(v) => update({ established: v })} placeholder="2009" inputMode="numeric" />
                    </Field>
                    <Field label="License number" optional note="Shown as a credential. Leave blank if you don't hold one.">
                        <Text value={state.license} onChange={(v) => update({ license: v })} placeholder="CAC1812345" />
                    </Field>
                </div>
            );
        }

        case "people":
            return (
                <div className={s.row2}>
                    <Field label="Owner's name" optional note="Appears on your About page.">
                        <Text value={state.owner} onChange={(v) => update({ owner: v })} placeholder="Marcus Bell" autoComplete="name" />
                    </Field>
                    <Field label="How fast do you respond?" optional note="In your own words. It goes next to your call button.">
                        <Text value={state.response} onChange={(v) => update({ response: v })} placeholder="Within 2 hours" />
                    </Field>
                </div>
            );

        case "brands":
            return (
                <>
                    <ChipList options={BRAND_SUGGESTIONS[state.trade] ?? []} selected={state.brands} onToggle={(v) => update({ brands: toggleIn(state.brands, v) })} />
                    <AddRow placeholder="Another brand you install or service" onAdd={(v) => !state.brands.includes(v) && update({ brands: [...state.brands, v] })} />
                </>
            );

        case "certs":
            return (
                <>
                    <ChipList options={CERT_SUGGESTIONS[state.trade] ?? ["BBB accredited"]} selected={state.certs} onToggle={(v) => update({ certs: toggleIn(state.certs, v) })} />
                    <AddRow placeholder="e.g. Best of Orlando 2024" onAdd={(v) => !state.certs.includes(v) && update({ certs: [...state.certs, v] })} />
                </>
            );

        case "reviews":
            return (
                <>
                    <div className={`${s.row2} ${s.narrower}`}>
                        <Field label="Star rating">
                            <Text value={state.rating} onChange={(v) => update({ rating: v })} placeholder="4.9" inputMode="decimal" />
                        </Field>
                        <Field label="Number of reviews">
                            <Text value={state.reviewCount} onChange={(v) => update({ reviewCount: v })} placeholder="212" inputMode="numeric" />
                        </Field>
                    </div>
                    <div className={s.narrow}>
                        <Field label="Link to your reviews" optional note="Your Google reviews page works well.">
                            <Text value={state.reviewUrl} onChange={(v) => update({ reviewUrl: v })} placeholder="https://" inputMode="url" />
                        </Field>
                    </div>
                </>
            );

        case "numbers":
            return (
                <div className={s.narrow}>
                    {askedStats(state.trade, state).map((st) => (
                        <Field key={st.key} label={st.prompt}>
                            <Text value={state.statValues[st.key] ?? ""} onChange={(v) => update({ statValues: { ...state.statValues, [st.key]: v } })} placeholder={st.example} />
                        </Field>
                    ))}
                </div>
            );

        case "prices":
            return (
                <div className={s.narrow}>
                    {state.services.map((sv) => (
                        <Field key={sv.name} label={sv.name}>
                            <Text value={state.servicePrices[sv.name] ?? ""} onChange={(v) => update({ servicePrices: { ...state.servicePrices, [sv.name]: v } })} placeholder="e.g. $150" />
                        </Field>
                    ))}
                </div>
            );

        case "seasons":
            return (
                <div className={s.narrow}>
                    {(slotsFor(state.trade)?.seasons ?? []).map((se) => (
                        <Field key={se.key} label={se.label} note={se.prompt}>
                            <Text value={state.seasonBodies[se.key] ?? ""} onChange={(v) => update({ seasonBodies: { ...state.seasonBodies, [se.key]: v } })} placeholder="Leave blank if you don't offer this season" />
                        </Field>
                    ))}
                </div>
            );

        case "radius":
            return (
                <div className={s.narrower}>
                    <Field>
                        <Text value={state.serviceRadiusMiles} onChange={(v) => update({ serviceRadiusMiles: v })} placeholder="e.g. 25" inputMode="numeric" ariaLabel="How far do you travel for mobile service?" />
                    </Field>
                </div>
            );

        case "offer":
            return (
                <div className={s.narrow}>
                    <Field>
                        <Text value={state.offerBadge} onChange={(v) => update({ offerBadge: v })} placeholder="e.g. First mow free" ariaLabel="Any current promotional offer?" />
                    </Field>
                </div>
            );

        case "logo":
            return <LogoScreen {...p} />;

        case "photos":
            return <PhotosScreen {...p} />;

        case "voice":
            return (
                <>
                    <ChipList
                        options={VOICE_OPTIONS}
                        selected={state.voice}
                        onToggle={(v) => {
                            if (!state.voice.includes(v) && state.voice.length >= MAX_VOICES) return toast("Three is plenty. Untick one to swap.");
                            update({ voice: toggleIn(state.voice, v) });
                        }}
                    />
                    <div className={s.narrow} style={{ marginTop: 16 }}>
                        <Field label="Anything to avoid?" optional>
                            <Text value={state.avoid} onChange={(v) => update({ avoid: v })} placeholder="e.g. cheap, overly corporate" />
                        </Field>
                    </div>
                </>
            );

        case "setup":
            return <SetupScreen {...p} />;

        case "hours":
            return (
                <>
                    <div className={s.chips}>
                        {HOURS_PRESETS.map((h) => <Chip key={h} label={h} on={state.hours === h} onClick={() => update({ hours: state.hours === h ? "" : h })} />)}
                        <Chip label="Set my own hours" on={state.hours === CUSTOM_HOURS} onClick={() => update({ hours: state.hours === CUSTOM_HOURS ? "" : CUSTOM_HOURS })} />
                    </div>
                    {state.hours === CUSTOM_HOURS ? (
                        <div className={s.narrow} style={{ marginTop: 10 }}>
                            <Field>
                                <Text value={state.customHours} onChange={(v) => update({ customHours: v })} ariaLabel="Set my own hours" placeholder="Mon to Fri, 8am to 5pm" />
                            </Field>
                        </div>
                    ) : null}
                    <div className={s.chips} style={{ margin: "12px 0 18px" }}>
                        <Chip label={EMERGENCY_LINE} on={state.emergency} onClick={() => update({ emergency: !state.emergency })} />
                    </div>
                    <div className={s.narrower}>
                        <Field label="Name your receptionist" optional note="Leave it blank and we'll pick a friendly name.">
                            <Text value={state.agentName} onChange={(v) => update({ agentName: v })} placeholder="e.g. Sam" />
                        </Field>
                    </div>
                </>
            );

        case "review":
            return <ReviewScreen {...p} />;

        default:
            return null;
    }
}

function SitesScreen({ state, update, extra }: ScreenProps) {
    const set = (i: number, patch: Partial<WizardState["additionalSites"][number]>) =>
        update({ additionalSites: state.additionalSites.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    return (
        <>
            {state.additionalSites.map((site, i) => (
                <div key={i} className={s.siteCard}>
                    <div className={s.siteCardH}>
                        <span>Site {i + 2}</span>
                        <button type="button" className={`${s.lnk} ${s.lnkInline}`} onClick={() => update({ additionalSites: state.additionalSites.filter((_, j) => j !== i) })}>Remove</button>
                    </div>
                    <div className={s.row2}>
                        <Field label="Business name"><Text value={site.brandName} onChange={(v) => set(i, { brandName: v })} /></Field>
                        <Field label="Short name"><Text value={site.brandShort} onChange={(v) => set(i, { brandShort: v })} /></Field>
                        <Field label="Email"><Text value={site.email} onChange={(v) => set(i, { email: v })} type="email" /></Field>
                        <Field label="Phone"><Text value={site.phone} onChange={(v) => set(i, { phone: v })} type="tel" /></Field>
                        <Field label="Address"><Text value={site.address} onChange={(v) => set(i, { address: v })} /></Field>
                        <Field label="What makes it different?"><Text value={site.differentiators} onChange={(v) => set(i, { differentiators: v })} /></Field>
                    </div>
                </div>
            ))}
            {state.additionalSites.length < extra.maxSites - 1 ? (
                <button
                    type="button"
                    className={s.addBtn}
                    onClick={() => update({ additionalSites: [...state.additionalSites, { brandName: "", brandShort: "", email: "", phone: "", address: "", differentiators: "" }] })}
                >
                    + Add a site
                </button>
            ) : null}
        </>
    );
}

function LogoScreen({ state, update, uploads }: ScreenProps) {
    const logo = state.images.logo;
    if (logo) {
        return (
            <div className={`${s.drop} ${s.narrow}`} style={{ borderStyle: "solid", cursor: "default" }}>
                <span className={s.thumb} style={{ width: 64, height: 48 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo.url} alt="Logo preview" style={{ objectFit: "contain" }} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{logo.filename}</b>
                </span>
                <button type="button" className={s.lnk} onClick={() => update({ images: { ...state.images, logo: undefined } })}>Replace</button>
            </div>
        );
    }
    return (
        <div className={s.narrow} style={{ display: "grid", gap: 10 }}>
            <FilePicker accept={ACCEPT} onFiles={uploads.logo} className={s.drop}>
                <span style={{ fontSize: 26 }} aria-hidden="true">⤒</span>
                <span>
                    <b>{uploads.busy.has("logo") ? "Uploading…" : "Upload your logo"}</b>
                    <small>Drag it here or tap to choose a file</small>
                </span>
            </FilePicker>
            {uploads.errors.logo ? <p className={s.err} role="alert">{uploads.errors.logo}</p> : null}
            <button type="button" className={s.opt} aria-pressed={state.logoChoice === "design"} onClick={() => update({ logoChoice: state.logoChoice === "design" ? "" : "design" })}>
                <span className={s.optLabel}>Not yet. Design one for me.</span>
                <span className={s.optDetail}>We&apos;ll design a simple logo for you.</span>
            </button>
        </div>
    );
}

function PhotosScreen({ state, update, uploads }: ScreenProps) {
    const slides = state.images.heroSlides;
    const team = state.images.aboutFeature;
    return (
        <>
            <div className={s.grp}>
                <span className={s.lab}>Your work <small>Up to 10. Used across your homepage.</small></span>
                <div className={s.thumbs}>
                    {slides.map((img, i) => (
                        <span key={img.url} className={s.thumb}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={`Upload ${i + 1}`} />
                            <button type="button" className={s.thumbX} aria-label="Remove photo" onClick={() => update({ images: { ...state.images, heroSlides: slides.filter((_, j) => j !== i) } })}>✕</button>
                        </span>
                    ))}
                    {slides.length < MAX_WORK_PHOTOS ? (
                        <FilePicker accept={ACCEPT} multiple onFiles={uploads.work} className={`${s.thumb} ${s.thumbAdd}`} ariaLabel="Add photos">
                            {uploads.busy.has("hero") ? "…" : "+"}
                        </FilePicker>
                    ) : null}
                </div>
                {uploads.errors.hero ? <p className={s.err} role="alert">{uploads.errors.hero}</p> : null}
            </div>
            <div className={s.grp}>
                <span className={s.lab}>You or your team <small>One photo for your About page.</small></span>
                <div className={s.thumbs}>
                    {team ? (
                        <>
                            <span className={`${s.thumb} ${s.thumbWide}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={team.url} alt="Team photo" />
                            </span>
                            <button type="button" className={s.lnk} onClick={() => update({ images: { ...state.images, aboutFeature: undefined } })}>Remove</button>
                        </>
                    ) : (
                        <FilePicker accept={ACCEPT} onFiles={uploads.team} className={`${s.thumb} ${s.thumbWide} ${s.thumbAdd}`} ariaLabel="Add a team photo">
                            {uploads.busy.has("about-feature") ? "…" : "+"}
                        </FilePicker>
                    )}
                </div>
                {uploads.errors["about-feature"] ? <p className={s.err} role="alert">{uploads.errors["about-feature"]}</p> : null}
            </div>
            <p className={s.hint}>No photos yet? Skip this. We&apos;ll use quality stock photos and swap yours in whenever you send them.</p>
        </>
    );
}

function SetupScreen({ state, update, ctx, errors, goTo }: ScreenProps) {
    const allowed = modesFor(ctx);
    const signed = ctx.signedMode;
    return (
        <>
            {signed ? (
                <p className={s.signedNote}>
                    {signed === "declined"
                        ? "To add the receptionist, just reply to your welcome email and we'll sort out the paperwork."
                        : "You can switch between forwarding and a new number below. To move to website-only, reply to your welcome email and we'll handle the change."}
                </p>
            ) : null}
            {RECEPTIONIST_OPTIONS.filter((o) => allowed.includes(o.id) || (signed && o.id === signed)).map((o) => (
                <button key={o.id} type="button" className={s.opt} aria-pressed={state.receptionistMode === o.id} onClick={() => update({ receptionistMode: o.id })}>
                    <span className={s.optLabel}>{o.label}</span>
                    {o.id === signed ? <em className={s.tag} style={{ fontStyle: "normal" }}>You chose this when you signed</em> : null}
                    <span className={s.optDetail}>{o.detail}</span>
                </button>
            ))}
            {errors.receptionistMode ? <p className={s.err} role="alert">{errors.receptionistMode}</p> : null}
            {state.receptionistMode && state.receptionistMode !== "declined" ? (
                <div className={s.callout}>
                    We&apos;ll ring <b>{state.phone.trim() || "your business phone"}</b> first.{" "}
                    <button type="button" className={`${s.lnk} ${s.lnkInline}`} onClick={() => goTo("contact")}>Change it</button>
                </div>
            ) : null}
        </>
    );
}

/** What a screen's answers look like on the Review summary. */
export function summaryLines(id: string, st: WizardState): string[] {
    const t = (v: string) => v.trim();
    switch (id) {
        case "trade": return [TRADE_OPTIONS.find((o) => o.id === st.trade)?.label ?? ""];
        case "name": return [t(st.name)];
        case "contact": return [t(st.phone), t(st.email), t(st.address)];
        case "area": return [st.towns.join(", ")];
        case "website": return [t(st.website)];
        case "sites": return st.additionalSites.filter((x) => x.brandName.trim()).map((x) => x.brandName.trim());
        case "services": return [st.services.length ? `${st.services.length} services` : ""];
        case "apart": return [st.diffs.slice(0, 2).join(", ")];
        case "customers": return [st.customers.join(", ")];
        case "since": return [t(st.established) && `Since ${t(st.established)}`, t(st.license) && `License ${t(st.license)}`];
        case "people": return [t(st.owner), t(st.response)];
        case "brands": return [st.brands.join(", ")];
        case "certs": return [st.certs.join(", ")];
        case "reviews": return [t(st.rating) && t(st.reviewCount) ? `${t(st.rating)} stars from ${t(st.reviewCount)} reviews` : "", t(st.reviewUrl) ? "Review link added" : ""];
        case "logo": return [st.images.logo ? "Uploaded" : st.logoChoice === "design" ? "We'll design one" : ""];
        case "photos": return [st.images.heroSlides.length ? `${st.images.heroSlides.length} work photos` : "", st.images.aboutFeature ? "Team photo" : ""];
        case "voice": return [st.voice.join(", ")];
        case "setup": return [RECEPTIONIST_OPTIONS.find((o) => o.id === st.receptionistMode)?.label ?? ""];
        case "hours": return [st.hours === CUSTOM_HOURS ? t(st.customHours) : st.hours, t(st.agentName) && `Receptionist: ${t(st.agentName)}`];
        default: return [];
    }
}

function ReviewScreen({ state, ctx, screens, goTo }: ScreenProps) {
    const gaps = screens.filter((x) => x.required && !isRequiredOk(x.id, state, ctx));
    const skipped = screens.filter((x) => x.skippable && !isAnswered(x.id, state));
    return (
        <>
            {gaps.length ? (
                <div className={`${s.callout} ${s.calloutWarn}`} style={{ marginBottom: 12 }} role="alert">
                    <b>{gaps.length === 1 ? "One thing we need before you send:" : `${gaps.length} things we need before you send:`}</b>{" "}
                    {gaps.map((g) => (
                        <button key={g.id} type="button" className={`${s.lnk} ${s.lnkInline}`} style={{ margin: "0 4px" }} onClick={() => goTo(g.id)}>{g.nav}</button>
                    ))}
                </div>
            ) : null}
            <div className={s.sumgrid}>
                {CHAPTERS.map((c, i) => {
                    const inCh = screens.filter((x) => x.chapter === i);
                    const lines = inCh.flatMap((x) => summaryLines(x.id, state)).filter(Boolean);
                    return (
                        <div key={c.label} className={s.sum}>
                            <h3 className={s.sumH}>
                                {c.label}
                                <button type="button" onClick={() => inCh[0] && goTo(inCh[0].id)}>Edit</button>
                            </h3>
                            {/* Five lines at most, so the summary fits one screen; Edit shows the rest. */}
                            {lines.length ? lines.slice(0, 5).map((l, j) => <p key={j}>{l}</p>) : <p className={s.sumEmpty}>Nothing yet</p>}
                        </div>
                    );
                })}
            </div>
            {skipped.length ? (
                <p className={s.hint} style={{ marginTop: 12 }}>
                    Still to come:{" "}
                    {skipped.map((x) => (
                        <button key={x.id} type="button" className={`${s.lnk} ${s.lnkInline}`} style={{ fontSize: 12, margin: "0 4px" }} onClick={() => goTo(x.id)}>{x.nav}</button>
                    ))}
                </p>
            ) : null}
        </>
    );
}

function isRequiredOk(id: string, state: WizardState, ctx: WizardContext) {
    return Object.keys(screenErrors(id, state, ctx)).length === 0;
}
