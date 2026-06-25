# Session handoff — Wobblescope

**Parked:** 2026-06-25  
**Repo:** `/Users/mhess/marc_projects/ecdo` · GitHub `somarc/earth-dynamics`  
**Latest commit:** `c0ae685` — Phase C (Dst, solar wind, OVATION, CME heliocentric)

---

## Where we left off

Phases **A**, **B**, and **C** are complete and committed. User pivoted away before starting **Phase D**. UX is getting busy but still manageable — consider an **Atmosphere preset** or panel collapse when D adds cyclone tracks.

---

## Completed (by phase)

| Phase | Items | Notes |
|-------|-------|-------|
| **A** | P1–P4 | Plate motion, click inspect, incremental quakes, layer presets |
| **B** | R2–R6 | Hotspots, plate hover tooltip, IGRF field lines, subduction tubes |
| **C** | T12–T14, U5 | Dst chart, solar wind metrics, OVATION (near-now), CME cones in heliocentric |

Full backlog status: [`docs/roadmap.md`](roadmap.md)

---

## Run / verify

```bash
npm run start                    # API :3001 + Vite :5173
npm run ingest -- --only=omni    # Dst + solar wind (2022+ routine; 2010+ with --force on omni)
npm run ingest -- --only=weather # Resume Open-Meteo grid (rate-limited)
```

**Good demo dates**

| Date | Why |
|------|-----|
| 2024-05-11 | G5 storm — Dst −406 nT, Kp 9, wind 777 km/s, Bz −35.3 nT |
| 2024-05-08–12 | Heliocentric — CME cone from DONKI cache |
| Today (±2d) | OVATION aurora grid on globe (Kp fallback for historical) |

---

## Local data snapshot (2026-06-25)

| Source | Status |
|--------|--------|
| EOP / ephemeris | 1962–2026-05-25 (+ extended timeline for newer quakes) |
| Earthquakes | 61,915 (incremental through 2026-06-25) |
| Geomagnetic + OMNI | 1,630 days with Dst (2022–2026 ingested) |
| US storms (T5) | 1,021,660 events — **sidebar only, not on globe** |
| Weather (T6) | **4/16** grid points complete (NYC, Miami, LA, Anchorage) — 12 cities pending |
| DONKI | JSON cache + 6 events in DB; live fetch needs `NASA_API_KEY` |

---

## Next session: Phase D

Roadmap order: **T15 → T6 complete → T16**

### T15 — IBTrACS global tropical cyclones
- **Data:** NOAA IBTrACS v04 CSV (public, verified)
- **Build:** `cyclones` table, `ingest/sources/ibtracs.mjs`, track polylines on globe, inspect, citation in `ingest/constants.mjs`
- **Pattern:** Reuse quake/volcano marker + plate boundary line rendering

### T6 — Weather grid complete
- **Mostly ops:** Re-run `npm run ingest -- --only=weather` until all 16 grid points land
- **Optional:** Globe glyphs or heat hints; currently weather is **event-list only**
- **Blocker:** Open-Meteo rate limits (ingest already resumes per grid point)

### T16 — Atmospheric angular momentum
- **Data:** IERS/GFZ geophysical fluids (EAM/AAM ASCII) — ties to LOD chart (established physics)
- **Build:** `aam_daily` table, ingest, overlay on LOD panel or small side chart
- **Science:** Primary rotation–atmosphere coupling lane; cite in Data Sources panel

### UX decisions (discuss before or during D)
1. Add **Atmosphere** layer preset (cyclones + weather, hide space/plates)?
2. Put US storms (T5) on globe while adding IBTrACS, or keep storms list-only?
3. Collapse / tab sidebar panels to offset density?

**Assessment:** Platform is ready for D — ingest → SQLite → API → globe patterns exist. Phase D is new lanes + viz, not new plumbing. No Phase E (EDS/Workers) dependency.

---

## Key files

```
ingest/sources/omni.mjs      # Dst + solar wind (OMNI + NOAA)
ingest/sources/weather.mjs   # Open-Meteo 16-pt grid (partial)
ingest/sources/storms.mjs    # US NCEI storm events
src/ovation.js               # OVATION aurora fetch + globe points
src/cme-heliocentric.js      # CME cones in heliocentric view
src/space-weather.js         # Kp/Dst charts, metrics panel
api/handlers.mjs             # getDay, geomagnetic window
docs/roadmap.md              # Living backlog
```

---

## Known constraints

- `ecdo.db` and most `public/data/*.json` gitignored (seed reference files committed)
- DONKI `DEMO_KEY` rate-limited; use `NASA_API_KEY` or `space-weather-donki.json` cache
- OVATION is nowcast only (~2 days); historical aurora uses Kp-estimated rings
- npm package name still `earth-dynamics`; DB still `ecdo.db`

---

## After Phase D (unchanged)

- **Phase E:** EDS static deploy, Cloudflare Worker + D1
- **Phase F:** Compare dates, deep links, playback

---

*Update this file when resuming or completing a phase.*