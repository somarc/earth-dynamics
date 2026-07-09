/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  applyExperiencePanels,
  resolveEntryFrame,
} from '../../src/experiences/controller.mjs';
import { setDomRoot } from '../../src/dom-scope.js';
import orbital from '../../experiences/orbital/experience.mjs';
import baldEarth from '../../experiences/bald-earth/experience.mjs';

describe('applyExperiencePanels', () => {
  /** @type {HTMLElement} */
  let root;

  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = `
      <div data-panel="polhode"></div>
      <div data-panel="events"></div>
      <div data-panel="inspect"></div>
    `;
    document.body.appendChild(root);
    setDomRoot(root);
  });

  afterEach(() => {
    root.remove();
    setDomRoot(null);
  });

  it('hideAllPanels hides every panel', () => {
    applyExperiencePanels({ hideAllPanels: true, panels: [] });
    for (const el of root.querySelectorAll('[data-panel]')) {
      expect(el.classList.contains('panel--experience-hidden')).toBe(true);
    }
  });

  it('allow-list shows only requested panels', () => {
    applyExperiencePanels({
      panels: ['events'],
      hiddenPanels: [],
    });
    expect(root.querySelector('[data-panel="events"]').classList.contains('panel--experience-hidden')).toBe(false);
    expect(root.querySelector('[data-panel="polhode"]').classList.contains('panel--experience-hidden')).toBe(true);
  });
});

describe('orbital vs bald earth entry frames', () => {
  it('orbital is GEO-first with earth–moon frame, not live-user or forced helio', () => {
    expect(orbital.defaultView).toBe('geocentric');
    expect(orbital.orientToUser).toBe(false);
    expect(resolveEntryFrame(orbital, 'geocentric')).toBe('earth-moon');
    // Helio only when user switches views — not the product landing.
    expect(resolveEntryFrame(orbital, 'heliocentric')).toBe('helio-sun-earth');
  });

  it('bald earth stays live-user on geo', () => {
    expect(baldEarth.bareGlobe).toBe(true);
    expect(baldEarth.defaultView).toBe('geocentric');
    expect(resolveEntryFrame(baldEarth, 'geocentric')).toBe('live-user');
  });
});
