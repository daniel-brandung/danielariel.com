import { describe, expect, it } from "vitest";
import {
  CHICKEN_WIDTH,
  LAYERS,
  MAX_CHICKENS,
  SPAWN_INTERVAL_END,
  SPAWN_INTERVAL_START,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  createInitialState,
  startRound,
  update,
  type Chicken,
  type GameState,
} from "@/components/game/engine";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const playing = (): GameState => startRound(createInitialState());

const chicken = (overrides: Partial<Chicken>): Chicken => ({
  id: 999,
  layer: "mid",
  x: 400,
  y: 300,
  vx: 180,
  falling: false,
  fallVy: 0,
  ...overrides,
});

describe("spawning and movement", () => {
  it("spawns on the first tick and schedules the next spawn within ramp bounds", () => {
    // rand call order: layer, side, speed, y, cooldown jitter (0.5 → 1.0× interval)
    const { state } = update(playing(), 0.001, seq(0.9, 0.2, 0.5, 0.5, 0.5));
    expect(state.chickens).toHaveLength(1);
    const c = state.chickens[0];
    expect(c.layer).toBe("near"); // floor(0.9 × 3) → third bucket
    expect(c.vx).toBeGreaterThan(0); // side 0.2 < 0.5 → enters from the left
    expect(state.spawnCooldown).toBeGreaterThan(SPAWN_INTERVAL_END);
    expect(state.spawnCooldown).toBeLessThanOrEqual(SPAWN_INTERVAL_START);
  });

  it("respects the on-screen cap", () => {
    const crowd = Array.from({ length: MAX_CHICKENS }, (_, i) => chicken({ id: i + 1 }));
    const s: GameState = { ...playing(), chickens: crowd };
    const { state } = update(s, 0.001, seq(0.5));
    expect(state.chickens.filter((c) => !c.falling)).toHaveLength(MAX_CHICKENS);
    expect(state.spawnCooldown).toBeGreaterThan(0); // cooldown still reset
  });

  it("moves flying chickens horizontally", () => {
    const s: GameState = { ...playing(), spawnCooldown: 99, chickens: [chicken({ x: 400, vx: 200 })] };
    const { state } = update(s, 0.5, seq(0.5));
    expect(state.chickens[0].x).toBeCloseTo(500);
  });

  it("despawns chickens once fully off screen", () => {
    const gone = chicken({ x: VIRTUAL_WIDTH + CHICKEN_WIDTH * LAYERS.mid.scale + 100, vx: 200 });
    const s: GameState = { ...playing(), spawnCooldown: 99, chickens: [gone] };
    const { state } = update(s, 0.016, seq(0.5));
    expect(state.chickens).toHaveLength(0);
  });

  it("drops falling chickens with gravity and removes them below the ground", () => {
    const s: GameState = {
      ...playing(),
      spawnCooldown: 99,
      chickens: [chicken({ falling: true, fallVy: 0, y: 300 })],
    };
    const first = update(s, 0.1, seq(0.5)).state;
    expect(first.chickens[0].y).toBeGreaterThan(300);
    expect(first.chickens[0].fallVy).toBeGreaterThan(0);

    const low: GameState = {
      ...playing(),
      spawnCooldown: 99,
      chickens: [chicken({ falling: true, fallVy: 800, y: VIRTUAL_HEIGHT + 200 })],
    };
    expect(update(low, 0.1, seq(0.5)).state.chickens).toHaveLength(0);
  });
});
