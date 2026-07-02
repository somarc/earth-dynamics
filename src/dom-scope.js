/** Scoped DOM queries for standalone app and EDS widget mount roots. */

let root = typeof document !== 'undefined' ? document : null;

export function setDomRoot(element) {
  root = element;
}

export function getDomRoot() {
  return root;
}

export function $id(id) {
  if (!root) return null;
  return root.querySelector(`#${id}`);
}

export function $(selector) {
  if (!root) return null;
  return root.querySelector(selector);
}

export function $$(selector) {
  if (!root) return [];
  return root.querySelectorAll(selector);
}