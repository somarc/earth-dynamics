import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const RADIUS = EARTH_RADIUS * 1.01;

function tempColor(tempC) {
  if (tempC == null) return 0x8899aa;
  const t = Math.max(-30, Math.min(45, tempC));
  const u = (t + 30) / 75;
  const r = Math.round(40 + u * 215);
  const g = Math.round(80 + (1 - Math.abs(u - 0.45) * 2) * 120);
  const b = Math.round(180 - u * 150);
  return (r << 16) | (g << 8) | b;
}

export function buildWeatherGlyphGroup(readings) {
  const group = new THREE.Group();
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const w of readings || []) {
    if (w.lat == null || w.lon == null) continue;
    const pos = latLonToVector3(w.lat, w.lon, RADIUS);
    const size = 0.012 + Math.min((w.windMaxKmh ?? 0) / 120, 1) * 0.014;
    const color = tempColor(w.tempMaxC);

    const glyph = new THREE.Mesh(
      new THREE.SphereGeometry(size, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88 }),
    );
    glyph.position.set(pos.x, pos.y, pos.z);
    const payload = { ...w, pickType: 'weather' };
    glyph.userData = payload;
    group.add(glyph);

    const pick = new THREE.Mesh(new THREE.SphereGeometry(size * 2.2, 8, 8), pickMat);
    pick.position.copy(glyph.position);
    pick.userData = payload;
    group.add(pick);
  }

  return group;
}

export function weatherGlyphLabel(w) {
  const temp = w.tempMaxC != null ? `${w.tempMaxC.toFixed(0)}°C` : '—';
  const wind = w.windMaxKmh != null ? `${w.windMaxKmh.toFixed(0)} km/h` : '—';
  return `${w.label || w.gridId}: ${temp}, wind ${wind}`;
}