import { discoverLayers } from './registry.mjs';
import { runLayerIngest } from '../ingest/lib/run-layer-ingest.mjs';

async function resolveIngest(layer) {
  if (typeof layer.ingest === 'function') return layer.ingest;
  try {
    const mod = await import(`./${layer.id}/ingest.mjs`);
    return mod.ingest ?? mod.default ?? null;
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw err;
  }
}

/**
 * Run registry-backed layer ingests with per-source failure isolation.
 */
export async function runRegistryIngest({ only = null, force = false, extra = {} } = {}) {
  const layers = await discoverLayers({ reload: true });
  const ingestable = [];
  for (const layer of layers) {
    if (await resolveIngest(layer)) ingestable.push(layer);
  }

  if (!ingestable.length) return [];

  const selected = only
    ? ingestable.filter(
        (l) => l.id === only || l.ingestKey === only || l.ingestAliases?.includes?.(only),
      )
    : ingestable;

  if (only && !selected.length) return [];

  const results = [];
  for (const layer of selected) {
    const ingestFn = await resolveIngest(layer);
    if (!ingestFn) continue;
    const result = await runLayerIngest(layer.id, (ctx) => ingestFn({ ...ctx, ...extra }), {
      force,
      skipIfFresh: layer.skipIfFresh ?? false,
    });
    results.push(result);
  }
  return results;
}