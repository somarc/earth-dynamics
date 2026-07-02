# Wobblescope Layer Plugins

Add a data source by creating a directory here. The registry discovers `layers/<id>/layer.mjs` automatically.

**Contract:** [`docs/adr-layer-plugin-contract.md`](../docs/adr-layer-plugin-contract.md)  
**Intent:** [`docs/platform-intent.md`](../docs/platform-intent.md)

## Quick start — static reference layer

Copy `_template/static-reference/`:

```
layers/my-layer/
  layer.mjs    # manifest (required)
  globe.mjs    # buildGroup + optional load
```

No edits to `ingest/run.mjs`, `api/handlers.mjs`, `earth.js`, or `index.html` after P2.

## Quick start — ingested timeseries layer

```
layers/my-layer/
  layer.mjs
  ingest.mjs   # must use ingest/lib primitives
  schema.sql   # optional CREATE TABLE fragment
  globe.mjs
```

```bash
npm run ingest -- --only=my-layer
```

## Ingest primitives (required for ingested layers)

```javascript
import { fetchWithRetry, incrementalWindow, upsertRows } from '../../ingest/lib/index.mjs';
```

Do not inline `fetch` + manual retry in layer ingest files.

## Manifest skeleton

See `layers/_template/layer.mjs` and `layers/hotspots/layer.mjs` for a working example.