// Tower layout: pure and deterministic. One platform per floor, generated on
// demand from (seed, floor) so any floor can be looked up in any order — the
// engine, the renderer and the ghost replay all see the same tower.

export const FIELD_W = 520; // inner tower width; walls sit at x = 0 and x = FIELD_W
export const FLOOR_GAP = 80; // vertical distance between floors (world units)
export const STRATUM_FLOORS = 50;
export const PLATFORM_MIN_W = 84;
export const PLATFORM_MAX_W = 340;
const BASE_W_START = 205; // typical platform width at floor 0…
const BASE_W_END = 96; // …narrowing towards this by floor 350
const NARROWING_FLOORS = 350;
const DRIFT_MAX_AMP = 90;

export type PlatformKind = "solid" | "drift" | "brittle";

export interface Platform {
  floor: number;
  y: number; // top surface
  x0: number; // left edge (drift platforms oscillate around it)
  width: number;
  full: boolean; // spans the whole tower: the ground and every stratum gate
  kind: PlatformKind;
  driftAmp: number;
  driftSpeed: number; // rad/s
  driftPhase: number;
}

export interface Stratum {
  name: string;
  from: number; // first floor
  drift: number; // share of drifting platforms
  brittle: number; // share of platforms that crumble after landing
  gravity: number; // multiplier on the base gravity
  widthScale: number;
  twist: string; // one-liner shown when the stratum is entered
}

export const STRATA: readonly Stratum[] = [
  { name: "Glacier", from: 0, drift: 0, brittle: 0, gravity: 1, widthScale: 1, twist: "build speed, then jump" },
  { name: "Aurora Belt", from: 50, drift: 0, brittle: 0, gravity: 1, widthScale: 0.82, twist: "the ledges get thinner" },
  { name: "Storm Shelf", from: 100, drift: 0.45, brittle: 0, gravity: 1, widthScale: 0.9, twist: "the wind moves the ledges" },
  { name: "Stratosphere", from: 150, drift: 0.15, brittle: 0, gravity: 0.8, widthScale: 0.85, twist: "thin air — you float" },
  { name: "Orbit", from: 200, drift: 0.1, brittle: 0.35, gravity: 0.9, widthScale: 0.9, twist: "cracked ledges crumble" },
  { name: "The Void", from: 250, drift: 0.3, brittle: 0.3, gravity: 0.85, widthScale: 0.8, twist: "everything at once" },
];

export function stratumIndexAt(floor: number): number {
  for (let i = STRATA.length - 1; i > 0; i--) {
    if (floor >= STRATA[i].from) return i;
  }
  return 0;
}

/** FNV-1a — turns a date key like "2026-10-06" into a tower seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 stream keyed by (seed, floor). */
function floorRandom(seed: number, floor: number): () => number {
  let a = (seed ^ Math.imul(floor + 1, 0x9e3779b1)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isGateFloor(floor: number): boolean {
  return floor % STRATUM_FLOORS === 0;
}

export function platformAt(seed: number, floor: number): Platform {
  const y = floor * FLOOR_GAP;
  if (floor <= 0 || isGateFloor(floor)) {
    return {
      floor,
      y,
      x0: 0,
      width: FIELD_W,
      full: true,
      kind: "solid",
      driftAmp: 0,
      driftSpeed: 0,
      driftPhase: 0,
    };
  }

  const rand = floorRandom(seed, floor);
  const stratum = STRATA[stratumIndexAt(floor)];
  const base =
    BASE_W_START - (BASE_W_START - BASE_W_END) * Math.min(1, floor / NARROWING_FLOORS);
  const width = Math.round(
    Math.min(
      PLATFORM_MAX_W,
      Math.max(PLATFORM_MIN_W, base * (0.75 + rand() * 0.5) * stratum.widthScale),
    ),
  );

  const kindRoll = rand();
  const kind: PlatformKind =
    kindRoll < stratum.brittle
      ? "brittle"
      : kindRoll < stratum.brittle + stratum.drift
        ? "drift"
        : "solid";

  const room = FIELD_W - width;
  let driftAmp = 0;
  let driftSpeed = 0;
  let driftPhase = 0;
  if (kind === "drift") {
    driftAmp = Math.min(DRIFT_MAX_AMP, (room / 2) * (0.4 + rand() * 0.6));
    driftSpeed = 0.7 + rand() * 0.9;
    driftPhase = rand() * Math.PI * 2;
  }
  // keep the whole drift range inside the walls
  const x0 = Math.round(driftAmp + rand() * (room - 2 * driftAmp));

  return { floor, y, x0, width, full: false, kind, driftAmp, driftSpeed, driftPhase };
}

/** Left edge at run time `time` — drift platforms sway, everything else is fixed. */
export function platformLeft(p: Platform, time: number): number {
  return p.kind === "drift" ? p.x0 + p.driftAmp * Math.sin(time * p.driftSpeed + p.driftPhase) : p.x0;
}
