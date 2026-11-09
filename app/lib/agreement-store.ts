import "server-only";
import { get, put } from "@vercel/blob";

/**
 * Where signed agreement PDFs live, and the only code that touches them.
 *
 * They used to sit in the public Blob store, so anyone holding a link could read a client's
 * signed contract, with its IP address and browser audit page, forever. A Vercel store is public
 * or private for life, so agreements have their own private store and their own token. The
 * public store keeps serving what is meant to be public (showcase and onboarding images).
 *
 * A private blob can only be read with the token, on the server. Who gets the bytes is decided
 * by the caller: the portal's download route for the owner, the token-gated ops route for the
 * operator, and the agreement emails to the signer.
 *
 * There is deliberately no fallback to `BLOB_READ_WRITE_TOKEN`. If this token is missing, signing
 * fails loudly. Falling back would write the contract to the public store.
 */

function storeToken(): string {
    const token = process.env.AGREEMENTS_BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("AGREEMENTS_BLOB_READ_WRITE_TOKEN is not set");
    return token;
}

/** One PDF per agreement, addressed by its id, so a read never depends on a stored URL. */
export const agreementPathname = (id: string) => `agreements/${id}.pdf`;

/** Store a signed PDF privately. Returns its URL, which works only with the store's token. */
export async function storeAgreementPdf(id: string, pdf: Uint8Array): Promise<string> {
    const { url } = await put(agreementPathname(id), Buffer.from(pdf), {
        access: "private",
        contentType: "application/pdf",
        token: storeToken(),
    });
    return url;
}

/** The full signed PDF, audit page included. Throws if it can't be read. */
export async function readAgreementPdf(id: string): Promise<Uint8Array> {
    const result = await get(agreementPathname(id), { access: "private", token: storeToken() });
    if (!result || result.statusCode !== 200 || !result.stream) {
        throw new Error(`agreement ${id}: PDF not found in the private store`);
    }
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
}
