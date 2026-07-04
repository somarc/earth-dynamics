import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const RADIUS = EARTH_RADIUS * 1.008;

function tempColor(tempC) {
  if (tempC == null) return 0x445566;
  const t = Math.max(-5, Math.min(40, tempC));
  const u = (t + 5) / 45;
  const r = Math.round(30 + u * 220);
  const g = Math.round(70 + (1 - Math.abs(u - 0.5) * 1.6) * 130);
  const b = Math.round(200 - u * 170);
  return (r << 16) | (g << 8) | b;
}

export function buildOceanTempGridGroup(grid) {
  const group = new THREE.Group();
  const points = grid?.points ?? [];
  if (!points.length) return group;

  const positions = [];
  const colors = [];
  const color = new THREE.Color();

  for (const p of points) {
    if (p.tempC == null) continue;
    const pos = latLonToVector3(p.lat, p.lon, RADIUS);
    positions.push(pos.x, pos.y, pos.z);
    color.setHex(tempColor(p.tempC));
    colors.push(color.r, color.g, color.b);
  }

  if (positions.length < 3) return group;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.028,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    sizeAttenuation: true,
  });
  group.add(new THREE.Points(geo, mat));
  group.userData.gridNote = grid.note ?? 'ERA5 tropical grid';
  return group;
}