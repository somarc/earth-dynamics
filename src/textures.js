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

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

export async function loadEarthTextures() {
  try {
    const [day, night] = await Promise.all([
      loadTexture('/textures/earth-day.jpg'),
      loadTexture('/textures/earth-night.jpg'),
    ]);
    return { day, night };
  } catch {
    const day = createFallbackTexture();
    return { day, night: null };
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
uniform vec3 uSunDirection;
uniform float uHasNightMap;

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

  gl_FragColor = vec4(color, 1.0);
}
`;

/** Day/night surface blend driven by ephemeris sun direction (earthGroup frame). */
export function createTerminatorEarthMaterial(textures) {
  const { day, night } = textures;
  const nightTex = night ?? day;
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: day },
      uNightMap: { value: nightTex },
      uSunDirection: { value: new THREE.Vector3(1, 0.2, 0.5) },
      uHasNightMap: { value: night ? 1 : 0 },
    },
    vertexShader: terminatorVertexShader,
    fragmentShader: terminatorFragmentShader,
  });
}

export function updateEarthSunDirection(material, sunDirection) {
  const uniform = material?.uniforms?.uSunDirection;
  if (!uniform || !sunDirection) return;
  uniform.value.copy(sunDirection);
}

export function createEarthMaterial(textures) {
  return createTerminatorEarthMaterial(textures);
}