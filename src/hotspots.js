import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

export async function loadHotspots(url = '/data/hotspots.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hotspots ${res.status}`);
  return res.json();
}

export function buildHotspotGroup(data, radius = EARTH_RADIUS * 1.017) {
  const group = new THREE.Group();
  const ringGeo = new THREE.RingGeometry(0.008, 0.014, 16);
  const coreGeo = new THREE.SphereGeometry(0.007, 12, 12);

  for (const hs of data.hotspots || []) {
    const pos = latLonToVector3(hs.lat, hs.lon, radius);
    const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();

    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff5533,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      }),
    );
    ring.position.set(pos.x, pos.y, pos.z);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    ring.userData = hs;

    const core = new THREE.Mesh(
      coreGeo,
      new THREE.MeshBasicMaterial({ color: 0xffaa66 }),
    );
    core.position.set(pos.x, pos.y, pos.z);
    core.userData = hs;

    group.add(ring);
    group.add(core);
  }

  return group;
}