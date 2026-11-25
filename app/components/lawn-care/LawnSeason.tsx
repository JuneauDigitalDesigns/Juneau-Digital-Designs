"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, formatDollars, lostPerYear } from "@/app/data/missed-calls";
import { MowerIcon } from "./LawnIcon";

/**
 * "A missed call is a whole season." — the missed-call sum, drawn as a street of lawns.
 *
 * Same sourced rates as the homepage, /hvac and /plumbing (`app/data/missed-calls.ts`). What
 * differs is what a won call is worth: in lawn care a customer is not one job but a season of
 * visits, because whoever answers the phone gets every visit after that. Xander approved counting
 * it that way, knowing it makes the totals much larger than the other pages'.
 *
 * WHY A STREET (Xander, 20 Nov 2026). The page first drew one lawn, with the mown part standing
 * for what a receptionist wins back. He asked for the mower to mow won / (won + lost) of it, and
 * that always comes to a third: "won back" is our fixed estimate of half of "lost", so no number a
 * visitor types can move it. What the numbers DO change is how many customers are at stake. So
 * the picture is one lawn per customer the missed calls cost, overgrown, and the mower mows the
 * ones a receptionist wins back. Type more missed calls and the street grows; fewer, it shrinks.
 *
 * The mower cuts the street the way a lawn is cut: along the first row, straight down, back along
 * the next (his words: not "snapping back to the start" of every row). So the mown lawns are the
 * first N in that back-and-forth order, not in reading order, and the mower faces the way it goes.
 *
 * The totals stay "$?" until Calculate is pressed, as on the other two pages, and the street sits
 * overgrown for the starting numbers with the mower waiting. The three starting numbers are
 * examples the visitor types over; $45 a visit is the example price in the lawn care design.
 */

const START_MISSED = 10;

/** Customers the missed calls cost in a year: calls a week × 52 × the two Invoca rates. */
const customersLost = (missedPerWeek: number) => missedPerWeek * 52 * LEAD_RATE * CLOSE_RATE;

/**
 * How many customers one lawn stands for. Up to 160 customers, one each; past that, ten; past
 * 1,600, a hundred. Keeps the street readable at any figure, and the line above it says which.
 */
const perLawn = (customers: number) => (customers <= 160 ? 1 : customers <= 1600 ? 10 : 100);

/** The mower waits this long after Calculate, then takes at most this long to cut the street. */
const WAIT = 500;
const CUT = 2400;

/** Width of a typed figure in `ch`, so the coral rule under it hugs what was typed. */
function fit(value: string): string {
    return `${Math.max(2.4, value.length + 0.4)}ch`;
}

const whole = (n: number) => Math.round(n).toLocaleString("en-US");

interface Street {
    lawns: number;
    mown: number;
    per: number;
    /** Bumped on every Calculate, so the mower runs again even when the numbers have not changed. */
    run: number;
}

interface Stop {
    lot: HTMLElement;
    /** True on the rows the mower cuts right to left. */
    back: boolean;
}

/** The street's lawns in the order the mower reaches them: row one left to right, row two back. */
function cuttingOrder(street: HTMLElement): Stop[] {
    const rows: HTMLElement[][] = [];
    let top: number | null = null;
    street.querySelectorAll<HTMLElement>(".lawn-lot").forEach((lot) => {
        if (lot.offsetTop !== top) {
            rows.push([]);
            top = lot.offsetTop;
        }
        rows[rows.length - 1].push(lot);
    });
    return rows.flatMap((row, r) => (r % 2 ? [...row].reverse() : row).map((lot) => ({ lot, back: r % 2 === 1 })));
}

