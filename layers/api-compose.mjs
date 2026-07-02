import cyclonesLayer from './cyclones/layer.mjs';

/** Layers that contribute slices to /api/day/:date — add manifests here as they migrate. */
const SNAPSHOT_LAYERS = [cyclonesLayer];

export function composeLayerSnapshots(db, date, opts = {}) {
  const out = {};
  for (const layer of SNAPSHOT_LAYERS) {
    if (typeof layer.contributeToDaySnapshot === 'function') {
      Object.assign(out, layer.contributeToDaySnapshot(db, date, opts));
    }
  }
  return out;
}