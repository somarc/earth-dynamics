import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLitMapEarthMaterial, loadEarthTextures } from './textures.js';
import { createLabelRenderer, makeLabel, resizeLabelRenderer } from './labels.js';
import {
  EARTH_RADIUS,
  EARTH_MEAN_RADIUS_KM,
  latLonToVector3,
  moonBodyRadiusScene,
  MOON_MEAN_DIST_KM,
  poleOffsetToTilt,
  iersPoleGlobePosition,
  magToSize,
  quakeMarkerPosition,
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
/** Large enough to read continents when the default camera sits just outside Earth. */
const HELIO_EARTH_RADIUS = 0.28;

function eclipticToScene(x, y, z) {
  return new THREE.Vector3(x * AU_SCALE, z * AU_SCALE, -y * AU_SCALE);
}

/**
 * Default Helio posture: over Earth's shoulder, Sun-focused, Earth large in the foreground.
 * Camera sits outside Earth's orbit looking sunward with a lateral/vertical offset so the
 * planet does not occult the star — same "you are here" energy as geo Live orientation.
 * @param {THREE.Vector3} earthPos Scene-space Earth position (Sun at origin).
 * @param {{ earthRadius?: number }} [opts]
 * @returns {{ position: THREE.Vector3, target: THREE.Vector3 }}
 */
export function frameHelioSunEarth(earthPos, opts = {}) {
  const earthR = opts.earthRadius ?? HELIO_EARTH_RADIUS;
  const dist = Math.max(earthPos.length(), 0.01);
  const radial = earthPos.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  let side = new THREE.Vector3().crossVectors(worldUp, radial);
  if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
  else side.normalize();
  const up = new THREE.Vector3().crossVectors(radial, side).normalize();

  // ~4–5 Earth radii outside the surface — globe fills the near field, not a distant speck.
  const back = Math.max(earthR * 4.6, dist * 0.09);
  const position = earthPos.clone()
    .add(radial.clone().multiplyScalar(back))
    .add(up.clone().multiplyScalar(back * 0.48))
    .add(side.clone().multiplyScalar(back * 1.05));

  // Look at the Sun (slight Earth bias keeps the planet in the lower frame).
  const target = earthPos.clone().multiplyScalar(0.05);

  return { position, target };
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
    /** When true, camera re-frames to Sun–Earth on ephemeris updates until user orbits. */
    this.autoFrame = true;
    this.userMovedCamera = false;
    this.ready = this.init(canvas);
  }

  async init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x060a12, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    // Slightly wider FOV so close Earth + distant Sun both read in one frame.
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.04, 500);
    // Placeholder until first ephemeris frame; framing uses Earth position.
    this.camera.position.set(0, 6, 16);
    this.camera.lookAt(0, 0, 0);

    const sunGeo = new THREE.SphereGeometry(0.42, 32, 32);
    this.sunMesh = new THREE.Mesh(
      sunGeo,
      new THREE.MeshBasicMaterial({ color: 0xffe066 })
    );
    this.scene.add(this.sunMesh);

    // Soft corona so the Sun remains a clear focus from Earth's shoulder.
    this.sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffb020,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.scene.add(this.sunGlow);

    this.sunLabel = makeLabel('Sun', 'body-label body-label--sun');
    this.sunLabel.position.set(0, 0.85, 0);
    this.sunMesh.add(this.sunLabel);

    // Strong sun light for lit-map Phong Earth (same lesson as geo navy-ambient fix).
    this.sunPointLight = new THREE.PointLight(0xfff4dd, 28, 80, 1.1);
    this.sunPointLight.position.set(0, 0, 0);
    this.scene.add(this.sunPointLight);

    // Thin ecliptic hint — fat ring washed out the close-up Sun–Earth shot.
    const eclipticPts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      eclipticPts.push(new THREE.Vector3(Math.cos(a) * AU_SCALE, 0, Math.sin(a) * AU_SCALE));
    }
    this.eclipticPlane = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(eclipticPts),
      new THREE.LineBasicMaterial({
        color: 0x3a5070,
        transparent: true,
        opacity: 0.28,
      }),
    );
    this.scene.add(this.eclipticPlane);

    const orbitLineGeo = new THREE.BufferGeometry();
    this.orbitTrail = new THREE.Line(
      orbitLineGeo,
      new THREE.LineBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.55 })
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

    const earthTextures = await loadEarthTextures(this.renderer);
    const earthGeo = new THREE.SphereGeometry(HELIO_EARTH_RADIUS, 64, 64);
    // Lit day map — sun lights drive the dayside (same language as geo lit-map / GE).
    this.earth = new THREE.Mesh(
      earthGeo,
      createLitMapEarthMaterial(earthTextures, {
        nightLights: true,
        nightEmissiveIntensity: 0.18,
        albedoBoost: 1.4,
        shininess: 10,
      }),
    );
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

    // True Moon/Earth size ratio on the exaggerated helio Earth.
    const moonR = moonBodyRadiusScene(HELIO_EARTH_RADIUS);
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(moonR, 20, 20),
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
    this.moonLabel.position.set(0, moonR + 0.04, 0);
    this.moonMesh.add(this.moonLabel);

    // Soft white fill so nightside continents still read (navy ambient killed geo lit-map).
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.14));
    this.hemiLight = new THREE.HemisphereLight(0xfff0cc, 0x0a1020, 0.28);
    this.scene.add(this.hemiLight);
    this.sunDirectional = new THREE.DirectionalLight(0xfff8ee, 3.2);
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
    this.defaultCameraPosition = new THREE.Vector3(0, 6, 16);
    this.defaultLookTarget = new THREE.Vector3(0, 0, 0);
    this.cameraEntry = null;

    // Very slow decorative spin — Live posture, not free-spin show.
    this.autoRotate = 0.0008;
    this.lodFactor = 1;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    // Allow close inspection of Earth; still let users pull back to full orbit.
    this.controls.minDistance = 0.9;
    this.controls.maxDistance = 56;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('start', () => {
      this.userMovedCamera = true;
      this.autoFrame = false;
    });

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

    // Light Earth from the Sun (origin → Earth is anti-sunward from surface? sun at 0, earth at earthPos)
    // Directional from Sun toward Earth: light position near origin, target = earth.
    this.sunDirectional.position.set(0, 0, 0);
    this.sunDirectional.target.position.copy(earthPos);
    this.sunDirectional.target.updateMatrixWorld();
    this.sunPointLight.position.set(0, 0, 0);

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
      // Direction from geocentric ecliptic; distance = real Earth-radii × helio Earth size
      // (Earth is oversized for readability, so AU-true moon would sit inside the mesh).
      const dir = eclipticToScene(
        ephemerisDay.moon.x,
        ephemerisDay.moon.y,
        ephemerisDay.moon.z,
      );
      if (dir.lengthSq() > 1e-16) dir.normalize();
      const km =
        ephemerisDay.lunar?.moonDistanceKm
        ?? ephemerisDay.moon.distKm
        ?? MOON_MEAN_DIST_KM;
      const re = (km > 0 ? km : MOON_MEAN_DIST_KM) / EARTH_MEAN_RADIUS_KM;
      const dist = HELIO_EARTH_RADIUS * re;
      this.moonMesh.position.copy(earthPos.clone().add(dir.multiplyScalar(dist)));
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

    // Keep Sun–Earth composition unless the user took the camera.
    if (this.autoFrame && !this.userMovedCamera && !this.cameraEntry) {
      this.frameSunEarth({ animate: false });
    }
  }

  /**
   * Default Helio posture: Sun is system focus; Earth sits large in the foreground.
   */
  frameSunEarth({ animate = false, duration = 560 } = {}) {
    if (!this.lastEarthPos || !this.controls) return false;
    const { position, target } = frameHelioSunEarth(this.lastEarthPos, {
      earthRadius: HELIO_EARTH_RADIUS,
    });
    this.defaultCameraPosition.copy(position);
    this.defaultLookTarget.copy(target);

    if (animate) {
      this.cameraEntry = {
        start: performance.now(),
        duration,
        fromPos: this.camera.position.clone(),
        toPos: position.clone(),
        fromTarget: this.controls.target.clone(),
        toTarget: target.clone(),
      };
    } else {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      this.cameraEntry = null;
    }
    return true;
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
      const pos = quakeMarkerPosition(q.lat, q.lon, q.depth, HELIO_EARTH_RADIUS);
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
    // Reset follow mode when entering Helio from Geo.
    this.userMovedCamera = false;
    this.autoFrame = true;
    if (this.lastEarthPos) {
      this.frameSunEarth({ animate: true, duration: 520 });
      return;
    }
    // No ephemeris yet — brief approach toward placeholder default.
    this.cameraEntry = {
      start: performance.now(),
      duration: 420,
      fromPos: this.camera.position.clone().multiplyScalar(1.08),
      toPos: this.defaultCameraPosition.clone(),
      fromTarget: this.controls?.target.clone() ?? new THREE.Vector3(),
      toTarget: this.defaultLookTarget.clone(),
    };
  }

  /** Re-engage Sun–Earth framing (e.g. Live mode / date change). */
  resetHelioFraming() {
    this.userMovedCamera = false;
    this.autoFrame = true;
    return this.frameSunEarth({ animate: true });
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
    const entry = this.cameraEntry;
    const toPos = entry.toPos || this.defaultCameraPosition;
    const fromPos = entry.fromPos || this.entryFromPos || this.camera.position;
    this.camera.position.lerpVectors(fromPos, toPos, eased);
    if (entry.fromTarget && entry.toTarget && this.controls) {
      this.controls.target.lerpVectors(entry.fromTarget, entry.toTarget, eased);
    } else if (this.controls) {
      this.controls.target.copy(this.defaultLookTarget);
    }
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