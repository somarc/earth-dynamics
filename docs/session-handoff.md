# Session handoff — Wobblescope

**Updated:** 2026-07-08  
**Repo:** `/Users/mhess/marc_projects/ecdo` · GitHub `somarc/earth-dynamics`

---

## Where we are

**Test spine** (iterating, 2026-07-08):

| Item | What |
|------|------|
| `npm test` | vitest — **93** unit/contract tests, no network |
| Fixture DB | `tests/fixtures/create-fixture-db.mjs` in-memory seed |
| Day-frame contract | Golden keys for `2024-05-11` (G5) + Katrina cyclones |
| CI | `.github/workflows/test.yml` — test + `npm run build` |
| Pure extracts | daily-resolve, playback-format, event-list, experience URL, ephWindowToChart |
| Ingest parsers | ocean-sst, solar, AAM, USGS quakes + fetchWithRetry / upsert / incremental |

Next: more source parsers (OMNI, IBTrACS), DayFrame cache in conductor, GlobeCore peel, Playwright smokes.

**Phase F (trust layer)** shipped:

| Item | What |
|------|------|
| F1 | Epistemic badges on sidebar panels + globe inspect picks |
| F2 | Header staleness chips (USGS lag, ephemeris gap, weather 12/16, OMNI age) |
| F3 | Helical pedagogical callout; lunar exploratory disclaimer retained |
| F4 | Data Sources rows show epistemic class + ingest age |

**Also:** USGS incremental ingest fixed (`endtime` = next day) — today's events included.

**Next: Phase G** — deep links, compare two dates, change summary.

---

## Run / verify

```bash
npm run start
npm run ingest -- --only=earthquakes   # refresh catalog (includes today)
```

**Demo**

| Date | Why |
|------|-----|
| **2026-06-26** | M6.5 Sarangani, Philippines (USGS `us6000t8ec`) |
| 2005-08-29 | Hurricane Katrina track |
| 2024-05-11 | G5 space-weather chain |

Check header staleness chips, panel badges, Data Sources epistemic labels.

---

## Key files (Phase F)

```
src/epistemics.js           # badge + staleness UI
ingest/constants.mjs        # epistemic + ingestKeys per source
api/handlers.mjs            # /api/meta freshness block
ingest/sources/earthquakes.mjs  # end-of-day ingest fix
```

---

## Backlog

- Burkhard MAXWELL / Zenodo Southern CA stress (regional modeled layer)
- Weather grid 12/16 (Open-Meteo 429)
- Phase G share & compare

---

*Update when completing a roadmap phase.*