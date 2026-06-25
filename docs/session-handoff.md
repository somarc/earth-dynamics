# Session handoff — Wobblescope

**Updated:** 2026-06-25  
**Repo:** `/Users/mhess/marc_projects/ecdo` · GitHub `somarc/earth-dynamics`  
**Latest:** Phase E complete (`7d91d89` → `8ffa7c9`)

---

## Where we are

**Phase E (globe equity)** shipped:

| Item | What |
|------|------|
| E1 | IBTrACS ingest — 4,775 storms since 1980; tracks on globe |
| E2 | Weather grid — **12/16** cities; 4 pending (Sydney, São Paulo, equator pts). Chunked resume + `--weather-grid=`; re-run when Open-Meteo 429 clears |
| E3 | ERA5 weather glyphs (temp color, wind size) at grid cities |
| E4 | **Atmosphere** preset — cyclones + weather, hides solid/space layers |

**Next: Phase F (trust layer)** — epistemic badges, staleness chips, disclaimer governance.

---

## Run / verify

```bash
npm run start                              # restart API for cyclones field
npm run ingest -- --only=ibtracs           # skip if already ingested
npm run ingest -- --only=weather           # resume until 16/16 (chunked; wait if 429)
npm run ingest -- --only=weather --weather-grid=sydney,saopaulo,equator_pacific,equator_africa
```

**Demo dates**

| Date | Why |
|------|-----|
| 2005-08-29 | Hurricane Katrina track (IBTrACS) |
| 2024-09-26 | Recent Atlantic cyclone season |
| Today | Weather glyphs at ingested grid cities |

**Try**

1. Click **Atmosphere** preset in footer
2. Scrub to **2005-08-29** — Katrina track grows to landfall
3. Hover cyclone head or weather glyph for inspect/tooltip

---

## Phase F kickoff

See [`roadmap.md`](roadmap.md) Phase F: lane epistemic badges, per-source staleness, helical/pedagogical callouts.

---

## Key files (Phase E)

```
ingest/sources/ibtracs.mjs
src/cyclones.js
src/weather-globe.js
src/earth.js                  # setCyclones, setWeatherGlyphs
api/handlers.mjs              # day.cyclones
```

---

*Update when completing a roadmap phase.*