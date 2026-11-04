/**
 * `fetch` for same-origin API calls that need the signed-in user, carrying a fresh Clerk session
 * token as a Bearer header.
 *
 * Mounting Clerk on the page keeps the session cookie fresh while the tab is active. This
 * covers the cases it misses: a laptop that slept on the agreement page, or a background tab
 * whose timers the browser slowed. `getToken()` returns the cached token while it is still
 * valid and fetches a new one when it is not. Clerk's middleware checks a header token before
 * the cookie, so a stale cookie no longer decides the request.
 *
 * One retry on 401, with a token Clerk is told not to take from its cache. Every route this
 * wraps refuses a signed-out caller before it does anything, so a 401 means nothing was
 * written and repeating the request is safe. A second 401 is returned as it is: the session
 * really has ended.
 *
 * A factory over `getToken` and `fetch` so the test can drive it without React or Clerk.
 */
export type GetToken = (opts?: { skipCache?: boolean }) => Promise<string | null>;

export function makeSessionFetch(getToken: GetToken, fetchImpl: typeof fetch = fetch) {
    async function attempt(input: RequestInfo | URL, init: RequestInit, skipCache: boolean) {
        let token: string | null = null;
        try {
            token = await getToken(skipCache ? { skipCache: true } : undefined);
        } catch {
            // No token to add: the request goes with the session cookie, as it did before this.
        }
        const headers = new Headers(init.headers);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetchImpl(input, { ...init, headers });
    }

    return async function sessionFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
        const res = await attempt(input, init, false);
        if (res.status !== 401) return res;
        return attempt(input, init, true);
    };
}
