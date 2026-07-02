import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from '../../src/utils.js';

const RADIUS = EARTH_RADIUS * 1.014;

function windColor(windKts, sshs) {
  if (sshs != null && sshs >= 3) return 0xff2244;
  if (sshs != null && sshs >= 1) return 0xff8844;
  if (windKts != null && windKts >= 64) return 0xff5544;
  if (windKts != null && windKts >= 34) return 0xffaa44;
  return 0x7eb8da;
}

function trackPoints(track, viewDate) {
  const pts = (track || []).filter((p) => !viewDate || p.date <= viewDate);
  return pts.length >= 2 ? pts : [];
}

export function buildCycloneGroup(storms, viewDate) {
  const group = new THREE.Group();
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const storm of storms || []) {
    const pts = trackPoints(storm.track, viewDate);
    if (pts.length < 2) continue;

    const vectors = pts.map((p) => {
      const v = latLonToVector3(p.lat, p.lon, RADIUS);
      return new THREE.Vector3(v.x, v.y, v.z);
    });

    const color = windColor(storm.maxWindKts, storm.maxSshs);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(vectors),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.82, linewidth: 2 }),
    );
    group.add(line);

    const head = pts.at(-1);
    const headPos = latLonToVector3(head.lat, head.lon, RADIUS * 1.006);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 10, 10),
      new THREE.MeshBasicMaterial({ color }),
    );
    marker.position.set(headPos.x, headPos.y, headPos.z);
    const payload = { ...storm, pickType: 'cyclone', head };
    marker.userData = payload;
    group.add(marker);

    const pick = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), pickMat);
    pick.position.copy(marker.position);
    pick.userData = payload;
    group.add(pick);
  }

  return group;
}

export function cycloneInspectLabel(storm) {
  const wind = storm.maxWindKts != null ? `${Math.round(storm.maxWindKts)} kt` : '—';
  const cat = storm.maxSshs != null && storm.maxSshs >= 0 ? `Cat ${storm.maxSshs}` : '';
  return `${storm.name || 'Unnamed'} (${storm.season || '—'}) · ${wind} ${cat}`.trim();
}