# Session handoff — Wobblescope

**Updated:** 2026-06-26  
**Repo:** `/Users/mhess/marc_projects/ecdo` · GitHub `somarc/earth-dynamics`

---

## Where we are

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