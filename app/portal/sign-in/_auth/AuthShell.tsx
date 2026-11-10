import Image from "next/image";
import Link from "next/link";
import s from "./AuthShell.module.css";

/**
 * The page around Clerk's sign-in and sign-up cards, in the AGENCY brand.
 *
 * Built from the approved ClerkSignIn (desktop) and ClerkPhone mockups. Desktop is a sand
 * brand panel on the left (lockup, "Every lead, in one place.", the subline, a peek at the
 * portal, the agency link) with the card centred on cream to the right. Below 1024px the panel
 * collapses to a band holding the lockup and headline, and the card tucks up over its bottom
 * edge.
 *
 * NOT inside `<PortalScope>`. These pages used to wear the portal's cool product palette; Xander
 * moved them to the agency brand on 2026-11-09 (Q6). The scope table in PORTAL-DESIGN.md says
 * so, and MarketingChrome treats them as agency routes (grain on, cream canvas).
 *
 * LIGHT-PINNED. `.shell` restates the light agency tokens, because `:root` follows the OS into
 * the dark agency theme and Xander asked for cream, never dark. Anything inside that reads
 * `var(--bg)` and friends, including the global marketing input rule, therefore resolves light.
 *
 * Lives under sign-in/ in a private `_auth` folder (not a route) and is shared by sign-up.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <div className={s.shell}>
            <aside className={s.brand}>
                <Image
                    className={s.lockup}
                    src="/jdd-lockup-portal.png"
                    alt="Juneau Digital Designs"
                    width={640}
                    height={192}
                    priority
                />
                <p className={s.headline}>
                    Every lead,
                    <br />
                    in one place.
                </p>
                <p className={s.sub}>
                    Calls your receptionist answered, enquiries from your website, and the jobs
                    you&rsquo;re working, on your phone or your computer.
                </p>
                <PortalPeek />
                <div className={s.foot}>
                    <span>Juneau Digital Designs</span>
                    <Link href="/">juneaudigitaldesigns.com</Link>
                </div>
            </aside>

            <main className={s.side}>
                <div className={s.stack}>
                    {children}
                    <footer className={s.links}>
                        {/* A signed-out visitor can't reach /portal/support, so Help goes to a
                            person: the same address PortalNoAccess gives a stuck client. */}
                        <a href="mailto:hello@juneaudigitaldesigns.com">Help</a>
                        <Link href="/privacy-policy">Privacy</Link>
                        <Link href="/terms">Terms</Link>
                    </footer>
                </div>
            </main>
        </div>
    );
}

/**
 * A glimpse of the inbox, desktop only. Pure decoration, so `aria-hidden`: the names are
 * illustrative, the buttons are spans, and a screen reader would otherwise announce two
 * strangers and two "Call back" controls that do nothing.
 */
function PortalPeek() {
    return (
        <div className={s.peek} aria-hidden="true">
            <div className={s.peekRow}>
                <span className={s.eyebrow}>Client portal</span>
            </div>
            <div className={s.peekRow}>
                <strong>Dave K.</strong>
                <span className={s.why}>Wants a callback</span>
                <span className={s.callBack}>Call back</span>
            </div>
            <div className={s.peekRow}>
                <strong>Carol O.</strong>
                <span className={`${s.why} ${s.whyWeb}`}>Web enquiry</span>
                <span className={s.callBack}>Call back</span>
            </div>
        </div>
    );
}
