/**
 * Clerk `appearance` for the portal: every Clerk surface wears the AGENCY brand.
 *
 * Sign-in and sign-up are the agency's front door (Xander, 2026-11-09: "Sign-in uses the
 * AGENCY palette and the JDD lockup"), and the account popover is drawn cream-and-coral in the
 * approved ClerkMenu mockup. So unlike the dashboard behind it, nothing Clerk renders uses the
 * portal's cool product palette any more.
 *
 * Three exports, applied at two levels:
 *
 * - `clerkAppearance` goes on the `<ClerkProvider>` in app/portal/layout.tsx. Variables, the
 *   CSS layer, and the account popover. It is provider-level rather than passed to each
 *   `<UserButton/>` because there are four UserButtons (three in PortalChrome, one in
 *   PortalNoAccess), and because "Manage account" opens Clerk's profile modal, which reads the
 *   provider's appearance, not the button's. Per-button, that modal would have stayed on a
 *   third palette under a cream popover.
 * - `clerkAuthAppearance` goes on `<SignIn/>` and `<SignUp/>`. The card itself: the lockup,
 *   the full-width Google button, Big Shoulders title, the coral Continue button. Clerk applies
 *   the provider's appearance first and the component's on top.
 *
 * WHY LITERAL HEX AND NOT `var(--token)`. Two reasons, either one enough:
 *   1. Clerk renders the UserButton popover and the profile modal through a React portal into
 *      <body>. A `var()` there resolves against `:root`.
 *   2. `:root` is not pinned light. The agency theme has a `[data-theme="dark"]` block and
 *      next-themes follows the OS, so a `var(--bg)` on a phone in dark mode is near-black, and
 *      Xander asked for cream, never dark. There is no light-on-dark lockup either.
 * Every value names the agency token it mirrors (the light `:root` block at the top of
 * globals.css). Keep them in step by hand; this file is a row in PORTAL-DESIGN.md's mirror
 * table.
 *
 * `fontFamily` is the exception and is safe as a `var()`: the font variables are declared on
 * <html> in the root layout and don't change with the theme, so they resolve anywhere.
 *
 * WHY THE NAMES ARE TYPED HERE. `@clerk/nextjs` 7 (Core 3) loads its UI from Clerk's CDN as
 * `@clerk/ui@1`, and types `appearance` as `any` unless `@clerk/ui` is installed. Installing it
 * for types alone was tried and rejected on 2026-11-09: it added 547 packages and moved the
 * installed `@clerk/shared` off 4.15.0, i.e. it changed runtime code to get type checking.
 * Meanwhile Core 3 had renamed four variables this file used (`colorText`, `colorTextSecondary`,
 * `colorInputBackground`, `colorInputText`), and Clerk dropped them silently, so the popover was
 * never actually getting the ink colour it was given. The types below are copied from
 * `@clerk/ui@1.42.4`'s `dist/internal/appearance.d.ts` (the version the CDN serves), cut down
 * to the keys used here, so a misspelt or renamed key is a compile error instead of a no-op.
 * test/clerk-appearance.test.mjs also fails if one of the old names comes back.
 *
 * WHY THE TAILWIND CLASSES WIN. `cssLayerName: "clerk"` puts Clerk's own CSS in a cascade layer
 * that globals.css orders *below* `components` and `utilities`. Without it Clerk's styles were
 * unlayered and beat every utility class passed in `elements` regardless of specificity, so most
 * of the old `elements` entries were doing nothing either.
 */

type ClerkVariables = {
    colorPrimary?: string;
    colorPrimaryForeground?: string;
    colorDanger?: string;
    colorSuccess?: string;
    colorWarning?: string;
    colorNeutral?: string;
    colorForeground?: string;
    colorMuted?: string;
    colorMutedForeground?: string;
    colorBackground?: string;
    colorInput?: string;
    colorInputForeground?: string;
    colorRing?: string;
    colorShadow?: string;
    colorBorder?: string;
    colorModalBackdrop?: string;
    fontFamily?: string;
    fontFamilyButtons?: string;
    borderRadius?: string;
};

type ClerkOptions = {
    logoPlacement?: "inside" | "outside" | "none";
    logoImageUrl?: string;
    logoLinkUrl?: string;
    socialButtonsVariant?: "auto" | "iconButton" | "blockButton";
    socialButtonsPlacement?: "top" | "bottom";
    termsPageUrl?: string;
    helpPageUrl?: string;
    privacyPageUrl?: string;
    animations?: boolean;
};

