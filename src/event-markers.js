import * as THREE from 'three';

const PULSE_DURATION_MS = 900;

export function shouldQuakeHalo(quake) {
  return (quake.mag ?? 0) >= 6;
}

export function shouldVolcanoHalo(volcano) {
  return volcano.continuing || (volcano.vei ?? 0) >= 3;
}

export function createEventHalo(baseSize, color, scale = 2.2) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(baseSize * scale, 14, 14),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

export class EventPulseController {
  constructor() {
    this.pulses = [];
  }

  add(mesh, { color = 0xffffff, maxScale = 2.4 } = {}) {
    if (!mesh) return;
    this.pulses.push({
      mesh,
      color,
      maxScale,
      start: performance.now(),
      duration: PULSE_DURATION_MS,
    });
  }

  trigger(meshes, { filter = () => true, color = 0xffffff, maxScale = 2.4 } = {}) {
    for (const mesh of meshes) {
      if (filter(mesh.userData)) this.add(mesh, { color, maxScale });
    }
  }

  update(now) {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i];
      const t = (now - pulse.start) / pulse.duration;
      if (t >= 1) {
        pulse.mesh.scale.setScalar(1);
        if (pulse.mesh.material.opacity != null) {
          pulse.mesh.material.opacity = pulse.baseOpacity ?? 0.85;
        }
        this.pulses.splice(i, 1);
        continue;
      }
      const eased = 1 - (1 - t) ** 2;
      const scale = 1 + eased * (pulse.maxScale - 1);
      pulse.mesh.scale.setScalar(scale);
      if (pulse.mesh.material.opacity != null) {
        if (pulse.baseOpacity == null) pulse.baseOpacity = pulse.mesh.material.opacity;
        pulse.mesh.material.opacity = pulse.baseOpacity * (1 - eased * 0.35);
      }
    }
  }
}