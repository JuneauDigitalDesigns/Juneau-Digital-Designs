import { FILM_CALL, FILM_CALL_IN, FILM_COPY, FILM_SITE, type CallScenario } from "@/app/data/switchboard-calls";
import { lineMs } from "./film-timing";

/**
 * The receptionist film's script, out of the component so it can be played on a fake clock and
 * checked (`test/receptionist-film.test.mjs`).
 *
 * Two rules came with it on 2026-11-18 (Xander):
 *
 * 1. **No cursor.** Phones have none. Every press on the site is a tap: a ripple where the
 *    finger lands (`tap`), on the call button in the Starter story and on each form field as it
 *    is filled in in the Growth one.
 *
 * 2. **Every change moves forward.** The screens swap with the old one leaving before the new one
 *    arrives (AnimatePresence `mode="wait"`, about 0.7s in all). The script used to lift a title
 *    card in the same moment it changed the screen behind it, so for that 0.7s the card faded
 *    off the *previous* screen on its way out: the owner's ringing phone flashed back after
 *    "Instead, your receptionist answers", and the website after "About a minute later". Now a
 *    screen changes behind a card only once the card is fully up (`CARD_IN_MS`), and the card
 *    lifts only once the new screen has fully arrived (`SWAP_MS`). The test plays both stories
 *    and holds every swap to that.
 */

export type Mode = "starter" | "growth";
export type Screen = "idle" | "site" | "dialing" | "ownerRing" | "ringIn" | "call" | "text";
export type Side = "their" | "your";

type Box = { x: number; y: number; w: number; h: number };
const centre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export interface SiteState {
    scroll: number;
    /** The last tap, in screen coordinates; `n` counts taps so each one replays its ripple. */
    tap: { x: number; y: number; n: number } | null;
    pressed: "call" | "hero" | "submit" | null;
    focus: "name" | "phone" | null;
    name: string;
    phone: string;
    ticked: boolean;
    callout: "call" | "form" | null;
}

export const SITE_START: SiteState = {
    scroll: 0,
    tap: null,
    pressed: null,
    focus: null,
    name: "",
    phone: "",
    ticked: false,
    callout: null,
};

/** How long each beat holds, in ms of film time. The pauses are what make it read as real. */
export const T = {
    card: 1600,
    cardLong: 2200,
    dialing: 2000,
    ringBeforeBusy: 1800,
    busy: 2400,
    ringIn: 2600,
    callRest: 1200,
    text: 5500,
    /* A callout's line draws, then its box: reading time follows its words (240ms each). */
    callNumber: 5400,
    fillForm: 6800,
};

/** A title card's fade in (StageCard: 0.32s), with room: a screen may change behind it after this. */
export const CARD_IN_MS = 400;
/** A screen's swap: the old one leaves (0.35s), then the new one arrives (0.35s), with room. */
export const SWAP_MS = 800;
/** Typing speed on the phone's keyboard. */
export const KEY_MS = 70;

/** The calls run ~10s on screen but stand for real calls of a minute or more. */
export const REPRESENTS_SEC: Record<Mode, number> = { starter: 78, growth: 94 };

/** Everything the script can do to the film. The component draws it; the test records it. */
export interface FilmActor {
    screen(s: Screen): void;
    card(c: { label: string; sub?: string } | null): void;
    side(s: Side): void;
    site(p: Partial<SiteState> | ((s: SiteState) => Partial<SiteState>)): void;
    busy(b: boolean): void;
    /** The call screen, with no line up yet and the timer at 0:00. */
    startCall(sc: CallScenario): void;
    line(i: number): void;
    endCall(): void;
}

export function scenarioFor(mode: Mode): CallScenario {
    return mode === "starter" ? FILM_CALL_IN : FILM_CALL;
}