/** The element keys used below, each checked against @clerk/ui 1.42.4's `ElementsConfig`. */
type ClerkElementKey =
    | "rootBox"
    | "cardBox"
    | "card"
    | "logoBox"
    | "logoImage"
    | "headerTitle"
    | "headerSubtitle"
    | "socialButtonsBlockButton"
    | "socialButtonsBlockButtonText"
    | "dividerLine"
    | "dividerText"
    | "formFieldLabel"
    | "formFieldInput"
    | "formButtonPrimary"
    | "footer"
    | "footerActionText"
    | "footerActionLink"
    | "userButtonAvatarBox"
    | "userButtonPopoverCard"
    | "userButtonPopoverMain"
    | "userButtonPopoverActions"
    | "userButtonPopoverActionButton"
    | "userButtonPopoverActionButtonIcon"
    | "userButtonPopoverFooter"
    | "userPreview"
    | "userPreviewMainIdentifier"
    | "userPreviewSecondaryIdentifier";

type ClerkTheme = {
    variables?: ClerkVariables;
    options?: ClerkOptions;
    elements?: Partial<Record<ClerkElementKey, string>>;
};

/** `cssLayerName` is a provider-level option only (`GlobalAppearanceOptions` in @clerk/ui). */
type ClerkProviderAppearance = ClerkTheme & { cssLayerName?: string };

/**
 * The agency palette in literal hex, each value named for the light `:root` token it mirrors.
 * Exported so the contrast test can check the pairs Clerk will actually render.
 *
 * Contrast (WCAG 2, computed; see test/clerk-appearance.test.mjs):
 *   fg       on card / bg / panelHeader   18.39 / 15.90 / 15.07
 *   fg2      on card / bg / panelHeader / white   10.27 / 8.88 / 8.42 / 10.46
 *   teal     on card / panelHeader        5.72 / 4.69   (links)
 *   danger   on card / white              5.10 / 5.19   (field errors)
 *   success  on card                      4.95
 *   warning  on card                      5.82
 *   onCoral  on coral                     4.08  LARGE TEXT ONLY (>= 18.66px bold). Clerk's
 *            primary button label here is Big Shoulders 20px 800, so it clears the 3:1 floor.
 *            Anything smaller on coral uses `coralDeep` (5.31) instead.
 *   onCoral  on coralDeep                 5.31
 * `--fg-3` (#7a715a) is deliberately absent: 4.11:1 on cream, which fails AA for the 11-13px
 * text Clerk sets in muted colour. `fg2` takes every secondary role.
 */
export const AGENCY_HEX = {
    bg: "#f4ecd8", //          --bg
    panelHeader: "#f0e6cd", // --panel-header
    panel: "#fbf5e6", //       --panel / --elev-1
    card: "#fffdf5", //        --elev-2
    fg: "#14120c", //          --fg
    fg2: "#43402c", //         --fg-2
    coral: "#d2542f", //       --accent-2
    coralDeep: "#b8441f", //   no token: the mockup's coral hover, AA for small text on it
    onCoral: "#fffdf5", //     --elev-2 (the mockup's label colour; --on-accent-2 is 3.53:1)
    teal: "#1f6f78", //        --accent
    danger: "#c2401f", //      --chart-neg
    success: "#2f7d4f", //     --chart-pos
    warning: "#8a5a00", //     no token: Clerk's default #F36B16 is 2.9:1 on the card
    white: "#ffffff", //       input fill, per the mockup
} as const;

