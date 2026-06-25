# Wobblescope — Wishlist

Ideas, gaps, and “consider but aren’t yet” items captured from macro review (2026-06-25).  
**Not a commitment order** — see [`roadmap.md`](roadmap.md) for prioritized delivery.

**Legend:** `gap` = missing vs vision · `debt` = shipped but incomplete · `idea` = future exploration · `icebox` = interesting, no slot yet

---

## Product thesis

| ID | Item | Type | Notes |
|----|------|------|-------|
| W1 | **Co-analysis, not just co-display** | `gap` | Scrub shows lanes together; no lag/lead, rolling correlation, or “what changed since last week?” |
| W2 | **Change detection** | `idea` | Diff panel: new quakes, Kp spikes, LOD jumps since prior date or prior week |
| W3 | **Lag / lead explorer** | `idea` | Shift one lane ±N days relative to slider (e.g. CME → Dst → aurora chain) |
| W4 | **Anomaly / z-score overlays** | `idea` | Per-lane “how unusual is this day?” without claiming prediction |
| W5 | **Statistical disclaimer layer** | `idea` | Separate “eyeball” from “tested”; optional simple significance hints |

---

## Physics coupling (established science)

| ID | Item | Type | Notes |
|----|------|------|-------|
| C1 | **AAM ↔ LOD bridge** | `gap` | LOD chart exists; atmospheric angular momentum (T16) does not — primary rotation–atmosphere link |
| C2 | **Solid Earth tides** | `icebox` | Tie ephemeris lunar forcing to crustal tide model; strengthens tidal index story |
| C3 | **CME → Dst → aurora chain viz** | `debt` | Data lanes exist; no guided narrative or linked highlights across panels |
| C4 | **Plate motion ↔ seismic context** | `done` | Vectors + boundaries + inspect — maintain as reference pattern |

---

## Data lanes — coverage & globe equity

| ID | Item | Type | Notes |
|----|------|------|-------|
| D1 | **Ephemeris end vs timeline end** | `debt` | Ingest ends ~2026-05-25; slider extends further with stale fallback |
| D2 | **OMNI / Dst pre-2022** | `gap` | Deep space-weather history thin before ~2022 ingest window |
| D3 | **Weather grid 4/16** | `debt` | Open-Meteo rate limits; 12 cities pending |
| D4 | **Weather on globe** | `gap` | ERA5 grid is event-list only — no glyphs, heat, or wind hints |
| D5 | **US storms 1M+ ingested, not mapped** | `gap` | NCEI storm events in DB; sidebar only |
| D6 | **IBTrACS global cyclones** | `planned` | T15 — tracks on globe |
| D7 | **DONKI deep history** | `debt` | Needs `NASA_API_KEY` or maintained JSON cache |
| D8 | **OVATION historical** | `debt` | Nowcast ~2d; historical aurora uses Kp-derived rings |
| D9 | **Incremental ephemeris refresh** | `idea` | Extend Horizons ingest past EOP without full re-fetch |
| D10 | **Tsunami propagation** | `icebox` | USGS `tsunami` flag on quakes; no wave / arrival layer |
| D11 | **ENSO / ONI / SST** | `icebox` | T17; hydrosphere bridge to weather and LOD |
| D12 | **Sea level / cryosphere** | `icebox` | Not in multi-sphere model today |

---

## Science integrity & epistemology

| ID | Item | Type | Notes |
|----|------|------|-------|
| S1 | **Lane epistemic badges** | `gap` | `measured` · `modeled` · `derived` · `pedagogical` · `exploratory` |
| S2 | **Staleness / coverage per source** | `gap` | Ephemeris has “as of” hint; other lanes do not |
| S3 | **Ingest provenance on inspect** | `idea` | Click chart point → ingest run, source version, row count |
| S4 | **Helical chart = pedagogical** | `debt` | LSR advance + JPL heliocentric coil — not galactic ephemeris |
| S5 | **Alignment ↔ quakes disclaimer** | `done` | In orbital metrics; extend pattern to all exploratory lanes |
| S6 | **GVP episode semantics** | `done` | Cones = active episodes, not holocene inventory |
| S7 | **Correlation ≠ causation governance** | `gap` | Roadmap I7 — per-lane disclaimer templates |

---

## Views, charts & graphics

