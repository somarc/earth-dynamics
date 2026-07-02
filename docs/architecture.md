<p align="center">
  <img src="/assets/weatherly-mascot.jpg" alt="Weatherly mascot" width="56" height="56" />
</p>

# Wobblescope — Architecture

## What we're building

A **time-synchronized Earth-system correlation explorer**: verifiable signals from rotation geodesy, orbital mechanics, solid-earth events, atmosphere, and space weather on one scrubbable timeline. Not a prediction engine — an instrument for seeing what co-occurs.

```
┌─────────────────────────────────────────────────────────────┐
│  AEM Edge Delivery Services (static) — planned (H1)         │
│  Three.js app — geocentric + heliocentric views             │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch /api/*
         ┌─────────────────┴─────────────────┐
         │  TODAY (local dev)                │  PLANNED (H2)
         ▼                                   ▼
┌─────────────────────┐            ┌──────────────────────────┐
│  Node api/server    │            │  Cloudflare Worker       │
│  + handlers.mjs     │            │  (worker/ — 503 stub)  │
└──────────┬──────────┘            └────────────┬─────────────┘
           │                                    │
           ▼                                    ▼
┌─────────────────────┐            ┌──────────────────────────┐
│  data/ecdo.db       │            │  Cloudflare D1           │
│  (local SQLite)     │            │  same db/schema.sql      │
└──────────▲──────────┘            └────────────▲─────────────┘
           │                                    │
           └────────────────┬───────────────────┘
                            │ seed / refresh
┌───────────────────────────▼─────────────────────────────────┐
│  Ingest pipeline (local / CI)                               │
│  ingest/run.mjs → data/ecdo.db                              │
└─────────────────────────────────────────────────────────────┘
```

**Important:** `worker/index.js` is a placeholder (503 JSON). It does **not** call `routeRequest()` from `api/handlers.mjs` yet. Local development and review use `npm run api` on port 3001; Vite proxies `/api` in dev.

## Local development

```bash
npm run ingest          # build SQLite from JSON + live sources
npm run api             # http://localhost:3001
npm run dev             # Vite proxies /api → 3001
```

## Production target (EDS + Workers)

| Layer | Target | Notes |
|-------|--------|-------|
| Frontend | `somarc/earth-dynamics` → EDS site | `npm run build` → deploy `dist/` via DA or Git sync |
| API | Cloudflare Worker | `worker/` — bind D1, CORS to EDS origin |
| Database | Cloudflare D1 | Export `data/ecdo.db` or run ingest in CI, `wrangler d1 execute` |
| Ingest | GitHub Action (scheduled) | Weekly refresh earthquakes, storms; monthly weather |

### EDS integration sketch

1. Create EDS site from boilerplate (`somarc/earth-dynamics` code repo)
2. Build step outputs static assets to repo root or `dist/`
3. Configure `scripts.js` to set `window.__API_BASE__` from Helix env or meta tag
4. Worker URL e.g. `https://earth-dynamics-api.<account>.workers.dev`

### D1 migration

```bash
wrangler d1 create earth-dynamics
wrangler d1 execute earth-dynamics --local --file=db/schema.sql
sqlite3 data/ecdo.db .dump | wrangler d1 execute earth-dynamics --file=-
```

## Data layers

| Layer | Source | Table(s) |
|-------|--------|----------|
| Rotation | IERS EOP C04 | `eop_daily` |
| Orbits | JPL Horizons DE441 | `ephemeris_daily` |
| Earthquakes | USGS FDSN | `earthquakes` |
| Volcanoes | Smithsonian GVP | `eruptions`, `volcanoes` |
| Weather | Open-Meteo ERA5 | `weather_daily`, `weather_grid` |
| Storms | NOAA NCEI Storm Events | `storm_events` |
| Solar | NASA MSFC sunspot + NOAA Kp | `solar_daily` |

## API contract

| Endpoint | Purpose |
|----------|---------|
| `GET /api/meta` | Sources, date range, ingest status |
| `GET /api/dates` | All EOP dates (slider) |
| `GET /api/day/:date` | Full snapshot for one day |
| `GET /api/eop/window?end=&days=` | EOP series for charts |

## Future additions

- IBTrACS tropical cyclones (global)
- ERA5 global anomaly grids (Copernicus CDS)
- NOAA GHCN temperature station anomalies
- GRACE mass redistribution (LOD drivers)
- Correlation analytics endpoint (tidal index vs earthquake rate)