export const clerkAppearance = {
    // Must match the layer named in the `@layer` order line at the top of globals.css.
    cssLayerName: "clerk",
    variables: {
        colorBackground: AGENCY_HEX.card,
        colorForeground: AGENCY_HEX.fg,
        colorMutedForeground: AGENCY_HEX.fg2,
        colorPrimary: AGENCY_HEX.coral,
        colorPrimaryForeground: AGENCY_HEX.onCoral,
        colorInput: AGENCY_HEX.white,
        colorInputForeground: AGENCY_HEX.fg,
        colorNeutral: AGENCY_HEX.fg, // base for hovers and dividers
        // Clerk's control borders. 0.5 ink is 3.52:1 on the white input, clearing WCAG 1.4.11's
        // 3:1 for a control boundary; the mockup's 0.28 (--rule-strong) is 1.89:1.
        colorBorder: "rgba(20, 18, 12, 0.5)",
        colorRing: "rgba(210, 84, 47, 0.25)", // --accent-2 at 25%, the mockup's focus ring
        colorShadow: "rgba(20, 18, 12, 0.10)", // --glass-shadow tint
        colorModalBackdrop: "rgba(20, 18, 12, 0.45)",
        colorDanger: AGENCY_HEX.danger,
        colorSuccess: AGENCY_HEX.success,
        colorWarning: AGENCY_HEX.warning,
        borderRadius: "6px",
        // The agency body face (`--font-body` in `:root`), named by its next/font variable rather
        // than `var(--font-body)`: `.portal-scope` redefines `--font-body`, and the UserButton
        // trigger sits inside it. Hanken is loaded at 400-600, so a 700 renders at 600.
        fontFamily: "var(--font-hanken), 'Hanken Grotesk', system-ui, sans-serif",
        fontFamilyButtons: "var(--font-hanken), 'Hanken Grotesk', system-ui, sans-serif",
    },
    elements: {
        // ── The account popover (ClerkMenu mockup) ──────────────────────────────────────────
        // Portalled into <body>, outside `.portal-scope`, hence literal hex in the classes too.
        userButtonAvatarBox: "size-7 shadow-[0_0_0_2px_#ffffff,0_0_0_4px_rgba(210,84,47,0.4)]",
        userButtonPopoverCard:
            "w-[340px] max-w-[calc(100vw-24px)] rounded-[12px] border border-[rgba(20,18,12,0.10)] bg-[#fffdf5] text-[#14120c] shadow-[0_18px_40px_rgba(20,18,12,0.18)]",
        userButtonPopoverMain: "bg-[#fffdf5]",
        userPreview: "px-[18px] py-4 gap-3",
        userPreviewMainIdentifier: "text-[14px] font-semibold text-[#14120c]",
        // 10.27:1 on the card.
        userPreviewSecondaryIdentifier: "text-[12.5px] text-[#43402c]",
        userButtonPopoverActions: "border-t-0",
        // Label 10.27:1 on the card; hover 15.90:1 (ink on cream).
        userButtonPopoverActionButton:
            "h-[46px] gap-[14px] px-[18px] border-t border-[rgba(20,18,12,0.08)] text-[13.5px] text-[#43402c] hover:bg-[#f4ecd8] hover:text-[#14120c]",
        // An icon, not text: 4.08:1 on the card clears the 3:1 non-text floor.
        userButtonPopoverActionButtonIcon: "size-4 text-[#d2542f] opacity-100",
        // "Secured by Clerk": 8.42:1 on the sand footer.
        userButtonPopoverFooter:
            "bg-none bg-[#f0e6cd] border-t border-[rgba(20,18,12,0.10)] text-[#43402c]",
    },
} as const satisfies ClerkProviderAppearance;

/**
 * The sign-in and sign-up card (ClerkSignIn and ClerkPhone mockups).
 *
 * The lockup is inside the card on desktop only. On a phone the page's own band carries it
 * directly above the card, so `logoBox` hides below 1024px rather than showing it twice.
 *
 * Help / Privacy / Terms are rendered by the page under the card, as in the mockup, not through
 * `options.*PageUrl`, which would put them inside Clerk's footer instead.
 */
