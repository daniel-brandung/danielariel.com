// Round + loadout — same skeleton as the 2D game
export const ROUND_SECONDS = 90;
export const MAX_SHELLS = 8;
export const RELOAD_SECONDS = 0.6;
export const MAX_CHICKENS = 7;
export const SPAWN_INTERVAL_START = 1.5;
export const SPAWN_INTERVAL_END = 0.8;

// 3D-specific tuning
export const CHICKEN_RADIUS = 1.0; // hit-sphere radius, world units
export const GROUND_Y = -0.5; // falling chickens are culled below this
export const MAX_MULTIPLIER = 4;
export const GOLDEN_CHANCE = 0.05;
export const GOLDEN_POINTS = 50;
export const GOLDEN_SPEED_FACTOR = 1.6;
export const GOLDEN_WEAVE_AMPLITUDE = 1.5;
export const GOLDEN_WEAVE_SPEED = 3; // rad/s of the sine weave

const GRAVITY = 25; // world units/s²
const DESPAWN_MARGIN = 4;

export type Band = "near" | "mid" | "far";

export interface BandSpec {
  points: number;
  z: number; // band depth; the camera sits at the origin looking down -z
  zJitter: number;
  xExtent: number; // spawn/despawn half-width
  yMin: number;
  yMax: number;
  speedMin: number; // world units/s
  speedMax: number;
}

export const BANDS: Record<Band, BandSpec> = {
  near: { points: 5, z: -12, zJitter: 2, xExtent: 22, yMin: 2, yMax: 6, speedMin: 4, speedMax: 6 },
  mid: { points: 10, z: -25, zJitter: 4, xExtent: 42, yMin: 3, yMax: 10, speedMin: 8, speedMax: 12 },
  far: { points: 15, z: -45, zJitter: 6, xExtent: 72, yMin: 5, yMax: 16, speedMin: 14, speedMax: 20 },
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** dir must be normalized; the component gets it from THREE.Raycaster, which guarantees that. */
export interface Ray {
  origin: Vec3;
  dir: Vec3;
}

export interface Chicken3D {
  id: number;
  band: Band;
  golden: boolean;
  pos: Vec3;
  vx: number; // world units/s along x; sign is flight direction
  baseY: number; // cruise altitude; golden chickens weave around it
  weavePhase: number;
  falling: boolean;
  fallVy: number;
}

export type Phase = "ready" | "playing" | "paused" | "ended";

export interface GameState3D {
  phase: Phase;
  timeLeft: number;
  score: number;
  shells: number;
  reloading: boolean;
  reloadTimeLeft: number;
  multiplier: number;
  spawnCooldown: number;
  goldenSpawned: boolean;
  nextId: number;
  chickens: Chicken3D[];
}

export type GameEvent3D =
  | { type: "shot" }
  | { type: "empty" }
  | { type: "hit"; points: number; pos: Vec3; golden: boolean }
  | { type: "combo"; multiplier: number }
  | { type: "goldenSpawn" }
  | { type: "reloadStart" }
  | { type: "reloadEnd" }
  | { type: "roundEnd"; score: number };

export interface Tick3D {
  state: GameState3D;
  events: GameEvent3D[];
}

export function createInitialState(): GameState3D {
  return {
    phase: "ready",
    timeLeft: ROUND_SECONDS,
    score: 0,
    shells: MAX_SHELLS,
    reloading: false,
    reloadTimeLeft: 0,
    multiplier: 1,
    spawnCooldown: 0,
    goldenSpawned: false,
    nextId: 1,
    chickens: [],
  };
}

export function startRound(state: GameState3D): GameState3D {
  return { ...createInitialState(), nextId: state.nextId, phase: "playing" };
}

export function pause(state: GameState3D): GameState3D {
  return state.phase === "playing" ? { ...state, phase: "paused" } : state;
}

export function resume(state: GameState3D): GameState3D {
  return state.phase === "paused" ? { ...state, phase: "playing" } : state;
}

export function startReload(state: GameState3D): Tick3D {
  if (state.phase !== "playing" || state.reloading || state.shells === MAX_SHELLS) {
    return { state, events: [] };
  }
  return {
    state: { ...state, reloading: true, reloadTimeLeft: RELOAD_SECONDS },
    events: [{ type: "reloadStart" }],
  };
}

export function update(state: GameState3D, dt: number, rand: () => number): Tick3D {
  if (state.phase !== "playing") return { state, events: [] };
  const events: GameEvent3D[] = [];
  const next = { ...state };

  next.timeLeft = Math.max(0, next.timeLeft - dt);

  if (next.reloading) {
    next.reloadTimeLeft = Math.max(0, next.reloadTimeLeft - dt);
    if (next.reloadTimeLeft === 0) {
      next.reloading = false;
      next.shells = MAX_SHELLS;
      events.push({ type: "reloadEnd" });
    }
  }

  // Task 4 adds chicken movement and spawning here.

  if (next.timeLeft === 0) {
    next.phase = "ended";
    events.push({ type: "roundEnd", score: next.score });
  }

  return { state: next, events };
}
