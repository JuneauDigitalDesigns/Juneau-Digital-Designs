import { SignIn } from "@clerk/nextjs";

export default function PortalSignInPage() {
    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
            <SignIn
                appearance={{
                    variables: {
                        colorBackground: "#0d1b2e",
                        colorText: "#F4F6FB",
                        colorInputBackground: "rgba(255,255,255,0.06)",
                        colorInputText: "#F4F6FB",
                        colorPrimary: "#F5EDD6",
                    },
                    elements: {
                        card: "border border-white/10 shadow-2xl",
                        formButtonPrimary: "bg-[#F5EDD6] text-[#07101e] hover:bg-[#ede3c5] font-semibold",
                    },
                }}
            />
        </div>
    );
}
