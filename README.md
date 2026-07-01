# Wobblescope

**Spin, shake, storm & syzygy** — a time-synchronized Earth-system explorer. Scrub one timeline across polar motion, orbital geometry, earthquakes, volcanoes, space weather, aurora, weather, and storms. Inspired by [ECDO](https://x.com/Winston_104/status/2069692182634885555) pole-motion visualization.

**Production target:** AEM Edge Delivery Services (static app) + Cloudflare Worker API + D1. See [docs/architecture.md](docs/architecture.md).

## Deployment status (today)

| Surface | Implementation | Status |
|---------|----------------|--------|
| Frontend | Vite → static `dist/` | Local dev works; EDS deploy planned (roadmap H1) |
| API | `api/server.mjs` + `data/ecdo.db` | **Current path** for local dev and review |
| Edge API | `worker/index.js` | **503 stub only** — not a port of `api/handlers.mjs` yet (roadmap H2) |
| Database | SQLite locally; D1 at edge | Schema in `db/schema.sql`; D1 seed planned (H3) |

Until H2 ships, production builds must point `VITE_API_BASE` at a running Node API or stay on the static JSON fallback.

## Quick start

```bash
npm install

# One-time: fetch remote datasets into JSON (legacy path)
npm run fetch-data

# Build SQLite from JSON + weather/storms/solar
npm run ingest

# Dev: API + frontend
npm run start
# → API http://localhost:3001  ·  App http://localhost:5173
```

**First-run expectations:** `npm run fetch-data` pulls ~64 years of IERS EOP, yearly USGS slices, JPL ephemeris vectors, and related sources. Expect several minutes on a typical connection and roughly **~100 MB** of generated artifacts (`public/data/` ~64 MB, `data/` ~44 MB after ingest). Starting only `npm run api` on a fresh clone creates an empty SQLite file and an empty timeline — the app shows a bootstrap gate until ingest completes.

**Trust semantics:** `/api/day/:date` returns `asOf` when EOP, ephemeris, or AAM rows fall back to the nearest prior date. The header shows per-day fallback chips; `/api/meta` freshness compares catalog ends to the visible timeline end (including earthquake-extended scrub dates).

**Refreshing incomplete lanes:** Staleness chips (e.g. weather 12/16, ephemeris past ingest end) are intentional. Re-run targeted ingest after rate limits clear:

```bash
npm run ingest -- --only=weather      # finish ERA5 grid (Open-Meteo rate limits)
npm run fetch-data                    # refresh JPL ephemeris JSON, then ingest
npm run ingest -- --only=ephemeris
```

## Data layers

| Layer | Source | Store |
|-------|--------|-------|
| Polar motion, LOD | IERS EOP C04 | `eop_daily` |
| Ephemeris | JPL Horizons DE441 | `ephemeris_daily` |
| Earthquakes M≥5 | USGS FDSN | `earthquakes` |
| Volcanoes | Smithsonian GVP | `eruptions`, `volcanoes` |
| Weather | Open-Meteo ERA5 (16 grid points) | `weather_daily` |
| US storms | NOAA NCEI Storm Events | `storm_events` |
| Sunspot / Kp | NASA MSFC + NOAA SWPC | `solar_daily` |
| Space weather | NASA DONKI + NOAA SWPC | `space_weather_events`, `geomagnetic_daily` |
| Plate boundaries | PB2002 steps (kinematic class) | `public/data/plate-boundary-steps.json` |

**Roadmap:** [docs/roadmap.md](docs/roadmap.md)

## Commands

| Command | Purpose |
|---------|---------|
| `npm run ingest` | Migrate JSON + ingest new sources |
| `npm run ingest -- --only=weather` | Single source |
| `npm run ingest -- --only=earthquakes` | USGS incremental (last 14d overlap) |
| `npm run ingest:force` | Re-ingest all |
| `npm run api` | SQLite API server |
| `npm run fetch-data` | Refresh JSON from APIs |

## Views

- **Geocentric** — Earth-centered, pole motion, events on globe
- **Heliocentric** — Sun-centered, 23.44° obliquity, orbital trail

## Repository layout

```
app/          → src/, index.html (Vite frontend)
ingest/       → data pipeline → data/ecdo.db
api/          → dev server + shared handlers
worker/       → Cloudflare Worker stub
db/           → schema.sql (D1-compatible)
docs/         → architecture.md
scripts/      → legacy JSON fetchers
```

## Deploy path (EDS + Workers)

1. `npm run build` → deploy `dist/` to EDS site
2. Seed Cloudflare D1 from `data/ecdo.db`
3. Deploy `worker/` with D1 binding
4. Set `VITE_API_BASE` to Worker URL at build time