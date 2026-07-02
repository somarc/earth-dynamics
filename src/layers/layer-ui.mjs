import { allLayerUi } from './ui-registry.mjs';
import { EPISTEMIC } from '../epistemics.js';
import { $id, $ } from '../dom-scope.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const GROUP_LABELS = {
  solid: 'Solid',
  atmos: 'Atmos',
  space: 'Space',
  sky: 'Sky',
};

export function renderLayerChips() {
  const layers = allLayerUi();
  const byGroup = new Map();
  for (const layer of layers) {
    const g = layer.ui.group;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(layer);
  }

  for (const [group, items] of byGroup) {
    const mount = $(`[data-layer-chips="${group}"]`);
    if (!mount) continue;
    mount.innerHTML = items
      .map((layer) => {
        const chipId = layer.ui.chipId ? ` id="${esc(layer.ui.chipId)}"` : '';
        const style = layer.ui.hiddenUntilHelio ? ' style="display:none"' : '';
        const checked = layer.defaultVisible !== false ? ' checked' : '';
        return `<label class="layer-chip"${chipId}${style} title="${esc(layer.ui.title)}"><input type="checkbox" id="${esc(layer.toggleId)}"${checked} /><span>${esc(layer.ui.chipLabel)}</span></label>`;
      })
      .join('');
  }
}

export function wireLayerToggles(handlers) {
  const {
    geocentricScene,
    heliocentricScene,
    getView,
    onReapplyEvents,
    onUpdateUI,
    onGeomagChips,
    onUpdateChipCounts,
  } = handlers;

  for (const layer of allLayerUi()) {
    const el = $id(layer.toggleId);
    if (!el) continue;

    el.addEventListener('change', (e) => {
      const visible = e.target.checked;
      if (layer.views.includes('geocentric') && geocentricScene) {
        layer.applyVisible(geocentricScene, visible);
      }
      if (layer.views.includes('heliocentric') && heliocentricScene) {
        layer.applyVisible(heliocentricScene, visible);
      }

      switch (layer.onToggle) {
        case 'reapplyEvents':
          onReapplyEvents?.();
          break;
        case 'updateUI':
          onUpdateUI?.();
          break;
        case 'geomagChips':
          onGeomagChips?.();
          break;
        case 'updateChipCounts':
          onUpdateChipCounts?.();
          break;
        default:
          break;
      }
    });
  }

  return { getView };
}

export function applyPresetToScenes(preset, geocentricScene, heliocentricScene) {
  const set = (id, checked) => {
    const el = $id(id);
    if (el) el.checked = checked;
  };

  for (const layer of allLayerUi()) {
    const visible = preset[layer.key] ?? layer.defaultVisible ?? false;
    set(layer.toggleId, visible);
    if (layer.views.includes('geocentric') && geocentricScene) {
      layer.applyVisible(geocentricScene, visible);
    }
    if (layer.views.includes('heliocentric') && heliocentricScene) {
      layer.applyVisible(heliocentricScene, visible);
    }
  }
}

export function applyEpistemicTitles() {
  for (const layer of allLayerUi()) {
    const input = $id(layer.toggleId);
    const meta = EPISTEMIC[layer.epistemic];
    if (!input || !meta) continue;
    const label = input.closest('label');
    if (label) label.title = `${meta.title} (${meta.label})`;
  }
}

export { GROUP_LABELS };