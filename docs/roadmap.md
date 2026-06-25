# Wobblescope — Product Roadmap

Living backlog for iterating toward full multi-sphere coverage.  
**Status:** `done` · `next` · `planned` · `icebox`

---

## Highest leverage (do these first)

These connect existing layers, improve daily usability, or unlock patterns for everything else.

| ID | Item | Why now | Status |
|----|------|---------|--------|
| **P1** | [Plate motion vectors](#p1-plate-motion-vectors) | Makes plate boundaries *meaningful* — quakes/volcanoes drift in tectonic context | `done` |
| **P2** | [Event inspect / click-through](#p2-event-inspect) | Turns markers into evidence (USGS, DONKI, GVP links, metadata) | `done` |
| **P3** | [Incremental data refresh](#p3-incremental-ingest) | Timeline stays current without full 1990–2026 re-fetch | `done` |
| **P4** | [Layer presets](#p4-layer-presets) | Reduces toggle fatigue as overlay count grows | `done` |

---

## P1 — Plate motion vectors

**Goal:** Short arrows on the globe showing cm/yr plate velocity (NUVEL-1 or GSRM v2).

| | |
|--|--|
| **Source** | [UNAVCO GSRM](https://www.unavco.org/) / NOAA PB2002 companion motion model |
| **Render** | Tangent vectors on `surfaceGroup`, scaled for visibility, toggle with plates |
| **API** | Static GeoJSON or precomputed arrow table (no daily ingest) |
| **Done when** | User can see convergence/divergence near recent M≥7 quakes (e.g. Venezuela, Japan) |

---

## P2 — Event inspect

**Goal:** Click or hover on quake, volcano, CME, storm → sidebar detail + external citation link.

| | |
|--|--|
| **Scope** | Raycast on globe markers; keyboard-accessible list selection fallback |
| **Done when** | Clicking Yumare M7.5 opens USGS event page context in panel |

---

## P3 — Incremental ingest

**Goal:** `npm run ingest` only fetches new rows since last `ingest_log` entry.

| | |
|--|--|
| **Sources** | USGS (last 30d), NOAA Kp (daily), DONKI (incremental), Open-Meteo (resume grid) |
| **Done when** | New earthquake appears within 24h of USGS publish without manual `fetch-data` |

---

## P4 — Layer presets

**Goal:** One-click stacks: **Solid Earth** · **Space Weather** · **Orbital** · **Full stack**

| | |
|--|--|
| **Done when** | Preset buttons set all footer toggles and legend updates |

---

## Reference geometry (static context)

| ID | Item | Source | Status |
|----|------|--------|--------|
| R1 | Plate boundaries (PB2002) | Bird 2003 / NOAA | `done` |
| R2 | Plate motion vectors | PB2002 Euler poles | `done` |
| R3 | Mantle hotspots | GVP / Wilson hotspot list | `done` |
| R4 | Boundary labels on hover | PB2002 `Name` + `Type` | `done` |
| R5 | IGRF field lines (proper) | NOAA WMM/IGRF coefficients | `done` |
| R6 | Trench / ridge emphasis | Subduction polylines (thicker) | `done` |

---

## Time-series lanes (scrubbable data)

| ID | Item | Source | Status |
|----|------|--------|--------|
| T1 | Polar motion, LOD, ω₃ | IERS EOP C04 | `done` |
| T2 | Ephemeris + tidal metrics | JPL Horizons DE441 | `done` |
| T3 | Earthquakes M≥5 | USGS FDSN | `done` |
| T4 | Volcanoes / eruptions | Smithsonian GVP | `done` |
| T5 | US storms | NOAA NCEI Storm Events | `done` |
| T6 | Weather grid (16 pts) | Open-Meteo ERA5 | `done` (partial — rate limits) |
| T7 | Sunspot number | NASA MSFC | `done` |
| T8 | Geomagnetic Kp + G-scale | NOAA SWPC + DONKI GST | `done` |
| T9 | CME / flare / GST events | NASA DONKI | `done` (seed + incremental; needs `NASA_API_KEY` for deep history) |
| T10 | Auroral oval (Kp-driven) | Derived from Kp | `done` |
| T11 | Dipole field lines (simple) | Model | `done` |
| T12 | Dst index | Kyoto WDC / OMNI | `done` |
| T13 | Solar wind (speed, Bz) | NOAA DSCOVR / OMNI | `done` |
| T14 | OVATION aurora probability | NOAA SWPC | `done` |
| T15 | Global tropical cyclones | IBTrACS | `planned` |
| T16 | Atmospheric angular momentum | NASA GSFC AAM | `planned` |
| T17 | ENSO / ONI | NOAA CPC | `icebox` |

---

## Views & UX

| ID | Item | Status |
|----|------|--------|
| U1 | Geocentric globe | `done` |
| U2 | Heliocentric (obliquity, orbit trail) | `done` |
| U3 | Heliocentric body labels | `done` |
| U4 | Space weather panel + Kp chart | `done` |
| U5 | CME markers on heliocentric view | `done` |
| U6 | Compare two dates (ghost / split) | `planned` |
| U7 | Deep links `?date=&layers=` | `planned` |
| U8 | Time playback with event pulses | `planned` |
| U9 | Mobile / narrow layout polish | `planned` |

---

## Infrastructure & ops

| ID | Item | Status |
|----|------|--------|
| I1 | SQLite local + dev API | `done` |
| I2 | Extended timeline past EOP end | `done` |
| I3 | EDS static deploy (`dist/`) | `planned` |
| I4 | Cloudflare Worker + D1 API | `planned` |
| I5 | CI ingest → D1 seed | `planned` |
| I6 | `NASA_API_KEY` in CI secrets | `planned` |
| I7 | Correlation disclaimer governance per lane | `planned` |

---

## Science integrity (always on)

- **Established physics:** LOD↔AAM, tidal forcing, CME→geomagnetic storm→aurora, plate tectonics
- **Exploratory overlay only:** planetary alignment ↔ quakes, temporal clustering, Kp ↔ eruptions
- Every new lane must cite a source in `ingest/constants.mjs` → Data Sources panel

---

## Suggested iteration order

```
Phase A (now)     ~~P1 → P2 → P3 → P4~~ ✓
Phase B (context) ~~R2 → R3 → R4 → R5 → R6~~ ✓
Phase C (space)   ~~T12 → T13 → T14 → U5~~ ✓
Phase D (global)  T15 → T6 complete → T16
Phase E (ship)    I3 → I4 → I5
Phase F (power)   U6 → U7 → U8
```

---

## Quick commands (as layers land)

```bash
npm run ingest -- --only=space-weather   # Kp + DONKI + OMNI Dst/wind
npm run ingest -- --only=omni            # Dst + solar wind only
npm run fetch-space-weather              # Build DONKI JSON (slow on DEMO_KEY)
NASA_API_KEY=xxx npm run fetch-space-weather
```

---

*Last updated: 2026-06-25 — Phases A–C shipped; parked before Phase D. See [`session-handoff.md`](session-handoff.md).*