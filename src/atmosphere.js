import * as THREE from 'three';

const vertexShader = `
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform vec3 uSunDirection;
uniform float uIntensity;

varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 sunDir = normalize(uSunDirection);
  vec3 normal = normalize(vNormal);

  float viewDot = clamp(dot(viewDir, normal), 0.0, 1.0);
  float sunDot = dot(normal, sunDir);

  float rim = pow(1.0 - viewDot, 2.6);
  float day = smoothstep(-0.18, 0.55, sunDot);
  float twilight = smoothstep(-0.42, 0.12, sunDot) * (1.0 - day);

  vec3 dayColor = vec3(0.42, 0.7, 1.0);
  vec3 twilightColor = vec3(1.0, 0.42, 0.16);
  vec3 nightColor = vec3(0.05, 0.09, 0.2);

  vec3 scatter = mix(nightColor, twilightColor, twilight);
  scatter = mix(scatter, dayColor, day * 0.9);

  float alpha = rim * uIntensity * (0.22 + day * 0.58 + twilight * 0.4);
  gl_FragColor = vec4(scatter, clamp(alpha, 0.0, 0.92));
}
`;

export function createAtmosphereShell(radius, scale = 1.055) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * scale, 72, 72),
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(1, 0.2, 0.5) },
        uIntensity: { value: 1.2 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  mesh.name = 'atmosphere-shell';
  return mesh;
}

export function updateAtmosphereSun(mesh, sunDirection) {
  const uniform = mesh?.material?.uniforms?.uSunDirection;
  if (!uniform || !sunDirection) return;
  uniform.value.copy(sunDirection);
}