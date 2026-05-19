export default function MockupBanner() {
    return (
        <div
            style={{
                background: "rgba(255, 196, 50, 0.08)",
                border: "1px solid rgba(255, 196, 50, 0.28)",
                color: "rgba(255, 196, 50, 0.92)",
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
                marginBottom: 28,
                textAlign: "center",
            }}
        >
            ⚠ Mockup preview — buttons are inert, no data is saved
        </div>
    );
}