export const clerkAuthAppearance = {
    options: {
        logoPlacement: "inside",
        logoImageUrl: "/jdd-lockup-portal.png",
        logoLinkUrl: "/",
        socialButtonsVariant: "blockButton",
        socialButtonsPlacement: "top",
    },
    elements: {
        rootBox: "w-full",
        cardBox:
            "w-full max-w-none rounded-[12px] border border-[rgba(20,18,12,0.10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_18px_40px_rgba(20,18,12,0.10)]",
        card: "bg-[#fffdf5] shadow-none border-0 rounded-none px-5 pt-[22px] pb-5 gap-[15px] lg:px-8 lg:pt-[30px] lg:pb-[26px] lg:gap-[18px]",
        // 150px wide at the lockup's 10:3.
        logoBox: "hidden lg:flex h-[45px] justify-center",
        logoImage: "h-[45px] w-auto",
        // Big Shoulders 900, uppercase: the agency's display voice. Ink on card, 18.39:1.
        headerTitle:
            "[font-family:var(--font-display)] font-black uppercase text-[28px] lg:text-[32px] leading-none tracking-normal text-[#14120c]",
        // 10.27:1 on the card.
        headerSubtitle: "text-[13.5px] text-[#43402c]",
        socialButtonsBlockButton:
            "h-12 lg:h-[46px] rounded-[6px] bg-[#fffdf5] border border-[rgba(20,18,12,0.5)] shadow-none hover:bg-[#f4ecd8]",
        socialButtonsBlockButtonText: "text-[15px] lg:text-[14px] font-semibold text-[#14120c]",
        dividerLine: "bg-[rgba(20,18,12,0.16)]",
        // 10.27:1 on the card.
        dividerText: "text-[12px] text-[#43402c]",
        formFieldLabel: "text-[13px] font-semibold text-[#14120c]",
        // `!` because globals.css has an unlayered `input:not(...) { … !important }` rule for the
        // marketing forms (fill `--surface`, teal focus). An !important in a *layer* beats an
        // unlayered !important, so these restore the mockup's white field and coral focus.
        // 16px on phones so iOS Safari doesn't zoom on focus (the same rule's reason for being).
        // Clerk draws the field's edge as a 1px box-shadow at ~5% ink, not a border, and caps the
        // height at 36px; `max-h-none` and the shadow ring restore the mockup's 46px field with
        // an edge that clears 3:1 (0.5 ink on white, 3.52:1). Focus: coral edge plus coral ring.
        formFieldInput:
            "h-12 max-h-none lg:h-[46px] px-3 !text-[16px] lg:!text-[14.5px] !bg-[#ffffff] !text-[#14120c] !shadow-[0_0_0_1px_rgba(20,18,12,0.5)] focus:!shadow-[0_0_0_1px_#d2542f,0_0_0_4px_rgba(210,84,47,0.25)]",
        // The agency's `.btn.primary`: Big Shoulders 800, uppercase, coral. The label is cream on
        // coral at 4.08:1, which passes only as large text, so the size must stay >= 18.66px
        // bold. 20px (21px on phones) is the mockup's. Hover darkens to 5.31:1.
        formButtonPrimary:
            "h-[50px] lg:h-12 rounded-[6px] bg-[#d2542f] hover:bg-[#b8441f] text-[#fffdf5] [font-family:var(--font-display)] font-extrabold text-[21px] lg:text-[20px] tracking-[0.04em] uppercase shadow-[0_8px_20px_-8px_rgba(210,84,47,0.55)] after:hidden",
        // The sand strip under the card: "Don't have an account? Sign up", "Secured by Clerk".
        footer: "bg-none bg-[#f0e6cd] border-t border-[rgba(20,18,12,0.10)]",
        // 8.42:1 on the sand.
        footerActionText: "text-[13px] text-[#43402c]",
        // Teal link, 4.69:1 on the sand; underlined so it isn't carried by colour alone.
        footerActionLink:
            "text-[13px] font-semibold text-[#1f6f78] underline underline-offset-2 hover:text-[#14525a]",
    },
} as const satisfies ClerkTheme;

/**
 * Clerk's built-in wording, overridden on the provider (`localization`).
 *
 * Approved in portal-ux-rework-copy-draft.md ("Sign in (Clerk) and account menu"). Sign-up's
 * first step keeps Clerk's default title: no string for it has been approved.
 *
 * `signUp.continue` is the step an invited client lands on (F-F1, 2026-11-11). The invitation
 * ticket verifies their email, and Clerk's continue step hides every field that is already
 * filled or optional, so with both instances' settings the one field left is the password. The
 * stock heading there was "Fill in missing fields". Clerk takes localization only on the
 * provider, never per component, so this applies to every continue step. That holds only while
 * a password is the one thing sign-up can be missing; `test/invite-signup-continue.test.mjs`
 * checks it against the recorded instance settings.
 */
export const clerkLocalization = {
    signIn: {
        start: {
            title: "Sign in to your client portal",
            subtitle: "Your leads, customers and site, all in one place",
        },
    },
    signUp: {
        continue: {
            title: "Create your password",
            subtitle: "You'll use it with your email to sign in to your client portal",
        },
    },
};
