import "server-only";
import { randomUUID } from "node:crypto";
import { get, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

/**
 * Where a close call's recording lives: the same private store as the signed agreements, under
 * its own prefix (`agreement-store.ts` owns `agreements/`).
 *
 * A recording is too big to pass through this app. A Vercel Function's request body stops at
 * 4.5 MB, and a few minutes of Zoom video is tens of megabytes. So this app never receives the
 * file: it issues a token good for one pathname, the console streams the file straight to the
 * store with it, and this app then checks the blob arrived at the size the console reports.
 *
 * There is deliberately no fallback to the public store's token, for the same reason the signed
 * agreements have none: this is a recording of a client's voice.
 */

/** Far past a terms-only recording. A bound on a mistake, not a plan limit. */
export const MAX_RECORDING_BYTES = 5 * 1024 * 1024 * 1024;

/** Long enough for a large file on a slow uplink. The token only ever writes one new pathname. */
const UPLOAD_WINDOW_MS = 6 * 60 * 60 * 1000;

function storeToken(): string {
    const token = process.env.AGREEMENTS_BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("AGREEMENTS_BLOB_READ_WRITE_TOKEN is not set");
    return token;
}

/** Every recording for an agreement sits under this. Also what `complete` checks a path against. */
export const recordingPrefix = (agreementId: string) => `recordings/${agreementId}/`;

/** A fresh name each time, so a retried upload can't collide with a half-finished one. */
export function newRecordingPathname(agreementId: string, fileName: string): string {
    const ext = /\.[a-z0-9]{1,8}$/i.exec(fileName)?.[0].toLowerCase() ?? "";
    return `${recordingPrefix(agreementId)}${randomUUID()}${ext}`;
}

/** A token that can create this one pathname and nothing else. It cannot read or overwrite. */
export async function recordingUploadToken(pathname: string): Promise<string> {
    return generateClientTokenFromReadWriteToken({
        token: storeToken(),
        pathname,
        maximumSizeInBytes: MAX_RECORDING_BYTES,
        allowedContentTypes: ["video/*", "audio/*"],
        validUntil: Date.now() + UPLOAD_WINDOW_MS,
        addRandomSuffix: false,
        allowOverwrite: false,
    });
}

/** What the store holds at this path, or null if nothing does. */
export async function recordingStat(pathname: string): Promise<{ size: number } | null> {
    try {
        const blob = await head(pathname, { token: storeToken() });
        return { size: blob.size };
    } catch (e) {
        if (e instanceof Error && e.name === "BlobNotFoundError") return null;
        throw e;
    }
}

/** The recording's bytes as a stream, so a large file is never held in memory here. */
export async function openRecording(pathname: string): Promise<ReadableStream<Uint8Array> | null> {
    const result = await get(pathname, { access: "private", token: storeToken(), useCache: false });
    return result && result.statusCode === 200 && result.stream ? result.stream : null;
}
