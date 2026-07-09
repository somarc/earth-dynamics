import * as THREE from 'three';

/**
 * Inertial atmosphere shell (sits on earthGroup, does not spin with surface).
 *
 * Uses the *same* sun direction as surface lighting (ephemeris → world space).
 * BackSide + additive: limb glow only; day scatter only on the sunlit hemisphere
 * so night-facing Live views no longer get a false bright blue halo.
 */
const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  // Outward normal in world space (geometry is a sphere centered at origin).
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uSunDirection;
uniform float uIntensity;
// 0 = instrument (stronger rim), 1 = lit-map / live (softer, terminator-locked)
uniform float uProfile;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  // Outward planet normal — matches Phong N·L and instrument terminator sunDot.
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPosition);
  vec3 L = normalize(uSunDirection);

  // Shell is drawn BackSide; keep N outward so sunDot matches the land mesh.
  float facing = dot(N, V);
  // Fresnel-style limb (view-grazing edge of the disk)
  float rim = pow(1.0 - clamp(abs(facing), 0.0, 1.0), mix(2.4, 3.2, uProfile));

  // Same soft day/night language as terminator shader (aligned with lit N·L)
  float sunDot = dot(N, L);
  float day = smoothstep(-0.05, 0.35, sunDot);       // hard night below ~0
  float twilight = smoothstep(-0.25, 0.12, sunDot) * (1.0 - day);
  float night = 1.0 - day - twilight;

  // Day-side atmospheric scatter (blue)
  vec3 dayScatter = vec3(0.35, 0.62, 1.0);
  // Terminator (orange) — only near limb AND near terminator
  vec3 twilightScatter = vec3(1.0, 0.45, 0.18);
  // Night airglow — very subtle, not a bright blue shell
  vec3 nightScatter = vec3(0.04, 0.07, 0.14);

  vec3 scatter = nightScatter * night;
  scatter += twilightScatter * twilight;
  scatter += dayScatter * day;

  // Alpha: rim-only so we never paint a solid fog ball.
  // Day limb strongest; twilight hot; night almost nothing (was 0.22 floor — the "miss").
  float dayW = mix(0.55, 0.42, uProfile);
  float twW = mix(0.85, 0.7, uProfile);
  float nightW = mix(0.06, 0.04, uProfile);
  float fill = day * dayW + twilight * twW + night * nightW;

  // Suppress day glow when looking deep into the night hemisphere (Live at 9pm).
  // camera→earth center vs sun: if we face away from sun, kill day-limb bleed.
  vec3 toCenter = normalize(-vWorldPosition);
  float viewSun = dot(V, L); // >0 looking somewhat toward sun
  float nightFacing = smoothstep(0.15, -0.35, viewSun); // 1 when looking into night
  fill *= mix(1.0, 0.25 + twilight * 0.9, nightFacing * (1.0 - twilight));

  float alpha = rim * fill * uIntensity;
  alpha = clamp(alpha, 0.0, mix(0.88, 0.72, uProfile));

  gl_FragColor = vec4(scatter, alpha);
}
`;

export function createAtmosphereShell(radius, scale = 1.035) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * scale, 80, 80),
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(1, 0.2, 0.5) },
        uIntensity: { value: 1.0 },
        uProfile: { value: 0 }, // instrument
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  mesh.name = 'atmosphere-shell';
  // Slightly outside the surface so the rim reads cleanly without z-fighting.
  mesh.renderOrder = 1;
  return mesh;
}

export function updateAtmosphereSun(mesh, sunDirection) {
  const uniform = mesh?.material?.uniforms?.uSunDirection;
  if (!uniform || !sunDirection) return;
  uniform.value.copy(sunDirection).normalize();
}

/** 0 = instrument glow, 1 = lit-map / live-now softer terminator-locked shell */
export function updateAtmosphereProfile(mesh, profile) {
  const u = mesh?.material?.uniforms?.uProfile;
  if (!u) return;
  u.value = Math.max(0, Math.min(1, profile));
}

export function updateAtmosphereIntensity(mesh, intensity) {
  const u = mesh?.material?.uniforms?.uIntensity;
  if (!u) return;
  u.value = Math.max(0, Math.min(3, intensity));
}
