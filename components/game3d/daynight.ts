export type Rgb = [number, number, number];

export interface SkyColors {
  top: Rgb;
  horizon: Rgb;
  fog: Rgb;
  light: Rgb;
  lightIntensity: number;
  ambientIntensity: number;
  starAlpha: number;
}

interface Keyframe extends SkyColors {
  at: number;
}

// dusk → deep dusk → night over one 90-second round
const KEYFRAMES: Keyframe[] = [
  {
    at: 0,
    top: [0.1, 0.16, 0.3],
    horizon: [0.95, 0.52, 0.24],
    fog: [0.45, 0.3, 0.28],
    light: [1.0, 0.85, 0.62],
    lightIntensity: 1.0,
    ambientIntensity: 0.55,
    starAlpha: 0,
  },
  {
    at: 0.55,
    top: [0.04, 0.07, 0.17],
    horizon: [0.4, 0.22, 0.28],
    fog: [0.2, 0.15, 0.2],
    light: [0.75, 0.68, 0.7],
    lightIntensity: 0.65,
    ambientIntensity: 0.4,
    starAlpha: 0.35,
  },
  {
    at: 1,
    top: [0.01, 0.02, 0.06],
    horizon: [0.05, 0.09, 0.15],
    fog: [0.03, 0.05, 0.08],
    light: [0.55, 0.62, 0.85],
    lightIntensity: 0.35,
    ambientIntensity: 0.28,
    starAlpha: 1,
  },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Sky/fog/light colors for round progress 0 (dusk) → 1 (night). */
export function skyColorsAt(progress: number): SkyColors {
  const p = Math.min(1, Math.max(0, progress));
  let a = KEYFRAMES[0];
  let b = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (p >= KEYFRAMES[i].at && p <= KEYFRAMES[i + 1].at) {
      a = KEYFRAMES[i];
      b = KEYFRAMES[i + 1];
      break;
    }
  }
  const t = a.at === b.at ? 0 : (p - a.at) / (b.at - a.at);
  return {
    top: lerpRgb(a.top, b.top, t),
    horizon: lerpRgb(a.horizon, b.horizon, t),
    fog: lerpRgb(a.fog, b.fog, t),
    light: lerpRgb(a.light, b.light, t),
    lightIntensity: lerp(a.lightIntensity, b.lightIntensity, t),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, t),
    starAlpha: lerp(a.starAlpha, b.starAlpha, t),
  };
}
