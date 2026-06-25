import * as THREE from 'three';
import { EARTH_RADIUS } from './utils.js';

let cachedLines = null;

export async function loadIgrfFieldLines(url = '/data/field-lines-igrf.json') {
  if (cachedLines) return cachedLines;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IGRF field lines ${res.status}`);
  cachedLines = await res.json();
  return cachedLines;
}

export function updateIgrfFieldLines(group, kp, visible, data) {
  group.clear();
  if (!visible || !data?.lines?.length) return;

  const scale = 1 + Math.min((kp ?? 0) * 0.04, 0.35);
  const opacity = 0.22 + Math.min((kp ?? 0) * 0.04, 0.25);

  for (const line of data.lines) {
    const pts = line.points.map(
      (p) => new THREE.Vector3(p.x * scale, p.y * scale, p.z * scale),
    );
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(
      new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: 0x7eb8ff,
          transparent: true,
          opacity,
        }),
      ),
    );
  }
}