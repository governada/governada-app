/**
 * Globe GLSL shaders — all shader strings for the constellation visualization.
 *
 * Pure data module — no React, no runtime dependencies.
 * Imported by globe rendering components (NodePoints, etc.)
 */

// ---------------------------------------------------------------------------
// Node point sprites (DReps, CC members, user)
// ---------------------------------------------------------------------------

export const NODE_VERT = /* glsl */ `
attribute float aSize;
attribute float aDimmed;
attribute vec3 aNodeColor;
varying vec3 vColor;
varying float vAlpha;
varying float vDimmed;

void main() {
  vColor = aNodeColor;
  vDimmed = aDimmed;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * 600.0 / -mvPosition.z;
  gl_PointSize = clamp(gl_PointSize, 1.0, 128.0);
  vAlpha = mix(1.0, 0.06, smoothstep(0.0, 1.0, aDimmed));
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const NODE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vDimmed;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  float core = 1.0 - smoothstep(0.0, 0.15, dist);
  vec3 col = vColor * (1.0 + core * 1.5);
  // Continuous desaturation — supports intermediate "maybe" states
  float dimAmount = smoothstep(0.3, 0.8, vDimmed);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum * 0.15), dimAmount);
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

// ---------------------------------------------------------------------------
// SPO diamond-shaped point sprites
// ---------------------------------------------------------------------------

export const SPO_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vDimmed;

void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  // Diamond (rotated square) distance: |x| + |y|
  float diamond = abs(p.x) + abs(p.y);
  if (diamond > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, diamond);
  float core = 1.0 - smoothstep(0.0, 0.15, diamond);
  vec3 col = vColor * (1.0 + core * 2.0);
  // Continuous desaturation — supports intermediate "maybe" states
  float dimAmount = smoothstep(0.3, 0.8, vDimmed);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum * 0.15), dimAmount);
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

// ---------------------------------------------------------------------------
// Network pulse particles (light flowing along edges)
// ---------------------------------------------------------------------------

export const PULSE_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aPulseColor;
varying float vAlpha;
varying vec3 vPulseColor;

void main() {
  vAlpha = aAlpha;
  vPulseColor = aPulseColor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * 600.0 / -mvPosition.z;
  gl_PointSize = clamp(gl_PointSize, 2.0, 48.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const PULSE_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vPulseColor;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  float core = 1.0 - smoothstep(0.0, 0.15, dist);
  vec3 col = vPulseColor * (1.0 + core * 2.0);
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;
