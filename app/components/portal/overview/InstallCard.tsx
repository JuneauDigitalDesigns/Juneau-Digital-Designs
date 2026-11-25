"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Export } from "@phosphor-icons/react";
import Sheet from "../inbox/Sheet";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { collapseProps } from "../ui/collapse";

/**
 * "Put the portal on your home screen" (2026-11-19, Xander Q18), a one-time card on Home.
 *
 * Approved wording, word for word (mockup strings 8 to 12): the title, the body, "Show me how" /
 * "Not now", and the sheet's title and three iPhone steps.
 *
 * Shown only on a phone browser that can install it and has not: iPhone/iPad Safari (which has no
 * install prompt, so "Show me how" opens the steps), or any browser that has fired
 * `beforeinstallprompt` (Android Chrome), where "Show me how" opens the browser's own install
 * dialog instead. Never on a desktop, never once installed, and never again after "Not now".
 * The dismissal is per device, in localStorage, which is the right scope for "this phone".
 */
const DISMISSED_KEY = "portal-install-dismissed";

interface InstallPromptEvent extends Event {
    prompt: () => Promise<void>;
}

export default function InstallCard() {
    const [mode, setMode] = useState<"hidden" | "ios" | "prompt">("hidden");
    const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
    const [steps, setSteps] = useState(false);
    const reduce = useReducedMotion();

    useEffect(() => {
        let dismissed = false;
        try {
            dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
        } catch {}
        const standalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone === true;
        const phone = window.matchMedia("(max-width: 1023px)").matches;
        if (dismissed || standalone || !phone) return;

        const ua = navigator.userAgent;
        const iosSafari = /iP(hone|ad|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
        // Set from an event or a one-off check after mount, never during render.
        const t = window.setTimeout(() => {
            if (iosSafari) setMode("ios");
        }, 0);

        const onPrompt = (e: Event) => {
            e.preventDefault();
            setDeferred(e as InstallPromptEvent);
            setMode("prompt");
        };
        window.addEventListener("beforeinstallprompt", onPrompt);
        return () => {
            window.clearTimeout(t);
            window.removeEventListener("beforeinstallprompt", onPrompt);
        };
    }, []);

    const dismiss = () => {
        try {
            localStorage.setItem(DISMISSED_KEY, "1");
        } catch {}
        setMode("hidden");
    };

    return (
        <>
            {/* Folds away on Not now rather than popping (2026-11-19). */}
            <AnimatePresence initial={false}>
            {mode !== "hidden" && (
            <motion.div key="install" {...collapseProps(reduce)} className="lg:hidden">
            <div className="portal-elev flex gap-3 items-start p-3.5" style={{ borderRadius: 16 }}>
                <span
                    aria-hidden="true"
                    className="shrink-0 w-[46px] h-[46px] rounded-[11px] overflow-hidden grid place-items-center"
                    style={{ background: "var(--brand-band)" }}
                >
                    <Image src="/portal-icons/icon-192.png" alt="" width={46} height={46} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="m-0 font-semibold text-[16px]" style={{ color: "var(--fg)" }}>
                        Put the portal on your home screen
                    </p>
                    <p className="m-0 mt-0.5 text-[14.5px]" style={{ color: "var(--fg-2)" }}>
                        It opens full screen, like an app, one tap from your home screen.
                    </p>
                    <div className="flex gap-5 mt-2.5">
                        <button
                            type="button"
                            className="min-h-11 text-[15px] font-semibold cursor-pointer"
                            style={{ color: "var(--accent)" }}
                            onClick={() => {
                                if (mode === "prompt" && deferred) {
                                    void deferred.prompt().finally(dismiss);
                                } else {
                                    setSteps(true);
                                }
                            }}
                        >
                            Show me how
                        </button>
                        <button
                            type="button"
                            className="min-h-11 text-[15px] cursor-pointer"
                            style={{ color: "var(--fg-3)" }}
                            onClick={dismiss}
                        >
                            Not now
                        </button>
                    </div>
                </div>
            </div>
            </motion.div>
            )}
            </AnimatePresence>

            {steps && (
                <Sheet label="Add to your home screen" onClose={() => setSteps(false)}>
                    <h2 className="m-0 px-1 text-[19px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
                        Add to your home screen
                    </h2>
                    <ol className="list-none m-0 mt-2 p-0 flex flex-col gap-3.5">
                        {[
                            <>
                                Tap the Share button{" "}
                                <Export size={18} aria-hidden="true" style={{ display: "inline", verticalAlign: "-3px", color: "var(--accent)" }} />{" "}
                                in Safari&apos;s toolbar.
                            </>,
                            <>Scroll down and tap Add to Home Screen.</>,
                            <>Tap Add. The portal icon appears with your other apps.</>,
                        ].map((step, i) => (
                            <li key={i} className="flex gap-3 items-start text-[16px]" style={{ color: "var(--fg)" }}>
                                <span
                                    aria-hidden="true"
                                    className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-[14px] font-bold"
                                    style={{ background: "color-mix(in srgb, var(--accent) 14%, var(--elev-1))", color: "var(--accent)" }}
                                >
                                    {i + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>
                    <button
                        type="button"
                        onClick={() => {
                            setSteps(false);
                            dismiss();
                        }}
                        className="mt-4 h-12 rounded-[13px] text-[16px] font-semibold cursor-pointer"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        Done
                    </button>
                </Sheet>
            )}
        </>
    );
}
