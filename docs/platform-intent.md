# Wobblescope — Platform Intent

**Status:** active intent (architecture investment)  
**Supersedes:** ad-hoc per-layer wiring as the default extension model  
**Related:** [`architecture.md`](architecture.md) · [`roadmap.md`](roadmap.md)

---

## The point of this app

Wobblescope is an **aggregation instrument** — a time-synchronized explorer where verifiable Earth-system signals co-exist on one scrubbable timeline. The product thesis is not any single layer (quakes, cyclones, LOD, aurora). It is **composability**: many independent data sources, one coherent instrument.

That only works if adding a source is cheap, safe, and repeatable. Today it is not.

---

## Toy vs platform

| | Toy (today) | Platform (target) |
|---|-------------|-------------------|
| **Adding a data source** | Hand-wire ~12 files by copying existing layers | Implement one layer manifest; registry auto-wires the stack |
| **Extension model** | Convention + code review | Enforced contract + discovery |
| **Ownership** | `EarthScene` god-object, `getDay()` mega-query, `main.js` preset sprawl | Each layer owns its ingest, schema, API slice, globe controller, legend, epistemics |
| **Contributor path** | "Read the codebase and match patterns" | "Copy `layers/_template/`, fill the manifest, run ingest" |
| **Scaling dimensions** | More layers = more god-object growth | More layers = more manifests in a registry |
| **Shareable state** | Checkbox DOM IDs and boolean fields | Stable layer IDs from the registry (`?layers=cyclones,quakes`) |

The app **works** as a toy. It is scientifically serious, visually polished, and trust-layered (Phase F). But every new lane increases coupling linearly. That is the ceiling between a personal instrument and a platform others can extend.

---

## What we have today (evidence)

Each data source is bespoke end-to-end:

1. `ingest/sources/X.mjs` — fetch and normalize
2. `db/schema.sql` — dedicated table
3. `ingest/run.mjs` — manual import and `--only=` branch
4. `ingest/constants.mjs` — citation/epistemic metadata (disconnected from wiring)
5. `api/handlers.mjs` — SQL inlined into `getDay()` and/or bespoke route
6. `src/*.js` — `buildXGroup()` renderer
7. `src/earth.js` — new `showX` flag, group, setter, visibility wiring (~970 lines and growing)
8. `src/main.js` — preset booleans, toggle map, chip counts, event-layer application
9. `index.html` — hand-authored checkbox chip
10. `src/epistemics.js` + `src/legend-help.js` — duplicate registries for the same layers

There is no shared layer contract. A contributor adding GRACE mass anomalies, regional webcam imagery, or ENSO indices must archaeology the full stack and hope they matched every convention.

The deepest coupling is `/api/day/:date` — a monolithic snapshot where every layer's SQL, shape, and window logic lives in one function. The frontend assumes that shape in `data-client.js` → `applyEventLayers()` → `EarthScene`.

---

## What "platform" means here

A **layer plugin contract**: one manifest per data source that declares everything the app needs to wire ingest → storage → API → globe → legend → epistemics → presets.

A **layer registry** discovered at build/ingest/runtime (e.g. `layers/*/layer.mjs`), replacing hardcoded import chains in `ingest/run.mjs`, `api/handlers.mjs`, and `EarthScene`.

A **layer controller** model on the frontend: `EarthScene` composes small per-layer controllers instead of accumulating `showX` properties. Scene primitives (spin pole, atmosphere, bodies) stay in the scene; data layers delegate to controllers.

**Layer kinds** — not every source is identical. The contract dispatches by kind:

| Kind | Examples | Contract owns |
|------|----------|---------------|
| `ingested-timeseries` | quakes, cyclones, weather, AAM | schema, ingest, day-snapshot slice, optional window route, globe build/update |
| `static-reference` | hotspots, plates, radar sites | static load path, globe build, legend |
| `derived-runtime` | IGRF field lines, aurora rings | compute inputs, globe update, epistemic class |
| `regional-imagery` | home-region patch, future NRT tiles | ingest blobs, asset routes, camera/focus behavior |
| `chart-lane` | polhode, ecliptic, space-weather panels | window route, chart renderer (may share ingest with globe layer) |
| `scene-primitive` | spin pole, trail, bodies | stays in scene core — not a contributor plugin |

Kinds prevent forcing GRACE, IBTrACS tracks, and GIBS tiles into one identical shape while keeping one registry and one contributor workflow per kind.

---

## What we must do

### 1. Define the contract

Write the layer manifest spec: required fields per kind, ingest signature, schema declaration, API contribution hook, globe interface, legend/epistemic/preset metadata.

One worked example per kind (not all layers at once).