export async function playStory(mode: Mode, act: FilmActor, wait: (ms: number) => Promise<void>): Promise<void> {
    const sc = scenarioFor(mode);
    const tap = (p: { x: number; y: number }) =>
        act.site((s) => ({ tap: { x: p.x, y: p.y - s.scroll, n: (s.tap?.n ?? 0) + 1 } }));
    const press = async (what: SiteState["pressed"], at: Box) => {
        tap(centre(at));
        act.site({ pressed: what });
        await wait(400);
        act.site({ pressed: null });
    };
    const type = async (field: "name" | "phone", text: string) => {
        tap(centre(FILM_SITE[field]));
        act.site({ focus: field });
        await wait(250);
        for (let i = 1; i <= text.length; i++) {
            await wait(KEY_MS);
            act.site({ [field]: text.slice(0, i) } as Partial<SiteState>);
        }
        await wait(300);
        act.site({ focus: null });
    };
    /** A title card, and the screen behind it changed once the card is fully up. */
    const behind = async (card: { label: string; sub?: string }, change: () => void, hold: number) => {
        act.card(card);
        await wait(CARD_IN_MS);
        change();
        await wait(Math.max(SWAP_MS, hold - CARD_IN_MS));
        act.card(null);
    };
    const talk = async () => {
        for (let i = 0; i < sc.transcript.length; i++) {
            act.line(i);
            await wait(lineMs(sc.transcript[i].text));
        }
        await wait(T.callRest);
        act.endCall();
    };

    act.site(SITE_START);
    act.busy(false);
    act.side("their");

    if (mode === "starter") {
        await behind({ label: FILM_COPY.customerSees, sub: FILM_COPY.everyPlan }, () => act.screen("site"), T.card);
        await wait(900);
        // A tap on the number in the hero.
        await press("call", FILM_SITE.heroCall);
        await wait(500);
        act.screen("dialing");
        await wait(T.dialing);

        await behind(
            { label: FILM_COPY.meanwhile },
            () => {
                act.side("your");
                act.screen("ownerRing");
            },
            T.cardLong,
        );
        await wait(T.ringBeforeBusy);
        act.busy(true);
        await wait(T.busy);

        act.card({ label: FILM_COPY.voicemail });
        await wait(T.cardLong);
        await behind(
            { label: FILM_COPY.instead },
            () => {
                act.side("their");
                act.startCall(sc);
            },
            T.cardLong,
        );
        await talk();

        await behind(
            { label: FILM_COPY.backOnYours },
            () => {
                act.side("your");
                act.screen("text");
            },
            T.card,
        );
        await wait(T.text);
        return;
    }

    await behind({ label: FILM_COPY.customerSees, sub: FILM_COPY.onGrowth }, () => act.screen("site"), T.card);
    await wait(700);
    // Customers can still call: the number, with its callout.
    act.site({ callout: "call" });
    await wait(T.callNumber);
    act.site({ callout: null });
    await wait(500);
    // Or the form: a tap on "Book a Free Estimate", then on each field as it is filled in.
    await press("hero", FILM_SITE.heroEstimate);
    await wait(200);
    act.site({ scroll: FILM_SITE.formScroll });
    await wait(1200);
    await type("name", sc.caller.name);
    await wait(400);
    await type("phone", sc.ownerMessage.callback);
    await wait(400);
    tap(centre(FILM_SITE.consent));
    act.site({ ticked: true });
    await wait(600);
    await press("submit", FILM_SITE.submit);
    // A beat, then the form's callout, with the page eased down to make room for its box.
    await wait(1000);
    act.site({ scroll: FILM_SITE.formCalloutScroll });
    await wait(700);
    act.site({ callout: "form" });
    await wait(T.fillForm);
    act.site({ callout: null });
    await wait(400);

    await behind({ label: FILM_COPY.aMinuteLater }, () => act.screen("ringIn"), T.cardLong);
    await wait(T.ringIn);
    act.startCall(sc);
    await talk();

    await behind(
        { label: FILM_COPY.meanwhile },
        () => {
            act.side("your");
            act.screen("text");
        },
        T.card,
    );
    await wait(T.text);
}
