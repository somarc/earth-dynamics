<p align="center">
  <img src="/assets/weatherly-mascot.jpg" alt="Weatherly mascot" width="56" height="56" />
</p>

# Wobblescope — Experience Platform Plan

**Status:** accepted plan (2026-07-03)  
**Ethos:** Satellite-connected instrument for holding Earth up to the light of time — guided by theme, truthful by connector, composable by layer.  
**Related:** [`platform-intent.md`](platform-intent.md) · [`adr-connector-contract.md`](adr-connector-contract.md) · [`adr-layer-plugin-contract.md`](adr-layer-plugin-contract.md) · [`roadmap.md`](roadmap.md)

---

## One-sentence product intent

**Enter through a sphere of the planet** (solid Earth, ocean & atmosphere, magnetosphere, spin, orbit), **scrub honestly synced open data**, **zoom out to the heliocentric chapter** when the story requires it — without hiding what is measured, modeled, or pedagogical.

---

## Why now

The app has strong bones:

- Scrubbable timeline as the instrument spine
- Layer registry + ingest primitives (`ingest/lib/`, `layers/*/`)
- Epistemic trust layer (Phase F)
- Diverse Earth-system lanes: dynamo field lines, plates, quakes, ocean SST, space weather, rotation geodesy, orbital geometry

The UX has not caught up. Today it reads as a **control room**: globe center, eight stacked sidebar panels, bottom tray of Solid / Atmos / Space / Sky chips. That serves builders, not the Weatherly vision — one dominant Earth, observation from afar, motion through time.

This plan matures presentation **without** abandoning composability or the ingest paradigm.

---

## Three-layer stack

Everything builds on three concepts. Lower layers do not know about upper layers.

