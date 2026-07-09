# ADR: Anonymous public default is LIVE (Windy-class now)

**Status:** Accepted  
**Date:** 2026-07-08  
**Context:** Product posture for eventual AEM Edge Delivery Services + Cloudflare Worker deploy  
**Related:** [`architecture.md`](architecture.md) · [`session-handoff.md`](session-handoff.md) · [`platform-intent.md`](platform-intent.md)

---

## Decision

The **anonymous, unauthenticated site** defaults to a **LIVE** experience of the world — akin to [Windy](https://www.windy.com): arrive, orient to **now**, see **recent layered events** in a short relevant window. It is a **global rallying point** (pings, pulses, shared clock), not a science lab or archive browser.

Anything beyond a **hot LIVE cache** (~**48 hours** working target; tune with evidence) is **deferred to authenticated / deeper API paths** that may hit the full database.

---

## Product model

| Surface | Audience | Default | Data path |
|---------|----------|---------|-----------|
| **LIVE lobby** | Anonymous public | Geo · Live · now orientation · trailing events | Edge-cached “hot” window (~48h) |
| **Replay / Archive** | Explicit opt-in | Scrubber, moments, multi-decade lanes | Full DB / D1 (may require auth later) |
| **Themes** (Bald, Orbit, Spin, Full…) | Depth rooms | Off the lobby | Same split: live slice vs archive |
| **Helio / solar domain** | Future | Opt-in only until solar ingest is real | Parked as product front door |

### LIVE lobby feels like

1. **World is now** — wall-clock solar phase, optional GPS/timezone face (not free-spin museum mode).
2. **Events arrive** — quakes, eruptions, storms, weather as they clear ingest → edge.
3. **Pings that matter** — pulse / halo on significant hits; quiet chrome.
4. **One shared clock** — “now” is the product; Replay is a deliberate door.
5. **Relevant timeframe** — day / ~48h trailing lens, not 60 years of EOP on first paint.

### Rule of thumb

> **If they didn’t ask for a tool, give them the planet with a pulse.**  
> Tools (Orbit, Bald, Full, Helio, archive scrub) are opt-in depth — not the front door.

---

## Deploy shape (EDS + Cloudflare)

```
Anonymous browser
  → AEM EDS static shell (Three.js, LIVE chrome)
  → Cloudflare Worker “live” / hot API
       • ~48h (or tuned) rolling window
       • edge cache, short TTL / stale-while-revalidate
       • no auth
  → D1 / origin DB only for cold paths

Authenticated / power paths (later)
  → full day-frame archive, multi-year windows, authoring
  → explicit Replay, Bald studio, Full Instrument
```

**Today (local):** Node `api/` + SQLite implements full day frames. The LIVE cache split is **product architecture**, not yet a hard worker boundary — implement when H2 edge API is real.

---

## Window guidance (~48h)

| Concern | Guidance |
|---------|----------|
| **Working target** | ~48 hours trailing for anonymous LIVE event layers |
| **Why not 7d on the wire** | Cold start, cache weight, “now” narrative dilution |
| **Why not 6h only** | Night-side users and sparse event types need a bit of memory |
| **Tune later** | Measure payload size, ingest lag, and pulse density; adjust 24–72h |

UI time-lens **day / week** remains a presentation control; the **anonymous network budget** is the hot cache, not the full catalog.

---

## Explicit non-goals (for the public lobby)

- Helio as default (true AU is hard; solar-domain data not ready)
- Continuous free-spin as the hero UX
- Full Instrument / multi-decade scrub as first paint
- Forcing archive SQL for every anonymous page view

---

## Consequences

1. **Default experience** stays GEO + Live (Bald look is fine; Live *mode* is the posture).
2. **Orbit / Spin / Full / Helio** remain theme rail depth — GEO-first where it matters.
3. **Edge worker** should grow a thin live/hot contract before cloning full `/api/day/:date` archive behavior for the public path.
4. **Auth boundary** (when introduced) protects deep history and heavy queries, not the shared LIVE room.
5. Engineering priority: pulse quality, freshness chips, hot-window API — not Helio polish.

---

## Status of implementation (as of acceptance)

| Item | State |
|------|--------|
| Live vs Replay footer | Shipped |
| Orient to user + wall-clock sun | Shipped |
| Time lens (day…decade) | Shipped (UI); hot-cache boundary not enforced at edge yet |
| Event pulses | Shipped (baseline) |
| EDS + CF Worker live/hot API | Planned (roadmap H1/H2) |
| Auth-gated archive | Planned (not started) |
| True-scale Moon/Sun in scene | Shipped (GEO-readable; Helio opt-in) |
