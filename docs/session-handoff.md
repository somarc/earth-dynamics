# Session handoff — Wobblescope

**Updated:** 2026-06-25  
**Repo:** `/Users/mhess/marc_projects/ecdo` · GitHub `somarc/earth-dynamics`  
**Latest:** Phase D complete (`3348974` → `e74d569`)

---

## Where we are

**Phase D (physics loop)** shipped:

| Item | What |
|------|------|
| D1 | GFZ AAM ingest → `aam_daily` (~18k rows, 1976–2026) |
| D2 | AAM z anomaly overlaid on ΔLOD chart; `/api/aam/window` |
| D3 | Space weather chain highlight on multi-step storm dates |
| D4 | `npm run ingest -- --only=ephemeris` incremental Horizons extend |

**Next: Phase E (globe equity)** — IBTrACS, weather grid completion, Atmosphere preset.

---

## Run / verify

```bash
npm run start                              # restart API to pick up new routes
npm run ingest -- --only=aam               # refresh AAM (incremental by year)
npm run ingest -- --only=ephemeris         # extend ephemeris to EOP end
```

**Demo dates**

| Date | Why |
|------|-----|
| 2024-05-11 | G5 storm — chain highlight on space weather panel; LOD+AAM overlay |
| 2024-01-15 | Winter AAM/LOD coupling visible on rotation panel |
| Today (±2d) | OVATION aurora + chain badge when Kp elevated |

**API checks**

```bash
curl "http://localhost:3001/api/aam/window?end=2024-05-11&days=30"
curl "http://localhost:3001/api/day/2024-05-11" | jq '.aam'
```

---

## Phase E kickoff

1. `ingest/sources/ibtracs.mjs` + cyclone tracks on globe
2. Resume `npm run ingest -- --only=weather` (12 cities pending)
3. **Atmosphere** layer preset

See [`roadmap.md`](roadmap.md) Phase E.

---

## Key files (Phase D)

```
ingest/sources/aam.mjs
ingest/sources/ephemeris.mjs
ingest/lib/horizons-ephemeris.mjs
src/charts.js                 # LOD + AAM overlay
src/space-weather-chain.js    # CME → Dst → aurora highlight
api/handlers.mjs              # /api/aam/window
```

---

*Update when completing a roadmap phase.*