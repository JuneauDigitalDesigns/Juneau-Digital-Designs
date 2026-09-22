/**
 * Whether a string is a URL our own Vercel Blob store actually issued, rather than something
 * a client handed us that merely looks like one. Every route that accepts a client-supplied
 * image URL (onboarding uploads, featured-listing uploads) validates against this before
 * trusting it — an attacker-controlled URL stored in an account record would otherwise be
 * rendered back to every visitor of the homepage or portal.
 */
export function isValidBlobUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" && parsed.hostname.endsWith(".public.blob.vercel-storage.com");
    } catch {
        return false;
    }
}
