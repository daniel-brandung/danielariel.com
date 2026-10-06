// GLSL for the tower. Everything renders into a linear HDR buffer: values
// above ~0.6 luminance feed the bloom, and OutputPass tone-maps at the end.
import { Color } from "three";

const NOISE = /* glsl */ `
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + 17.0;
      a *= 0.5;
    }
    return v;
  }
`;

export const skyVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uAuroraA;
  uniform vec3 uAuroraB;
  uniform vec3 uMountain;
  uniform float uAurora;
  uniform float uStars;
  uniform float uPlanet;
  uniform float uTime;
  uniform float uAlt;
  uniform float uFlow;
  uniform float uLightning;
  uniform vec2 uRes;
  varying vec2 vUv;
  ${NOISE}

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
    vec3 col = mix(uBottom, uTop, pow(smoothstep(0.0, 1.0, uv.y), 0.75));

    // two star layers drifting down at different rates as you climb
    for (int layer = 0; layer < 2; layer++) {
      float fl = float(layer);
      float scale = mix(70.0, 140.0, fl);
      vec2 sp = vec2(p.x, p.y + uAlt * mix(0.00035, 0.00016, fl)) * scale;
      vec2 cell = floor(sp);
      vec2 f = fract(sp) - 0.5;
      float h = hash(cell + fl * 31.0);
      vec2 jitter = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
      float d = length(f - jitter * 0.6);
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.3 + h * 3.0) + h * 50.0);
      float star = step(0.972, h) * smoothstep(0.1, 0.0, d) * twinkle;
      col += vec3(0.85, 0.92, 1.0) * star * uStars * mix(1.6, 0.9, fl);
    }

    // aurora: curtains hanging from a wavy line, streaked by vertical rays
    float t = uTime * 0.06;
    vec3 aurora = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float x = p.x * (0.9 + fi * 0.35) + fi * 1.7;
      float line = 0.6 + fi * 0.09 + 0.12 * sin(x * 1.6 + t * 3.0 + fi)
                 + 0.12 * (fbm(vec2(x * 0.8, t + fi)) - 0.5);
      float d = uv.y - line;
      float curtain = d > 0.0 ? exp(-d * (3.2 + fi)) : exp(d * 34.0);
      float rays = 0.3 + 0.7 * fbm(vec2(x * 9.0, uv.y * 0.6 - t * 4.0));
      vec3 c = mix(uAuroraA, uAuroraB, clamp(d * 3.0 + 0.25, 0.0, 1.0));
      aurora += c * curtain * rays * (0.6 - fi * 0.14);
    }
    col += aurora * uAurora * (0.75 + uFlow * 0.7);

    // a planet's limb far below (orbit)
    if (uPlanet > 0.001) {
      float edge = length(vec2(p.x * 0.8, uv.y + 2.15)) - 2.4;
      vec3 ground = mix(vec3(0.01, 0.03, 0.09), vec3(0.06, 0.2, 0.45), smoothstep(-0.35, 0.0, edge));
      col = mix(col, ground, smoothstep(0.004, -0.004, edge) * uPlanet);
      col += vec3(0.25, 0.55, 1.0) * exp(-abs(edge) * 38.0) * uPlanet * 1.2;
    }

    // two mountain ridges that sink out of view as the tower rises
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float sink = uAlt * (0.00024 + fi * 0.00022);
      float ridge = 0.2 - fi * 0.07 - sink
                  + 0.1 * fbm(vec2(p.x * (1.3 + fi) + fi * 9.0, fi * 4.0))
                  + 0.05 * abs(sin(p.x * (2.6 + fi * 1.9)));
      float m = smoothstep(ridge + 0.002, ridge - 0.002, uv.y);
      float rim = exp(-abs(uv.y - ridge) * 240.0);
      col = mix(col, uMountain * (1.0 + fi * 0.5), m);
      col += uAuroraA * rim * 0.22 * (1.0 - fi * 0.5);
    }

    col += vec3(0.55, 0.62, 1.0) * uLightning;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const worldVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormal;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vLocal = position;
    vNormal = normal; // boxes are only ever scaled and translated
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** Ice-block walls with glowing seams; the pattern is pinned to world space. */
export const wallFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSeam;
  uniform float uTime;
  uniform float uFlow;
  uniform float uSide;   // -1 left wall, +1 right wall
  uniform float uInnerX; // x of the face that borders the playfield
  uniform float uAlpha;
  varying vec3 vWorld;
  varying vec3 vNormal;
  ${NOISE}

  void main() {
    vec3 n = normalize(vNormal);
    vec2 q = abs(n.x) > 0.5 ? vec2(vWorld.z, vWorld.y) : vec2(vWorld.x, vWorld.y);
    if (abs(n.y) > 0.5) q = vWorld.xz;
    vec2 brick = vec2(64.0, 40.0);
    float row = floor(q.y / brick.y);
    q.x += mod(row, 2.0) * brick.x * 0.5;
    vec2 cell = floor(q / brick);
    vec2 g = fract(q / brick);
    vec2 edge = min(g, 1.0 - g) * brick;
    float seam = 1.0 - smoothstep(0.0, 2.4, min(edge.x, edge.y));
    float r = hash(cell);
    float frost = fbm(q * 0.06 + r * 10.0);
    vec3 body = uColor * (0.08 + 0.1 * r + 0.08 * g.y + 0.08 * frost);
    float facing = abs(n.x) > 0.5 ? (n.x * uSide < 0.0 ? 1.0 : 0.45) : (n.z > 0.5 ? 0.7 : 0.3);
    vec3 col = body * facing;
    float pulse = 0.55 + 0.45 * sin(vWorld.y * 0.015 - uTime * 2.2);
    col += uSeam * seam * (0.18 + uFlow * 0.9) * pulse;
    float innerEdge = n.z > 0.5 ? exp(-abs(vWorld.x - uInnerX) * 0.5) : 0.0;
    col += uSeam * innerEdge * (1.1 + uFlow);
    gl_FragColor = vec4(col, uAlpha);
  }
