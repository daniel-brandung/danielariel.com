import { describe, expect, it } from "vitest";
import {
  BRITTLE_DELAY,
  COMBO_TIERS,
  COMBO_WINDOW,
  FEET_HALF_W,
  HURRY_INTERVAL,
  MAX_VX,
  NO_INPUT,
  PLAYER_H,
  PLAYER_HALF_W,
  STEP,
  comboTier,
  createInitialState,
  pause,
  resume,
  scoreOf,
  startRun,
  step,
  type Input,
  type TowerEvent,
  type TowerState,
} from "@/components/icytower/engine";
import { FIELD_W, FLOOR_GAP, hashSeed, platformAt } from "@/components/icytower/tower";

const SEED = hashSeed("engine-tests");
const JUMP: Input = { left: false, right: false, jump: true };

function run(state: TowerState, input: Input, seconds: number) {
  const events: TowerEvent[] = [];
  let s = state;
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    const tick = step(s, input);
    s = tick.state;
    events.push(...tick.events);
  }
  return { state: s, events };
}

/** Apex height of a jump taken from the ground with the given horizontal speed. */
function apexOfJump(vx: number, from: TowerState = startRun(SEED)): number {
  let s: TowerState = { ...from, player: { ...from.player, vx } };
  const startY = s.player.y;
  let apex = startY;
  s = step(s, JUMP).state;
  for (let i = 0; i < 400 && s.player.vy > 0; i++) {
    // keep running so the jump speed is not bled off by friction
    s = step(s, { left: vx < 0, right: vx > 0, jump: false }).state;
    apex = Math.max(apex, s.player.y);
  }
  return apex - startY;
}

/** Put the player just above `floor`, falling, over the middle of its platform. */
function dropOnto(state: TowerState, floor: number): TowerState {
  const p = platformAt(state.seed, floor);
  return {
    ...state,
    cameraY: Math.min(state.cameraY, p.y - 200),
    player: {
      ...state.player,
      x: p.x0 + p.width / 2,
      y: p.y + 1,
      vx: 0,
      vy: -200,
      grounded: false,
    },
  };
}

describe("run lifecycle", () => {
  it("waits in ready and freezes when paused or over", () => {
    const ready = createInitialState(SEED);
    expect(step(ready, JUMP).state).toBe(ready);
    const paused = pause(startRun(SEED));
    expect(paused.phase).toBe("paused");
    expect(step(paused, JUMP).state).toBe(paused);
    expect(resume(paused).phase).toBe("playing");
  });

  it("is deterministic for the same seed and inputs", () => {
    const script = (i: number): Input => ({
      left: i % 240 > 160,
      right: i % 240 < 120,
      jump: i % 90 < 30,
    });
    const play = () => {
      let s = startRun(SEED);
      for (let i = 0; i < 1200; i++) s = step(s, script(i)).state;
      return s;
    };
    expect(play()).toEqual(play());
  });
});

