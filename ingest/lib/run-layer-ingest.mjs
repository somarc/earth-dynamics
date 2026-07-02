import { logIngest } from '../db.mjs';

/**
 * Per-layer ingest wrapper: isolated failure, consistent logging.
 */
export async function runLayerIngest(layerId, fn, { force = false, skipIfFresh = false } = {}) {
  const label = `layer:${layerId}`;
  console.log(`\n▸ ${label}`);

  if (skipIfFresh && !force) {
    console.log(`  ${label}: skipped (fresh)`);
    return { status: 'skipped', layerId };
  }

  try {
    const result = await fn({ force });
    const rowCount = result?.rowCount ?? result?.rows ?? 0;
    const notes = result?.notes ?? '';
    if (result?.logged !== false) {
      logIngest(result?.logKey ?? layerId, rowCount, notes);
    }
    console.log(`  ${label}: ok`);
    return { status: 'ok', layerId, ...result };
  } catch (err) {
    console.error(`  ${label}: FAILED — ${err.message}`);
    logIngest(layerId, 0, `error: ${err.message}`);
    return { status: 'error', layerId, error: err };
  }
}