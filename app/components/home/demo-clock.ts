/**
 * A pausable clock for the homepage films.
 *
 * Xander's rule (2026-11-12): clicking a demo pauses it, and the next click resumes it from
 * exactly where it stopped, not from the start of the step. Every pause in a film's script is a
 * `wait` on one of these, so pausing the clock freezes the script between any two lines of it:
 * a wait that had 600ms left when the film was paused has 600ms left when it resumes.
 *
 * What it cannot freeze is a CSS transition already under way (a camera move, a fade): those are
 * the browser's. The films pause their CSS animations from `onChange` and freeze the few moving
 * transitions they own; anything else finishes its last few tenths of a second and holds.
 *
 * `cancel` rejects every pending and later wait with "cancelled", which is how a newer run, a
 * replay or an unmount stops an older script.
 */

export interface DemoClock {
    /** Resolves after `ms` of unpaused time. Rejects with "cancelled" once the clock is cancelled. */
    wait(ms: number): Promise<void>;
    pause(): void;
    resume(): void;
    readonly paused: boolean;
    /** Unpaused time since the clock was made, in ms. */
    elapsed(): number;
    cancel(): void;
    readonly cancelled: boolean;
    /** Called with `true` on pause and `false` on resume, once per change. Returns an unsubscribe. */
    onChange(fn: (paused: boolean) => void): () => void;
}

interface Pending {
    left: number;
    startedAt: number;
    timer: ReturnType<typeof setTimeout> | null;
    resolve: () => void;
    reject: (e: Error) => void;
}

export function createDemoClock(): DemoClock {
    let paused = false;
    let cancelled = false;
    let base = Date.now();
    let banked = 0;
    const pending = new Set<Pending>();
    const listeners = new Set<(p: boolean) => void>();

    const arm = (p: Pending) => {
        p.startedAt = Date.now();
        p.timer = setTimeout(() => {
            pending.delete(p);
            p.resolve();
        }, Math.max(0, p.left));
    };

    return {
        wait(ms) {
            if (cancelled) return Promise.reject(new Error("cancelled"));
            return new Promise<void>((resolve, reject) => {
                const p: Pending = { left: ms, startedAt: 0, timer: null, resolve, reject };
                pending.add(p);
                if (!paused) arm(p);
            });
        },
        pause() {
            if (paused || cancelled) return;
            paused = true;
            banked += Date.now() - base;
            for (const p of pending) {
                if (p.timer !== null) clearTimeout(p.timer);
                p.timer = null;
                p.left -= Date.now() - p.startedAt;
            }
            listeners.forEach((fn) => fn(true));
        },
        resume() {
            if (!paused || cancelled) return;
            paused = false;
            base = Date.now();
            for (const p of pending) arm(p);
            listeners.forEach((fn) => fn(false));
        },
        get paused() {
            return paused;
        },
        elapsed() {
            return banked + (paused ? 0 : Date.now() - base);
        },
        cancel() {
            if (cancelled) return;
            cancelled = true;
            for (const p of pending) {
                if (p.timer !== null) clearTimeout(p.timer);
                p.reject(new Error("cancelled"));
            }
            pending.clear();
            listeners.clear();
        },
        get cancelled() {
            return cancelled;
        },
        onChange(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}
