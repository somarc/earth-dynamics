# Wobblescope tests

Phase A of the deconstruct / recombine plan: **contract-first coverage** so we can peel layers safely.

## Commands

```bash
npm test           # single run (CI)
npm run test:watch # local iteration
```

## Layout

| Path | Purpose |
|------|---------|
| `tests/unit/` | Pure functions (utils, playback labels, resolveDailyRow, chain eval, incremental windows) |
| `tests/contract/` | Day-frame API shape, experience manifests, layer registries |
| `tests/fixtures/` | In-memory SQLite seed (`createFixtureDb`) — no network |

## What is intentionally not covered yet

- Three.js render pixels / WebGL
- Live upstream ingest (USGS, Open-Meteo, …)
- Playwright UI flows
- Full `EarthScene` god-object

Those land in later tiers once DayFrame + LayerCatalog seams are stable.

## Adding a test with a new lane

1. Extend `tests/fixtures/create-fixture-db.mjs` with minimal rows.
2. Assert `getDay('…')` includes your slice key.
3. If the lane is an experience layer, add the key to a manifest test expectation.