export default function LawnSeason() {
    const [missed, setMissed] = useState(String(START_MISSED));
    const [visit, setVisit] = useState("45");
    const [visits, setVisits] = useState("30");
    const [answer, setAnswer] = useState<{ lost: string; won: string; lostOf: string; wonOf: string } | null>(null);

    const startCustomers = customersLost(START_MISSED);
    const [street, setStreet] = useState<Street>({
        lawns: Math.max(1, Math.round(startCustomers / perLawn(startCustomers))),
        mown: 0,
        per: perLawn(startCustomers),
        run: 0,
    });
    const [counts, setCounts] = useState<{ won: number; lost: number } | null>(null);

    const streetRef = useRef<HTMLDivElement>(null);
    const mowerRef = useRef<SVGSVGElement>(null);
    /** How many lawns are mown right now, and how many will be when the mower is done. */
    const mownNow = useRef(0);
    const mownTarget = useRef(0);
    const drive = useRef(0);

    /** Put the mower on a lawn, facing the way the mower is going on that row. */
    const park = useCallback((stop: Stop | undefined) => {
        const mower = mowerRef.current;
        if (!mower || !stop) return;
        const { lot, back } = stop;
        mower.style.transform =
            `translate(${lot.offsetLeft + lot.offsetWidth / 2 - 23}px,${lot.offsetTop - 16}px)` + (back ? " scaleX(-1)" : "");
    }, []);

    /** Show the street as it stands, with no motion: the first N lawns along the cut are mown. */
    const settle = useCallback(() => {
        const el = streetRef.current;
        if (!el) return;
        const order = cuttingOrder(el);
        order.forEach((stop, i) => stop.lot.classList.toggle("is-mown", i < mownNow.current));
        el.classList.add("is-parked");
        park(order[Math.max(0, mownNow.current - 1)]);
    }, [park]);

    // Each Calculate: a fresh street, overgrown, then the mower cuts it. Timers, not animation
    // frames, so it still finishes in a background tab or a preview that holds frames back.
    useEffect(() => {
        const el = streetRef.current;
        if (!el) return;
        const id = ++drive.current;
        mownNow.current = 0;
        mownTarget.current = street.mown;
        el.querySelectorAll(".lawn-lot.is-mown").forEach((lot) => lot.classList.remove("is-mown"));
        const order = cuttingOrder(el);
        el.classList.add("is-parked");
        park(order[0]);
        if (street.run === 0) return;
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            mownNow.current = street.mown;
            settle();
            return;
        }
        void el.offsetWidth;
        el.classList.remove("is-parked");
        const step = Math.max(25, Math.min(90, CUT / Math.max(1, street.mown)));
        const timers: number[] = [];
        let n = 0;
        const next = () => {
            if (id !== drive.current || n >= street.mown) return;
            park(order[n]);
            order[n].lot.classList.add("is-mown");
            n += 1;
            mownNow.current = n;
            timers.push(window.setTimeout(next, step));
        };
        timers.push(window.setTimeout(next, WAIT));
        return () => timers.forEach((t) => window.clearTimeout(t));
    }, [street, park, settle]);

    // A narrower window puts fewer lawns in a row, which changes the order the mower cuts them in.
    // A run in progress finishes at once rather than stopping half way down the street.
    useEffect(() => {
        const onResize = () => {
            drive.current += 1;
            mownNow.current = mownTarget.current;
            settle();
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [settle]);

    function calculate(e: React.FormEvent) {
        e.preventDefault();
        const m = Number(missed);
        const v = Number(visit);
        const n = Number(visits);
        if (missed.trim() === "" || visit.trim() === "" || visits.trim() === "" || !(m >= 0) || !(v >= 0) || !(n >= 1)) {
            setAnswer(null);
            return;
        }
        const customer = v * n;
        const lost = lostPerYear(m, customer);
        const customers = customersLost(m);
        const all = Math.round(customers);
        const back = Math.round(customers * AI_RECOVERY_RATE);
        const per = perLawn(customers);
        setAnswer({
            lost: formatDollars(lost),
            won: formatDollars(lost * AI_RECOVERY_RATE),
            lostOf: `About ${whole(customers)} customers × $${whole(customer)} each`,
            wonOf: `Half of them: about ${whole(customers * AI_RECOVERY_RATE)} customers`,
        });
        setCounts({ won: back, lost: all - back });
        setStreet((was) => ({
            lawns: Math.max(1, Math.round(customers / per)),
            mown: Math.round(back / per),
            per,
            run: was.run + 1,
        }));
    }

    const perSeason = Number(visit) * Number(visits);

    return (
        <form className="lawn-season" onSubmit={calculate} aria-label="Work out what your missed calls cost in a year">
            <p className="lawn-fill">
                You miss{" "}
                <label className="lawn-blank">
                    <input
                        id="lawn-missed"
                        className="lawn-blank-in"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={500}
                        value={missed}
                        style={{ width: fit(missed) }}
                        onChange={(e) => setMissed(e.target.value)}
                        aria-label="Calls you miss a week"
                    />
                </label>{" "}
                calls a week.
                <br /> A customer pays{" "}
                <label className="lawn-blank">
                    <span>$</span>
                    <input
                        id="lawn-visit"
                        className="lawn-blank-in"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={5000}
                        value={visit}
                        style={{ width: fit(visit) }}
                        onChange={(e) => setVisit(e.target.value)}
                        aria-label="What a customer pays a visit, in dollars"
                    />
                </label>{" "}
                a visit,
                <br />{" "}
                <label className="lawn-blank">
                    <input
                        id="lawn-visits"
                        className="lawn-blank-in"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={60}
                        value={visits}
                        style={{ width: fit(visits) }}
                        onChange={(e) => setVisits(e.target.value)}
                        aria-label="Visits a season"
                    />
                </label>{" "}
                visits a season.
            </p>
            <button className="btn primary lg" type="submit">
                Calculate
            </button>

            <div className="lawn-sumpic">
                <p className="lawn-one">
                    <span className="lawn-one-each">
                        One customer, one season: {visits || "0"} visits at ${visit || "0"}
                    </span>
                    <b>${Number.isFinite(perSeason) ? whole(perSeason) : "0"}</b>
                </p>
                <div className="lawn-halves" aria-live="polite">
                    <div>
                        <span className="lawn-halves-lbl">
                            <i className="lawn-key lawn-key-short" aria-hidden="true" />
                            Won back with a receptionist
                        </span>
                        <span className="lawn-amt">{answer ? answer.won : "$?"}</span>
                        <span className="lawn-of">{answer ? answer.wonOf : "Half of them"}</span>
                    </div>
                    <div>
                        <span className="lawn-halves-lbl">
                            <i className="lawn-key lawn-key-long" aria-hidden="true" />
                            Lost to missed calls, a year
                        </span>
                        <span className="lawn-amt">{answer ? answer.lost : "$?"}</span>
                        <span className="lawn-of">{answer ? answer.lostOf : "Customers lost × what each pays in a season"}</span>
                    </div>
                </div>

                <p className="lawn-street-cap">
                    {street.per === 1
                        ? "Every lawn here is a customer you'd have won this year."
                        : `Every lawn here is ${street.per} customers you'd have won this year.`}
                </p>
                <div
                    className="lawn-street is-parked"
                    ref={streetRef}
                    role="img"
                    aria-label="One lawn for each customer lost to missed calls. The mown lawns are the ones a receptionist wins back; the overgrown ones are still lost"
                >
                    <MowerIcon className="lawn-street-mower" ref={mowerRef} />
                    {Array.from({ length: street.lawns }, (_, i) => (
                        <i key={i} className="lawn-lot" />
                    ))}
                </div>
                <p className="lawn-legend">
                    <span>
                        <i className="lawn-lot is-mown" aria-hidden="true" />
                        <span>
                            Mown: won back with a receptionist
                            {counts ? `, about ${whole(counts.won)}` : ""}
                        </span>
                    </span>
                    <span>
                        <i className="lawn-lot" aria-hidden="true" />
                        <span>
                            Overgrown: still lost
                            {counts ? `, about ${whole(counts.lost)}` : ""}
                        </span>
                    </span>
                </p>
            </div>
        </form>
    );
}
