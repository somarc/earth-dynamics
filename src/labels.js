import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function createLabelRenderer(container) {
  const renderer = new CSS2DRenderer();
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.domElement.className = 'label-layer';
  container.appendChild(renderer.domElement);
  return renderer;
}

export function makeLabel(text, className = 'body-label') {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return new CSS2DObject(el);
}

export function resizeLabelRenderer(renderer, container) {
  renderer.setSize(container.clientWidth, container.clientHeight);
}