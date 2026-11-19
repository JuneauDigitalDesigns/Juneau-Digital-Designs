/**
 * How to reach Juneau Digital Designs, as the footer's Contact section shows it (Xander,
 * 2026-11-12).
 *
 * The footer was the only place it appeared until 19 Nov 2026, when Xander asked for it in the
 * nav bar too, as a button that dials. Both read it from here, so the number exists once.
 *
 * Not to be confused with `DEMO_TEL` in ./demo-line.ts, which is a different number doing a
 * different job: this one reaches Xander, that one rings the AI receptionist so a prospect can
 * hear it. The page asks use the demo line; the nav and the footer use this one.
 *
 * Typed clean. The number as first pasted carried an invisible U+202C character, which can
 * break a `tel:` link and rides along when a visitor copies the number. `test/footer-contact`
 * refuses any invisible character here.
 */
export const CONTACT = {
    phoneDisplay: "(407) 984-7493",
    phoneHref: "tel:+14079847493",
    email: "support@juneaudigitaldesigns.com",
    emailHref: "mailto:support@juneaudigitaldesigns.com",
};
