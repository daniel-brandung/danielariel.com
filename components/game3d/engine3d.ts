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

/** Distance along the ray to the chicken's hit sphere, or null on a miss. */
export function rayDistanceTo(ray: Ray, chicken: Chicken3D): number | null {
  const ox = ray.origin.x - chicken.pos.x;
  const oy = ray.origin.y - chicken.pos.y;
  const oz = ray.origin.z - chicken.pos.z;
  const b = ox * ray.dir.x + oy * ray.dir.y + oz * ray.dir.z;
  const c = ox * ox + oy * oy + oz * oz - CHICKEN_RADIUS * CHICKEN_RADIUS;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

export function shoot(state: GameState3D, ray: Ray): Tick3D {
  if (state.phase !== "playing" || state.reloading) return { state, events: [] };
  if (state.shells === 0) {
    // a dry click breaks the combo too
    const next = state.multiplier > 1 ? { ...state, multiplier: 1 } : state;
    return { state: next, events: [{ type: "empty" }] };
  }

  const events: GameEvent3D[] = [{ type: "shot" }];
  let next = { ...state, shells: state.shells - 1 };

  let target: Chicken3D | undefined;
  let bestT = Infinity;
  for (const c of next.chickens) {
    if (c.falling) continue;
    const t = rayDistanceTo(ray, c);
    if (t !== null && t < bestT) {
      bestT = t;
      target = c;
    }
  }

  if (target) {
    const hit = target;
    const points = (hit.golden ? GOLDEN_POINTS : BANDS[hit.band].points) * next.multiplier;
    const raised = Math.min(MAX_MULTIPLIER, next.multiplier + 1);
    const raisedFrom = next.multiplier;
    next = {
      ...next,
      score: next.score + points,
      multiplier: raised,
      chickens: next.chickens.map((c) =>
        c.id === hit.id ? { ...c, falling: true, fallVy: 0 } : c,
      ),
    };
    events.push({ type: "hit", points, pos: hit.pos, golden: hit.golden });
    if (raised > raisedFrom) events.push({ type: "combo", multiplier: raised });
  } else {
    next = { ...next, multiplier: 1 };
  }

  return { state: next, events };
}

function spawnInterval(timeLeft: number): number {
  const progress = 1 - timeLeft / ROUND_SECONDS;
  return SPAWN_INTERVAL_START + (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * progress;
}

// rand call order: band, golden roll (skipped when forced), side, speed,
// altitude, depth jitter, weave phase — tests depend on this order.
function spawnChicken(nextId: number, rand: () => number, forceGolden: boolean): Chicken3D {
  const bands: Band[] = ["far", "mid", "near"];
  const band = bands[Math.min(2, Math.floor(rand() * 3))];
  const spec = BANDS[band];
  const golden = forceGolden || rand() < GOLDEN_CHANCE;
  const fromLeft = rand() < 0.5;
  const speed =
    (spec.speedMin + rand() * (spec.speedMax - spec.speedMin)) *
    (golden ? GOLDEN_SPEED_FACTOR : 1);
  const baseY = spec.yMin + rand() * (spec.yMax - spec.yMin);
  return {
    id: nextId,
    band,
    golden,
    pos: {
      x: fromLeft ? -spec.xExtent : spec.xExtent,
      y: baseY,
      z: spec.z + (rand() * 2 - 1) * spec.zJitter,
    },
    vx: fromLeft ? speed : -speed,
    baseY,
    weavePhase: rand() * Math.PI * 2,
    falling: false,
    fallVy: 0,
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

  next.chickens = next.chickens
    .map((c) => {
      if (c.falling) {
        return {
          ...c,
          pos: { ...c.pos, y: c.pos.y - (c.fallVy + (GRAVITY * dt) / 2) * dt },
          fallVy: c.fallVy + GRAVITY * dt,
        };
      }
      const weavePhase = c.weavePhase + dt * GOLDEN_WEAVE_SPEED;
      return {
        ...c,
        pos: {
          x: c.pos.x + c.vx * dt,
          y: c.golden ? c.baseY + Math.sin(weavePhase) * GOLDEN_WEAVE_AMPLITUDE : c.pos.y,
          z: c.pos.z,
        },
        weavePhase,
      };
    })
    .filter((c) => {
      if (c.falling) return c.pos.y > GROUND_Y;
      return Math.abs(c.pos.x) < BANDS[c.band].xExtent + DESPAWN_MARGIN;
    });

  next.spawnCooldown -= dt;
  if (next.spawnCooldown <= 0) {
    const flying = next.chickens.filter((c) => !c.falling).length;
    if (flying < MAX_CHICKENS) {
      const forceGolden = !next.goldenSpawned && next.timeLeft <= ROUND_SECONDS / 2;
      const spawned = spawnChicken(next.nextId, rand, forceGolden);
      next.chickens = [...next.chickens, spawned];
      next.nextId += 1;
      if (spawned.golden) {
        next.goldenSpawned = true;
        events.push({ type: "goldenSpawn" });
      }
    }
    const jitter = 0.7 + rand() * 0.6; // 0.7×–1.3× around the ramp interval
    next.spawnCooldown = spawnInterval(next.timeLeft) * jitter;
  }

  if (next.timeLeft === 0) {
    next.phase = "ended";
    events.push({ type: "roundEnd", score: next.score });
  }

  return { state: next, events };
}
