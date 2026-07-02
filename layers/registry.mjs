import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedLayers = null;

/** Discover layer manifests from layers/<id>/layer.mjs (skips _-prefixed dirs). */
export async function discoverLayers({ reload = false } = {}) {
  if (cachedLayers && !reload) return cachedLayers;

  const entries = readdirSync(__dirname, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name);

  const layers = [];
  for (const dir of entries) {
    const layerPath = join(__dirname, dir, 'layer.mjs');
    try {
      const mod = await import(pathToFileURL(layerPath).href);
      if (mod.default?.id) layers.push(mod.default);
    } catch (err) {
      if (err?.code === 'ERR_MODULE_NOT_FOUND') continue;
      throw err;
    }
  }

  layers.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  cachedLayers = layers;
  return layers;
}

export async function layerById(id) {
  const layers = await discoverLayers();
  return layers.find((l) => l.id === id) ?? null;
}

export async function ingestableLayers() {
  const layers = await discoverLayers();
  return layers.filter((l) => typeof l.ingest === 'function');
}

export async function apiLayers() {
  const layers = await discoverLayers();
  return layers.filter(
    (l) => typeof l.contributeToDaySnapshot === 'function' || l.routes?.length,
  );
}

export async function globeLayers() {
  const layers = await discoverLayers();
  return layers.filter((l) => l.globe);
}