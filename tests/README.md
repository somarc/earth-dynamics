# Wobblescope tests

Deconstruct / recombine plan: **contract-first coverage** so we can peel layers safely.

## Commands

```bash
npm test           # single run (CI)
npm run test:watch # local iteration
```

## Layout

| Path | Purpose |
|------|---------|
| `tests/unit/` | Pure functions — math, parsers, fetch retry, event list, URLs, transitions |
| `tests/contract/` | Day-frame API shape, experience manifests, layer registries |
| `tests/fixtures/` | In-memory SQLite seed (`createFixtureDb`) — no network |

## Coverage map (iterate as packs land)

| Area | Tests |
|------|--------|
| Globe math / filters | `utils.test.js` |
| Day resolve + timeline end | `daily-resolve.test.js` |
| Day-frame API keys | `contract/day-frame.test.js` |
| Experiences + layer registry | `experience-manifests`, `layer-registry`, `experience-url` |
| Events panel HTML | `event-list.test.js` |
| Ocean SST / solar / AAM / quakes parsers | `ocean-sst-parse`, `parse-solar`, `parse-aam`, `parse-earthquakes` |
| Ingest primitives | `incremental-window`, `upsert-rows`, `fetch-with-retry` |
| Charts / UX pure | `eph-window-chart`, `playback-format`, `view-transition`, `space-weather-chain` |

## What is intentionally not covered yet

- Three.js render pixels / WebGL
- Live upstream ingest (USGS, Open-Meteo, …)
- Playwright UI flows
- Full `EarthScene` god-object

Those land in later tiers once DayFrame + LayerCatalog seams are stable.

## Adding a test with a new lane

1. Extract pure parse / snapshot helpers (no `fetch`, no DOM).
2. Extend `tests/fixtures/create-fixture-db.mjs` with minimal rows.
3. Assert `getDay('…')` includes your slice key.
4. If the lane is an experience layer, add the key to a manifest test expectation.
