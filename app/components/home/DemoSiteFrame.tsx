"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * A real site of ours, in the hero.
 *
 * This was a live <iframe> and that approach was wrong. To reveal the page below the
 * fold the iframe had to be rendered several thousand pixels tall — but an iframe's
 * height *is* its viewport, so the demo's `min-height: 96vh` hero resolved against it
 * and inflated to ~4992px. The pan then spent its whole travel inside one stretched,
 * empty hero. Measured: at an 800px viewport the hero is 845px; at 2000px it's 1920px.
 *
 * Cross-origin rules also forbid scrolling the iframe's document, so there was no live
 * fix. It's now a screenshot captured at a true 1280x800 viewport, which renders
 * exactly right and drops a third-party request from the hero's critical path.
 *
 * Recapture with scratchpad/capture.js if the demo changes; the gate is that the image
 * comes back ~4492px tall, not ~8600.
 */

/* The viewport the capture was taken at. The pan shows one viewport-worth at a time,
   so this has to match or the framing is wrong. */
const VIEW_W = 1280;
const VIEW_H = 800;
/* Defaults matching the committed asset — replaced by the real values on load, so a
   recapture at a different height still pans correctly. */
const DEFAULT_H = 4492;
const DURATION_MS = 34000;

export default function DemoSiteFrame() {
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(VIEW_H / VIEW_W);
  const [imgH, setImgH] = useState(DEFAULT_H);
  const [loaded, setLoaded] = useState(false);

  // A cached image finishes loading before hydration attaches onLoad, so that handler
  // never fires and the frame sits on its skeleton forever with the pan switched off.
  // Any repeat visit hits this. Catch the already-complete case on mount.
  useEffect(() => {
    const el = imgRef.current;
    if (el?.complete && el.naturalHeight > 0) {
      setImgH(el.naturalHeight);
      setLoaded(true);
    }
  }, []);

  // Fit the fixed-size capture into whatever width the hero column gives us.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      // Guard against a 0 measurement before first layout — scale(0) collapses the
      // frame to nothing and there'd be no second callback to recover from it.
      if (w > 0) setScale(w / VIEW_W);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    // ResizeObserver callbacks are delivered with the rendering steps, so they can be
    // withheld where frames aren't being produced (background tabs, some embedded
    // views). The window listener isn't redundant there — it's the one that fires.
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const animate = loaded && !reduce;
  /* Image-space pixels: the translate happens inside the scaled wrapper, so it must
     not be pre-scaled. */
  const travel = Math.max(0, imgH - VIEW_H);

  return (
    <div className="laptop">
      {/* No URL in the chrome — the address bar named a throwaway test deployment,
          which invites the visitor to go look at it rather than at their own site. */}
      <div className="laptop-bar" aria-hidden="true">
        <span className="laptop-dot" />
        <span className="laptop-dot" />
        <span className="laptop-dot" />
      </div>

      <div ref={hostRef} className="laptop-screen" style={{ height: VIEW_H * scale }}>
        <div style={{ width: VIEW_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {/* Plain <img>, not next/image: the pan maps 1:1 onto the capture's pixel
              geometry, and the optimizer would resample it to arbitrary widths. The
              asset is already a sized, compressed webp. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src="/demo-site.webp"
            alt="A website we built for an HVAC company, scrolling from the hero through services, reviews and booking."
            width={VIEW_W}
            height={imgH}
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalHeight > 0) setImgH(el.naturalHeight);
              setLoaded(true);
            }}
            className={animate ? "laptop-pan" : undefined}
            style={{
              width: VIEW_W,
              height: "auto",
              display: "block",
              ["--pan-travel" as string]: `-${travel}px`,
              ["--pan-duration" as string]: `${DURATION_MS}ms`,
            }}
          />
        </div>
        {!loaded && <div className="laptop-skeleton" aria-hidden="true" />}
      </div>
    </div>
  );
}
