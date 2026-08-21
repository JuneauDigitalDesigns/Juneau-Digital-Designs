/**
 * Where may we send someone after they sign in or sign up?
 *
 * The purchase funnel now starts in front of Clerk: pick a tier, get bounced to sign-up, come
 * back to `/start?plan=X` and carry on. That return trip travels as a `redirect_url` query
 * param — and a query param that decides where the browser goes next is an open redirect
 * unless something checks it.
 *
 * Relative, same-origin paths only. Rejects anything carrying a scheme (`https:`, and
 * notably `javascript:`), anything protocol-relative (`//evil.example`, which a browser
 * treats as absolute despite the leading slash), and anything not rooted at `/`. Backslashes
 * go too: some browsers normalise `/\evil.example` into a protocol-relative URL.
 *
 * Deliberately a check on shape rather than a parse. Handing a hostile input to `new URL()`
 * with a base happily resolves it into a valid-looking absolute URL, which is the failure
 * mode rather than the fix.
 *
 * Runs on the server, before the value reaches Clerk — `forceRedirectUrl` outranks every
 * other redirect Clerk might otherwise choose, so this is the only thing standing in front
 * of it.
 */

/**
 * C0 controls plus DEL.
 *
 * A code-point scan rather than a character class, because writing those characters into a
 * regex literal means writing them into the source file, and a stray raw control byte in a
 * `.ts` file is its own small disaster.
 */
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

export function safeRedirectPath(
  raw: string | string[] | undefined,
  fallback = "/portal",
): string {
  // Next hands back an array when a param repeats. A repeated `redirect_url` is not something
  // a legitimate link produces, so refuse rather than guess which one was meant.
  if (typeof raw !== "string") return fallback;

  const value = raw.trim();
  if (!value) return fallback;

  if (!value.startsWith("/")) return fallback;
  // Both of these are absolute to a browser, leading slash notwithstanding.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // A tab or newline mid-string can carry a scheme past a naive prefix check.
  if (hasControlChars(value)) return fallback;

  return value;
}
