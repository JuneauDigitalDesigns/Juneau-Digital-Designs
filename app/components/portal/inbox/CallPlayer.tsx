"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";

/**
 * The phone's recording player (2026-11-19 mockup, Q8): a big round play button, a scrubber and
 * the time, sized for a thumb. The browser's own <audio> controls are small and differ per phone.
 *
 * The audio element is still the real player underneath, `preload="none"` as before, so nothing
 * is fetched from the recording route until they press play. Desktop keeps the native controls.
 */
export default function CallPlayer({ src, label }: { src: string; label: string }) {
    const audio = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [time, setTime] = useState(0);
    const [length, setLength] = useState(0);

    useEffect(() => {
        const a = audio.current;
        if (!a) return;
        const onTime = () => setTime(a.currentTime);
        const onMeta = () => setLength(Number.isFinite(a.duration) ? a.duration : 0);
        const onEnd = () => setPlaying(false);
        const onPlay = () => setPlaying(true);
        a.addEventListener("timeupdate", onTime);
        a.addEventListener("loadedmetadata", onMeta);
        a.addEventListener("ended", onEnd);
        a.addEventListener("pause", onEnd);
        a.addEventListener("play", onPlay);
        return () => {
            a.removeEventListener("timeupdate", onTime);
            a.removeEventListener("loadedmetadata", onMeta);
            a.removeEventListener("ended", onEnd);
            a.removeEventListener("pause", onEnd);
            a.removeEventListener("play", onPlay);
        };
    }, []);

    const toggle = () => {
        const a = audio.current;
        if (!a) return;
        if (a.paused) void a.play().catch(() => setPlaying(false));
        else a.pause();
    };

    return (
        <div className="flex items-center gap-3">
            <audio ref={audio} preload="none" src={src} />
            <button
                type="button"
                onClick={toggle}
                aria-label={playing ? `Pause ${label}` : `Play ${label}`}
                className="shrink-0 w-[52px] h-[52px] rounded-full grid place-items-center cursor-pointer active:scale-95 transition-transform"
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
                {playing ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}
            </button>
            <input
                type="range"
                min={0}
                max={length || 0}
                step={0.1}
                value={Math.min(time, length || 0)}
                onChange={(e) => {
                    const a = audio.current;
                    if (a) a.currentTime = Number(e.target.value);
                }}
                aria-label="Position in recording"
                className="flex-1 min-w-0 h-11"
                style={{ accentColor: "var(--accent)" }}
                disabled={!length}
            />
            <span className="shrink-0 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                {clock(time)}
                {length ? ` / ${clock(length)}` : ""}
            </span>
        </div>
    );
}

function clock(s: number): string {
    const t = Math.max(0, Math.floor(s));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