```
┌─────────────────────────────────────────────────────────────┐
│  EXPERIENCES — guided themes (curated entry, narrative)        │
│    Solid Earth · Ocean & Atmosphere · Magnetosphere · …      │
├─────────────────────────────────────────────────────────────┤
│  LAYERS — atomic registry plugins (globe, chart, ingest)    │
│    quakes, ocean-sst, cyclones, field-lines, polhode…        │
├─────────────────────────────────────────────────────────────┤
│  CONNECTORS — acquisition truth (sync class, freshness)      │
│    incremental · snapshot · nowcast · manual · computed      │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Owns | Does not own |
|-------|------|--------------|
| **Connector** | How data is acquired, how stale it may be, epistemic class, upstream through-date | UI layout, globe rendering |
| **Layer** | Schema, ingest, API slice, globe/chart contribution, legend chip | Cross-layer narrative |
| **Experience** | Which layers/panels activate, default view, suggested dates, theme-scoped freshness | New fetch paths or bespoke ETL |

**Rule:** Experiences **compose** layers. Connectors **truthfully describe** layer ingest. No experience may imply liveness that connectors do not support.

---

## Experience catalog (v1)

Six dominant themes map to existing data — no new sources required for proof.

| ID | Title | Story | Primary layers | Primary panels | Default view |
|----|-------|-------|----------------|----------------|--------------|
| `solid-earth` | Solid Earth | Lithosphere in motion | quakes, volcanoes, plates, boundaries, hotspots, radar | inspect, events | geocentric |
| `ocean-climate` | Ocean & Atmosphere | Hydrosphere + weather on one timeline | cyclones, weather, ocean-sst, storms | ocean-sst, events | geocentric |
| `magnetosphere` | Magnetosphere | Dynamo → space coupling | field-lines, mag-poles, aurora, magnetometers | space-weather | geocentric |
| `earth-spin` | Earth's Spin | Rotation is not constant | spin-pole, trail, polhode lane, AAM | polhode, rotation (LOD) | geocentric |
| `orbital` | Orbital Geometry | Tides, syzygy, system context | bodies, ecliptic, helical | orbital metrics, ecliptic/helical | geocentric → helio |
| `regional` | Regional | Human-scale patch on a living planet | home-region | inspect | geocentric (framed) |

**Power-user mode:** `full-instrument` — today's bottom tray, all panels, all presets. Never removed; not the default front door.

---

## Connector contract (summary)

Full spec: [`adr-connector-contract.md`](adr-connector-contract.md).

Every ingested or runtime-fetched source declares:

| Field | Purpose |
|-------|---------|
| `syncClass` | `incremental` · `snapshot` · `nowcast` · `manual` · `computed` |
| `scaleClass` | `point` · `index` · `track` · `grid` · `archive` |
| `cadence` | Expected refresh (`6h`, `daily`, `monthly`, `on-demand`) |
| `maxStaleDays` | When UI should warn |
| `upstreamThrough` | What the source itself has published through (when known) |
| `epistemic` | `measured` · `modeled` · `derived` · `pedagogical` |

**First-class connectors:** `syncClass` ∈ {incremental, snapshot, nowcast} + scheduled or resumable ingest + theme/header freshness.

**Acknowledged bespoke:** `manual` or `scaleClass: archive` — UI states batch ingest explicitly; no pretend live sync.

### Current connector inventory (honest)

| Connector | syncClass | scaleClass | Notes |
|-----------|-----------|------------|-------|
| USGS earthquakes | incremental | point | First-class |
| NOAA CPC ocean-sst | snapshot | index | Monthly indices; not spatial SST |
| Open-Meteo ERA5 | incremental | point | 12/16 grid; rate-limited |
| OMNI / geomagnetic | incremental | index | Thin pre-2022 |
| NASA DONKI | incremental | track | Key for deep history |
| IBTrACS cyclones | incremental | track | Registry path |
| JPL Horizons ephemeris | incremental | point | Ends before timeline |
| GFZ AAM | snapshot | index | Specialty ingest |
| Home region imagery | manual | grid | Multi-script pipeline |
| Plates, hotspots, IGRF | computed / manual | static | Pedagogical or derived |
| OVATION aurora | nowcast | grid | Browser fetch; ~2d window only |

---

## Experience manifest (target contract)

Experiences live under `experiences/<id>/experience.mjs`, discovered like layers.

```javascript
/** @type {import('./types.d.ts').ExperienceManifest} */
export default {
  id: 'ocean-climate',
  title: 'Ocean & Atmosphere',
  tagline: 'Hydrosphere signals on a scrubbable timeline',
  mascotCue: 'weatherly',           // optional guide copy key

  layers: {
    cyclones: true,
    weather: true,
    oceanSst: true,                 // chart-lane; no globe yet
    storms: false,                  // list in events panel only
    plates: false,
  },

  panels: ['ocean-sst', 'events'],  // chart-lane + sidebar panel IDs
  hiddenPanels: ['polhode', 'rotation', 'space-weather', 'helical-split'],

  presets: { /* overrides layer visibility from manifest */ },

  defaultView: 'geocentric',
  freshnessKeys: ['ocean-sst', 'weather', 'ibtracs'],

  suggestedMoments: [
    { date: '2026-06-15', label: 'CPC El Niño declaration context', connectorRefs: ['noaaOceanSst'] },
    { date: '1997-11-15', label: '1997–98 El Niño peak', connectorRefs: ['noaaOceanSst'] },
  ],

  epistemicSummary: { measured: 2, modeled: 1, derived: 0, pedagogical: 0 },
};
```

### URL contract (extends Phase G deep links)

```
?experience=ocean-climate&date=2026-06-15&view=geocentric
?experience=magnetosphere&date=2003-10-29
?experience=full-instrument   # power user
```

Experience param applies before layer overrides; `layers=` remains available for fine control.

---

## UX evolution

### Today

| Zone | Role |
|------|------|
| Viewport | Globe / helio canvas |
| Right sidebar | Fixed stack of 8+ panels |
| Header | Date, staleness chips, legend row |
| Footer | Timeline + Filter + Presets + layer chip tray |

### Target (phased)

| Zone | Role |
|------|------|
| **Theme rail** (left or top) | Primary nav — six experiences + Full instrument |
| **Viewport** | Dominant Earth; theme may set camera / opacity defaults |
| **Context sidebar** | Dynamic — 2–3 panels per experience |
| **Header** | Experience title + theme-scoped freshness + date |
| **Footer** | Timeline always visible; layer chips only in Full instrument or expandable "Layers" drawer |
| **Guide** (optional) | Weatherly hint chip — "What am I looking at?" per experience |

### Guided moments

Bookmarked dates with honest connector refs — not predictions, historical anchors:

- June 2026 — CPC El Niño indices
- 2003-10-29 — Halloween geomagnetic storms
- 2004-12-26 — Sumatra M9.x
- 1997-11 — El Niño peak

Each moment is a deep link + one-line narrative + epistemic footnote.

---

## Implementation phases

Runs **on top of** platform-intent P0–P4 (layer registry). Does not block registry migration; experiences consume registry IDs.

```
K0  Connector contract + ingest unification
K1  Experience registry + manifest types
K2  Proof experiences (solid-earth, ocean-climate)
K3  Theme rail + dynamic sidebar
K4  Guided moments + URL restore
K5  Freshness scoped to experience (extends F2)
K6  Grid connector spike (OISST strip — optional, parallel)
```

### K0 — Connector contract + ingest unification

**Why:** Truth foundation. Every layer must log ingest; meta API exposes connector fields.

| Task | Deliverable |
|------|-------------|
| K0.1 | ADR accepted: [`adr-connector-contract.md`](adr-connector-contract.md) |
| K0.2 | Extend `layer.mjs` with optional `connector: { syncClass, scaleClass, cadence, maxStaleDays }` |
| K0.3 | Route **all** ingests through `runLayerIngest` (fix `ocean-sst` direct path in `ingest/run.mjs`) |
| K0.4 | Extend `/api/meta` → `connectors[]` with `upstreamThrough`, `ingestedAt`, `syncClass` |
| K0.5 | Map `ingest/constants.mjs` SOURCES to connector metadata |

**Exit:** `npm run ingest -- --only=ocean-sst` writes `ingest_log`; `/api/meta` returns connector block for every cited source.

### K1 — Experience registry

| Task | Deliverable |
|------|-------------|
| K1.1 | `experiences/registry.mjs` — filesystem discovery |
| K1.2 | `experiences/types.d.ts` — manifest shape |
| K1.3 | `experiences/_template/experience.mjs` |
| K1.4 | `experiences/README.md` — contributor path |
| K1.5 | `buildExperiencePresets()` — maps experience → layer visibility + panel list |

**Exit:** `import { EXPERIENCES } from './experiences/registry.mjs'` returns ≥2 manifests; no `index.html` edits per experience.

### K2 — Proof experiences

| Task | Deliverable |
|------|-------------|
| K2.1 | `experiences/solid-earth/experience.mjs` |
| K2.2 | `experiences/ocean-climate/experience.mjs` |
| K2.3 | Wire `applyExperience(id)` in `main.js` (replaces preset-only path for entry) |
| K2.4 | Panel show/hide from experience manifest |
| K2.5 | Experience epistemic summary in header ("2 measured · 1 modeled") |

**Exit:** Selecting Ocean & Atmosphere shows ocean panel + cyclones/weather layers; Solid Earth shows quakes/plates; other panels collapsed.

### K3 — Theme rail + dynamic sidebar

| Task | Deliverable |
|------|-------------|
| K3.1 | Theme rail UI component (replaces preset row as primary nav) |
| K3.2 | Collapse sidebar panels not in `experience.panels` |
| K3.3 | "Full instrument" mode restores current layout |
| K3.4 | Mobile: theme rail → bottom sheet or compact dropdown |
| K3.5 | Registry-driven legend scoped to active experience layers |

**Exit:** First-time user lands on `solid-earth` or `ocean-climate` without seeing eight panels; power user reaches Full instrument in one click.

### K4 — Guided moments + URL restore

| Task | Deliverable |
|------|-------------|
| K4.1 | `?experience=&date=` parsing on load |
| K4.2 | Moments list per experience (sidebar or rail expander) |
| K4.3 | Shareable URLs restore experience + date + view |
| K4.4 | Align with Phase G G-UX1 deep links |

**Exit:** Opening `?experience=magnetosphere&date=2003-10-29` restores theme, date, and relevant layers.

### K5 — Experience-scoped freshness

| Task | Deliverable |
|------|-------------|
| K5.1 | `buildStalenessChips(meta, { freshnessKeys })` |
| K5.2 | Header shows connector through-dates for active experience |
| K5.3 | Promote wishlist I10 → scoped freshness strip (not global dashboard sprawl) |
| K5.4 | Citations panel: filter to active experience connectors |

**Exit:** Ocean experience header shows CPC + Open-Meteo staleness, not OMNI lag.

### K6 — Grid connector spike (parallel, optional)

| Task | Deliverable |
|------|-------------|
| K6.1 | `scaleClass: grid` connector for equatorial OISST strip or single-date ERA5 |
| K6.2 | Honest labeling: "Pacific 20°S–20°N" or "ERA5 for scrub date" |
| K6.3 | Ocean-climate experience optionally enables globe raster layer |

**Exit:** One spatial field on globe; connector manifest documents scale limits.

---

## Dependencies

| Dependency | Relationship |
|------------|--------------|
| Platform P2 (registry drives UI) | Experiences should consume registry layer IDs; P2 reduces K3 hand-wiring |
| Phase G deep links | K4 extends `?experience=` alongside `?date=&view=&layers=` |
| Phase H CI ingest | First-class connectors get scheduled refresh |
| Phase F trust layer | Experiences inherit epistemic badges; summarize per theme |

**Parallel OK:** K0–K2 can start before P4 layer migration completes. Proof experiences reference both registry and legacy layer keys via `legacyKey`.

---

## Success criteria — experience platform mature when

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | **Guided entry** | New user reaches a coherent theme without configuring chips |
| 2 | **Truth scoped** | Active experience shows only relevant connector freshness |
| 3 | **Composable depth** | Full instrument mode preserves today's power |
| 4 | **Shareable stories** | URL restores experience + date |
| 5 | **No new archaeology** | New experience = new `experiences/<id>/` directory only |
| 6 | **Connector honesty** | Every visible layer traces to connector with syncClass + epistemic |
| 7 | **Ingest parity** | All syncable connectors log to `ingest_log` |

---

## What we are not doing

- Replacing the timeline spine or SQLite instrument model
- Pretending monthly CPC indices are a live global SST map
- Building a separate "data marketplace" product — connectors stay layer-bound
- Weatherly as chatbot or gamification — guide copy only, optional
- Blocking platform P0–P4 — experiences ride the registry

---

## Sequencing with roadmap

| Milestone | Phases | User-visible outcome |
|-----------|--------|------------------------|
| **M7 — Guided instrument** | K0–K3 | Theme rail; two proof experiences; dynamic sidebar |
| **M8 — Shareable stories** | K4 + G | URLs restore experience + moment |
| **M9 — Truth at theme scope** | K5 | Freshness follows what you're exploring |
| **M10 — Spatial ocean (optional)** | K6 | Honest grid overlay in Ocean experience |

Recommended immediate sprint: **K0 + K1** (contract + registry skeleton), then **K2** (proof experiences) for observable progress.

---

## Document index

| Doc | Role |
|-----|------|
| This plan | Experience platform vision, phases, UX target |
| [`adr-connector-contract.md`](adr-connector-contract.md) | Connector fields, sync classes, meta API |
| [`platform-intent.md`](platform-intent.md) | Layer plugin registry (foundation) |
| [`roadmap.md`](roadmap.md) | Phase K tracking + milestones |

---

*Authored: 2026-07-03 — experience platform maturation plan.*