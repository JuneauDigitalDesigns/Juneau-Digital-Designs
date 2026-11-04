/**
 * Onboarding prefill (app/lib/onboarding-prefill.ts + the wizard's initial state).
 *
 * Facts we already hold arrive filled in so the client only checks them: from the signed
 * agreement (both purchase paths) and, for a sales-call close, the operator order. Nothing is
 * invented, nothing we don't store is read, and a saved draft always wins.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPrefill } from "../app/lib/onboarding-prefill.ts";
import { buildPayload, initialState, restoreDraft } from "../app/components/onboarding/wizard/model.ts";

const agreement = {
    clientLegalName: "Ridgeline HVAC LLC",
    clientAddress: "2140 Edgewater Dr, Orlando, FL 32804",
    signerName: "Marcus Bell",
    signerTitle: "Owner",
};
const order = {
    vertical: "hvac",
    client: {
        legalName: "Ridgeline HVAC LLC",
        dba: "Ridgeline Heating & Air",
        entityType: "LLC",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        contactName: "Marcus Bell",
        contactTitle: "Owner",
        email: "marcus@ridgelineair.com",
        phone: "(407) 555-0142",
    },
};

test("a sales-call close fills name (DBA first), address, phone, trade and owner", () => {
    assert.deepEqual(buildPrefill({ agreement, order }), {
        source: "call",
        name: "Ridgeline Heating & Air",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        phone: "(407) 555-0142",
        trade: "hvac",
        owner: "Marcus Bell",
    });
    const noDba = buildPrefill({ agreement, order: { ...order, client: { ...order.client, dba: undefined } } });
    assert.equal(noDba.name, "Ridgeline HVAC LLC", "falls back to the legal name");
});

test("self-serve fills only what the agreement holds", () => {
    assert.deepEqual(buildPrefill({ agreement, order: null }), {
        source: "agreement",
        name: "Ridgeline HVAC LLC",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        owner: "Marcus Bell",
    });
    const p = buildPrefill({ agreement, order: null });
    assert.equal("phone" in p, false, "the agreement stores no business phone, so none is invented");
    assert.equal("trade" in p, false);
});

test("no inferences: the signer is the owner only when their title says so; unknown trades are dropped", () => {
    const manager = buildPrefill({ agreement: { ...agreement, signerTitle: "Office Manager" } });
    assert.equal("owner" in manager, false);
    for (const title of ["Co-owner", "Owner/Operator", "Founder"]) {
        assert.equal(buildPrefill({ agreement: { ...agreement, signerTitle: title } }).owner, "Marcus Bell", title);
    }
    const odd = buildPrefill({ order: { ...order, vertical: "pest-control" } });
    assert.equal("trade" in odd, false, "a trade the wizard doesn't offer is never forced in");
    assert.equal(buildPrefill({ order: { ...order, vertical: "other" } }).trade, "other");
});

test("nothing held, nothing prefilled", () => {
    assert.equal(buildPrefill({}), null);
    assert.equal(buildPrefill({ agreement: null, order: null }), null);
    assert.equal(buildPrefill({ agreement: { clientLegalName: " ", clientAddress: "", signerName: "", signerTitle: "" } }), null);
});

test("only facts we store: no tax ID or registration field can come through", () => {
    const withExtras = { ...agreement, ein: "47-1234567", representative: "x", businessIndustry: "y" };
    const p = buildPrefill({ agreement: withExtras, order: null });
    assert.deepEqual(Object.keys(p).sort(), ["address", "name", "owner", "source"]);
});

test("the wizard starts with the prefill, editable, and sends it as usual", () => {
    const st = initialState("marcus@ridgelineair.com", "forwarded", buildPrefill({ agreement, order }));
    assert.equal(st.name, "Ridgeline Heating & Air");
    assert.equal(st.trade, "hvac");
    assert.equal(st.phone, "(407) 555-0142");
    assert.equal(st.address, "2140 Edgewater Dr, Orlando, FL 32804");
    assert.equal(st.owner, "Marcus Bell");
    assert.equal(st.receptionistMode, "forwarded");
    assert.equal(st.screen, "welcome", "they still start at the welcome screen");
    const payload = buildPayload(st, { plan: "growth", signedMode: "forwarded" });
    assert.equal(payload.brandName, "Ridgeline Heating & Air");
    assert.equal(payload.ownerName, "Marcus Bell");
    assert.deepEqual(initialState("x@y.com", undefined, null).name, "", "no prefill leaves it blank");
});

test("a saved draft always wins, even where the client cleared a prefilled field", () => {
    const base = initialState("marcus@ridgelineair.com", "forwarded", buildPrefill({ agreement, order }));
    const draft = { ...base, name: "Ridgeline Air", phone: "", screen: "contact", visited: ["welcome", "trade", "name", "contact"] };
    const restored = restoreDraft(JSON.parse(JSON.stringify(draft)), base);
    assert.equal(restored.name, "Ridgeline Air", "the client's own edit is kept");
    assert.equal(restored.phone, "", "a field they emptied stays empty");
    assert.equal(restored.screen, "contact");
});