### 2. Build the registry

Replace manual wiring with discovery:

- **Ingest:** `for (layer of ingestableLayers) await layer.ingest({ db, force })`
- **API:** `getDay()` composes frame from each layer's `contributeToDaySnapshot()`; routes merge from layer manifests
- **Frontend:** toggles, presets, legend chips, epistemic badges generated from registry — not duplicated in four files

### 3. Decompose the god-objects

- **`EarthScene`** — thin scene shell + `LayerController[]`; no new `showX` after migration
- **`getDay()`** — composer, not 180 lines of per-table SQL
- **`main.js`** — layer UI driven by registry IDs, not string-literal maps

Keep `/api/day/:date` as a convenience aggregate. Layers own their queries. Optional generic `/api/layer/:id` for contributor testing.

### 4. Migrate proof layers, not everything

Prove the contract with low-risk layers before touching core timeline or space-weather chain:

1. **hotspots** (`static-reference`) — no ingest, no API, globe only
2. **radar-sites** or **cyclones** (`ingested-timeseries` + globe) — full stack path
3. **home-region** → `regional-imagery` kind — replaces bespoke `home-region.js` subsystem

Defer: EOP/ephemeris (timeline core), space-weather multi-panel chain, plates (multi-sub-layer).

### 5. Make the contributor path real

`layers/README.md` with copy-paste templates per kind. A new source is:

```
layers/grace-mass/
  layer.mjs      # manifest
  ingest.mjs     # optional, if kind requires
  schema.sql     # optional fragment
  globe.mjs      # buildGroup / update
```

Zero edits to `run.mjs`, `handlers.mjs`, `earth.js`, or `index.html`.

### 6. Wire platform concerns that depend on this

These roadmap items should build on registry layer IDs, not today's ad-hoc wiring:

- **Phase G deep links** — `?date=&view=&layers=cyclones,quakes`
- **Phase H ship** — CI ingest iterates registry; D1 schema from layer schema fragments
- **Regional/NRT imagery** — first new layer *on the contract*, not another one-off subsystem
- **Future sources** (GRACE, GHCN, ENSO, webcam feeds) — template-fill exercises

### 7. Fix blocking UX in parallel

Zoom/pan focus bug and regional camera behavior are independent of the registry but block regional-layer UX. Do not gate the architecture work on them; do not defer them past the first `regional-imagery` layer.

---

## What we are not doing (yet)

- Migrating all 20+ existing layers in one pass
- Rewriting Three.js rendering or visual quality
- Building a generic key-value store to replace typed tables (typed tables stay; schema fragments declare them)
- Replacing the monolithic day snapshot before proof layers work (compose in place first; decompose routes later)
- Blocking Phase G/H entirely — but deep links and CI ingest must target registry IDs from the start of those phases

---

## Success criteria — we are a platform when

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | **Template-fill** | New layer = new directory under `layers/` only; `npm run ingest -- --only=<id>` works with no `run.mjs` edit |
| 2 | **Single source of truth** | Layer ID declared once; legend, epistemic badge, preset membership, toggle all derive from manifest |
| 3 | **God-object shrink** | No new `showX` on `EarthScene`; no new checkbox in `index.html` by hand |
| 4 | **Composable day snapshot** | `getDay()` built by reducing layer contributions; adding a layer does not require reading 400 lines of handlers |
| 5 | **Behavioral parity** | Proof layers (hotspots, cyclones, radar) render and inspect identically to pre-refactor |
| 6 | **Contributor docs** | `layers/README.md` enables a second developer to add a source without a guided tour |
| 7 | **Shareable layer state** | URL/query restores visible layers by registry ID |

---

## Sequencing

```
P0  Contract spec + registry skeleton + hotspots proof (static-reference)
P1  Ingested path proof (radar or cyclones)
P2  Registry drives UI (presets, toggles, legend, epistemics) — god-object freeze
P3  home-region → regional-imagery kind; first NRT tile layer on contract
P4  Migrate remaining layers incrementally; core timeline last
∥  Zoom/pan focus fix (parallel, user-facing)
```

**This is an architecture investment, not a bug fix.** It pays off the moment a second contributor appears, the moment Phase G needs stable layer IDs, and the moment regional imagery becomes contributor-addable instead of another fork of `home-region.js`.

---

## One-sentence intent

**Make Wobblescope a composable aggregation platform by replacing bespoke per-layer hand-wiring with a discovered layer registry and enforced plugin contract — so adding a data source is a manifest exercise, not a full-stack archaeology project.**

---

*Authored: 2026-07-01 — platform transition intent. Implementation spec (manifest schema, migration checklist) follows as ADR.*