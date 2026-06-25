# Wobblescope — Product Roadmap

Prioritized delivery plan for a **time-synchronized Earth-system correlation instrument**.  
**Status:** `done` · `next` · `planned` · `icebox`

Full idea backlog → [`wishlist.md`](wishlist.md)

---

## North star

Close the gap between **co-display** (many lanes, one timeline) and **co-analysis** (physics coupling, globe equity, shareable evidence). Ship a public read-only instrument when the narrative is trustworthy.

---

## Shipped foundation (Phases A–C + graphics)

| Phase | Scope | Status |
|-------|--------|--------|
| **A** | P1–P4: plate motion, inspect, incremental ingest, presets | `done` |
| **B** | R2–R6: hotspots, plate hover, IGRF, subduction emphasis | `done` |
| **C** | T12–T14, U5: Dst, solar wind, OVATION, CME heliocentric | `done` |
| **G** | G1–G3 graphics, helical chart, globe inspect, playback pulses | `done` |

### Graphics & UX recently completed

| ID | Item | Status |
|----|------|--------|
| G1 | Ephemeris-driven sun lighting + earth textures | `done` |
| G2 | Sun-aligned atmosphere shell, ACES tone map | `done` |
| G3 | Event halos, view crossfade, playback pulses | `done` |
| U10 | Helical galactic-plane chart (beside ecliptic) | `done` |
| U11 | Rich globe inspect (quakes, volcanoes, hotspots, plates) | `done` |
| U12 | Wider panels column (420px) for orbital charts | `done` |

---

## Delivery phases (highest value first)

```
Phase D  Physics loop      T16 → LOD coupling → ephemeris refresh     ✓
Phase E  Globe equity      T15 → T6 complete → weather glyphs → preset  ✓
Phase F  Trust layer       I7 → staleness badges → lane epistemics
Phase G  Share & compare   U7 → U6 → change summary
Phase H  Ship              I3 → I4 → I5 → I6
Phase I  Graphics harden   G4 → visual contracts → helio parity
Phase J  Co-analysis       lag explorer → anomalies (from wishlist)
```

---

## Phase D — Physics loop `next`

**Why:** Makes the rotation lane scientifically legible; fulfills “correlation instrument” thesis more than adding another decorative layer.

| ID | Item | Source / scope | Status |
|----|------|----------------|--------|
| **D1** | Atmospheric angular momentum (T16) | GFZ ESMGFZ operational AAM → `aam_daily` | `done` |
| **D2** | AAM ↔ LOD chart overlay | Normalized AAM z anomaly on ΔLOD panel | `done` |
| **D3** | CME → Dst → aurora linked highlights | Space weather panel chain badge + chart outlines | `done` |
| **D4** | Ephemeris incremental extend | `npm run ingest -- --only=ephemeris` | `done` |

**Done when:** Scrubbing 2024-05-11 shows LOD deviation alongside AAM anomaly; space-weather chain is visually linked; ephemeris row count tracks timeline end.

```bash
npm run ingest -- --only=aam
npm run ingest -- --only=ephemeris
```

---

## Phase E — Globe equity

**Why:** Several ingested lanes are list-only; users expect “on globe = real layer.”

| ID | Item | Source / scope | Status |
|----|------|----------------|--------|
| **E1** | IBTrACS tropical cyclones (T15) | Track polylines + inspect + citation | `done` |
| **E2** | Weather grid completion (T6) | Chunked Open-Meteo resume; 12/16 ingested (rate-limited) | `debt` |
| **E3** | Weather glyphs on globe | Temp/wind hints at grid points | `done` |
| **E4** | **Atmosphere** layer preset | Cyclones + weather; hides space/plates | `done` |
| **E5** | US storms on globe *(decision)* | NCEI markers vs list-only — see wishlist W-decision | `icebox` |

**Decision (before E1):** IBTrACS owns global “storms on globe”; US NCEI stays list-only unless E5 explicitly approved.

**Done when:** Hurricane track visible on globe; 16/16 weather cities ingested; Atmosphere preset one-click.

```bash
npm run ingest -- --only=weather
npm run ingest -- --only=weather --weather-grid=sydney,saopaulo,equator_pacific,equator_africa
npm run ingest -- --only=ibtracs
```

---

## Phase F — Trust layer

**Why:** As layers multiply, users must know what is measured, modeled, or pedagogical.

| ID | Item | Status |
|----|------|--------|
| **F1** | Lane epistemic badges (I7) | `measured` · `modeled` · `derived` · `pedagogical` · `exploratory` | `planned` |
| **F2** | Per-source staleness in UI | Header or panel chips from `ingest_log` + `/api/meta` | `planned` |
| **F3** | Helical + exploratory callouts | Pedagogical label on helical chart; align with orbital disclaimer | `planned` |
| **F4** | Data Sources panel enrichment | Epistemic class per citation row | `planned` |

**Done when:** Every sidebar panel and globe layer type shows epistemic class; stale ephemeris/OMNI clearly flagged.

---

## Phase G — Share & compare

**Why:** Correlation exploration needs shareable state and temporal diff.

