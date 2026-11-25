/**
 * Whether a person has had the portal tour, once on a computer and once on a phone
 * (Xander, 19 Nov 2026): "it only does it once the very first time that the user lands on the
 * portal. Does it once for the desktop and once for the mobile for every user."
 *
 * Stored on the Clerk user, in `publicMetadata.tour`, so it follows the person from browser to
 * browser and device to device, and it is per person, not per account: a colleague on the same
 * business gets both tours too. Public metadata is readable in the browser but writable only by
 * the server, and only `/api/portal/tour` writes it, through `nextTour` below.
 *
 *     publicMetadata.tour = {
 *       desktop: { completed: true,  step: 12, at: "2026-11-19T15:02:00.000Z" },
 *       mobile:  { completed: false, step: 4 },
 *       updatedAt: "2026-11-19T15:10:00.000Z",
 *     }
 *
 * The tours before this one stored `completed`, `lastStepIndex` and a per-tab `seen` list at the
 * top level. They are ignored and dropped on the next write: no client had taken those tours
 * (Xander, 19 Nov 2026), so everyone gets both new ones on their first visit.
 */

export const TOUR_DEVICES = ["desktop", "mobile"] as const;
export type TourDevice = (typeof TOUR_DEVICES)[number];

export interface DeviceTour {
    /** Seen on this device. Only ever goes from false to true. */
    completed: boolean;
    /** The step to pick up from if the tour was interrupted on this device. */
    step: number;
    /** When it was completed. */
    at?: string;
}

export interface TourState {
    desktop: DeviceTour;
    mobile: DeviceTour;
}

export interface StoredTour {
    desktop?: DeviceTour;
    mobile?: DeviceTour;
    updatedAt?: string;
}

/** Which flag a layout uses: the phone layout (and the installed app) is "mobile". */
export function tourDeviceFor(phoneLayout: boolean): TourDevice {
    return phoneLayout ? "mobile" : "desktop";
}

export function isTourDevice(x: unknown): x is TourDevice {
    return typeof x === "string" && (TOUR_DEVICES as readonly string[]).includes(x);
}

const STEP_MAX = 500;

function device(raw: unknown): DeviceTour {
    const d = (raw ?? {}) as Partial<DeviceTour>;
    const step = typeof d.step === "number" && Number.isInteger(d.step) && d.step >= 0 && d.step <= STEP_MAX ? d.step : 0;
    return { completed: d.completed === true, step, ...(typeof d.at === "string" ? { at: d.at } : {}) };
}

/** The tour state as stored, cleaned: anything malformed reads as "not seen yet". */
export function readTour(meta: unknown): TourState {
    const m = (meta ?? {}) as StoredTour;
    return { desktop: device(m.desktop), mobile: device(m.mobile) };
}

/**
 * The stored tour after a write from one device.
 *
 * - `completed` only ever goes one way, per device. Nothing in the portal un-sees the tour: Replay
 *   plays it without re-arming the first-visit start, so a stray `completed: false`, or a write
 *   that raced past this one, must not bring it back on every visit.
 * - The other device's flag is never touched.
 * - Legacy top-level fields are not carried over.
 */
export function nextTour(prev: unknown, write: { device: TourDevice; completed?: unknown; step?: unknown }, nowIso: string): StoredTour {
    const before = readTour(prev);
    const mine = before[write.device];
    const completed = mine.completed || write.completed === true;
    const step = typeof write.step === "number" && Number.isInteger(write.step) && write.step >= 0 && write.step <= STEP_MAX ? write.step : mine.step;
    const at = mine.at ?? (completed && !mine.completed ? nowIso : undefined);
    return {
        ...before,
        [write.device]: { completed, step, ...(at ? { at } : {}) },
        updatedAt: nowIso,
    };
}
