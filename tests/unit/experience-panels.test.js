/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { applyExperiencePanels } from '../../src/experiences/controller.mjs';
import { setDomRoot } from '../../src/dom-scope.js';

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