| ID | Item | Status |
|----|------|--------|
| **G-UX1** | Deep links `?date=&view=&preset=` (U7) | `planned` |
| **G-UX2** | Compare two dates (U6) | Ghost markers or split scrub | `planned` |
| **G-UX3** | “Since last week” change summary | New events / Kp spikes / LOD delta in events panel | `planned` |
| **G-UX4** | Sidebar tabs or collapse | Offset density from Phases D–E | `planned` |

**Done when:** URL restores full app state; user pins date A vs B and sees globe/list diff.

---

## Phase H — Ship

**Why:** Instrument only matters if it stays current outside one laptop.

| ID | Item | Status |
|----|------|--------|
| **H1** | EDS static deploy (I3) | `planned` |
| **H2** | Cloudflare Worker + D1 (I4) | `planned` |
| **H3** | CI ingest → D1 seed (I5) | `planned` |
| **H4** | `NASA_API_KEY` in CI (I6) | `planned` |
| **H5** | API smoke test in CI | Day snapshot + meta contract | `planned` |

**Done when:** Public EDS URL loads; API served from Worker+D1; weekly ingest updates quakes/Kp.

---

## Phase I — Graphics harden

**Why:** Visual quality is ahead of visual proof; harden before more VFX.

| ID | Item | Status |
|----|------|--------|
| **I-GR1** | Selective bloom + exposure (G4) | `planned` |
| **I-GR2** | Fixed-view visual contracts | Regression baselines for globe + charts | `planned` |
| **I-GR3** | Heliocentric atmosphere / lighting parity | Align with geocentric G1–G2 | `planned` |

---

## Phase J — Co-analysis (wishlist promotion)

**Why:** Completes the product thesis from [`wishlist.md`](wishlist.md) W1–W5.

| ID | Item | Status |
|----|------|--------|
| **J1** | Lag / lead lane shift | `icebox` |
| **J2** | Per-lane anomaly z-scores | `icebox` |
| **J3** | Ingest provenance on chart click | `icebox` |

Promote to `planned` after Phase D + F establish trustworthy baselines.

---

## Reference tables (inventory)

### Platform primitives — done

| ID | Item | Status |
|----|------|--------|
| P1–P4 | Plate motion, inspect, incremental ingest, presets | `done` |
| R1–R6 | Plates, motion, hotspots, hover, IGRF, trenches | `done` |
| I1–I2 | SQLite API, extended timeline | `done` |

### Time-series lanes

| ID | Item | Source | Status |
|----|------|--------|--------|
| T1 | Polar motion, LOD, ω₃ | IERS EOP | `done` |
| T2 | Ephemeris + tidal metrics | JPL DE441 | `done` (stale past ingest end) |
| T3 | Earthquakes M≥5 | USGS | `done` |
| T4 | GVP eruption episodes | Smithsonian | `done` |
| T5 | US storms | NOAA NCEI | `done` (list only) |
| T6 | Weather grid 16 pts | Open-Meteo | `debt` (12/16) |
| T7–T14 | Solar, Kp, CME, aurora, Dst, wind, OVATION | Various | `done` |
| T15 | IBTrACS cyclones | NOAA | `done` |
| T16 | Atmospheric angular momentum | GFZ ESMGFZ AAM | `done` |
| T17 | ENSO / ONI | NOAA CPC | `icebox` |

### Views & UX

| ID | Item | Status |
|----|------|--------|
| U1–U5 | Geocentric, heliocentric, space weather, CME | `done` |
| U6 | Compare two dates | `planned` (Phase G) |
| U7 | Deep links | `planned` (Phase G) |
| U8 | Playback pulses | `done` |
| U9 | Mobile polish | `planned` (Phase G) |

---

## Science integrity (always on)

| Class | Examples |
|-------|----------|
| **Established physics** | LOD↔AAM, tidal forcing, CME→storm→aurora, plate tectonics |
| **Measured** | USGS quakes, IERS EOP, JPL ephemeris, OMNI Dst |
| **Derived** | Kp aurora rings, tidal index, OVATION nowcast |
| **Pedagogical** | Helical chart (LSR advance + heliocentric coil) |
| **Exploratory only** | Planetary alignment ↔ quakes, temporal clustering |

Every new lane: source in `ingest/constants.mjs` → Data Sources panel → epistemic class (Phase F).

---

## Quick commands

```bash
npm run start
npm run ingest -- --only=space-weather
npm run ingest -- --only=omni
npm run ingest -- --only=weather
NASA_API_KEY=xxx npm run fetch-space-weather
```

---

## Milestone targets

| Milestone | Phases | User-visible outcome |
|-----------|--------|-------------------|
| **M1 — Credible rotation** | D | AAM on LOD chart; physics story closed |
| **M2 — Full atmosphere** | E | Cyclones + weather on globe; Atmosphere preset |
| **M3 — Trustworthy UI** | F | Badges + staleness; no false equivalence |
| **M4 — Shareable** | G | URLs + date compare |
| **M5 — Public instrument** | H | EDS + Worker + scheduled ingest |
| **M6 — Production graphics** | I | G4 + visual regression |

---

*Last updated: 2026-06-25 — Phases A–E and D shipped; **Phase F (trust layer)** is next. See [`wishlist.md`](wishlist.md) and [`session-handoff.md`](session-handoff.md).*