describe("movement", () => {
  it("clears one floor from a standing jump but not two", () => {
    const h = apexOfJump(0);
    expect(h).toBeGreaterThan(FLOOR_GAP);
    expect(h).toBeLessThan(2 * FLOOR_GAP);
  });

  it("turns full speed into a jump of more than four floors", () => {
    expect(apexOfJump(MAX_VX)).toBeGreaterThan(4 * FLOOR_GAP);
  });

  it("flags full-speed jumps as super jumps", () => {
    const s = startRun(SEED);
    const { events } = step({ ...s, player: { ...s.player, vx: MAX_VX } }, JUMP);
    expect(events).toContainEqual(expect.objectContaining({ type: "jump", superJump: true }));
  });

  it("caps running speed", () => {
    const { state } = run(startRun(SEED), { left: false, right: true, jump: false }, 0.2);
    const { state: later } = run(
      { ...state, player: { ...state.player, x: 50 } },
      { left: false, right: true, jump: false },
      0.3,
    );
    expect(Math.abs(later.player.vx)).toBeLessThanOrEqual(MAX_VX);
  });

  it("slides to a stop on the ice when the input is released", () => {
    const s = startRun(SEED);
    const { state } = run({ ...s, player: { ...s.player, vx: 400 } }, NO_INPUT, 1);
    expect(state.player.vx).toBe(0);
  });

  it("bounces off the walls in mid-air and keeps most of the speed", () => {
    const s = startRun(SEED);
    const airborne: TowerState = {
      ...s,
      player: { ...s.player, x: PLAYER_HALF_W + 1, y: 40, vx: -600, vy: 300, grounded: false },
    };
    const { state, events } = step(airborne, NO_INPUT);
    expect(state.player.vx).toBeGreaterThan(500);
    expect(events).toContainEqual(expect.objectContaining({ type: "wallBounce", side: -1 }));
    expect(state.player.x).toBeGreaterThanOrEqual(PLAYER_HALF_W);
    expect(state.player.x).toBeLessThanOrEqual(FIELD_W - PLAYER_HALF_W);
  });

  it("jumps through platforms from below and lands on them from above", () => {
    const floor1 = platformAt(SEED, 1);
    const s = startRun(SEED);
    const under: TowerState = {
      ...s,
      player: { ...s.player, x: floor1.x0 + floor1.width / 2, y: floor1.y - 30, vy: 600, grounded: false },
    };
    const { state, events } = run(under, NO_INPUT, 0.8);
    expect(events).toContainEqual(expect.objectContaining({ type: "land", floor: 1 }));
    expect(state.player.grounded).toBe(true);
    expect(state.player.y).toBe(floor1.y);
  });

  it("falls when running off the end of a ledge", () => {
    const floor1 = platformAt(SEED, 1);
    const s = startRun(SEED);
    const onEdge: TowerState = {
      ...s,
      lastFloor: 1,
      player: { ...s.player, x: floor1.x0 + floor1.width - 1, y: floor1.y, floor: 1, grounded: true, vx: 0 },
    };
    const dir = floor1.x0 + floor1.width < FIELD_W - 40 ? "right" : "left";
    const edgeX = dir === "right" ? floor1.x0 + floor1.width - 1 : floor1.x0 + 1;
    const start = { ...onEdge, player: { ...onEdge.player, x: edgeX } };
    const { state } = run(start, { left: dir === "left", right: dir === "right", jump: false }, 0.25);
    expect(state.player.grounded).toBe(false);
    expect(state.player.y).toBeLessThan(floor1.y);
    // the feet really are past the edge
    const offRight = state.player.x - FEET_HALF_W >= floor1.x0 + floor1.width;
    const offLeft = state.player.x + FEET_HALF_W <= floor1.x0;
    expect(offRight || offLeft).toBe(true);
  });
});

describe("combos", () => {
  it("chains multi-floor landings and pays floors² once it ends", () => {
    let s = startRun(SEED);
    let tick = step(dropOnto(s, 3), NO_INPUT);
    expect(tick.events).toContainEqual({ type: "comboStep", jumps: 1, floors: 3 });
    tick = step(dropOnto(tick.state, 6), NO_INPUT);
    expect(tick.events).toContainEqual({ type: "comboStep", jumps: 2, floors: 6 });
    // a one-floor hop breaks the chain
    tick = step(dropOnto(tick.state, 7), NO_INPUT);
    expect(tick.events).toContainEqual({
      type: "comboEnd",
      jumps: 2,
      floors: 6,
      bonus: 36,
      tier: comboTier(6),
    });
    s = tick.state;
    expect(s.comboBonus).toBe(36);
    expect(s.bestCombo).toBe(6);
    expect(scoreOf(s)).toBe(7 * 10 + 36);
  });

  it("pays nothing for a single multi-floor jump", () => {
    const first = step(dropOnto(startRun(SEED), 3), NO_INPUT).state;
    const { state, events } = step(dropOnto(first, 4), NO_INPUT);
    expect(events).toContainEqual(expect.objectContaining({ type: "comboEnd", bonus: 0, tier: -1 }));
    expect(state.comboBonus).toBe(0);
  });

  it("ends the combo when its clock runs out", () => {
    let s = step(dropOnto(startRun(SEED), 2), NO_INPUT).state;
    s = step(dropOnto(s, 4), NO_INPUT).state;
    const { state, events } = run(s, NO_INPUT, COMBO_WINDOW + 0.1);
    expect(events).toContainEqual(expect.objectContaining({ type: "comboEnd", bonus: 16 }));
    expect(state.combo.jumps).toBe(0);
  });

  it("names combo tiers by size", () => {
    expect(comboTier(3)).toBe(-1);
    expect(COMBO_TIERS[comboTier(4)].word).toBe("Cool");
    expect(COMBO_TIERS[comboTier(260)].word).toBe("No Way!");
  });
});

