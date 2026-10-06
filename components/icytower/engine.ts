// Pure game engine — no DOM, no Three.js. The component feeds it fixed
// STEP-sized ticks, which keeps runs deterministic: the same seed and the same
// inputs always produce the same climb (the daily ghost relies on that).
import {
  FIELD_W,
  FLOOR_GAP,
  STRATA,
  platformAt,
  platformLeft,
  stratumIndexAt,
  type Platform,
} from "@/components/icytower/tower";

export const STEP = 1 / 120;
export const VIEW_H = 640; // visible world height; falling below it ends the run

// player body (x is the centre, y the feet)
export const PLAYER_HALF_W = 14; // against the walls
export const FEET_HALF_W = 10; // against platform edges
export const PLAYER_H = 44;

// movement — tuned so a standing jump clears one floor and a full-speed jump ~5½
export const GRAVITY = 2700;
export const MAX_FALL = 1900;
export const MAX_VX = 720;
export const ACCEL_GROUND = 1350;
export const ACCEL_AIR = 1050;
export const TURN_BOOST = 2.2; // pushing against your own momentum bites harder
export const FRICTION_GROUND = 1150; // it's ice: you slide
export const DRAG_AIR = 140;
export const JUMP_BASE = 860;
export const JUMP_SPEED_BONUS = 1; // extra jump velocity per unit of horizontal speed
export const SUPER_JUMP_SPEED = MAX_VX * 0.7; // above this a jump becomes a spinning super jump
export const WALL_BOUNCE = 0.92; // airborne wall hits keep most of the speed
export const WALL_BOUNCE_GROUND = 0.35;
export const COYOTE = 0.08; // grace period to jump after running off a ledge
export const JUMP_BUFFER = 0.12; // a press this early still jumps on landing

// combos
export const COMBO_WINDOW = 3; // seconds to chain the next multi-floor jump
export const COMBO_MIN_JUMPS = 2; // a combo pays only after two multi-floor jumps

// the rising floor of doom
export const SCROLL_START_FLOOR = 5;
export const HURRY_INTERVAL = 30;
export const SCROLL_SPEEDS = [0, 60, 95, 130, 165, 200, 240, 280, 320]; // world units/s per level
export const CATCH_UP_LINE = 0.6; // above this share of the view the camera chases the player
const CATCH_UP_RATE = 10;
const FOLLOW_DOWN_LINE = 0.2; // before the clock starts, the camera also follows you back down
const START_CAMERA_Y = -VIEW_H * 0.12;
export const BRITTLE_DELAY = 0.45;
const CRACK_PRUNE_MARGIN = 2 * FLOOR_GAP;

export const COMBO_TIERS: readonly { min: number; word: string }[] = [
  { min: 4, word: "Cool" },
  { min: 8, word: "Frosty" },
  { min: 15, word: "Glacial" },
  { min: 25, word: "Avalanche" },
  { min: 35, word: "Blizzard" },
  { min: 50, word: "Aurora" },
  { min: 70, word: "Polar Vortex" },
  { min: 100, word: "Absolute Zero" },
  { min: 140, word: "Supernova" },
  { min: 200, word: "No Way!" },
];

/** Index into COMBO_TIERS for a combo of `floors`, or -1 below the first tier. */
export function comboTier(floors: number): number {
  let tier = -1;
  for (let i = 0; i < COMBO_TIERS.length; i++) {
    if (floors >= COMBO_TIERS[i].min) tier = i;
  }
  return tier;
}

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean; // held — holding it keeps jumping on every landing
}

export const NO_INPUT: Input = { left: false, right: false, jump: false };

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  floor: number; // floor stood on (or last stood on)
  coyote: number;
  jumpBuffer: number;
  superJump: boolean;
  facing: 1 | -1;
}

export interface Combo {
  jumps: number;
  floors: number;
  timer: number;
}

export interface Crack {
  floor: number;
  at: number; // run time of the first landing
}

export type Phase = "ready" | "playing" | "paused" | "over";

export interface TowerState {
  phase: Phase;
  seed: number;
  time: number; // run time, seconds
  steps: number;
  player: Player;
  cameraY: number; // world y of the bottom edge of the view
  scrolling: boolean;
  level: number; // hurry level; 0 until the tower starts to scroll
  hurryClock: number; // seconds into the current level
  lastFloor: number; // floor of the previous landing — combos measure from here
  maxFloor: number;
  combo: Combo;
  comboBonus: number;
  bestCombo: number;
  stratum: number;
  cracks: Crack[];
  jumpHeld: boolean; // last step's jump input, to detect fresh presses
}

export type TowerEvent =
  | { type: "jump"; power: number; superJump: boolean; x: number; y: number }
  | { type: "land"; floor: number; impact: number; x: number; y: number }
  | { type: "wallBounce"; side: -1 | 1; speed: number; x: number; y: number }
  | { type: "comboStep"; jumps: number; floors: number }
  | { type: "comboEnd"; jumps: number; floors: number; bonus: number; tier: number }
  | { type: "scrollStart" }
  | { type: "hurryUp"; level: number }
  | { type: "stratum"; index: number }
  | { type: "crack"; floor: number }
  | { type: "crumble"; floor: number }
  | { type: "gameOver"; score: number; floor: number; bestCombo: number; time: number };

