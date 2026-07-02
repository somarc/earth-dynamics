/** Shared day/night terminator blend — global shell and regional patches use the same sun frame. */

export const TERMINATOR_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

/** Day/night + twilight color blend; expects uDayMap, uNightMap, uSunDirection, uHasNightMap. */
export const TERMINATOR_DAYNIGHT_BLEND = `
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
`;

export function updateShaderSunDirection(material, sunDirection) {
  const uniform = material?.uniforms?.uSunDirection;
  if (!uniform || !sunDirection) return;
  uniform.value.copy(sunDirection);
}