import { wasIngested } from '../../ingest/db.mjs';
import { importHomeFromDisk } from '../../ingest/home-store.mjs';

export async function ingest({ force = false } = {}) {
  if (!force && wasIngested('home-region')) {
    console.log('  home-region already in DB (use --force to re-import from disk)');
    return { rowCount: 0, logged: false, notes: 'skipped (fresh)' };
  }
  const result = importHomeFromDisk();
  console.log(
    `  Stored ${result.assets} home assets (${(result.bytes / 1_048_576).toFixed(1)} MB) → ${result.regionId}`,
  );
  return {
    rowCount: result.assets,
    notes: `${result.regionId}, ${(result.bytes / 1_048_576).toFixed(1)} MB`,
    logKey: 'home-region',
  };
}