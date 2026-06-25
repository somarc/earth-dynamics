# Wobblescope

**Spin, shake, storm & syzygy** — a time-synchronized Earth-system explorer. Scrub one timeline across polar motion, orbital geometry, earthquakes, volcanoes, space weather, aurora, weather, and storms. Inspired by [ECDO](https://x.com/Winston_104/status/2069692182634885555) pole-motion visualization.

**Production target:** AEM Edge Delivery Services (static app) + Cloudflare Worker API + D1. See [docs/architecture.md](docs/architecture.md).

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

## Commands

| Command | Purpose |
|---------|---------|
| `npm run ingest` | Migrate JSON + ingest new sources |
| `npm run ingest -- --only=weather` | Single source |
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