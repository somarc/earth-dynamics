import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, logIngest } from './db.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HOME_MANIFEST = join(ROOT, 'public/data/home-region.json');
export const HOME_TEX_DIR = join(ROOT, 'public/textures/home');

const ASSET_FILES = {
  day: { file: 'day.jpg', mime: 'image/jpeg' },
  night: { file: 'night.jpg', mime: 'image/jpeg' },
  hillshade: { file: 'hillshade.png', mime: 'image/png' },
  'terrain-coverage': { file: 'terrain-coverage.png', mime: 'image/png' },
};

const upsertRegionStmt = () =>
  getDb().prepare(`
    INSERT INTO home_regions (id, name, label, bbox_json, center_json, config_json, updated_at)
    VALUES (@id, @name, @label, @bbox_json, @center_json, @config_json, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      label = excluded.label,
      bbox_json = excluded.bbox_json,
      center_json = excluded.center_json,
      config_json = excluded.config_json,
      updated_at = excluded.updated_at
  `);

const upsertAssetStmt = () =>
  getDb().prepare(`
    INSERT INTO home_assets (
      region_id, asset_key, mime_type, width, height, byte_length, sha256,
      source_json, fetched_at, data
    ) VALUES (
      @region_id, @asset_key, @mime_type, @width, @height, @byte_length, @sha256,
      @source_json, @fetched_at, @data
    )
    ON CONFLICT(region_id, asset_key) DO UPDATE SET
      mime_type = excluded.mime_type,
      width = excluded.width,
      height = excluded.height,
      byte_length = excluded.byte_length,
      sha256 = excluded.sha256,
      source_json = excluded.source_json,
      fetched_at = excluded.fetched_at,
      data = excluded.data
  `);

function parseResolution(resolution) {
  if (!resolution || typeof resolution !== 'string') return { width: null, height: null };
  const [w, h] = resolution.split('x').map((n) => parseInt(n, 10));
  return { width: Number.isFinite(w) ? w : null, height: Number.isFinite(h) ? h : null };
}

/** API-facing config — asset paths point at /api/home/assets/:key */
export function buildApiHomeConfig(manifest) {
  const assets = {};
  for (const key of Object.keys(ASSET_FILES)) {
    assets[key] = `/api/home/assets/${key}`;
  }
  if (manifest.assets?.terrainCoverage) {
    assets['terrain-coverage'] = '/api/home/assets/terrain-coverage';
  }

  return {
    ...manifest,
    assets: {
      ...assets,
      day: assets.day,
      night: assets.night,
      hillshade: manifest.terrain ? assets.hillshade : manifest.assets?.hillshade,
      terrainCoverage: assets['terrain-coverage'],
    },
    terrain: manifest.terrain
      ? {
          ...manifest.terrain,
          assets: {
            hillshade: '/api/home/assets/hillshade',
            coverage: '/api/home/assets/terrain-coverage',
          },
        }
      : undefined,
    storage: 'sqlite',
  };
}

export function upsertHomeRegion(manifest) {
  const apiConfig = buildApiHomeConfig(manifest);
  const now = new Date().toISOString();
  upsertRegionStmt().run({
    id: manifest.id,
    name: manifest.name,
    label: manifest.label ?? 'Home',
    bbox_json: JSON.stringify(manifest.bbox),
    center_json: JSON.stringify(manifest.center ?? null),
    config_json: JSON.stringify(apiConfig),
    updated_at: now,
  });
  return apiConfig;
}

export function upsertHomeAsset(regionId, assetKey, buffer, { mime, width = null, height = null, source = null } = {}) {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  upsertAssetStmt().run({
    region_id: regionId,
    asset_key: assetKey,
    mime_type: mime,
    width,
    height,
    byte_length: buffer.length,
    sha256,
    source_json: source ? JSON.stringify(source) : null,
    fetched_at: new Date().toISOString(),
    data: buffer,
  });
  return sha256;
}

export function getHomeRegionConfig(regionId = 'eastern-ontario') {
  const row = getDb()
    .prepare('SELECT config_json FROM home_regions WHERE id = ?')
    .get(regionId);
  if (!row) return null;
  return JSON.parse(row.config_json);
}

export function getHomeAsset(regionId, assetKey) {
  return getDb()
    .prepare(
      `SELECT mime_type, byte_length, sha256, data
       FROM home_assets WHERE region_id = ? AND asset_key = ?`,
    )
    .get(regionId, assetKey);
}

export function listHomeAssetKeys(regionId = 'eastern-ontario') {
  return getDb()
    .prepare('SELECT asset_key, byte_length, mime_type, fetched_at FROM home_assets WHERE region_id = ?')
    .all(regionId);
}

export function importHomeFromDisk({
  manifestPath = HOME_MANIFEST,
  textureDir = HOME_TEX_DIR,
} = {}) {
  if (!existsSync(manifestPath)) {
    throw new Error(`Home manifest missing: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { width, height } = parseResolution(manifest.resolution);
  upsertHomeRegion(manifest);

  let stored = 0;
  let bytes = 0;

  for (const [key, meta] of Object.entries(ASSET_FILES)) {
    const path = join(textureDir, meta.file);
    if (!existsSync(path)) continue;
    const buf = readFileSync(path);
    const source = manifest.sources?.find((s) => s.role === key || key.includes(s.role ?? ''));
    const dims =
      key === 'hillshade' && manifest.terrain?.resolution
        ? parseResolution(manifest.terrain.resolution)
        : { width, height };
    upsertHomeAsset(manifest.id, key, buf, {
      mime: meta.mime,
      width: dims.width,
      height: dims.height,
      source,
    });
    stored += 1;
    bytes += buf.length;
  }

  logIngest(
    'home-region',
    stored,
    `${manifest.id} · ${stored} assets · ${(bytes / 1_048_576).toFixed(1)} MB`,
  );

  return { regionId: manifest.id, assets: stored, bytes };
}