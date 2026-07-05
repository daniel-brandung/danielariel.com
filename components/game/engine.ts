export const VIRTUAL_WIDTH = 1280;
export const VIRTUAL_HEIGHT = 720;
export const ROUND_SECONDS = 90;
export const MAX_SHELLS = 8;
export const RELOAD_SECONDS = 0.6;
export const MAX_CHICKENS = 6;
export const SPAWN_INTERVAL_START = 1.5;
export const SPAWN_INTERVAL_END = 0.8;
// Chicken sprite size in virtual units at scale 1 (near layer)
export const CHICKEN_WIDTH = 96;
export const CHICKEN_HEIGHT = 84;

// Private constants for spawning and physics
const GRAVITY = 1400; // px/s² for falling chickens
const OFFSCREEN_MARGIN = 80;
// Exported: the component's renderer needs the same lifetimes for fade-out math
export const POPUP_SECONDS = 0.8;
export const BURST_SECONDS = 0.5;

export type Layer = "far" | "mid" | "near";

export interface LayerSpec {
  points: number;
  scale: number;
  speedMin: number;
  speedMax: number;
  yMin: number;
  yMax: number;
}

export const LAYERS: Record<Layer, LayerSpec> = {
  far: { points: 15, scale: 0.45, speedMin: 120, speedMax: 180, yMin: 90, yMax: 260 },
  mid: { points: 10, scale: 0.7, speedMin: 150, speedMax: 220, yMin: 160, yMax: 380 },
  near: { points: 5, scale: 1, speedMin: 190, speedMax: 260, yMin: 260, yMax: 470 },
};

export interface Chicken {
  id: number;
  layer: Layer;
  x: number; // center, virtual units
  y: number;
  vx: number; // px/s; sign is flight direction
  falling: boolean;
  fallVy: number;
}

export interface ScorePopup {
  x: number;
  y: number;
  points: number;
  age: number;
}

export interface FeatherBurst {
  x: number;
  y: number;
  age: number;
}

export type Phase = "ready" | "playing" | "paused" | "ended";

export interface GameState {
  phase: Phase;
  timeLeft: number;
  score: number;
  shells: number;
  reloading: boolean;
  reloadTimeLeft: number;
  spawnCooldown: number;
  nextId: number;
  chickens: Chicken[];
  popups: ScorePopup[];
  bursts: FeatherBurst[];
}

export type GameEvent =
  | { type: "shot" }
  | { type: "empty" }
  | { type: "hit"; points: number; x: number; y: number }
  | { type: "reloadStart" }
  | { type: "reloadEnd" }
  | { type: "roundEnd"; score: number };

export interface Tick {
  state: GameState;
  events: GameEvent[];
}

export function createInitialState(): GameState {
  return {
    phase: "ready",
    timeLeft: ROUND_SECONDS,
    score: 0,
    shells: MAX_SHELLS,
    reloading: false,
    reloadTimeLeft: 0,
    spawnCooldown: 0,
    nextId: 1,
    chickens: [],
    popups: [],
    bursts: [],
  };
}

export function startRound(state: GameState): GameState {
  return { ...createInitialState(), nextId: state.nextId, phase: "playing" };
}

export function pause(state: GameState): GameState {
  return state.phase === "playing" ? { ...state, phase: "paused" } : state;
}

export function resume(state: GameState): GameState {
  return state.phase === "paused" ? { ...state, phase: "playing" } : state;
}

export function shoot(state: GameState, x: number, y: number): Tick {
  if (state.phase !== "playing" || state.reloading) return { state, events: [] };
  if (state.shells === 0) return { state, events: [{ type: "empty" }] };
  void x;
  void y; // hit detection lands in Task 4
  return {
    state: { ...state, shells: state.shells - 1 },
    events: [{ type: "shot" }],
  };
}

export function startReload(state: GameState): Tick {
  if (state.phase !== "playing" || state.reloading || state.shells === MAX_SHELLS) {
    return { state, events: [] };
  }
  return {
    state: { ...state, reloading: true, reloadTimeLeft: RELOAD_SECONDS },
    events: [{ type: "reloadStart" }],
  };
}

function spawnInterval(timeLeft: number): number {
  const progress = 1 - timeLeft / ROUND_SECONDS;
  return SPAWN_INTERVAL_START + (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * progress;
}

function spawnChicken(nextId: number, rand: () => number): Chicken {
  const layers: Layer[] = ["far", "mid", "near"];
  const layer = layers[Math.min(2, Math.floor(rand() * 3))];
  const spec = LAYERS[layer];
  const fromLeft = rand() < 0.5;
  const speed = spec.speedMin + rand() * (spec.speedMax - spec.speedMin);
  const halfW = (CHICKEN_WIDTH * spec.scale) / 2;
  return {
    id: nextId,
    layer,
    x: fromLeft ? -halfW : VIRTUAL_WIDTH + halfW,
    y: spec.yMin + rand() * (spec.yMax - spec.yMin),
    vx: fromLeft ? speed : -speed,
    falling: false,
    fallVy: 0,
  };
}

export function update(state: GameState, dt: number, rand: () => number): Tick {
  if (state.phase !== "playing") return { state, events: [] };
  const events: GameEvent[] = [];
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
    .map((c) =>
      c.falling
        ? { ...c, y: c.y + (c.fallVy + (GRAVITY * dt) / 2) * dt, fallVy: c.fallVy + GRAVITY * dt }
        : { ...c, x: c.x + c.vx * dt },
    )
    .filter((c) => {
      if (c.falling) return c.y < VIRTUAL_HEIGHT + OFFSCREEN_MARGIN;
      const halfW = (CHICKEN_WIDTH * LAYERS[c.layer].scale) / 2;
      return c.x > -halfW - OFFSCREEN_MARGIN && c.x < VIRTUAL_WIDTH + halfW + OFFSCREEN_MARGIN;
    });

  next.spawnCooldown -= dt;
  if (next.spawnCooldown <= 0) {
    const flying = next.chickens.filter((c) => !c.falling).length;
    if (flying < MAX_CHICKENS) {
      next.chickens = [...next.chickens, spawnChicken(next.nextId, rand)];
      next.nextId += 1;
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
