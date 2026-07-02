# ADR: Layer Plugin Contract

**Status:** accepted (P0 implementation)  
**Intent:** [`platform-intent.md`](platform-intent.md)

## Context

Wobblescope layers are hand-wired across ingest, API, globe, legend, and UI. This ADR defines the manifest contract and registry discovery that replace that pattern.

## Decision

Each layer is a directory under `layers/<id>/` with a `layer.mjs` manifest. A registry discovers manifests at:

- **Node** (ingest, API): `layers/registry.mjs` — filesystem scan
- **Browser** (globe): `src/layers/registry.mjs` — Vite `import.meta.glob`

### Required manifest fields (all kinds)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable registry ID (`hotspots`, `cyclones`) |
| `kind` | LayerKind | Dispatch behavior (see kinds below) |
| `name` | string | Human label |
| `epistemic` | string | Trust class for badges |
| `sourceKey` | string? | Key into `ingest/constants.mjs` SOURCES |

### Kind-specific fields

| Kind | `ingest` | `schema` | `contributeToDaySnapshot` | `static` | `globe` |
|------|----------|----------|---------------------------|----------|---------|
| `static-reference` | null | null | null | `{ url, load }` | required |
| `ingested-timeseries` | function | SQL fragment | function | — | required |
| `derived-runtime` | optional | — | optional | — | required |
| `regional-imagery` | function | SQL fragment | — | — | required |
| `chart-lane` | optional | — | — | — | optional |
| `scene-primitive` | — | — | — | — | not a plugin |

### Globe interface

```javascript
globe: {
  defaultVisible: true,
  toggleId: 'show-hotspots',  // bridge until P2 generates UI
  legacyKey: 'hotspots',       // bridge for presets/epistemics
  parent: 'surface',           // surface | earth | axis
  async init(ctx) { /* returns THREE.Object3D */ },
  update(group, frame, date, ctx) { /* optional per-scrub */ },
  pickTypes: ['hotspot'],
  legend: { id, class, label, title, help },
}
```

`LayerController` (`src/layer-controller.mjs`) owns visibility and group lifecycle.

### Ingest interface

Node-only ingest lives in `layers/<id>/ingest.mjs` (export `ingest`) — **not** imported from `layer.mjs`, so the browser bundle stays clean. `registry-runner.mjs` discovers ingest files by convention.

Ingested layers **must** use `ingest/lib/` primitives:

- `fetchWithRetry` — HTTP with backoff + Retry-After
- `incrementalWindow` — watermark + overlap from table or ingest_log
- `upsertRows` — transactional batched writes
- `runLayerIngest` — per-layer wrapper (via `layers/registry-runner.mjs`)

Registry runner isolates failures: one layer error does not abort the pipeline.

### API interface

```javascript
contributeToDaySnapshot(db, date, { pastDays }) {
  return { cyclones: [...] };  // merged into /api/day/:date
}
routes: [
  { path: '/api/foo/window', handler(db, url) { ... } },
]
```

`/api/day/:date` remains the aggregate; layers compose their slices.

## File layout

```
layers/
  registry.mjs
  registry-runner.mjs
  types.d.ts
  README.md
  hotspots/
    layer.mjs
    globe.mjs
  _template/
    layer.mjs
ingest/lib/
  fetch-with-retry.mjs
  incremental-window.mjs
  upsert-rows.mjs
  run-layer-ingest.mjs
src/
  layer-controller.mjs
  layers/registry.mjs
```

## Migration order

1. P0 — hotspots (`static-reference`) + ingest lib + registry skeleton
2. P1 — cyclones or radar (`ingested-timeseries`)
3. P2 — UI from registry (presets, toggles, legend)
4. P3 — home-region → `regional-imagery`
5. P4 — remaining layers; core timeline last

## Consequences

- Adding a layer after P2: new directory only, no god-object edits
- Legacy layers remain on old path until migrated
- `toggleId` / `legacyKey` bridge fields removed in P2