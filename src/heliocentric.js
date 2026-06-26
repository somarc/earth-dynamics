import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createEarthMaterial, loadEarthTextures } from './textures.js';
import { createLabelRenderer, makeLabel, resizeLabelRenderer } from './labels.js';
import {
  EARTH_RADIUS,
  latLonToVector3,
  poleOffsetToTilt,
  iersPoleGlobePosition,
  magToSize,
  veiToSize,
} from './utils.js';
import { buildCmeMarkers } from './cme-heliocentric.js';
import {
  createEventHalo,
  EventPulseController,
  shouldQuakeHalo,
  shouldVolcanoHalo,
} from './event-markers.js';

const OBLIQUITY = (23.4367 * Math.PI) / 180;
const AU_SCALE = 12;
const HELIO_EARTH_RADIUS = 0.14;
const MOON_GEO_SCALE = 140;

function eclipticToScene(x, y, z) {
  return new THREE.Vector3(x * AU_SCALE, z * AU_SCALE, -y * AU_SCALE);
}

export class HeliocentricScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.showQuakes = true;
    this.showVolcanoes = true;
    this.showTrail = true;
    this.showSpinPole = true;
    this.showMoon = true;
    this.showCme = true;
    this.ready = this.init(canvas);
  }

  async init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x060a12, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.camera.position.set(0, 8, 18);
    this.camera.lookAt(0, 0, 0);

    const sunGeo = new THREE.SphereGeometry(0.55, 32, 32);
    this.sunMesh = new THREE.Mesh(
      sunGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd54a })
    );
    this.scene.add(this.sunMesh);
    this.sunLabel = makeLabel('Sun', 'body-label body-label--sun');
    this.sunLabel.position.set(0, 0.75, 0);
    this.sunMesh.add(this.sunLabel);

    this.sunPointLight = new THREE.PointLight(0xfff4dd, 12, 200, 0.4);
    this.sunPointLight.position.set(0, 0, 0);
    this.scene.add(this.sunPointLight);

    const eclipticGeo = new THREE.RingGeometry(AU_SCALE * 0.95, AU_SCALE * 1.05, 128);
    const eclipticMat = new THREE.MeshBasicMaterial({
      color: 0x3a5070,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    this.eclipticPlane = new THREE.Mesh(eclipticGeo, eclipticMat);
    this.eclipticPlane.rotation.x = Math.PI / 2;
    this.scene.add(this.eclipticPlane);

    const orbitLineGeo = new THREE.BufferGeometry();
    this.orbitTrail = new THREE.Line(
      orbitLineGeo,
      new THREE.LineBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.4 })
    );
    this.scene.add(this.orbitTrail);

    this.earthSystem = new THREE.Group();
    this.scene.add(this.earthSystem);

    this.obliquityGroup = new THREE.Group();
    this.obliquityGroup.rotation.z = OBLIQUITY;
    this.earthSystem.add(this.obliquityGroup);

    this.axisGroup = new THREE.Group();
    this.obliquityGroup.add(this.axisGroup);

    this.surfaceGroup = new THREE.Group();
    this.axisGroup.add(this.surfaceGroup);

    const earthTextures = await loadEarthTextures();
    const scale = HELIO_EARTH_RADIUS / EARTH_RADIUS;
    const earthGeo = new THREE.SphereGeometry(HELIO_EARTH_RADIUS, 48, 48);
    this.earth = new THREE.Mesh(earthGeo, createEarthMaterial(earthTextures));
    this.surfaceGroup.add(this.earth);
    this.earthLabel = makeLabel('Earth', 'body-label body-label--earth');
    this.earthLabel.position.set(0, HELIO_EARTH_RADIUS + 0.18, 0);
    this.earthSystem.add(this.earthLabel);

    const axisPoints = [
      new THREE.Vector3(0, -HELIO_EARTH_RADIUS * 1.6, 0),
      new THREE.Vector3(0, HELIO_EARTH_RADIUS * 1.6, 0),
    ];
    this.rotationAxis = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(axisPoints),
      new THREE.LineBasicMaterial({ color: 0x4da3ff })
    );
    this.axisGroup.add(this.rotationAxis);

    const eclipticAxisPoints = [
      new THREE.Vector3(0, -AU_SCALE * 0.5, 0),
      new THREE.Vector3(0, AU_SCALE * 0.5, 0),
    ];
    this.eclipticNorthLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(eclipticAxisPoints),
      new THREE.LineBasicMaterial({ color: 0x667788, transparent: true, opacity: 0.35 })
    );
    this.scene.add(this.eclipticNorthLine);
    this.eclipticLabel = makeLabel('Ecliptic N', 'body-label body-label--muted');
    this.eclipticLabel.position.set(0, AU_SCALE * 0.52, 0);
    this.scene.add(this.eclipticLabel);

    const poleGeo = new THREE.SphereGeometry(0.02, 12, 12);
    this.poleMarker = new THREE.Mesh(
      poleGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    this.surfaceGroup.add(this.poleMarker);

    this.quakeGroup = new THREE.Group();
    this.surfaceGroup.add(this.quakeGroup);
    this.volcanoGroup = new THREE.Group();
    this.surfaceGroup.add(this.volcanoGroup);

    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xc8c8d8,
        roughness: 0.95,
        metalness: 0,
        emissive: 0x111118,
        emissiveIntensity: 0.1,
      })
    );
    this.scene.add(this.moonMesh);
    this.moonLabel = makeLabel('Moon', 'body-label body-label--moon');
    this.moonLabel.position.set(0, 0.08, 0);
    this.moonMesh.add(this.moonLabel);

    this.scene.add(new THREE.AmbientLight(0x1a2030, 0.06));
    this.hemiLight = new THREE.HemisphereLight(0xfff0cc, 0x080810, 0.22);
    this.scene.add(this.hemiLight);
    this.sunDirectional = new THREE.DirectionalLight(0xfff8ee, 5.5);
    this.sunDirectional.target = new THREE.Object3D();
    this.scene.add(this.sunDirectional);
    this.scene.add(this.sunDirectional.target);

    this.labelRenderer = createLabelRenderer(canvas.parentElement);
    this.labelRenderer.domElement.classList.add('label-layer--hidden');

    this.cmeGroup = new THREE.Group();
    this.scene.add(this.cmeGroup);

    this.stars = this.createStars();
    this.scene.add(this.stars);

    this.quakeMeshes = new Map();
    this.volcanoMeshes = new Map();
    this.eventPulses = new EventPulseController();
    this.defaultCameraPosition = new THREE.Vector3(0, 8, 18);
    this.cameraEntry = null;

    this.autoRotate = 0.008;
    this.lodFactor = 1;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 40;

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    return this;
  }

  createStars() {
    const count = 2000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 60 + Math.random() * 80;
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
      new THREE.PointsMaterial({ color: 0x8899aa, size: 0.08, sizeAttenuation: true })
    );
  }

  setLabelsVisible(visible) {
    if (this.labelRenderer) {
      this.labelRenderer.domElement.classList.toggle('label-layer--hidden', !visible);
    }
  }

  handleResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    if (this.labelRenderer) resizeLabelRenderer(this.labelRenderer, this.canvas.parentElement);
  }

  updatePoleMotion(eopRecord, _trailHistory) {
    const { tiltX, tiltZ } = poleOffsetToTilt(eopRecord.xRad, eopRecord.yRad);
    this.axisGroup.rotation.x = tiltX;
    this.axisGroup.rotation.z = tiltZ;

    const { lat: poleLat, lon: poleLon } = iersPoleGlobePosition(
      eopRecord.xArcsec,
      eopRecord.yArcsec,
    );
    const pos = latLonToVector3(poleLat, poleLon, HELIO_EARTH_RADIUS * 1.02);
    this.poleMarker.position.set(pos.x, pos.y, pos.z);
    this.poleMarker.visible = this.showSpinPole;
    this.lodFactor = 1 + eopRecord.lodSec / 86400;
  }

  setSpinPoleVisible(visible) {
    this.showSpinPole = visible;
    if (this.poleMarker) this.poleMarker.visible = visible;
  }

  setTrailVisible(visible) {
    this.showTrail = visible;
    if (this.orbitTrail) this.orbitTrail.visible = visible && this.orbitTrail.geometry?.attributes?.position?.count > 1;
  }

  setCmeEvents(events, viewDate) {
    this.cmeGroup.clear();
    if (!this.showCme || !this.lastEarthPos) return;
    const cmes = (events || []).filter((e) => e.eventType === 'CME');
    const markers = buildCmeMarkers(cmes, viewDate, this.lastEarthPos);
    this.cmeGroup.add(markers);
  }

  updateHeliocentric(ephemerisDay, orbitHistory = []) {
    if (!ephemerisDay?.earthHelio) return;

    const earthPos = eclipticToScene(
      ephemerisDay.earthHelio.x,
      ephemerisDay.earthHelio.y,
      ephemerisDay.earthHelio.z
    );
    this.lastEarthPos = earthPos;
    this.earthSystem.position.copy(earthPos);

    const sunDir = earthPos.clone().normalize();
    this.sunDirectional.position.copy(sunDir.clone().multiplyScalar(-50));
    this.sunDirectional.target.position.copy(earthPos);
    this.sunDirectional.target.updateMatrixWorld();

    if (orbitHistory.length > 1) {
      const pts = orbitHistory
        .filter((d) => d.earthHelio)
        .map((d) =>
          eclipticToScene(d.earthHelio.x, d.earthHelio.y, d.earthHelio.z)
        );
      this.orbitTrail.geometry.dispose();
      this.orbitTrail.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      this.orbitTrail.visible = this.showTrail;
    } else {
      this.orbitTrail.visible = false;
    }

    if (this.showMoon && ephemerisDay.moon) {
      const moonOffset = eclipticToScene(
        ephemerisDay.moon.x * MOON_GEO_SCALE,
        ephemerisDay.moon.y * MOON_GEO_SCALE,
        ephemerisDay.moon.z * MOON_GEO_SCALE
      );
      this.moonMesh.position.copy(earthPos.clone().add(moonOffset));
      this.moonMesh.visible = true;
      const illum = ephemerisDay.lunar?.illumination ?? 0.5;
      this.moonMesh.material.color.setRGB(
        0.45 + illum * 0.55,
        0.45 + illum * 0.55,
        0.48 + illum * 0.5
      );
      this.moonMesh.material.emissiveIntensity = 0.05 + illum * 0.12;
    } else {
      this.moonMesh.visible = false;
    }
  }

  setEarthquakes(quakes) {
    this.quakeGroup.clear();
    this.quakeMeshes.clear();
    if (!this.showQuakes) return;
    const s = HELIO_EARTH_RADIUS / EARTH_RADIUS;
    for (const q of quakes) {
      const size = magToSize(q.mag) * s;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 8),
        new THREE.MeshBasicMaterial({
          color: q.mag >= 7 ? 0xff2244 : q.mag >= 6 ? 0xff5c6a : 0xff8c99,
          transparent: true,
          opacity: 0.85,
        })
      );
      const pos = latLonToVector3(q.lat, q.lon, HELIO_EARTH_RADIUS * 1.02);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { ...q, pickType: 'earthquake' };
      this.quakeGroup.add(mesh);

      if (shouldQuakeHalo(q)) {
        const halo = createEventHalo(size, q.mag >= 7 ? 0xff2244 : 0xff5c6a);
        halo.position.copy(mesh.position);
        this.quakeGroup.add(halo);
      }

      this.quakeMeshes.set(q.id, mesh);
    }
  }

  setVolcanoes(volcs) {
    this.volcanoGroup.clear();
    this.volcanoMeshes.clear();
    if (!this.showVolcanoes) return;
    const s = HELIO_EARTH_RADIUS / EARTH_RADIUS;
    for (const v of volcs) {
      const size = veiToSize(v.vei) * s;
      const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(size, size * 2.5, 4),
        new THREE.MeshBasicMaterial({ color: v.continuing ? 0xff6600 : 0xff8c42 })
      );
      const pos = latLonToVector3(v.lat, v.lon, HELIO_EARTH_RADIUS * 1.03);
      mesh.position.set(pos.x, pos.y, pos.z);
      const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      mesh.userData = { ...v, pickType: 'volcano' };
      this.volcanoGroup.add(mesh);

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

  updateCameraEntry(now) {
    if (!this.cameraEntry) return;
    const t = Math.min(1, (now - this.cameraEntry.start) / this.cameraEntry.duration);
    const eased = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.entryFromPos, this.defaultCameraPosition, eased);
    this.controls.target.set(0, 0, 0);
    if (t >= 1) this.cameraEntry = null;
  }

  updateBodies() {}

  render(delta) {
    const now = performance.now();
    this.surfaceGroup.rotation.y += this.autoRotate * this.lodFactor;
    this.updateCameraEntry(now);
    this.eventPulses.update(now);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.labelRenderer) {
      this.labelRenderer.render(this.scene, this.camera);
    }
  }
}