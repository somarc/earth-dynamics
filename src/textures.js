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

export function createEarthMaterial(textures) {
  const { day, night } = textures;
  return new THREE.MeshStandardMaterial({
    map: day,
    roughness: 0.82,
    metalness: 0.04,
    emissive: night ? new THREE.Color(0xffffff) : new THREE.Color(0x050810),
    emissiveMap: night ?? undefined,
    emissiveIntensity: night ? 0.42 : 0.12,
  });
}