`;

/** Crystal ledges. uKind: 0 solid, 1 drifting, 2 brittle, 3 full-width gate. */
export const platformFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRim;
  uniform vec3 uSize;
  uniform float uKind;
  uniform float uCrack; // 0 intact … 1 about to crumble
  uniform float uTime;
  uniform float uFlow;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;
  ${NOISE}

  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }
  // distance to the nearest Voronoi cell border — reads as cracks in the ice
  float cracks(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + hash2(n + g) - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return sqrt(d2) - sqrt(d1);
  }

  void main() {
    vec3 n = normalize(vNormal);
    // MSAA shades edge samples from varyings extrapolated past the triangle;
    // on a face seen nearly edge-on that runs away, and exp() below overflows
    // to Inf, which the bloom then smears across the whole frame. Clamp first.
    vec3 lp = clamp(vLocal, -0.5, 0.5) * uSize;
    vec2 face;
    vec3 col;
    if (n.y > 0.5) {
      face = lp.xz;
      float front = smoothstep(-uSize.z * 0.5, uSize.z * 0.5, lp.z);
      col = uColor * (0.16 + 0.22 * front);
      col += uRim * exp(-(uSize.z * 0.5 - lp.z) * 0.45) * 1.3;
      col += uRim * exp(-(uSize.z * 0.5 + lp.z) * 0.6) * 0.3;
    } else if (n.z > 0.5) {
      face = lp.xy;
      float h = (lp.y + uSize.y * 0.5) / uSize.y;
      col = uColor * (0.07 + 0.26 * h) * (0.8 + 0.4 * fbm(lp.xy * 0.08));
      col += uRim * smoothstep(0.78, 1.0, h) * 0.9;
    } else if (n.y < -0.5) {
      face = lp.xz;
      col = uColor * 0.08;
    } else {
      face = lp.zy;
      col = uColor * 0.24;
    }
    // bright end caps
    col += uRim * exp(-(uSize.x * 0.5 - abs(lp.x)) * 0.6) * 0.5;

    if (uKind > 2.5) {
      // gates: a band of light running along the front
      float band = smoothstep(0.4, 0.0, abs(fract(lp.x / 90.0 - uTime * 0.25) - 0.5) * 2.0 - 0.6);
      col += uRim * band * 0.35;
    } else if (uKind > 1.5) {
      float c = 1.0 - smoothstep(0.0, 0.05 + uCrack * 0.05, cracks(face / 16.0));
      float flicker = uCrack > 0.0 ? 0.6 + 0.4 * sin(uTime * 60.0) : 1.0;
      col = mix(col, uRim * 2.6 * flicker, c * (0.35 + 0.65 * uCrack));
      col *= 1.0 - uCrack * 0.35;
    } else if (uKind > 0.5) {
      // drifting ledges: chevrons sliding along the front
      float s = step(0.6, fract((lp.x + abs(lp.y) * 0.8) / 22.0 - uTime * 0.8));
      if (n.z > 0.5) col += uRim * s * 0.3;
    }

    col *= 1.0 + uFlow * 0.3;
    gl_FragColor = vec4(min(col, vec3(32.0)), 1.0);
  }
`;

export const particleVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

export const particleFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a *= a * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

/** Final grade: chromatic aberration, vignette, danger glow, flash, grain. */
export const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAberration: { value: 0 },
    uVignette: { value: 0.55 },
    uDanger: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new Color(1, 1, 1) },
    uGrain: { value: 0.035 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uDanger;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * uAberration * (0.4 + r2 * 3.0);
      vec3 col = vec3(
        texture2D(tDiffuse, vUv + off).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - off).b
      );
      col *= 1.0 - uVignette * smoothstep(0.08, 0.5, r2);
      float bottom = smoothstep(0.32, 0.0, vUv.y) * uDanger;
      float throb = 0.75 + 0.25 * sin(uTime * 9.0);
      col = mix(col, vec3(1.4, 0.06, 0.16), bottom * 0.55 * throb);
      col += uFlashColor * uFlash;
      float grain = fract(sin(dot(vUv * (uTime + 3.7), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      col += grain * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
