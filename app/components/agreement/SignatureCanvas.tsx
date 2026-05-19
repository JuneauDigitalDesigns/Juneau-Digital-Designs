"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface SignatureCanvasHandle {
    isEmpty: () => boolean;
    toDataUrl: () => string;
    clear: () => void;
}

const SignatureCanvas = forwardRef<SignatureCanvasHandle>(function SignatureCanvas(_, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#EDEDEE";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, []);

    useImperativeHandle(ref, () => ({
        isEmpty: () => !hasInk,
        toDataUrl: () => {
            const canvas = canvasRef.current;
            if (!canvas) return "";
            // Re-render onto a white-background canvas for PDF embedding
            const out = document.createElement("canvas");
            out.width = canvas.width;
            out.height = canvas.height;
            const ctx = out.getContext("2d")!;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, out.width, out.height);
            ctx.drawImage(canvas, 0, 0);
            // Use black ink on white background so it reads on a PDF
            // (We re-draw paths in black by leveraging the existing canvas as source,
            // but since the stroke was light gray, we apply a luminance invert.)
            const img = ctx.getImageData(0, 0, out.width, out.height);
            for (let i = 0; i < img.data.length; i += 4) {
                // If the pixel isn't pure white, force it to near-black
                if (img.data[i] < 240 || img.data[i + 1] < 240 || img.data[i + 2] < 240) {
                    img.data[i] = 20;
                    img.data[i + 1] = 20;
                    img.data[i + 2] = 20;
                }
            }
            ctx.putImageData(img, 0, 0);
            return out.toDataURL("image/png");
        },
        clear: () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasInk(false);
        },
    }), [hasInk]);

    function getCoords(e: React.PointerEvent<HTMLCanvasElement>) {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
        e.preventDefault();
        const ctx = canvasRef.current!.getContext("2d")!;
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        drawingRef.current = true;
    }

    function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawingRef.current) return;
        e.preventDefault();
        const ctx = canvasRef.current!.getContext("2d")!;
        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        if (!hasInk) setHasInk(true);
    }

    function onUp() {
        drawingRef.current = false;
    }

    function clearLocal() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasInk(false);
    }

    return (
        <div>
            <div
                style={{
                    background: "var(--surface)",
                    border: "1px solid var(--rule)",
                    borderRadius: 10,
                    padding: 4,
                }}
            >
                <canvas
                    ref={canvasRef}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerLeave={onUp}
                    style={{
                        display: "block",
                        width: "100%",
                        height: 150,
                        touchAction: "none",
                        cursor: "crosshair",
                        borderRadius: 8,
                    }}
                />
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                }}
            >
                <span
                    style={{
                        fontSize: 11,
                        color: hasInk ? "var(--accent)" : "var(--fg-3)",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.06em",
                    }}
                >
                    {hasInk ? "✓ SIGNED" : "DRAW YOUR SIGNATURE ABOVE"}
                </span>
                <button
                    type="button"
                    onClick={clearLocal}
                    style={{
                        background: "transparent",
                        border: "1px solid var(--rule)",
                        color: "var(--fg-2)",
                        fontSize: 11,
                        padding: "4px 12px",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.06em",
                    }}
                >
                    CLEAR
                </button>
            </div>
        </div>
    );
});

export default SignatureCanvas;
