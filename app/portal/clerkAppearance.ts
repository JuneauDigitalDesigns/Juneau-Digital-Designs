/**
 * Shared Clerk `appearance` for the portal.
 *
 * Applied at the `<ClerkProvider>` in app/portal/layout.tsx, so it dresses the sign-in and
 * sign-up cards *and* the `<UserButton/>` popover in the dashboard rail.
 *
 * WHY LITERAL HEX AND NOT `var(--token)`. Clerk renders the UserButton popover through a
 * React portal into <body>, which is outside `<PortalScope>` — a `var()` there would
 * resolve against `:root` and come back wearing the agency cream and coral. These values
 * are the portal palette written out by hand; the comment on each line names the token it
 * mirrors so the two can be kept in step. If you change the scoped block at the bottom of
 * globals.css, change these too.
 *
 * `fontFamily` is the exception and is safe as a `var()`: the font variables are declared
 * on <html> in the root layout, so they resolve anywhere in the document.
 */
export const portalClerkAppearance = {
    variables: {
        colorBackground: "#ffffff",        // --elev-1 (card surface)
        colorText: "#0d1117",              // --fg
        colorTextSecondary: "#767c85",     // --fg-3
        colorPrimary: "#2563eb",           // --accent (product blue)
        colorInputBackground: "#ffffff",   // --elev-2
        colorInputText: "#0d1117",         // --fg
        colorNeutral: "#0d1117",           // base for borders/dividers
        colorSuccess: "#16a34a",           // --online
        borderRadius: "6px",               // control radius; cards are 8px
        fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
    },
    elements: {
        card: "border border-[color:var(--rule)] shadow-sm",
        // A flat product button: darken on hover rather than inverting to ink-on-cream,
        // which was the marketing `.btn.primary` behaviour.
        formButtonPrimary:
            "bg-[#2563eb] text-white hover:bg-[#1d4ed8] font-medium",
    },
} as const;
