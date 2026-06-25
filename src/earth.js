import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createEarthMaterial, loadEarthTextures } from './textures.js';
import {
  EARTH_RADIUS,
  latLonToVector3,
  poleOffsetToTilt,
  magToSize,
  veiToSize,
} from './utils.js';
import { updateAuroraRings } from './space-weather.js';
import { updateOvationAurora } from './ovation.js';
import { loadIgrfFieldLines, updateIgrfFieldLines } from './igrf.js';
import { loadPlateBoundaries, buildPlateGroup, loadPlateMotion, buildMotionGroup } from './plates.js';
import { loadHotspots, buildHotspotGroup } from './hotspots.js';
import { classifyPick } from './event-inspect.js';
import { createAtmosphereShell, updateAtmosphereSun } from './atmosphere.js';
import {
  createEventHalo,
  EventPulseController,
  shouldQuakeHalo,
  shouldVolcanoHalo,
} from './event-markers.js';

export class EarthScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.showQuakes = true;
    this.showVolcanoes = true;
    this.showTrail = true;
    this.showBodies = true;
    this.showAurora = true;
    this.showFieldLines = true;
    this.showPlates = true;
    this.showPlateMotion = true;
    this.showHotspots = true;
    this.ready = this.init(canvas);
  }

  async init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x060a12, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0.3, 2.8);
    this.camera.lookAt(0, 0, 0);

    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    this.surfaceGroup = new THREE.Group();
    this.earthGroup.add(this.surfaceGroup);

    const earthTextures = await loadEarthTextures();
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMat = createEarthMaterial(earthTextures);
    this.earth = new THREE.Mesh(earthGeo, earthMat);
    this.surfaceGroup.add(this.earth);

    // Inertial shell — does not spin with surfaceGroup so limb tracks ephemeris sun.
    this.atmosphere = createAtmosphereShell(EARTH_RADIUS);
    this.earthGroup.add(this.atmosphere);

    const gridGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.001, 32, 16);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x3a5070,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    this.grid = new THREE.Mesh(gridGeo, gridMat);
    this.surfaceGroup.add(this.grid);

    this.axisGroup = new THREE.Group();
    this.earthGroup.add(this.axisGroup);

    const axisMat = new THREE.LineBasicMaterial({ color: 0x4da3ff, linewidth: 2 });
    const axisPoints = [
      new THREE.Vector3(0, -EARTH_RADIUS * 1.4, 0),
      new THREE.Vector3(0, EARTH_RADIUS * 1.4, 0),
    ];
    this.rotationAxis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(axisPoints),
      axisMat
    );
    this.axisGroup.add(this.rotationAxis);

    const poleGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const poleMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.poleMarker = new THREE.Mesh(poleGeo, poleMat);
    this.surfaceGroup.add(this.poleMarker);

    const trailMax = 2000;
    const trailPositions = new Float32Array(trailMax * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setDrawRange(0, 0);
    this.trailLine = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.5 })
    );
    this.surfaceGroup.add(this.trailLine);
    this.trailPositions = trailPositions;
    this.trailCount = 0;

    this.quakeGroup = new THREE.Group();
    this.surfaceGroup.add(this.quakeGroup);
    this.volcanoGroup = new THREE.Group();
    this.surfaceGroup.add(this.volcanoGroup);
    this.auroraGroup = new THREE.Group();
    this.surfaceGroup.add(this.auroraGroup);
    this.plateGroup = new THREE.Group();
    this.surfaceGroup.add(this.plateGroup);
    this.plateMotionGroup = new THREE.Group();
    this.surfaceGroup.add(this.plateMotionGroup);
    this.hotspotGroup = new THREE.Group();
    this.surfaceGroup.add(this.hotspotGroup);
    this.fieldLinesGroup = new THREE.Group();
    this.axisGroup.add(this.fieldLinesGroup);
    this.igrfFieldData = null;
    try {
      this.igrfFieldData = await loadIgrfFieldLines();
    } catch (err) {
      console.warn('IGRF field lines unavailable:', err);
    }

    try {
      const [plateGeo, motionData] = await Promise.all([
        loadPlateBoundaries(),
        loadPlateMotion().catch(() => null),
      ]);
      this.plateGroup.add(buildPlateGroup(plateGeo));
      this.plateGroup.visible = this.showPlates;
      if (motionData) {
        this.plateMotionGroup.add(buildMotionGroup(motionData));
        this.plateMotionGroup.userData.about = motionData.about ?? null;
        this.plateMotionGroup.visible = this.showPlates && this.showPlateMotion;
      }
    } catch (err) {
      console.warn('Plate boundaries unavailable:', err);
    }

    try {
      const hotspotData = await loadHotspots();
      this.hotspotGroup.add(buildHotspotGroup(hotspotData));
      this.hotspotGroup.userData.about = hotspotData.about ?? null;
      this.hotspotGroup.visible = this.showHotspots;
    } catch (err) {
      console.warn('Hotspots unavailable:', err);
    }

    this.bodiesGroup = new THREE.Group();
    this.earthGroup.add(this.bodiesGroup);

    const moonGeo = new THREE.SphereGeometry(0.09, 24, 24);
    this.moonMesh = new THREE.Mesh(
      moonGeo,
      new THREE.MeshPhongMaterial({ color: 0xc8c8d8, shininess: 4 })
    );
    this.bodiesGroup.add(this.moonMesh);

    const sunGeo = new THREE.SphereGeometry(0.14, 16, 16);
    this.sunMarker = new THREE.Mesh(
      sunGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd54a })
    );
    this.bodiesGroup.add(this.sunMarker);

    const sunLineGeo = new THREE.BufferGeometry();
    this.sunLine = new THREE.Line(
      sunLineGeo,
      new THREE.LineBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.35 })
    );
    this.bodiesGroup.add(this.sunLine);

    const orbitGeo = new THREE.RingGeometry(2.75, 2.85, 96);
    this.moonOrbitRing = new THREE.Mesh(
      orbitGeo,
      new THREE.MeshBasicMaterial({
        color: 0x667788,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      })
    );
    this.moonOrbitRing.rotation.x = Math.PI / 2;
    this.bodiesGroup.add(this.moonOrbitRing);

    this.quakeMeshes = new Map();
    this.volcanoMeshes = new Map();
    this.eventPulses = new EventPulseController();
    this.defaultCameraPosition = new THREE.Vector3(0, 0.3, 2.8);
    this.cameraEntry = null;

    this.ambientLight = new THREE.AmbientLight(0x223344, 0.28);
    this.scene.add(this.ambientLight);
    this.sunLight = new THREE.DirectionalLight(0xfff8ee, 1.85);
    this.sunLight.position.set(5, 3, 5);
    this.scene.add(this.sunLight);
    this.fillLight = new THREE.DirectionalLight(0x4da3ff, 0.12);
    this.fillLight.position.set(-3, -1, -4);
    this.scene.add(this.fillLight);
    this.defaultSunDirection = new THREE.Vector3(5, 3, 5).normalize();

    this.stars = this.createStars();
    this.scene.add(this.stars);

    this.autoRotate = 0.002;
    this.baseSpin = 0;
    this.lodFactor = 1;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 6;
    this.controls.enablePan = false;

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    return this;
  }

  createStars() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 20 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0x8899aa, size: 0.03, sizeAttenuation: true })
    );
  }

  handleResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  updatePoleMotion(eopRecord, trailHistory) {
    const { tiltX, tiltZ } = poleOffsetToTilt(eopRecord.xRad, eopRecord.yRad);
    this.axisGroup.rotation.x = tiltX;
    this.axisGroup.rotation.z = tiltZ;

    const m1 = eopRecord.xArcsec / 3600;
    const m2 = -eopRecord.yArcsec / 3600;
    const poleDist = Math.sqrt(m1 * m1 + m2 * m2);
    const poleLat = 90 - poleDist;
    const poleLon = (Math.atan2(m1, m2) * 180) / Math.PI;
    const pos = latLonToVector3(poleLat, poleLon, EARTH_RADIUS * 1.01);
    this.poleMarker.position.set(pos.x, pos.y, pos.z);

    if (this.showTrail && trailHistory.length) {
      const count = Math.min(trailHistory.length, this.trailPositions.length / 3);
      for (let i = 0; i < count; i++) {
        const r = trailHistory[trailHistory.length - count + i];
        const tm1 = r.xArcsec / 3600;
        const tm2 = -r.yArcsec / 3600;
        const dist = Math.sqrt(tm1 * tm1 + tm2 * tm2);
        const lat = 90 - dist;
        const lon = (Math.atan2(tm1, tm2) * 180) / Math.PI;
        const v = latLonToVector3(lat, lon, EARTH_RADIUS * 1.008);
        this.trailPositions[i * 3] = v.x;
        this.trailPositions[i * 3 + 1] = v.y;
        this.trailPositions[i * 3 + 2] = v.z;
      }
      this.trailLine.geometry.attributes.position.needsUpdate = true;
      this.trailLine.geometry.setDrawRange(0, count);
      this.trailLine.visible = true;
    } else {
      this.trailLine.visible = false;
    }

    this.lodFactor = 1 + eopRecord.lodSec / 86400;
  }

  setEarthquakes(quakes) {
    this.quakeGroup.clear();
    this.quakeMeshes.clear();
    if (!this.showQuakes) return;

    const pickMat = new THREE.MeshBasicMaterial({ visible: false });

    for (const q of quakes) {
      const size = magToSize(q.mag);
      const geo = new THREE.SphereGeometry(size, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: q.mag >= 7 ? 0xff2244 : q.mag >= 6 ? 0xff5c6a : 0xff8c99,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = latLonToVector3(q.lat, q.lon, EARTH_RADIUS * 1.015);
      mesh.position.set(pos.x, pos.y, pos.z);
      const payload = { ...q, pickType: 'earthquake' };
      mesh.userData = payload;
      this.quakeGroup.add(mesh);

      const pick = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(size * 2.8, 0.022), 8, 8),
        pickMat,
      );
      pick.position.copy(mesh.position);
      pick.userData = payload;
      this.quakeGroup.add(pick);

      if (shouldQuakeHalo(q)) {
        const halo = createEventHalo(size, q.mag >= 7 ? 0xff2244 : 0xff5c6a);
        halo.position.copy(mesh.position);
        this.quakeGroup.add(halo);
      }

      this.quakeMeshes.set(q.id, mesh);
    }
  }

  updateSunLighting(ephemerisDay) {
    const sunDir = ephemerisDay?.sun
      ? new THREE.Vector3(ephemerisDay.sun.x, ephemerisDay.sun.y, ephemerisDay.sun.z).normalize()
      : this.defaultSunDirection;
    const sunDistance = 9;
    this.sunLight.position.copy(sunDir).multiplyScalar(sunDistance);
    this.sunLight.intensity = ephemerisDay?.sun ? 2.0 : 1.5;
    this.fillLight.position.copy(sunDir).multiplyScalar(-sunDistance * 0.7);
    this.fillLight.intensity = 0.1 + (ephemerisDay?.lunar?.illumination ?? 0.25) * 0.08;
    updateAtmosphereSun(this.atmosphere, sunDir);
  }

  updateBodies(ephemerisDay) {
    this.updateSunLighting(ephemerisDay);

    if (!ephemerisDay || !this.showBodies) {
      this.bodiesGroup.visible = false;
      return;
    }

    this.bodiesGroup.visible = true;
    const moonDist = 2.8;
    const sunDist = 7.5;

    if (ephemerisDay.moon) {
      const m = new THREE.Vector3(
        ephemerisDay.moon.x,
        ephemerisDay.moon.y,
        ephemerisDay.moon.z
      ).normalize();
      this.moonMesh.position.copy(m.multiplyScalar(moonDist));
      const illum = ephemerisDay.lunar?.illumination ?? 0.5;
      this.moonMesh.material.color.setRGB(
        0.55 + illum * 0.45,
        0.55 + illum * 0.45,
        0.58 + illum * 0.4
      );
    }

    if (ephemerisDay.sun) {
      const s = new THREE.Vector3(
        ephemerisDay.sun.x,
        ephemerisDay.sun.y,
        ephemerisDay.sun.z
      ).normalize();
      this.sunMarker.position.copy(s.clone().multiplyScalar(sunDist));
      const pts = [new THREE.Vector3(0, 0, 0), s.clone().multiplyScalar(sunDist * 0.95)];
      this.sunLine.geometry.dispose();
      this.sunLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }
  }

  setPlatesVisible(visible) {
    this.showPlates = visible;
    if (this.plateGroup) this.plateGroup.visible = visible;
    this.updatePlateMotionVisible();
  }

  setHotspotsVisible(visible) {
    this.showHotspots = visible;
    if (this.hotspotGroup) this.hotspotGroup.visible = visible;
  }

  setPlateMotionVisible(visible) {
    this.showPlateMotion = visible;
    this.updatePlateMotionVisible();
  }

  updatePlateMotionVisible() {
    if (this.plateMotionGroup) {
      this.plateMotionGroup.visible = this.showPlates && this.showPlateMotion;
    }
  }

  setSpaceWeather(geomagnetic, { ovationData = null } = {}) {
    const kp = geomagnetic?.kpMax ?? null;
    const useOvation = this.showAurora && ovationData?.coordinates?.length;
    if (useOvation) {
      this.auroraGroup.clear();
      updateOvationAurora(this.auroraGroup, ovationData, true);
    } else {
      updateAuroraRings(this.auroraGroup, kp, this.showAurora);
    }
    updateIgrfFieldLines(this.fieldLinesGroup, kp, this.showFieldLines, this.igrfFieldData);
  }

  setVolcanoes(volcs) {
    this.volcanoGroup.clear();
    this.volcanoMeshes.clear();
    if (!this.showVolcanoes) return;

    const coneGeo = new THREE.ConeGeometry(0.012, 0.03, 4);
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const v of volcs) {
      const size = veiToSize(v.vei);
      const mat = new THREE.MeshBasicMaterial({
        color: v.continuing ? 0xff6600 : 0xff8c42,
      });
      const mesh = new THREE.Mesh(coneGeo.clone(), mat);
      mesh.scale.set(size / 0.012, size / 0.012, size / 0.012);
      const pos = latLonToVector3(v.lat, v.lon, EARTH_RADIUS * 1.02);
      mesh.position.set(pos.x, pos.y, pos.z);
      const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const payload = { ...v, pickType: 'volcano' };
      mesh.userData = payload;
      this.volcanoGroup.add(mesh);

      const pick = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(size * 2.5, 0.024), 8, 8),
        pickMat,
      );
      pick.position.copy(mesh.position);
      pick.userData = payload;
      this.volcanoGroup.add(pick);

      if (shouldVolcanoHalo(v)) {
        const halo = createEventHalo(size, v.continuing ? 0xff6600 : 0xff8c42, 2.6);
        halo.position.copy(mesh.position);
        halo.quaternion.copy(mesh.quaternion);
        this.volcanoGroup.add(halo);
      }

      this.volcanoMeshes.set(v.id, mesh);
    }
  }

  beginViewEntry() {
    this.cameraEntry = { start: performance.now(), duration: 420 };
    this.entryFromPos = this.camera.position.clone();
    if (this.entryFromPos.distanceTo(this.defaultCameraPosition) < 0.05) {
      this.entryFromPos.copy(this.defaultCameraPosition).multiplyScalar(1.12);
    }
  }

  triggerDayPulse() {
    this.eventPulses.trigger(this.quakeMeshes.values(), {
      filter: (d) => shouldQuakeHalo(d),
      color: 0xff5c6a,
      maxScale: 1.85,
    });
    this.eventPulses.trigger(this.volcanoMeshes.values(), {
      filter: (d) => shouldVolcanoHalo(d),
      color: 0xff8844,
      maxScale: 1.7,
    });
  }

  setPointerFromClient(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return rect;
  }

  getHotspotAbout() {
    return this.hotspotGroup?.userData?.about ?? null;
  }

  getPlateMotionAbout() {
    return this.plateMotionGroup?.userData?.about ?? null;
  }

  hoverPickAt(clientX, clientY) {
    const rect = this.setPointerFromClient(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const meshLayers = [
      { visible: this.showHotspots, group: this.hotspotGroup },
      { visible: this.showQuakes, group: this.quakeGroup },
      { visible: this.showVolcanoes, group: this.volcanoGroup },
      { visible: this.showPlates && this.showPlateMotion, group: this.plateMotionGroup },
    ];

    for (const layer of meshLayers) {
      if (!layer.visible || !layer.group?.visible) continue;
      const hits = this.raycaster.intersectObjects(layer.group.children, true);
      for (const hit of hits) {
        const picked = classifyPick(hit);
        if (picked) {
          return {
            ...picked,
            x: clientX - rect.left,
            y: clientY - rect.top,
          };
        }
      }
    }

    if (this.showPlates && this.plateGroup?.visible) {
      this.raycaster.params.Line.threshold = 0.018;
      const hits = this.raycaster.intersectObjects(this.plateGroup.children, false);
      if (hits.length) {
        const p = hits[0].object.userData;
        if (p?.Name) {
          return {
            type: 'plate-boundary',
            data: {
              name: p.Name,
              plates: `${p.PlateA || '?'}–${p.PlateB || '?'}`,
              type: p.Type || 'transform / ridge',
            },
            x: clientX - rect.left,
            y: clientY - rect.top,
          };
        }
      }
    }

    return null;
  }

  pickAt(clientX, clientY) {
    return this.hoverPickAt(clientX, clientY);
  }

  updateCameraEntry(now) {
    if (!this.cameraEntry) return;
    const t = Math.min(1, (now - this.cameraEntry.start) / this.cameraEntry.duration);
    const eased = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.entryFromPos, this.defaultCameraPosition, eased);
    this.controls.target.set(0, 0, 0);
    if (t >= 1) this.cameraEntry = null;
  }

  render(delta) {
    const now = performance.now();
    const spin = this.baseSpin + this.autoRotate * this.lodFactor;
    this.surfaceGroup.rotation.y += spin;
    // Field lines are body-fixed to the dipole / spin axis — co-rotate with geography.
    if (this.fieldLinesGroup?.visible) {
      this.fieldLinesGroup.rotation.y += spin;
    }
    this.updateCameraEntry(now);
    this.eventPulses.update(now);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}