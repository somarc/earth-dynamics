import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const CACHE_MS = 5 * 60 * 1000;

let cache = { at: 0, data: null };

export async function fetchOvation() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  const res = await fetch(OVATION_URL);
  if (!res.ok) throw new Error(`OVATION ${res.status}`);
  const data = await res.json();
  cache = { at: Date.now(), data };
  return data;
}

export function isOvationCurrent(dateStr) {
  if (!dateStr) return false;
  const viewed = new Date(`${dateStr}T12:00:00Z`).getTime();
  const now = Date.now();
  return Math.abs(now - viewed) < 2 * 86400000;
}

export function updateOvationAurora(group, ovationData, visible, minProb = 15) {
  group.clear();
  if (!visible || !ovationData?.coordinates?.length) return;

  const north = [];
  const south = [];
  for (const [lon, lat, prob] of ovationData.coordinates) {
    if (prob < minProb) continue;
    const list = lat >= 0 ? north : south;
    list.push({ lon, lat: Math.abs(lat), prob });
  }

  const addHemisphere = (points, colorBase) => {
    if (!points.length) return;
    const positions = [];
    const colors = [];
    for (const p of points) {
      const pos = latLonToVector3(p.lat, p.lon, EARTH_RADIUS * 1.009);
      positions.push(pos.x, pos.y, pos.z);
      const t = Math.min(1, p.prob / 80);
      colors.push(colorBase.r * t, colorBase.g * t, colorBase.b * t);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.018,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    group.add(new THREE.Points(geo, mat));
  };

  addHemisphere(north, new THREE.Color(0.36, 1, 0.55));
  addHemisphere(south, new THREE.Color(1, 0.42, 0.62));
}

export function ovationEquatorwardEdge(ovationData, minProb = 20) {
  if (!ovationData?.coordinates?.length) return null;
  let northEdge = 90;
  let southEdge = 90;
  for (const [, lat, prob] of ovationData.coordinates) {
    if (prob < minProb) continue;
    if (lat > 0) northEdge = Math.min(northEdge, lat);
    if (lat < 0) southEdge = Math.min(southEdge, Math.abs(lat));
  }
  const edge = Math.min(northEdge, southEdge);
  return edge < 90 ? edge : null;
}