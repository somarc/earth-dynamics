import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadEarthTexture } from './textures.js';
import {
  EARTH_RADIUS,
  latLonToVector3,
  poleOffsetToTilt,
  magToSize,
  veiToSize,
} from './utils.js';

export class EarthScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.showQuakes = true;
    this.showVolcanoes = true;
    this.showTrail = true;
    this.showBodies = true;
    this.ready = this.init(canvas);
  }

  async init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x060a12, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0.3, 2.8);
    this.camera.lookAt(0, 0, 0);

    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    this.surfaceGroup = new THREE.Group();
    this.earthGroup.add(this.surfaceGroup);

    const earthTexture = await loadEarthTexture();
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 8,
      specular: new THREE.Color(0x223344),
    });
    this.earth = new THREE.Mesh(earthGeo, earthMat);
    this.surfaceGroup.add(this.earth);

    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 64);
    const atmosMat = new THREE.MeshPhongMaterial({
      color: 0x4da3ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    this.atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    this.surfaceGroup.add(this.atmosphere);

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

    const ambLight = new THREE.AmbientLight(0x334466, 0.6);
    this.scene.add(ambLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(5, 3, 5);
    this.scene.add(sunLight);
    const rimLight = new THREE.DirectionalLight(0x4da3ff, 0.3);
    rimLight.position.set(-3, -1, -4);
    this.scene.add(rimLight);

    this.stars = this.createStars();
    this.scene.add(this.stars);

    this.autoRotate = 0.002;
    this.baseSpin = 0;
    this.lodFactor = 1;

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
      mesh.userData = q;
      this.quakeGroup.add(mesh);
      this.quakeMeshes.set(q.id, mesh);
    }
  }

  updateBodies(ephemerisDay) {
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

  setVolcanoes(volcs) {
    this.volcanoGroup.clear();
    this.volcanoMeshes.clear();
    if (!this.showVolcanoes) return;

    const coneGeo = new THREE.ConeGeometry(0.012, 0.03, 4);
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
      mesh.userData = v;
      this.volcanoGroup.add(mesh);
      this.volcanoMeshes.set(v.id, mesh);
    }
  }

  render(delta) {
    this.surfaceGroup.rotation.y += this.baseSpin + this.autoRotate * this.lodFactor;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}