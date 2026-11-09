/**
 * An invitation opened in a browser already signed in to a different account. Pure, so the test
 * runs it.
 *
 * Clerk's sign-up form sends a signed-in visitor straight on to the destination, which belongs to
 * the invited account, so they hit a 404 with the invitation unused (test run, 2026-11-09). The
 * page offers sign out instead, returning here with the invitation intact.
 */

const KEPT = ["redirect_url", "__clerk_ticket", "__clerk_status"];

/**
 * @param {Record<string, string | string[] | undefined>} params
 * @returns {string}
 */
export function inviteReturnPath(params) {
  const q = new URLSearchParams();
  for (const key of KEPT) {
    const v = params[key];
    if (typeof v === "string") q.set(key, v);
  }
  return `/portal/sign-up?${q.toString()}`;
}

/**
 * @param {string | null | undefined} userId
 * @param {string | string[] | undefined} ticket
 */
export function inviteNeedsSignOut(userId, ticket) {
  return Boolean(userId) && typeof ticket === "string" && ticket.length > 0;
}
