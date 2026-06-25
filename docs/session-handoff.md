# Session handoff — Wobblescope

**Updated:** 2026-06-25  
**Repo:** `/Users/mhess/marc_projects/ecdo` · GitHub `somarc/earth-dynamics`  
**Latest commit:** `62ce923` — wider panels + helical chart fixes

---

## Where we are

Phases **A**, **B**, **C**, and **G** (graphics) are complete. Macro review captured in [`wishlist.md`](wishlist.md). Prioritized delivery in [`roadmap.md`](roadmap.md).

**Next up: Phase D — Physics loop** (T16 AAM, LOD overlay, space-weather chain highlights, ephemeris extend).

---

## Completed (recent)

| Area | Items |
|------|-------|
| **Graphics G1–G3** | Sun lighting, atmosphere shell, event halos, view crossfade, playback pulses |
| **Charts** | Helical galactic-plane view beside ecliptic; ephemeris orbit window fix |
| **UX** | Globe inspect (quakes, volcanoes, hotspots, plates); 420px panels column |
| **Earlier** | Phases A–C per roadmap |

---

## Run / verify

```bash
npm run start                    # API :3001 + Vite :5173
npm run ingest -- --only=omni    # Dst + solar wind
npm run ingest -- --only=weather # Resume Open-Meteo grid (rate-limited)
```

**Good demo dates**

| Date | Why |
|------|-----|
| 2024-05-11 | G5 storm — Dst −406 nT, Kp 9, wind 777 km/s |
| 2024-05-08–12 | Heliocentric CME cones |
| Today (±2d) | OVATION aurora (historical uses Kp fallback) |

---

## Local data snapshot (2026-06-25)

| Source | Status |
|--------|--------|
| EOP / ephemeris | 1962–2026-05-25 (+ stale fallback on timeline) |
| Earthquakes | Incremental through 2026-06-25 |
| Geomagnetic + OMNI | ~2022–2026 (Dst) |
| US storms (T5) | In DB — **sidebar only** |
| Weather (T6) | **4/16** grid points |
| DONKI | Cache + live; `NASA_API_KEY` for depth |

---

## Phase D kickoff checklist

1. Read [`roadmap.md`](roadmap.md) Phase D acceptance criteria
2. Implement `ingest/sources/aam.mjs` + `aam_daily` table
3. Overlay AAM on LOD chart in `src/charts.js` or sibling module
4. Optional: cross-highlight Kp/Dst/aurora on G5 demo dates (D3)

---

## Key files

```
docs/wishlist.md             # Full macro backlog
docs/roadmap.md              # Prioritized phases D→J
src/helical-chart.js         # Helical panel
src/event-markers.js         # Halos + pulses
src/globe-inspect.js         # Hover/click context
ingest/sources/omni.mjs      # Dst + solar wind
api/handlers.mjs             # Day + window endpoints
```

---

## Open decisions (see wishlist)

- US storms on globe vs IBTrACS-only
- Deploy (Phase H) before or after Phase D
- Co-analysis scope for Phase J

---

*Update when completing a roadmap phase or shifting priority.*