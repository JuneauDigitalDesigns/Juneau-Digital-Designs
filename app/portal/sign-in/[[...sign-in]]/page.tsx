import { SignIn } from "@clerk/nextjs";
import PortalScope from "@/app/components/portal/PortalScope";
import { portalClerkAppearance } from "../../clerkAppearance";

export default function PortalSignInPage() {
    return (
        <PortalScope>
            <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
                <SignIn
                    path="/portal/sign-in"
                    routing="path"
                    signUpUrl="/portal/sign-up"
                    appearance={portalClerkAppearance}
                />
            </div>
        </PortalScope>
    );
}