describe("the rising tower", () => {
  it("starts scrolling once the player reaches floor 5", () => {
    const s = startRun(SEED);
    expect(s.scrolling).toBe(false);
    const { state, events } = step(dropOnto(s, 5), NO_INPUT);
    expect(events).toContainEqual({ type: "scrollStart" });
    expect(state.level).toBe(1);
    const later = run(state, NO_INPUT, 1).state;
    expect(later.cameraY).toBeGreaterThan(state.cameraY);
  });

  it("follows the player back down until the clock starts, and never after", () => {
    const s = startRun(SEED);
    const high: TowerState = { ...s, cameraY: 400, player: { ...s.player, y: 300, vy: -900, grounded: false } };
    const calm = run(high, NO_INPUT, 0.4).state;
    expect(calm.phase).toBe("playing");
    expect(calm.cameraY).toBeLessThan(400);

    const rising: TowerState = { ...high, scrolling: true, level: 1 };
    const { state } = run(rising, NO_INPUT, 0.2);
    expect(state.cameraY).toBeGreaterThan(400);
  });

  it("hurries up every 30 seconds", () => {
    const s: TowerState = { ...startRun(SEED), scrolling: true, level: 1, hurryClock: HURRY_INTERVAL - STEP / 2 };
    const { state, events } = step(s, NO_INPUT);
    expect(events).toContainEqual({ type: "hurryUp", level: 2 });
    expect(state.level).toBe(2);
  });

  it("ends the run when the player drops below the view", () => {
    const s = startRun(SEED);
    const sunk: TowerState = {
      ...s,
      scrolling: true,
      level: 1,
      maxFloor: 3,
      comboBonus: 9,
      cameraY: s.player.y + PLAYER_H + 5,
    };
    const { state, events } = step(sunk, NO_INPUT);
    expect(state.phase).toBe("over");
    expect(events).toContainEqual(expect.objectContaining({ type: "gameOver", score: 39, floor: 3 }));
  });

  it("announces each new stratum once", () => {
    const { events } = step(dropOnto(startRun(SEED), 50), NO_INPUT);
    expect(events).toContainEqual({ type: "stratum", index: 1 });
  });

  it("floats higher in the thin air of the Stratosphere", () => {
    const base = startRun(SEED);
    const high: TowerState = {
      ...base,
      cameraY: 150 * FLOOR_GAP - 200,
      player: { ...base.player, y: 150 * FLOOR_GAP, floor: 150 },
    };
    expect(apexOfJump(0, high)).toBeGreaterThan(apexOfJump(0) * 1.15);
  });

  it("crumbles brittle ledges shortly after landing", () => {
    let floor = 201;
    while (platformAt(SEED, floor).kind !== "brittle") floor++;
    const s = { ...startRun(SEED), lastFloor: floor, maxFloor: floor };
    const landed = step(dropOnto(s, floor), NO_INPUT);
    expect(landed.events).toContainEqual({ type: "crack", floor });
    expect(landed.state.player.grounded).toBe(true);
    const { state, events } = run(landed.state, NO_INPUT, BRITTLE_DELAY + 0.05);
    expect(events).toContainEqual({ type: "crumble", floor });
    expect(state.player.grounded).toBe(false);
  });
});
