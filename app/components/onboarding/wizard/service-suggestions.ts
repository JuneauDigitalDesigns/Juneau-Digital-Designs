/**
 * Suggestion chips for a service's details: what's included, the jobs customers call about, and
 * the questions they ask. A client taps only what's true; nothing is ever sent unless picked, and
 * the copywriter may tidy a picked item but never adds one.
 *
 * The lists live in @jdd/schema (v1.33.0+, `serviceSuggestions`, on each industry menu service),
 * the ONE source the agency wizard and the console intake both read. Nothing is kept here.
 *
 * Xander, 2026-11-10: "Yes, one trade per batch", each batch approved word for word, live
 * clients' trades first. A batch is added to jdd-schema's industry menu once approved, then the
 * pin moves. A service with no approved batch, or one typed in by hand, gets empty lists and shows
 * "add your own" only.
 */

import { serviceSuggestions } from "@jdd/schema";

export type ServiceSuggestions = { included: string[]; jobs: string[]; questions: string[] };

export function suggestionsFor(trade: string, service: string): ServiceSuggestions {
    return serviceSuggestions(trade, service);
}
