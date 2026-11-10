import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Small pieces the Overview's cards share, drawn from `Overview.dc.html` and its Starter and
 * phone boards. Every colour is a `.portal-scope` token; nothing here portals out of the scope,
 * so there is no hex to mirror in PORTAL-DESIGN.md.
 *
 * Server components throughout. Nothing on the Overview holds state, and rendering times on
 * the server in the client's zone keeps the HTML final — no hydration drift on "2:13 AM".
 */

/** Card title — Cabinet Grotesk 17px bold, as `.ct` in the mockup. */
export function CardTitle({ id, children }: { id?: string; children: ReactNode }) {
    return (
        <h2
            id={id}
            className="flex items-center gap-2"
            style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "17px",
                letterSpacing: "normal",
                lineHeight: 1.2,
                margin: 0,
            }}
        >
            {children}
        </h2>
    );
}

/** Header row of a list card: title on the left, a link on the right, hairline beneath. */
export function CardHead({ children, action }: { children: ReactNode; action?: ReactNode }) {
    return (
        <div
            className="flex items-center justify-between gap-3 px-3.5 py-3 lg:px-[18px] lg:py-3.5"
            style={{ borderBottom: "1px solid var(--rule)" }}
        >
            {children}
            {action}
        </div>
    );
}

/** The accent link at the right of a card head ("Open inbox →"). */
export function HeadLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className="text-[13px] shrink-0 hover:underline" style={{ color: "var(--accent)" }}>
            {children}
        </Link>
    );
}

/**
 * Small uppercase mono label (`.cl`). `--fg-3` on white is 5.38:1, so it clears AA at 10.5px.
 */
export function MonoLabel({ id, children }: { id?: string; children: ReactNode }) {
    return (
        <span
            id={id}
            className="uppercase"
            style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                letterSpacing: "0.06em",
                color: "var(--fg-3)",
            }}
        >
            {children}
        </span>
    );
}

/** A figure in Cabinet Grotesk 800 (`.num`). Size is the caller's: 52 / 30 / 26 / 24px. */
export function BigNumber({
    size,
    color,
    children,
}: {
    size: number;
    color?: string;
    children: ReactNode;
}) {
    return (
        <span
            className="portal-numeral"
            style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                fontSize: `${size}px`,
                color: color ?? "var(--fg)",
            }}
        >
            {children}
        </span>
    );
}

/** Desktop and phone carry different approved wording in places; this picks per breakpoint. */
export function ByWidth({ desktop, phone }: { desktop: ReactNode; phone: ReactNode }) {
    return (
        <>
            <span className="hidden lg:inline">{desktop}</span>
            <span className="lg:hidden">{phone}</span>
        </>
    );
}

export function PhoneIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
        </svg>
    );
}

export function ChatIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 5h16v11H8l-4 4z" />
        </svg>
    );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
        </svg>
    );
}

export function FormIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
    );
}

export function PlayIcon({ size = 15 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
        </svg>
    );
}
