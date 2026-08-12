"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * In-memory cache for the portal's client-fetched panels.
 *
 * Every tab is a real route, so switching remounted each section and re-ran its `useEffect`
 * fetch — a full round trip and a skeleton flash even when the server answered from Redis in
 * single-digit milliseconds. This store lives in `PortalChrome`, which sits in the `(dash)`
 * layout and therefore survives navigation between sibling tabs, so a revisit within the TTL
 * renders synchronously with no request at all.
 *
 * ## Security constraints
 *
 * Load-bearing, not incidental:
 *
 * 1. **Memory only.** Call records carry caller names, phone numbers, emails and addresses.
 *    Nothing here touches `sessionStorage`, `localStorage` or IndexedDB — the cache dies
 *    with the tab and a reload starts clean.
 *
 * 2. **Every key is namespaced by Clerk user id.** Isolation is structural rather than
 *    procedural: a second user physically cannot read the first user's entries, because
 *    they compute different keys. The effect below also wipes on identity change, but that
 *    is cleanup — correctness does not depend on it firing, or on sign-out happening to
 *    trigger a full page load. An earlier draft relied on a wipe alone; this does not.
 *
 * 3. **Keys include the site slug**, so a multi-site account can never render site A's data
 *    under site B.
 */

/**
 * Client-side TTLs, mirroring the server-side ones in `app/lib/portal-kv.ts`.
 *
 * They match rather than undercut: a shorter client TTL would just re-request a payload the
 * server would serve from its own cache anyway — a round trip for identical bytes.
 */
export const CLIENT_TTL = {
    /** Calls stay near-live — "did I get a lead?" is the question this product answers. */
    calls: 120_000,
    /** Matches USAGE_TTL server-side: a shorter window would just re-fetch identical bytes. */
    usage: 600_000,
    traffic: 3_600_000,
    performance: 86_400_000,
    billing: 43_200_000,
} as const;

interface Entry {
    data: unknown;
    fetchedAt: number;
}

class Store {
    private entries = new Map<string, Entry>();
    private inflight = new Map<string, Promise<unknown>>();
    private listeners = new Set<() => void>();

    subscribe = (fn: () => void) => {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    };

    getSnapshot = (key: string): Entry | undefined => this.entries.get(key);

    private emit() {
        for (const fn of this.listeners) fn();
    }

    isInflight(key: string): boolean {
        return this.inflight.has(key);
    }

    /**
     * Fetch through the cache. Returns immediately when a fresh entry exists.
     * Concurrent callers for the same key share one request.
     */
    load(key: string, url: string, ttlMs: number, force: boolean): void {
        if (this.inflight.has(key)) return;

        const current = this.entries.get(key);
        if (!force && current && Date.now() - current.fetchedAt < ttlMs) return;

        const promise = fetch(url)
            .then((r) => r.json())
            .then((json) => {
                this.entries.set(key, { data: json, fetchedAt: Date.now() });
            })
            .catch(() => {
                // Keep a working panel rather than blanking it on a transient failure. A key
                // that never resolved stays a miss, and the caller's error branch handles it.
                if (!current) this.entries.set(key, { data: { state: "error" }, fetchedAt: Date.now() });
            })
            .finally(() => {
                this.inflight.delete(key);
                this.emit();
            });

        this.inflight.set(key, promise);
    }

    /** Drop every entry whose key starts with `prefix`. Called after a mutation. */
    invalidate(prefix: string) {
        let changed = false;
        for (const key of this.entries.keys()) {
            if (key.includes(prefix)) {
                this.entries.delete(key);
                changed = true;
            }
        }
        if (changed) this.emit();
    }

    /** Discard everything. Used when the signed-in identity changes. */
    clear() {
        if (this.entries.size === 0) return;
        this.entries.clear();
        this.emit();
    }
}

interface Ctx {
    store: Store;
    /** Namespace for every key. Null until Clerk has loaded, which suppresses fetching. */
    scope: string | null;
}

const StoreContext = createContext<Ctx | null>(null);

export function PortalDataProvider({ children }: { children: React.ReactNode }) {
    const { userId, isLoaded } = useAuth();

    // `useState` with an initializer rather than a lazily-filled ref: it produces the same
    // stable instance without reading a ref during render.
    const [store] = useState(() => new Store());

    const scope = isLoaded && userId ? userId : null;

    // Cleanup only — isolation is already guaranteed by the key namespace, so this firing
    // late (or not at all) cannot expose one user's data to another.
    useEffect(() => {
        return () => store.clear();
    }, [store, scope]);

    return <StoreContext.Provider value={{ store, scope }}>{children}</StoreContext.Provider>;
}

function useCtx(): Ctx {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error("useCachedFetch must be used inside <PortalDataProvider>");
    return ctx;
}

export interface CachedResult<T> {
    data: T | null;
    /** True only on a genuine miss — a stale hit returns data and never blanks the UI. */
    isLoading: boolean;
    fetchedAt: number | null;
    refresh: () => void;
}

/**
 * Read `url` through the store.
 *
 * - Fresh hit → returned synchronously. No request, no skeleton.
 * - Stale hit → returned immediately, revalidated in the background, swapped in place.
 * - Miss → fetched, with `isLoading` true so the caller shows its existing skeleton.
 */
export function useCachedFetch<T>(key: string, url: string, ttlMs: number): CachedResult<T> {
    const { store, scope } = useCtx();
    const scopedKey = `${scope ?? "anon"}::${key}`;

    const entry = useSyncExternalStore(
        store.subscribe,
        () => store.getSnapshot(scopedKey),
        () => undefined, // nothing is cached during SSR
    );

    useEffect(() => {
        // Don't fetch before Clerk resolves — the key would be written under "anon" and
        // then be unreachable once the real scope arrives.
        if (!scope) return;
        store.load(scopedKey, url, ttlMs, false);
    }, [store, scope, scopedKey, url, ttlMs]);

    const refresh = useCallback(() => {
        if (scope) store.load(scopedKey, url, ttlMs, true);
    }, [store, scope, scopedKey, url, ttlMs]);

    return {
        data: (entry?.data as T | undefined) ?? null,
        isLoading: entry === undefined,
        fetchedAt: entry?.fetchedAt ?? null,
        refresh,
    };
}

/** Drop cached entries so the next read refetches. Call after any mutation. */
export function useInvalidate(): (prefix: string) => void {
    const { store } = useCtx();
    return useCallback((prefix: string) => store.invalidate(prefix), [store]);
}
