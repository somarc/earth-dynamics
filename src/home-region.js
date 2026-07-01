import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const PATCH_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const PATCH_FRAGMENT_SHADER = `
uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uHillshadeMap;
uniform vec3 uSunDirection;
uniform float uHasNightMap;
uniform float uHasHillshade;
uniform float uHillshadeStrength;

varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
  vec3 sunDir = normalize(uSunDirection);
  vec3 normal = normalize(vWorldNormal);
  float sunDot = dot(normal, sunDir);

  float dayMix = smoothstep(-0.12, 0.42, sunDot);
  float twilight = smoothstep(-0.38, 0.08, sunDot) * (1.0 - dayMix);

  vec3 dayColor = texture2D(uDayMap, vUv).rgb;
  vec3 nightColor = uHasNightMap > 0.5
    ? texture2D(uNightMap, vUv).rgb * 0.55
    : dayColor * 0.08;

  vec3 twilightTint = vec3(1.0, 0.52, 0.28);
  vec3 color = mix(nightColor, dayColor, dayMix);
  color = mix(color, color * twilightTint + nightColor * 0.15, twilight * 0.65);

  if (uHasHillshade > 0.5) {
    float hs = texture2D(uHillshadeMap, vUv).r;
    float relief = (hs - 0.5) * 2.0;
    color *= 1.0 + relief * uHillshadeStrength;
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

function loadTexture(url, { anisotropy = 16 } = {}) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = anisotropy;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function loadHomeRegionConfig() {
  try {
    const apiRes = await fetch(`${API_BASE}/api/home`);
    if (apiRes.ok) return apiRes.json();
  } catch {
    /* API offline — fall back to static manifest */
  }
  const res = await fetch('/data/home-region.json');
  if (!res.ok) throw new Error(`home-region.json → ${res.status}`);
  return res.json();
}

export async function loadHomeRegionTextures(renderer, config) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  const anisotropy = Math.min(16, maxAniso);
  const hillshadeUrl = config.assets?.hillshade ?? config.terrain?.assets?.hillshade;
  const [day, night, hillshade] = await Promise.all([
    loadTexture(config.assets.day, { anisotropy }),
    loadTexture(config.assets.night, { anisotropy }).catch(() => null),
    hillshadeUrl
      ? loadTexture(hillshadeUrl, { anisotropy: 8 }).catch(() => null)
      : Promise.resolve(null),
  ]);
  return { day, night, hillshade };
}

export function createHomePatchMaterial(textures, { hillshadeStrength = 0.42 } = {}) {
  const { day, night, hillshade } = textures;
  const nightTex = night ?? day;
  const hillTex = hillshade ?? day;
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: day },
      uNightMap: { value: nightTex },
      uHillshadeMap: { value: hillTex },
      uSunDirection: { value: new THREE.Vector3(1, 0.2, 0.5) },
      uHasNightMap: { value: night ? 1 : 0 },
      uHasHillshade: { value: hillshade ? 1 : 0 },
      uHillshadeStrength: { value: hillshadeStrength },
    },
    vertexShader: PATCH_VERTEX_SHADER,
    fragmentShader: PATCH_FRAGMENT_SHADER,
    transparent: false,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

export function updateHomePatchSun(material, sunDirection) {
  const uniform = material?.uniforms?.uSunDirection;
  if (!uniform || !sunDirection) return;
  uniform.value.copy(sunDirection);
}

export function setHomeTerrainVisible(material, visible) {
  if (!material?.uniforms?.uHasHillshade) return;
  material.uniforms.uHasHillshade.value = visible ? 1 : 0;
}

/**
 * Lat/lon grid patch draped slightly above the global shell.
 * UVs map the regional JPEG bbox (north at v=0).
 */
export function buildHomePatchMesh(config, material, { earthRadius = EARTH_RADIUS, lift = 0.00055 } = {}) {
  const { west, south, east, north } = config.bbox;
  const lonSpan = east - west;
  const latSpan = north - south;
  const segLon = Math.max(48, Math.round(lonSpan * 12));
  const segLat = Math.max(48, Math.round(latSpan * 12));
  const radius = earthRadius * (1 + lift);

  const vertexCount = (segLon + 1) * (segLat + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  let vi = 0;
  for (let j = 0; j <= segLat; j++) {
    const lat = south + (latSpan * j) / segLat;
    const v = 1 - j / segLat;
    for (let i = 0; i <= segLon; i++) {
      const lon = west + (lonSpan * i) / segLon;
      const pos = latLonToVector3(lat, lon, radius);
      const idx = vi * 3;
      positions[idx] = pos.x;
      positions[idx + 1] = pos.y;
      positions[idx + 2] = pos.z;
      const nlen = Math.hypot(pos.x, pos.y, pos.z) || 1;
      normals[idx] = pos.x / nlen;
      normals[idx + 1] = pos.y / nlen;
      normals[idx + 2] = pos.z / nlen;
      uvs[vi * 2] = i / segLon;
      uvs[vi * 2 + 1] = v;
      vi++;
    }
  }

  const indices = [];
  for (let j = 0; j < segLat; j++) {
    for (let i = 0; i < segLon; i++) {
      const a = j * (segLon + 1) + i;
      const b = a + 1;
      const c = a + (segLon + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'home-patch';
  mesh.userData = {
    pickType: 'home-region',
    config,
  };
  return mesh;
}

/** Camera pose for close inspection over a lat/lon target. */
export function frameCameraForLatLon(lat, lon, { earthRadius = EARTH_RADIUS, altitude = 0.09 } = {}) {
  const surface = latLonToVector3(lat, lon, earthRadius);
  const target = new THREE.Vector3(surface.x, surface.y, surface.z);
  const normal = target.clone().normalize();
  const dist = earthRadius + altitude;

  const worldUp = new THREE.Vector3(0, 1, 0);
  let east = new THREE.Vector3().crossVectors(worldUp, normal);
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
  else east.normalize();
  const north = new THREE.Vector3().crossVectors(normal, east).normalize();

  const position = normal
    .clone()
    .multiplyScalar(dist)
    .add(north.clone().multiplyScalar(altitude * 1.1))
    .add(east.clone().multiplyScalar(altitude * 0.35));

  return { position, target };
}