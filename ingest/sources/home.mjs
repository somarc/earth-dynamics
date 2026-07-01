import { wasIngested } from '../db.mjs';
import { importHomeFromDisk } from '../home-store.mjs';

export async function ingestHome({ force = false } = {}) {
  if (!force && wasIngested('home-region')) {
    console.log('  home-region already in DB (use --force to re-import from disk)');
    return null;
  }
  const result = importHomeFromDisk();
  console.log(
    `  Stored ${result.assets} home assets (${(result.bytes / 1_048_576).toFixed(1)} MB) → ${result.regionId}`,
  );
  return result;
}