| ID | Item | Type | Notes |
|----|------|------|-------|
| V1 | **Helical galactic-plane chart** | `done` | Side-by-side with ecliptic; 90–365 d window |
| V2 | **Ephemeris-driven sun lighting (G1)** | `done` | Geocentric + atmosphere shell |
| V3 | **Sun-aligned atmosphere rim (G2)** | `done` | Inertial shell, ACES tone map |
| V4 | **Event halos + view crossfade (G3)** | `done` | Playback pulses on day advance |
| V5 | **Selective bloom + exposure (G4)** | `planned` | HDR hierarchy for aurora, halos, CMEs |
| V6 | **Visual regression contracts** | `gap` | Fixed-view screenshots / GPU diagnostics before graphics churn |
| V7 | **Heliocentric visual parity** | `debt` | Simpler than geocentric — no atmosphere shell, etc. |
| V8 | **3D helical viewport** | `icebox` | Mini-scene in main viewport vs 2D chart |
| V9 | **Magnetosphere structure** | `icebox` | Beyond stylized IGRF lines — magnetopause, ring current |
| V10 | **Galactic ephemeris (real)** | `icebox` | Replace LSR heuristic with barycentric / galactic coords |

---

## UX & product

| ID | Item | Type | Notes |
|----|------|------|-------|
| U1 | **Globe inspect (quakes, volcanoes, hotspots, plates)** | `done` | Hover + click + tooltip |
| U2 | **Playback event pulses** | `done` | Was roadmap U8 |
| U3 | **Wider orbital panel (420px aside)** | `done` | Ecliptic + helical split |
| U4 | **Sidebar collapse / tabs** | `gap` | Density will worsen with D lanes |
| U5 | **Atmosphere layer preset** | `idea` | Cyclones + weather; hide space/plates |
| U6 | **Compare two dates** | `planned` | Ghost globe or split — high value for correlation use |
| U7 | **Deep links `?date=&view=&preset=`** | `planned` | Shareable moments |
| U8 | **Mobile / narrow layout** | `planned` | Footer toggles + 420px aside |
| U9 | **Keyboard inspect fallback** | `debt` | P2 scope; list selection → inspect panel |
| U10 | **“What’s on globe” summary** | `debt` | Partial via events panel tallies |
| U11 | **Panel search / jump** | `icebox` | Long sidebar scroll |

---

## Infrastructure & operations

| ID | Item | Type | Notes |
|----|------|------|-------|
| I1 | **Local SQLite + dev API** | `done` | |
| I2 | **Extended timeline past EOP** | `done` | Quakes incremental; EOP stale |
| I3 | **EDS static deploy** | `planned` | `dist/` to Edge Delivery |
| I4 | **Cloudflare Worker + D1 API** | `planned` | Same handlers, edge DB |
| I5 | **CI ingest → D1 seed** | `planned` | Scheduled freshness |
| I6 | **`NASA_API_KEY` in CI** | `planned` | DONKI + deep space weather |
| I7 | **Reproducible DB artifact** | `debt` | `ecdo.db` gitignored; seed story for deploy |
| I8 | **API contract versioning** | `idea` | `/api/meta` schema version for clients |
| I9 | **Automated smoke tests** | `gap` | Build + API day snapshot + chart render sanity |
| I10 | **Data freshness dashboard** | `idea` | Per-source last ingested in header or meta panel |

---

## Spheres not yet in the model

| Sphere | Wishlist notes |
|--------|----------------|
| **Hydrosphere** | SST, sea level, ocean heat — ENSO bridge (T17) |
| **Cryosphere** | Ice mass, snow cover — climate context |
| **Biosphere** | Fire, vegetation anomalies — likely out of scope |
| **Mantle** | Hotspots done; full convection / slabs not planned |
| **Ionosphere** | TEC, scintillation — space weather extension |
| **Cosmic rays** | Neutron monitors — solar cycle extension |

---

## Decision log (open)

1. **Storms vs cyclones on globe** — Put NCEI US storms on globe while adding IBTrACS, or keep US storms list-only and let IBTrACS own “storms on globe”?
2. **Atmosphere preset timing** — Ship with T15/T6, or earlier when weather grid completes?
3. **Co-analysis scope** — Lag slider only, or full anomaly panel in v1?
4. **Deploy before D?** — Minimal public read-only API vs finish physics loop first?

---

## References

- [`roadmap.md`](roadmap.md) — prioritized phases
- [`session-handoff.md`](session-handoff.md) — run commands, data snapshot
- [`architecture.md`](architecture.md) — EDS + Worker target

*Captured: 2026-06-25 · Update when wishlist items promote to roadmap or ship.*