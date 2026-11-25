/**
 * The grass on /lawn-care, drawn blade by blade.
 *
 * Xander approved this grass on sight ("this is actually perfect. Do not change anything about the
 * grass at all"), so the shape of a blade, the mix of greens and every seed below are fixed. The
 * numbers are not decorative: the sequence of random draws per blade (height, width, lean, bend,
 * colour, then the step to the next blade) is what makes this particular lawn, and changing their
 * order re-rolls every blade on the page.
 *
 * A seeded generator rather than Math.random, so the same lawn is drawn on the server, on the
 * client and on every later visit; an unseeded one would also make React's first client render
 * disagree with the server's.
 */

/** mulberry32: small, fast, and the same sequence everywhere for a given seed. */
function seeded(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface Blade {
    /** The leaf: up one side to the tip, back down the other. */
    d: string;
    /** Which green, as a class on the path. */
    shade: string;
}

export interface Lawn {
    blades: Blade[];
    /** How far the outermost blades reach, feet and leaning tips included. */
    from: number;
    to: number;
}

export interface BladeOptions {
    /** The box to fill, in the units of the SVG's own viewBox. */
    width: number;
    height: number;
    seed: number;
    /** Shortest and tallest blade. */
    min: number;
    max: number;
    /** The greens to draw from, repeated to weight the mix. */
    shades: readonly string[];
    /** Roughly how far apart the blades stand. */
    step: number;
    /** How far a blade leans from upright, as a share of its height. */
    sway: number;
    /** How far outside the box to start, so the row runs past both edges. */
    overhang: number;
}

export function drawBlades({ width, height, seed, min, max, shades, step, sway, overhang }: BladeOptions): Lawn {
    const r = seeded(seed);
    const blades: Blade[] = [];
    let from = Infinity;
    let to = -Infinity;
    for (let x = -overhang; x < width + overhang; x += step * (0.55 + r() * 0.9)) {
        const bh = min + r() * (max - min);
        const bw = 3 + r() * 3.2;
        const lean = (r() - 0.5) * bh * sway;
        const bend = (r() - 0.5) * 6;
        const shade = shades[Math.floor(r() * shades.length)];
        const tipX = x + lean;
        const tipY = height - bh;
        const midY = height - bh * 0.55;
        from = Math.min(from, x - bw / 2, tipX);
        to = Math.max(to, x + bw / 2, tipX);
        blades.push({
            shade,
            d:
                `M${(x - bw / 2).toFixed(1)} ${height}` +
                ` Q${(x - bw / 2 + lean * 0.35 + bend).toFixed(1)} ${midY.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}` +
                ` Q${(x + bw / 2 + lean * 0.35 + bend).toFixed(1)} ${midY.toFixed(1)} ${(x + bw / 2).toFixed(1)} ${height}Z`,
        });
    }
    return { blades, from: Number.isFinite(from) ? from : 0, to: Number.isFinite(to) ? to : width };
}

/**
 * The two rows behind the yard signs: a tall row behind them, a short one in front of the stakes.
 * Six greens so it does not read as one flat colour.
 */
export const SIGN_BACK = { height: 100, seed: 11, min: 44, max: 92, shades: ["g1", "g1", "g2", "g2", "g6", "g3"], step: 3.1, sway: 0.55, overhang: 4 } as const;
export const SIGN_FRONT = { height: 100, seed: 29, min: 14, max: 40, shades: ["g2", "g3", "g3", "g4", "g4", "g5", "g6"], step: 2.6, sway: 0.55, overhang: 4 } as const;
