# Town centre points

Source: US Census Bureau, 2024 Gazetteer Files, places (national), 2024_Gaz_place_national.zip from https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/ (file dated 2024-08-21), downloaded 2026-11-13. US Government work, public domain.

One file per state: `[name, lat, lng]` per place, the Census "internal point" rounded to 4 decimals, the name without its Census type suffix. Built by `scripts/build-town-points.mjs`. Used only in the browser by `app/lib/town-match.ts` to pre-select a job photo's town from its GPS; no coordinates are sent anywhere.

States: 52. Places: 32333.
