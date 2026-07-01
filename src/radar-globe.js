import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const SURFACE_RADIUS = EARTH_RADIUS * 1.006;
const RING_RADIUS = EARTH_RADIUS * 1.005;
const EARTH_RADIUS_KM = 6371;

function destinationPoint(lat, lon, bearingDeg, distanceKm) {
  const d2r = Math.PI / 180;
  const lat1 = lat * d2r;
  const lon1 = lon * d2r;
  const brng = bearingDeg * d2r;
  const d = distanceKm / EARTH_RADIUS_KM;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: lat2 / d2r, lon: lon2 / d2r };
}

function coverageRingPoints(lat, lon, rangeKm, segments = 72) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (i / segments) * 360;
    pts.push(destinationPoint(lat, lon, bearing, rangeKm));
  }
  return pts;
}

function networkColor(site) {
  if (site.country === 'CA') return 0xff8866;
  if (site.stationType === 'TDWR') return 0x66c8e8;
  return 0x5ad4a8;
}

export async function loadRadarSites(url = '/data/radar-sites.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Radar sites ${res.status}`);
  return res.json();
}

export function buildRadarSiteGroup(data, { showRings = true } = {}) {
  const group = new THREE.Group();
  group.userData.about = data.about || null;
  group.userData.coverageNote = data.coverageNote || null;

  const pickMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const site of data.sites || []) {
    if (site.lat == null || site.lon == null) continue;

    const color = networkColor(site);
    const anchor = latLonToVector3(site.lat, site.lon, SURFACE_RADIUS);
    const payload = { ...site, pickType: 'radar' };

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(site.stationType === 'TDWR' ? 0.007 : 0.009, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }),
    );
    dot.position.set(anchor.x, anchor.y, anchor.z);
    dot.userData = payload;
    group.add(dot);

    if (showRings && site.rangeKmNominal > 0) {
      const ringPts = coverageRingPoints(site.lat, site.lon, site.rangeKmNominal).map((p) => {
        const v = latLonToVector3(p.lat, p.lon, RING_RADIUS);
        return new THREE.Vector3(v.x, v.y, v.z);
      });
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      const ring = new THREE.Line(
        ringGeo,
        new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity: site.country === 'CA' ? 0.28 : 0.22,
          dashSize: 0.018,
          gapSize: 0.012,
        }),
      );
      ring.computeLineDistances();
      ring.userData = { ...payload, pickType: 'radar-ring' };
      group.add(ring);
    }

    const pick = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), pickMat);
    pick.position.set(anchor.x, anchor.y, anchor.z);
    pick.userData = payload;
    group.add(pick);
  }

  return group;
}

export function radarSiteLabel(site) {
  const range = site.rangeKmNominal != null ? `${site.rangeKmNominal} km ring` : '—';
  return `${site.siteId} · ${site.name} (${site.network}) — nominal ${range}`;
}