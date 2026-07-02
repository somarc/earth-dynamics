/** Browser layer registry — Vite discovers layers/<id>/layer.mjs at build time. */

const modules = import.meta.glob(
  ['../../layers/*/layer.mjs', '!../../layers/_*/layer.mjs'],
  { eager: true },
);

export const LAYERS = Object.values(modules)
  .map((m) => m.default)
  .filter((l) => l?.id)
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

export const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l]));

export const GLOBE_LAYERS = LAYERS.filter((l) => l.globe);