export interface Tick {
  state: TowerState;
  events: TowerEvent[];
}

export function createInitialState(seed: number): TowerState {
  return {
    phase: "ready",
    seed,
    time: 0,
    steps: 0,
    player: {
      x: FIELD_W / 2,
      y: 0,
      vx: 0,
      vy: 0,
      grounded: true,
      floor: 0,
      coyote: 0,
      jumpBuffer: 0,
      superJump: false,
      facing: 1,
    },
    cameraY: START_CAMERA_Y,
    scrolling: false,
    level: 0,
    hurryClock: 0,
    lastFloor: 0,
    maxFloor: 0,
    combo: { jumps: 0, floors: 0, timer: 0 },
    comboBonus: 0,
    bestCombo: 0,
    stratum: 0,
    cracks: [],
    jumpHeld: false,
  };
}

export function startRun(seed: number): TowerState {
  return { ...createInitialState(seed), phase: "playing" };
}

export function pause(state: TowerState): TowerState {
  return state.phase === "playing" ? { ...state, phase: "paused" } : state;
}

export function resume(state: TowerState): TowerState {
  return state.phase === "paused" ? { ...state, phase: "playing" } : state;
}

export function scoreOf(state: TowerState): number {
  return state.maxFloor * 10 + state.comboBonus;
}

export function isCrumbled(state: TowerState, floor: number): boolean {
  return state.cracks.some((c) => c.floor === floor && state.time - c.at >= BRITTLE_DELAY);
}

function supports(platform: Platform, x: number, time: number): boolean {
  const left = platformLeft(platform, time);
  return x + FEET_HALF_W > left && x - FEET_HALF_W < left + platform.width;
}

function endCombo(state: TowerState, events: TowerEvent[]): void {
  const { jumps, floors } = state.combo;
  const pays = jumps >= COMBO_MIN_JUMPS;
  const bonus = pays ? floors * floors : 0;
  state.comboBonus += bonus;
  if (pays) state.bestCombo = Math.max(state.bestCombo, floors);
  events.push({ type: "comboEnd", jumps, floors, bonus, tier: pays ? comboTier(floors) : -1 });
  state.combo = { jumps: 0, floors: 0, timer: 0 };
}

