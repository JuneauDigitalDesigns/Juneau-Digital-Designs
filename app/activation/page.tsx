export const metadata = {
    title: "Turning on your receptionist | Juneau Digital Designs",
    description:
        "How to point your business line at your JDD AI receptionist: forward your existing number, or publish the number we give you. Step-by-step, per carrier.",
};

/**
 * The activation instructions, as a page a client can come back to.
 *
 * Split from the choice they made in the onboarding wizard on purpose. Picking an option takes
 * five seconds; actually forwarding a line means logging into a carrier account, or calling
 * them, and it is routinely not something a client finishes in the same sitting. A page they
 * can bookmark is the difference between "I'll do it later" and never doing it, and until it
 * is done the receptionist receives nothing, the client sees no value, and the first-month
 * guarantee is measuring a system that was never connected.
 *
 * Deliberately **account-free and static**. At the moment the wizard is submitted the client's
 * Twilio number does not exist yet: `onboard.js` provisions it afterwards. So there is no
 * number to render here, and a page that tried would either block on provisioning or print a
 * placeholder. The number arrives by email; these are the steps that go with it.
 */

const CARRIERS: { name: string; steps: string }[] = [
    {
        name: "Most carriers, from your handset",
        steps:
            "Dial *72, then the number we send you, then press call. You should hear a confirmation tone. To switch it off later, dial *73.",
    },
    {
        name: "Verizon",
        steps:
            "In My Verizon, open the line, then Manage, then Call Forwarding. Choose Forward when busy or unanswered rather than Forward all calls, so your own phone still rings first.",
    },
    {
        name: "AT&T",
        steps:
            "In myAT&T, open the line, then Manage features, then Call Forwarding. Pick Conditional forwarding (no answer or busy), not Immediate.",
    },
    {
        name: "T-Mobile",
        steps:
            "In T-Mobile, open the line, then Manage data and add-ons, then Call Forwarding. Set Forward when no answer. Leave Forward all calls off.",
    },
    {
        name: "Google Voice",
        steps:
            "In Settings, under Calls, add the number we send you as a linked number and set it to ring after your own phone, not instead of it.",
    },
    {
        name: "An office phone system (VoIP or PBX)",
        steps:
            "Whoever manages your phone system can set a no-answer or overflow destination. Give them the number we send you and ask for it as the overflow after about 15 seconds of ringing.",
    },
];

export default function ActivationPage() {
    return (
        <main
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                padding: "64px max(24px, 4vw)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                    background:
                        "radial-gradient(ellipse at 60% 10%, rgba(245,237,214,0.07) 0%, transparent 60%)",
                }}
            />

            <article
                className="glass"
                style={{
                    position: "relative",
                    zIndex: 1,
                    maxWidth: 760,
                    margin: "0 auto",
                    padding: "clamp(28px, 4vw, 48px)",
                    borderRadius: 22,
                }}
            >
                <span className="eyebrow">Activation</span>
                <h1 style={{ fontSize: "var(--text-2xl)", margin: "16px 0 12px" }}>
                    Turning on your receptionist
                </h1>
                <p style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 16 }}>
                    Your receptionist can only answer calls it can actually reach. There are two
                    ways to do that, and you only need one of them. We will email you your number
                    as soon as your site is built; these are the steps that go with it.
                </p>

                <div
                    style={{
                        marginTop: 24,
                        padding: "18px 20px",
                        borderRadius: 14,
                        background: "var(--surface)",
                        border: "1px solid var(--rule)",
                        borderTop: "2px solid var(--accent)",
                    }}
                >
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--fg)", fontSize: 15 }}>
                        The AI never answers before you do.
                    </p>
                    <p style={{ margin: "6px 0 0", color: "var(--fg-2)", lineHeight: 1.65, fontSize: 14.5 }}>
                        Whichever option you pick, your own phone rings first. The AI only steps in
                        when nobody picks up, so it is replacing your voicemail, not answering ahead
                        of you. That is why the forwarding setting below matters: choose the
                        &ldquo;no answer&rdquo; kind, never &ldquo;forward all calls&rdquo;.
                    </p>
                </div>

                <h2 style={{ fontSize: "var(--text-xl)", margin: "36px 0 10px" }}>
                    Option 1: forward your existing number
                </h2>
                <p style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 15.5 }}>
                    Best if your number is already on your trucks, your cards, and your Google
                    listing. You keep it. You set your carrier to forward unanswered calls to the
                    number we give you, and those calls reach your receptionist instead of going to
                    voicemail. Nothing about how you answer the phone changes.
                </p>

                <div style={{ marginTop: 20 }}>
                    {CARRIERS.map((c) => (
                        <div key={c.name} style={{ borderTop: "1px solid var(--rule)", padding: "16px 0" }}>
                            <p style={{ margin: 0, fontWeight: 600, color: "var(--fg)", fontSize: 14.5 }}>
                                {c.name}
                            </p>
                            <p style={{ margin: "4px 0 0", color: "var(--fg-2)", lineHeight: 1.65, fontSize: 14.5 }}>
                                {c.steps}
                            </p>
                        </div>
                    ))}
                </div>

                <p
                    style={{
                        marginTop: 18,
                        color: "var(--fg-3)",
                        lineHeight: 1.65,
                        fontSize: 13.5,
                    }}
                >
                    One thing to watch: if your phone rings for a long time before forwarding, your
                    carrier&apos;s own voicemail can pick up first, and then the call never reaches
                    your receptionist. About 15 seconds, or four rings, is the sweet spot. If your
                    voicemail answers earlier than that, tell us and we will sort it out with you.
                </p>

                <h2 style={{ fontSize: "var(--text-xl)", margin: "36px 0 10px" }}>
                    Option 2: use our number as your business number
                </h2>
                <p style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 15.5 }}>
                    Best if you are starting fresh, or you have been meaning to separate your
                    business line from your personal mobile. You put the number we give you on your
                    site, your cards and your listings. Calls arrive on it, ring your phone first,
                    and reach your receptionist if you miss them. Nothing to configure with your
                    carrier at all.
                </p>

                <h2 style={{ fontSize: "var(--text-xl)", margin: "36px 0 10px" }}>
                    If you told us no receptionist
                </h2>
                <p style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 15.5 }}>
                    Then there is nothing for you to do here, and nothing has gone wrong. We are
                    building your website and we will not set up a phone number. Your price is the
                    same either way. If you change your mind, tell us and we will switch the
                    receptionist on with no extra onboarding fee.
                </p>

                <h2 style={{ fontSize: "var(--text-xl)", margin: "36px 0 10px" }}>Stuck?</h2>
                <p style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 15.5 }}>
                    Your carrier has to make the change, so it is the one part of setup we cannot do
                    for you. We can stay on the phone while you do it, though. Reply to any email
                    from us, or raise it from the Support tab in your portal, and we will walk you
                    through your specific carrier.
                </p>
            </article>
        </main>
    );
}
