import * as THREE from 'three';

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

const terminatorVertexShader = `
varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const terminatorFragmentShader = `
uniform sampler2D uDayMap;
uniform sampler2D uNightMap;
uniform sampler2D uMaskMap;
uniform vec3 uSunDirection;
uniform float uHasNightMap;
uniform float uHasMaskMap;
uniform float uLandOpacity;
uniform float uOceanOpacity;
uniform float uContextDim;
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
    ? texture2D(uNightMap, vUv).rgb * 0.55
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
  float alpha = mix(uOceanOpacity, uLandOpacity, landMask);
  color *= uContextDim;
  alpha *= mix(uContextDim, 1.0, landMask * 0.35);
  gl_FragColor = vec4(color, alpha);
}
`;

/** Day/night surface blend driven by ephemeris sun direction (earthGroup frame). */
export function createTerminatorEarthMaterial(textures) {
  const { day, night, mask } = textures;
  const nightTex = night ?? day;
  const maskTex = mask ?? day;
  const debugSun =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debugSun');
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: day },
      uNightMap: { value: nightTex },
      uMaskMap: { value: maskTex },
      uSunDirection: { value: new THREE.Vector3(1, 0.2, 0.5) },
      uHasNightMap: { value: night ? 1 : 0 },
      uHasMaskMap: { value: mask ? 1 : 0 },
      uLandOpacity: { value: 1 },
      uOceanOpacity: { value: 1 },
      uContextDim: { value: 1 },
      uDebugSun: { value: debugSun ? 1 : 0 },
    },
    vertexShader: terminatorVertexShader,
    fragmentShader: terminatorFragmentShader,
  });
}

/**
 * Hybrid shell: continents stay solid while oceans take the slider transparency.
 * At full solid both are opaque; lower values x-ray through water only.
 */
export function updateEarthOpacity(material, opacity) {
  if (!material?.uniforms?.uLandOpacity) return;
  const t = Math.max(0.08, Math.min(1, opacity));
  const oceanOpacity = t;
  const landOpacity = 1;
  material.uniforms.uLandOpacity.value = landOpacity;
  material.uniforms.uOceanOpacity.value = oceanOpacity;
  const fullySolid = landOpacity >= 0.998 && oceanOpacity >= 0.998;
  material.transparent = !fullySolid;
  material.depthWrite = fullySolid;
}

/** Dim the coarse global shell when a regional detail patch is active. */
export function updateEarthContextDim(material, dim = 1) {
  const uniform = material?.uniforms?.uContextDim;
  if (!uniform) return;
  uniform.value = Math.max(0.08, Math.min(1, dim));
}

export function updateEarthSunDirection(material, sunDirection) {
  const uniform = material?.uniforms?.uSunDirection;
  if (!uniform || !sunDirection) return;
  uniform.value.copy(sunDirection);
}

export function createEarthMaterial(textures) {
  return createTerminatorEarthMaterial(textures);
}