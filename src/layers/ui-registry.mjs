import { GLOBE_LAYERS } from './registry.mjs';
import { LEGACY_LAYER_UI, PRESET_IDS } from './legacy-ui.mjs';

function manifestToUi(layer) {
  const key = layer.globe?.legacyKey ?? layer.id;
  return {
    id: layer.id,
    key,
    toggleId: layer.globe?.toggleId ?? `show-${layer.id}`,
    epistemic: layer.epistemic,
    ui: {
      group: layer.ui?.group ?? 'solid',
      chipLabel: layer.ui?.chipLabel ?? layer.name,
      chipId: layer.ui?.chipId ?? `chip-${layer.id}`,
      countKey: layer.ui?.countKey ?? null,
      title: layer.ui?.title ?? layer.name,
      hiddenUntilHelio: layer.ui?.hiddenUntilHelio ?? false,
    },
    presets: layer.presets ?? {},
    views: layer.ui?.views ?? ['geocentric'],
    registry: true,
    legend: layer.globe?.legend ?? null,
    defaultVisible: layer.globe?.defaultVisible ?? true,
    applyVisible(scene, visible) {
      if (scene.setLayerVisible?.(layer.id, visible)) return;
      const method = `set${key.charAt(0).toUpperCase()}${key.slice(1)}Visible`;
      scene[method]?.(visible);
    },
    onToggle: layer.ui?.onToggle ?? (layer.globe?.dynamic ? 'reapplyEvents' : null),
  };
}

export function allLayerUi() {
  const registry = GLOBE_LAYERS.map(manifestToUi);
  const registryIds = new Set(registry.map((l) => l.id));
  const legacy = LEGACY_LAYER_UI.filter((l) => !registryIds.has(l.id));
  return [...legacy, ...registry].sort((a, b) => {
    const order = { solid: 0, atmos: 1, space: 2, sky: 3 };
    const ga = order[a.ui.group] ?? 9;
    const gb = order[b.ui.group] ?? 9;
    return ga - gb || a.ui.chipLabel.localeCompare(b.ui.chipLabel);
  });
}

export function buildLayerPresets() {
  const layers = allLayerUi();
  const presets = {};
  for (const presetId of PRESET_IDS) {
    presets[presetId] = { label: presetId };
    for (const layer of layers) {
      const val = layer.presets[presetId];
      presets[presetId][layer.key] = val !== undefined ? val : layer.defaultVisible ?? false;
    }
  }
  presets.solid.label = 'Solid Earth';
  presets.space.label = 'Space Weather';
  presets.orbital.label = 'Orbital';
  presets.atmosphere.label = 'Atmosphere';
  presets.full.label = 'Full stack';
  return presets;
}

export function layerEpistemicMap() {
  const map = {};
  for (const layer of allLayerUi()) {
    map[layer.key] = layer.epistemic;
  }
  return map;
}

export function registryLegendGeoEntries() {
  return allLayerUi()
    .filter((l) => l.legend && l.views.includes('geocentric'))
    .map((l) => ({
      id: l.legend.id,
      class: l.legend.class,
      label: l.legend.label,
      title: l.legend.title,
      help: l.legend.help,
    }));
}