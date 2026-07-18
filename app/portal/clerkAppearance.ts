/**
 * Shared Clerk `appearance` for the portal auth screens (sign-in + sign-up).
 *
 * Uses the Switchboard light-theme design tokens (see app/globals.css :root) so
 * the Clerk card reads as native to the site instead of the old dark-navy theme.
 * Kept in one place so both /portal/sign-in and /portal/sign-up stay in sync.
 */
export const portalClerkAppearance = {
    variables: {
        colorBackground: "#fbf5e6",        // --panel (card surface)
        colorText: "#14120c",              // --fg
        colorTextSecondary: "#7a715a",     // --fg-3
        colorPrimary: "#d2542f",           // --accent-2 (coral, primary CTA)
        colorInputBackground: "#f4ecd8",   // --bg
        colorInputText: "#14120c",         // --fg
        colorNeutral: "#14120c",           // warm-dark base for borders/dividers
        colorSuccess: "#3f8f5c",           // --online
        borderRadius: "8px",
        fontFamily: "var(--font-hanken), 'Hanken Grotesk', sans-serif",
    },
    elements: {
        card: "border border-[color:var(--rule)] shadow-xl",
        // Mirror .btn.primary: coral, inverting to ink-on-cream on hover
        formButtonPrimary:
            "bg-[#d2542f] text-[#f4ecd8] hover:bg-[#14120c] hover:text-[#f4ecd8] font-semibold",
    },
} as const;