/** Advance one fixed STEP. Returns the same state object when nothing can change. */
export function step(prev: TowerState, input: Input): Tick {
  if (prev.phase !== "playing") return { state: prev, events: [] };

  const events: TowerEvent[] = [];
  const s: TowerState = { ...prev, player: { ...prev.player }, combo: { ...prev.combo } };
  const p = s.player;
  const dt = STEP;
  const prevTime = s.time;
  s.time += dt;
  s.steps += 1;

  // --- run & slide -------------------------------------------------------
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    const accel = p.grounded ? ACCEL_GROUND : ACCEL_AIR;
    const turning = p.vx * dir < 0;
    p.vx += dir * accel * (turning ? TURN_BOOST : 1) * dt;
    p.facing = dir > 0 ? 1 : -1;
  } else {
    const decel = (p.grounded ? FRICTION_GROUND : DRAG_AIR) * dt;
    p.vx = Math.abs(p.vx) <= decel ? 0 : p.vx - Math.sign(p.vx) * decel;
  }
  p.vx = Math.max(-MAX_VX, Math.min(MAX_VX, p.vx));

  // ride drifting ledges
  if (p.grounded) {
    const under = platformAt(s.seed, p.floor);
    if (under.kind === "drift") p.x += platformLeft(under, s.time) - platformLeft(under, prevTime);
  }

  // --- jump ---------------------------------------------------------------
  const pressed = input.jump && !prev.jumpHeld;
  s.jumpHeld = input.jump;
  p.jumpBuffer = pressed ? JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);
  if (!p.grounded) p.coyote = Math.max(0, p.coyote - dt);

  if ((p.grounded || p.coyote > 0) && (input.jump || p.jumpBuffer > 0)) {
    const speed = Math.abs(p.vx);
    p.vy = JUMP_BASE + JUMP_SPEED_BONUS * speed;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.superJump = speed >= SUPER_JUMP_SPEED;
    events.push({ type: "jump", power: speed / MAX_VX, superJump: p.superJump, x: p.x, y: p.y });
  }

  // --- integrate ----------------------------------------------------------
  const gravity = GRAVITY * STRATA[stratumIndexAt(Math.max(0, Math.floor(p.y / FLOOR_GAP)))].gravity;
  const prevY = p.y;
  if (!p.grounded) {
    p.vy = Math.max(-MAX_FALL, p.vy - gravity * dt);
    p.y += p.vy * dt;
  }
  p.x += p.vx * dt;

  // --- walls --------------------------------------------------------------
  const wallHit = (side: -1 | 1) => {
    const speed = Math.abs(p.vx);
    if (p.grounded) {
      p.vx = -p.vx * WALL_BOUNCE_GROUND;
    } else {
      p.vx = -p.vx * WALL_BOUNCE;
      if (speed > 120) events.push({ type: "wallBounce", side, speed, x: p.x, y: p.y });
    }
  };
  if (p.x < PLAYER_HALF_W) {
    p.x = PLAYER_HALF_W;
    if (p.vx < 0) wallHit(-1);
  } else if (p.x > FIELD_W - PLAYER_HALF_W) {
    p.x = FIELD_W - PLAYER_HALF_W;
    if (p.vx > 0) wallHit(1);
  }

  // --- still standing on something? ---------------------------------------
  if (p.grounded) {
    const under = platformAt(s.seed, p.floor);
    if (isCrumbled(s, p.floor) || !supports(under, p.x, s.time)) {
      p.grounded = false;
      p.coyote = COYOTE;
      p.vy = 0;
    }
  }

  // --- landing (one-way platforms; at most one floor is crossed per step) ---
  if (!p.grounded && p.vy <= 0) {
    const floor = Math.floor(prevY / FLOOR_GAP);
    const top = floor * FLOOR_GAP;
    if (floor >= 0 && prevY >= top && p.y <= top) {
      const platform = platformAt(s.seed, floor);
      if (!isCrumbled(s, floor) && supports(platform, p.x, s.time)) {
        land(s, platform, events);
      }
    }
  }

  // --- combo clock ----------------------------------------------------------
  if (s.combo.jumps > 0) {
    s.combo.timer -= dt;
    if (s.combo.timer <= 0) endCombo(s, events);
  }

  // --- brittle ledges -------------------------------------------------------
  for (const c of s.cracks) {
    if (prevTime - c.at < BRITTLE_DELAY && s.time - c.at >= BRITTLE_DELAY) {
      events.push({ type: "crumble", floor: c.floor });
    }
  }
  if (s.cracks.length > 0) {
    const cutoff = s.cameraY - CRACK_PRUNE_MARGIN;
    if (s.cracks.some((c) => c.floor * FLOOR_GAP < cutoff)) {
      s.cracks = s.cracks.filter((c) => c.floor * FLOOR_GAP >= cutoff);
    }
  }

  // --- camera: the tower scrolls, and chases you when you climb fast ---------
  if (!s.scrolling && s.maxFloor >= SCROLL_START_FLOOR) {
    s.scrolling = true;
    s.level = 1;
    s.hurryClock = 0;
    events.push({ type: "scrollStart" });
  }
  if (s.scrolling) {
    if (s.level < SCROLL_SPEEDS.length - 1) {
      s.hurryClock += dt;
      if (s.hurryClock >= HURRY_INTERVAL) {
        s.level += 1;
        s.hurryClock -= HURRY_INTERVAL;
        events.push({ type: "hurryUp", level: s.level });
      }
    }
    s.cameraY += SCROLL_SPEEDS[s.level] * dt;
  }
  const target = p.y - VIEW_H * CATCH_UP_LINE;
  if (target > s.cameraY) s.cameraY += (target - s.cameraY) * Math.min(1, CATCH_UP_RATE * dt);
  if (!s.scrolling) {
    const low = Math.max(START_CAMERA_Y, p.y - VIEW_H * FOLLOW_DOWN_LINE);
    if (low < s.cameraY) s.cameraY += (low - s.cameraY) * Math.min(1, CATCH_UP_RATE * dt);
  }

  // --- off the bottom: game over (only once the tower is moving) ------------
  if (s.scrolling && p.y + PLAYER_H < s.cameraY) {
    if (s.combo.jumps > 0) endCombo(s, events);
    s.phase = "over";
    events.push({
      type: "gameOver",
      score: scoreOf(s),
      floor: s.maxFloor,
      bestCombo: s.bestCombo,
      time: s.time,
    });
  }

  return { state: s, events };
}

function land(s: TowerState, platform: Platform, events: TowerEvent[]): void {
  const p = s.player;
  const impact = Math.min(1, -p.vy / MAX_FALL);
  p.y = platform.y;
  p.vy = 0;
  p.grounded = true;
  p.superJump = false;
  p.floor = platform.floor;
  events.push({ type: "land", floor: platform.floor, impact, x: p.x, y: p.y });

  const climbed = platform.floor - s.lastFloor;
  if (climbed >= 2) {
    s.combo.jumps += 1;
    s.combo.floors += climbed;
    s.combo.timer = COMBO_WINDOW;
    events.push({ type: "comboStep", jumps: s.combo.jumps, floors: s.combo.floors });
  } else if (s.combo.jumps > 0) {
    endCombo(s, events);
  }
  s.lastFloor = platform.floor;

  if (platform.floor > s.maxFloor) {
    s.maxFloor = platform.floor;
    const stratum = stratumIndexAt(platform.floor);
    if (stratum > s.stratum) {
      s.stratum = stratum;
      events.push({ type: "stratum", index: stratum });
    }
  }

  if (platform.kind === "brittle" && !s.cracks.some((c) => c.floor === platform.floor)) {
    s.cracks = [...s.cracks, { floor: platform.floor, at: s.time }];
    events.push({ type: "crack", floor: platform.floor });
  }
}
