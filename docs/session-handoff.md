# Session handoff — Wobblescope

**Updated:** 2026-07-08  
**Repo:** `/Users/mhess/marc_projects/ecdo` · GitHub `somarc/earth-dynamics`

---

## Where we are

### Product posture (locked direction)

**Anonymous public site = LIVE lobby (Windy-class now).**  
Full write-up: [`adr-live-public-default.md`](adr-live-public-default.md).

| Default | Behavior |
|---------|----------|
| **Live** | Face user GPS/timezone, local today + hour for sun, day/night for *now* |
| **Events** | Recent layered pings in a short window (working target ~**48h** hot cache) |
| **Replay** | Explicit door — scrubber + multi-decade archive (later: auth / DB, not edge hot path) |
| **Continuous free rotation** | Not the preferred default UX |
| **Helio** | Opt-in only until solar-domain ingest is real |

Supporting stack: Bald Earth Studio (instrument vs lit-map), **Save as app defaults**, terminator-locked atmosphere, true-scale Moon (GEO); Orbit is GEO-first earth–moon framing.

**Verify Live:** Locate me · night local time → your region dark, west coast can still be day, thin terminator limb not a blue balloon.

### Test spine

| Item | What |
|------|------|
| `npm test` | vitest — **125** unit/contract tests, no network |
| Fixture DB | `tests/fixtures/create-fixture-db.mjs` in-memory seed |
| Day-frame contract | Golden keys for `2024-05-11` (G5) + Katrina cyclones |
| CI | `.github/workflows/test.yml` — test + `npm run build` |

Next engineering: DayFrame cache, more parsers, GlobeCore peel, Playwright; Replay UX polish per experience.

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