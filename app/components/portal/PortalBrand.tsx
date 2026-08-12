import Image from "next/image";

/**
 * The JDD lockup at the top of the portal rail, on its cream band.
 *
 * This is the only agency branding anywhere in the portal, and deliberately so: the rest
 * of the product is cool-neutral, and the client's own brand never appears at all. One
 * branded object, clearly marked as ours, linking back to the agency.
 *
 * The asset is the lockup cut out of its original cream ground to transparency, so the
 * band colour is `--brand-band` in CSS rather than baked pixels. That is what stops a
 * seam appearing where the image ends and the band fill begins — the original
 * `JDD_mark.png` has a grainy cream ground baked in and must not be used here.
 *
 * Sizing lives in `.portal-brand img` in globals.css, not on the element, because the
 * band height and the lockup height are separate decisions that change at the 1024px
 * breakpoint together. See the geometry contract comment on `.portal-brand`.
 */
export default function PortalBrand() {
    return (
        <a
            href="https://juneaudigitaldesigns.com"
            target="_blank"
            rel="noopener noreferrer"
            className="portal-brand"
            title="Juneau Digital Designs"
            aria-label="Juneau Digital Designs — agency home (opens in a new tab)"
        >
            <Image
                src="/jdd-lockup-portal.png"
                alt="Juneau Digital Designs"
                width={640}
                height={192}
                priority
            />
        </a>
    );
}
