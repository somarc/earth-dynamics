#!/usr/bin/env node
/**
 * Build the Weatherly widget bundle and copy into earth-dynamics-eds/widgets/weatherly/.
 *
 * Usage:
 *   node scripts/sync-widget-to-eds.mjs
 *   EDS_REPO=/path/to/earth-dynamics-eds node scripts/sync-widget-to-eds.mjs
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EDS_ROOT = process.env.EDS_REPO || resolve(ROOT, '../earth-dynamics-eds');
const DIST = resolve(ROOT, 'dist-widget');
const DEST = resolve(EDS_ROOT, 'widgets/weatherly');

if (!existsSync(EDS_ROOT)) {
  console.error(`EDS repo not found: ${EDS_ROOT}`);
  console.error('Clone somarc/earth-dynamics-eds or set EDS_REPO.');
  process.exit(1);
}

console.log('Building widget bundle…');
execSync('npm run build:widget', { cwd: ROOT, stdio: 'inherit' });

console.log(`Syncing ${DIST} → ${DEST}`);
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(DIST, DEST, { recursive: true });

console.log('Done. Widget files in earth-dynamics-eds/widgets/weatherly/');