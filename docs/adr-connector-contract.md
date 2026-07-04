# ADR: Connector Contract

**Status:** accepted (2026-07-03)  
**Plan:** [`experience-platform-plan.md`](experience-platform-plan.md)  
**Related:** [`adr-layer-plugin-contract.md`](adr-layer-plugin-contract.md)

## Context

Wobblescope aggregates dozens of open-science sources with different acquisition patterns: incremental APIs, monthly index files, runtime nowcasts, manual batch pipelines, and computed fields. Users must know **what we have**, **how fresh it is**, and **what epistemic class** applies — especially in guided experiences where fewer layers are visible.

Layers own ingest and rendering. Connectors name the **acquisition truth** that layers inherit.

## Decision

Every data source exposed in the app is described by a **connector** record. Connectors are declared on layer manifests (`connector` field) and mirrored in `ingest/constants.mjs` for citations.

### Required connector fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable ID, usually matches `sourceKey` or `ingestKey` |
| `syncClass` | SyncClass | How the app acquires updates |
| `scaleClass` | ScaleClass | Spatial/temporal scale of the data |
| `epistemic` | EpistemicClass | Trust class (same vocabulary as layers) |
| `cadence` | string | Human expectation: `hourly`, `daily`, `monthly`, `on-demand`, `static` |
| `maxStaleDays` | number? | Days after which UI warns (experience-scoped chips) |

### Optional connector fields

| Field | Type | Description |
|-------|------|-------------|
| `upstreamThrough` | string? | ISO date or `ym` — last publication from source authority |
| `upstreamLagNote` | string? | e.g. "CPC monthly indices lag ERSST by ~1 month" |
| `rateLimitNote` | string? | e.g. "Open-Meteo 429; chunked resume" |
| `ingestKeys` | string[] | Keys in `ingest_log` |
| `refreshCommand` | string? | e.g. `npm run ingest -- --only=ocean-sst` |

### SyncClass

| Value | Meaning | UI treatment |
|-------|---------|--------------|
| `incremental` | Resumable ingest from public API/file; suitable for scheduled sync | First-class; show ingested age + upstream through |
| `snapshot` | Full or partial replace on each run; small enough to re-fetch | First-class; show ingested age |
| `nowcast` | Runtime fetch for near-present only (e.g. OVATION) | Label "nowcast · valid ±2d"; no historical pretense |
| `manual` | Batch scripts, heavy downloads, contributor-run | Label "manual ingest"; show command |
| `computed` | Derived at runtime from models (IGRF, WMM arcs) | Label "computed · pedagogical orientation" |

### ScaleClass

| Value | Meaning | Implication |
|-------|---------|-------------|
| `point` | Discrete sites or bodies | Glyphs, markers |
| `index` | Scalar time series (Niño 3.4, LOD, ONI) | Chart lanes |
| `track` | Paths through time (cyclones, CMEs) | Polylines |
| `grid` | Raster field | Texture overlay; needs grid connector policy |
| `archive` | TB-scale bulk | Bespoke; honest regional or on-demand slice only |
| `static` | Reference geometry (plates, hotspots) | No freshness chip |

### First-class vs acknowledged bespoke

**First-class:** `syncClass` ∈ `{ incremental, snapshot, nowcast }` AND registered in scheduled ingest (Phase H) or documented resume path.

**Acknowledged bespoke:** `manual`, `archive`, or `computed` without ingest log — must show sync class in UI; never imply live global coverage.

## Layer manifest extension

```javascript
// layers/ocean-sst/layer.mjs
export default {
  id: 'ocean-sst',
  kind: 'chart-lane',
  sourceKey: 'noaaOceanSst',
  connector: {
    syncClass: 'snapshot',
    scaleClass: 'index',
    cadence: 'monthly',
    maxStaleDays: 45,
    upstreamLagNote: 'Global tropics index may lag Niño regions by one month',
  },
  // ...
};
```

## Meta API extension

`GET /api/meta` gains a `connectors` array (or enriches `ingested` rows):

```json
{
  "connectors": [
    {
      "id": "noaaOceanSst",
      "syncClass": "snapshot",
      "scaleClass": "index",
      "epistemic": "measured",
      "cadence": "monthly",
      "ingestedAt": "2026-07-03T12:00:00Z",
      "upstreamThrough": "2026-06",
      "rowCount": 1835,
      "notes": "NOAA CPC ERSSTv5 + ONI"
    }
  ]
}
```

`upstreamThrough` is populated from `MAX(date)` or `MAX(ym)` on the layer's primary table when applicable.

## Ingest requirements

1. All ingested layers **must** run through `runLayerIngest` (registry runner or equivalent) so `ingest_log` is always written.
2. Direct `ingest/run.mjs` branches must call `runLayerIngest` or `logIngest` explicitly.
3. Per-layer failure isolation preserved — one connector failure does not abort the pipeline.

## Experience integration

Experience manifests declare `freshnessKeys: string[]` — connector IDs whose staleness appears in the header when that experience is active. See [`experience-platform-plan.md`](experience-platform-plan.md).

## Consequences

### Positive

- Truth scales with guided UX — fewer visible layers, same honesty
- New bespoke sources have a declared slot without pretending sync
- Grid overlays (Windy-style) require explicit `scaleClass: grid` policy before shipping

### Negative

- Migration work to attach `connector` to every layer and fix ingest logging gaps
- `upstreamThrough` may be unknown for some sources until ingest computes it

## Implementation order (K0)

1. Add connector types to `layers/types.d.ts`
2. Attach connector blocks to existing layer manifests (start with ocean-sst, weather, earthquakes)
3. Unify `ocean-sst` ingest through `runLayerIngest`
4. Extend `/api/meta` in `api/handlers.mjs`
5. Update `buildStalenessChips` to accept `freshnessKeys` filter (K5)

---

*Accepted: 2026-07-03*