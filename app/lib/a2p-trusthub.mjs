// @ts-check
/**
 * A2P 10DLC identity — the vendor half: the TrustHub calls that consume the identity data.
 *
 * Plain ESM for the same reason as `a2p-identity.mjs`: this is the code path an EIN actually
 * travels down, so the test has to import the real implementation, and Node v22.0.0 cannot
 * import TypeScript.
 *
 * **Scope.** This module creates the four identity objects (runbook 2.2-2.4) and nothing
 * else. The customer profile, the entity assignments, the compliance evaluation, the submit,
 * the trust product, the brand and the campaign are the registration chain's — owned by the
 * runbook and `jdd-ops/lib/a2p-register.js`. The split is not arbitrary: these four calls are
 * the only ones that take identity data as input, and they are therefore the only ones that
 * have to happen inside the request that collected it.
 *
 * `fetchImpl` is injectable so the test can drive the real code with a spy instead of a mock
 * of it.
 */

import {
  buildAddressParams,
  buildBusinessEndUserAttributes,
  buildRepEndUserAttributes,
  scrubVendorMessage,
} from "./a2p-identity.mjs";

const TRUSTHUB = "https://trusthub.twilio.com/v1";
const TWILIO_API = "https://api.twilio.com/2010-04-01";

/**
 * @typedef {object} A2pTwilioAuth
 * @property {string} accountSid
 * @property {string} authToken
 */

/**
 * @typedef {object} A2pIdentitySids
 * @property {string} businessEndUserSid `IT…`
 * @property {string} repEndUserSid `IT…`
 * @property {string} addressSid `AD…`
 * @property {string} addressDocSid `RD…`
 */

/**
 * An error carrying a status and an already-scrubbed message.
 *
 * It is scrubbed at construction, not at the log site, because the only reliable way to keep
 * a payload out of a log is for no object in flight to be holding one by the time anything
 * can print it. An unhandled throw in a Next route writes `error.message` to stderr.
 */
export class A2pVendorError extends Error {
  /**
   * @param {string} message Already scrubbed.
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = "A2pVendorError";
    this.status = status;
  }
}

/** @param {A2pTwilioAuth} auth */
function basicAuth(auth) {
  return `Basic ${Buffer.from(`${auth.accountSid}:${auth.authToken}`).toString("base64")}`;
}

/**
 * One form-encoded Twilio POST.
 *
 * Every failure path goes through `scrubVendorMessage` with the submitted values, so a
 * vendor 400 that quotes the offending field value back at us cannot reach a log line or a
 * response body.
 *
 * @param {object} args
 * @param {string} args.url
 * @param {Record<string, string>} args.params
 * @param {A2pTwilioAuth} args.auth
 * @param {typeof fetch} args.fetchImpl
 * @param {string[]} args.submitted Values submitted this request, for scrubbing only.
 * @returns {Promise<Record<string, unknown>>}
 */
async function postForm({ url, params, auth, fetchImpl, submitted }) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(auth),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new A2pVendorError(
      `Twilio ${response.status} on ${new URL(url).pathname}: ${scrubVendorMessage(text, submitted)}`,
      response.status,
    );
  }
  try {
    return /** @type {Record<string, unknown>} */ (JSON.parse(text));
  } catch {
    // Not scrubbed-and-included: an unparseable body is not a field-level reason, and
    // including it would reintroduce the leak for no diagnostic gain.
    throw new A2pVendorError(`Twilio returned a non-JSON body on ${new URL(url).pathname}`, 502);
  }
}

/**
 * Best-effort cleanup of objects created earlier in a request that then failed.
 *
 * Without it, a failure between call two and call four leaves an orphaned business EndUser —
 * which still holds the EIN — on Twilio's side, with its SID discarded on ours, so nothing
 * could ever find it again. `DELETE /v1/EndUsers/{Sid}` is documented (204 No Content).
 *
 * Deliberately swallows its own errors: it runs while a failure is already being reported,
 * and a cleanup error must not replace the real one.
 *
 * @param {object} args
 * @param {string[]} args.endUserSids
 * @param {A2pTwilioAuth} args.auth
 * @param {typeof fetch} args.fetchImpl
 */
export async function deleteEndUsers({ endUserSids, auth, fetchImpl }) {
  await Promise.all(
    endUserSids.map(async (sid) => {
      try {
        await fetchImpl(`${TRUSTHUB}/EndUsers/${encodeURIComponent(sid)}`, {
          method: "DELETE",
          headers: { Authorization: basicAuth(auth) },
        });
      } catch {
        /* nothing to do and nothing to log: the caller is already failing */
      }
    }),
  );
}

/**
 * Create the business EndUser, the representative EndUser, the Address, and the Address
 * supporting document — then return only their SIDs.
 *
 * This function **is** the consume half of submit-and-consume. It takes the plaintext
 * identity data as an argument, holds it for the duration of these four calls, and returns
 * four opaque SIDs. Nothing it returns can be used to recover what it was given.
 *
 * @param {object} args
 * @param {string} args.slug Used only for `FriendlyName`s, so an operator can find the objects.
 * @param {import("./a2p-identity.mjs").A2pIdentityInput} args.input
 * @param {A2pTwilioAuth} args.auth
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<A2pIdentitySids>}
 */
export async function createIdentityObjects({ slug, input, auth, fetchImpl = fetch }) {
  /**
   * Everything the client typed that must never appear in a message, a log, or a response.
   * Assembled once and passed to every call's error path.
   */
  const submitted = [
    String(input.ein ?? ""),
    input.rep.email,
    input.rep.phone,
    input.rep.firstName,
    input.rep.lastName,
  ].filter((v) => String(v ?? "").trim().length > 0);

  /** @type {string[]} */
  const created = [];

  try {
    const business = await postForm({
      url: `${TRUSTHUB}/EndUsers`,
      params: {
        Type: "customer_profile_business_information",
        FriendlyName: `${slug}-business`,
        Attributes: JSON.stringify(buildBusinessEndUserAttributes(input)),
      },
      auth,
      fetchImpl,
      submitted,
    });
    const businessEndUserSid = String(business.sid ?? "");
    created.push(businessEndUserSid);

    const rep = await postForm({
      url: `${TRUSTHUB}/EndUsers`,
      params: {
        Type: "authorized_representative_1",
        FriendlyName: `${slug}-rep`,
        Attributes: JSON.stringify(buildRepEndUserAttributes(input)),
      },
      auth,
      fetchImpl,
      submitted,
    });
    const repEndUserSid = String(rep.sid ?? "");
    created.push(repEndUserSid);

    // Two calls rather than one, because TrustHub references an Address resource rather than
    // taking the fields inline (runbook 2.4).
    const address = await postForm({
      url: `${TWILIO_API}/Accounts/${encodeURIComponent(auth.accountSid)}/Addresses.json`,
      params: {
        ...buildAddressParams(input),
        FriendlyName: `${slug}-address`,
      },
      auth,
      fetchImpl,
      submitted,
    });
    const addressSid = String(address.sid ?? "");

    const addressDoc = await postForm({
      url: `${TRUSTHUB}/SupportingDocuments`,
      params: {
        Type: "customer_profile_address",
        FriendlyName: `${slug}-address`,
        Attributes: JSON.stringify({ address_sids: addressSid }),
      },
      auth,
      fetchImpl,
      submitted,
    });
    const addressDocSid = String(addressDoc.sid ?? "");

    return { businessEndUserSid, repEndUserSid, addressSid, addressDocSid };
  } catch (error) {
    await deleteEndUsers({ endUserSids: created.filter(Boolean), auth, fetchImpl });
    throw error;
  }
}
