import * as THREE from 'three';
import {
  TERMINATOR_VERTEX_SHADER,
  TERMINATOR_DAYNIGHT_BLEND,
  updateShaderSunDirection,
} from './shaders/terminator-daynight.js';

function createFallbackTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#1a3a5c');
  grad.addColorStop(0.5, '#2d6b4a');
  grad.addColorStop(1, '#1a3a5c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadTexture(url, { anisotropy = 8 } = {}) {
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

export async function loadEarthTextures(renderer) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() ?? 8;
  const anisotropy = Math.min(16, maxAniso);
  try {
    const [day, night, mask] = await Promise.all([
      loadTexture('/textures/earth-day.jpg', { anisotropy }),
      loadTexture('/textures/earth-night.jpg', { anisotropy }),
      loadTexture('/textures/earth-mask.png', { anisotropy: 4 }).catch(() => null),
    ]);
    return { day, night, mask };
  } catch {
    const day = createFallbackTexture();
    return { day, night: null, mask: null };
  }
}

/** @deprecated Use loadEarthTextures */
export function loadEarthTexture() {
  return loadEarthTextures().then((t) => t.day);
}

const terminatorFragmentShader = `
uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uMaskMap;
uniform vec3 uSunDirection;
uniform float uHasNightMap;
uniform float uHasMaskMap;
uniform float uContextDim;
uniform float uSurfaceLift;
uniform float uNightBoost;
uniform float uDebugSun;

varying vec2 vUv;
varying vec3 vWorldNormal;

float landMaskFromDayColor(vec3 dayColor) {
  float lum = dot(dayColor, vec3(0.299, 0.587, 0.114));
  float iceMask = smoothstep(0.52, 0.8, lum) * step(dayColor.b, dayColor.r + 0.06);
  float oceanScore = dayColor.b * 1.18 - dayColor.r * 0.58 - dayColor.g * 0.52;
  float oceanMask = smoothstep(0.02, 0.24, oceanScore) * (1.0 - iceMask * 0.92);
  return 1.0 - oceanMask;
}

float surfaceLandMask(vec3 dayColor) {
  if (uHasMaskMap > 0.5) {
    return texture2D(uMaskMap, vUv).r;
  }
  return landMaskFromDayColor(dayColor);
}

void main() {
  vec3 sunDir = normalize(uSunDirection);
  vec3 normal = normalize(vWorldNormal);
  float sunDot = dot(normal, sunDir);

  float dayMix = smoothstep(-0.12, 0.42, sunDot);
  float twilight = smoothstep(-0.38, 0.08, sunDot) * (1.0 - dayMix);

  vec3 dayColor = texture2D(uDayMap, vUv).rgb;
  vec3 nightColor = uHasNightMap > 0.5
    ? texture2D(uNightMap, vUv).rgb * uNightBoost
    : dayColor * 0.08;

  vec3 twilightTint = vec3(1.0, 0.52, 0.28);
  vec3 color = mix(nightColor, dayColor, dayMix);
  color = mix(color, color * twilightTint + nightColor * 0.15, twilight * 0.65);

  if (uDebugSun > 0.5) {
    float vis = clamp(sunDot * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(vec3(vis), 1.0);
    return;
  }

  float landMask = surfaceLandMask(dayColor);
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(lum), color, 1.18);
  color = max(mix(color, dayColor, 0.18), dayColor * uSurfaceLift);
  color *= uContextDim;
  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * GE-like lit day map — Phong so directional + ambient actually paint the albedo
 * (Standard + navy ambient was reading as pure night + city lights only).
 * Optional night-lights texture as emissive.
 */
export function createLitMapEarthMaterial(textures, {
  shininess = 12,
  nightLights = true,
  nightEmissiveIntensity = 0.22,
  albedoBoost = 1.35,
} = {}) {
  const { day, night } = textures;
  const mat = new THREE.MeshPhongMaterial({
    map: day,
    color: new THREE.Color(albedoBoost, albedoBoost, albedoBoost),
    // Soft limb: less plastic highlight so terminator reads closer to atmosphere shell
    shininess,
    specular: new THREE.Color(0x111118),
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
  if (nightLights && night) {
    mat.emissiveMap = night;
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveIntensity = nightEmissiveIntensity;
  } else {
    mat.emissiveIntensity = 0;
  }
  mat.userData.surfaceModel = 'lit-map';
  return mat;
}

/** Update lit-map material knobs from studio. */
export function updateLitMapMaterial(material, {
  shininess,
  roughness, // accepted for API compat; maps inversely toward shininess if shininess omitted
  nightLights,
  nightEmissiveIntensity,
  nightMap,
  albedoBoost,
} = {}) {
  if (!material || material.userData?.surfaceModel !== 'lit-map') return;
  if (shininess != null) {
    material.shininess = Math.max(1, Math.min(80, shininess));
  } else if (roughness != null) {
    // UI roughness 0.05–1 → shininess ~40–2
    material.shininess = Math.max(2, Math.min(40, (1 - roughness) * 42));
  }
  if (albedoBoost != null) {
    const b = Math.max(0.5, Math.min(2.5, albedoBoost));
    material.color.setRGB(b, b, b);
  }
  if (nightLights != null) {
    if (nightLights && nightMap) {
      material.emissiveMap = nightMap;
      material.emissive = new THREE.Color(0xffffff);
      material.emissiveIntensity = nightEmissiveIntensity ?? 0.22;
    } else {
      material.emissiveMap = null;
      material.emissiveIntensity = 0;
    }
    material.needsUpdate = true;
  } else if (nightEmissiveIntensity != null && material.emissiveMap) {
    material.emissiveIntensity = Math.max(0, Math.min(2, nightEmissiveIntensity));
  }
}

/** Day/night surface blend driven by ephemeris sun direction (earthGroup frame). */
export function createTerminatorEarthMaterial(textures) {
  const { day, night, mask } = textures;
  const nightTex = night ?? day;
  const maskTex = mask ?? day;
  const debugSun =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debugSun');
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: day },
      uNightMap: { value: nightTex },
      uMaskMap: { value: maskTex },
      uSunDirection: { value: new THREE.Vector3(1, 0.2, 0.5) },
      uHasNightMap: { value: night ? 1 : 0 },
      uHasMaskMap: { value: mask ? 1 : 0 },
      uContextDim: { value: 1 },
      uSurfaceLift: { value: 0.72 },
      uNightBoost: { value: 0.55 },
      uDebugSun: { value: debugSun ? 1 : 0 },
    },
    vertexShader: TERMINATOR_VERTEX_SHADER,
    fragmentShader: terminatorFragmentShader,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
  mat.userData.surfaceModel = 'instrument';
  return mat;
}

export function updateEarthOpacity(material, opacity) {
  if (!material?.uniforms?.uSurfaceLift) return;
  const t = Math.max(0.65, Math.min(1, opacity));
  material.uniforms.uSurfaceLift.value = 0.46 + 0.26 * t;
  material.transparent = false;
  material.depthWrite = true;
  material.depthTest = true;
}

/** Studio: set surface lift directly (or via wide opacity range). */
export function updateEarthSurfaceLift(material, lift) {
  if (!material?.uniforms?.uSurfaceLift) return;
  material.uniforms.uSurfaceLift.value = Math.max(0.2, Math.min(1.2, lift));
  material.transparent = false;
  material.depthWrite = true;
  material.depthTest = true;
}

export function updateEarthNightBoost(material, boost) {
  if (!material?.uniforms?.uNightBoost) return;
  material.uniforms.uNightBoost.value = Math.max(0.05, Math.min(1.5, boost));
}

/** Dim the coarse global shell when a regional detail patch is active. */
export function updateEarthContextDim(material, dim = 1) {
  const uniform = material?.uniforms?.uContextDim;
  if (!uniform) return;
  uniform.value = Math.max(0.08, Math.min(1, dim));
}

export function updateEarthSunDirection(material, sunDirection) {
  updateShaderSunDirection(material, sunDirection);
}

export function createEarthMaterial(textures) {
  return createTerminatorEarthMaterial(textures);
}
