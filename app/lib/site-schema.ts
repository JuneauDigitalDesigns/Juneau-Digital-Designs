/**
 * site-schema.ts — thin re-export of the shared @jdd/schema contract.
 *
 * The canonical SiteContent schema, the Intake envelope, the OnboardingSubmission
 * payload, and the mapPayloadToIntake mapper now live in the @jdd/schema package
 * (github:JuneauDigitalDesigns/jdd-schema), imported by BOTH this repo (producer)
 * and jdd-ops/console (consumer). That single package replaces the old
 * hand-synced mirror that used to live here.
 *
 * This file remains only so existing `@/app/lib/site-schema` import paths keep
 * resolving. Do not add types here — change the schema in @jdd/schema and bump
 * the pinned tag in package.json.
 */

export * from "@jdd/schema";
