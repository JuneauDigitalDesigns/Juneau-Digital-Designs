/**
 * How to reach Juneau Digital Designs, as the footer's Contact section shows it (Xander,
 * 2026-11-12). Footer only: the nav deliberately carries no number.
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
