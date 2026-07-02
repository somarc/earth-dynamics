import { discoverLayers } from './registry.mjs';
import { runLayerIngest } from '../ingest/lib/run-layer-ingest.mjs';

/**
 * Run registry-backed layer ingests with per-source failure isolation.
 */
export async function runRegistryIngest({ only = null, force = false, extra = {} } = {}) {
  const layers = await discoverLayers({ reload: true });
  const ingestable = layers.filter((l) => typeof l.ingest === 'function');

  if (!ingestable.length) return [];

  const selected = only
    ? ingestable.filter(
        (l) => l.id === only || l.ingestKey === only || l.ingestAliases?.includes?.(only),
      )
    : ingestable;

  if (only && !selected.length) return [];

  const results = [];
  for (const layer of selected) {
    const result = await runLayerIngest(layer.id, (ctx) => layer.ingest({ ...ctx, ...extra }), {
      force,
      skipIfFresh: layer.skipIfFresh ?? false,
    });
    results.push(result);
  }
  return results;
}