/**
 * Marks the boundary of the portal design system.
 *
 * Everything inside gets the scoped token block at the bottom of globals.css — cool
 * neutral surfaces, Inter/Cabinet/JetBrains, the product accent, no grain, light only.
 * Everything outside keeps the agency marketing brand.
 *
 * Applied per-route rather than in `app/portal/layout.tsx`, because that layout also
 * wraps `/portal/onboarding`, which is a sales funnel and intentionally stays on the
 * agency theme. Adding this there would quietly re-theme it.
 *
 * Note the scope only reaches things rendered in the React tree beneath it. Clerk's
 * `<UserButton />` popover portals into <body> and escapes it, which is why
 * `clerkAppearance.ts` carries literal hex instead of `var()`.
 */
export default function PortalScope({ children }: { children: React.ReactNode }) {
    return <div className="portal-scope">{children}</div>;
}
