import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

export async function discoverExperiences() {
  const dirs = readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_template')
    .map((d) => d.name);

  const experiences = [];
  for (const id of dirs) {
    const mod = await import(pathToFileURL(join(ROOT, id, 'experience.mjs')).href);
    const manifest = mod.default;
    if (manifest?.id) experiences.push(manifest);
  }
  return experiences.sort((a, b) => a.title.localeCompare(b.title));
}