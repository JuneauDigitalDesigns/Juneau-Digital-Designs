/**
 * The replica's sample data, beyond what it shares with the homepage demo.
 *
 * The business, Dave and his 2:13 AM no-heat call, and the Inbox rows are the homepage demo's
 * own (`app/data/portal-demo.ts`), imported rather than copied. What is here is what the
 * GrowthDemo / GrowthDemoPhone mockups added for this demo, word for word as Xander approved
 * them on 9 Nov 2026. Everything is fictional, and every number is in the 555-01XX range
 * reserved for fiction.
 */
export const SAMPLE = {
    callMeta: "Phone call · 2:13 AM · 1m 58s",
    playRecording: "Play recording",
    daveJob: "Furnace out, house at 58°",
    town: "Pflugerville",
    goingQuiet: "Going quiet",
    /** The rest of the board, by column: 0 Lead, 1 Contacted, 2 Quoted, 3 Scheduled. */
    board: [
        { name: "Carol Ostrander", job: "Heat pump swap quote", col: 1, stale: false },
        { name: "Jim Petrakis", job: "Yearly tune-up", col: 2, stale: false },
        { name: "Tammy Reynolds", job: "Thermostat blank", col: 2, stale: true },
        { name: "Luis Mendoza", job: "New AC install", col: 3, stale: false },
    ],
    today: "Today",
    callBubble: "Call answered by your receptionist · furnace out, house at 58°",
    wonDay: "Thursday · job marked Won",
    send: "Send",
    fromNumber: "Sends from your business number, (512) 555-0100",
    /* The phone mockup's shorter lines, for a 390px screen. */
    phone: {
        leadLine: "Furnace quit overnight and the house is down to 58°.",
        leadMore: "Two kids at home. Wants someone out first thing.",
        carolLine: "A quote on swapping our oil furnace for a heat pump.",
        carolTime: "3 hrs",
        tammyLine: "Going quiet · quoted 6 days ago",
        callBubble: "Call answered by your receptionist · furnace out",
        stagePrefix: "Stage: ",
    },
} as const;
