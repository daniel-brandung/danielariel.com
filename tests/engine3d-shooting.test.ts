import { describe, expect, it } from "vitest";
import {
  CHICKEN_RADIUS,
  GOLDEN_POINTS,
  MAX_MULTIPLIER,
  createInitialState,
  rayDistanceTo,
  shoot,
  startRound,
  type Chicken3D,
  type GameState3D,
  type Ray,
} from "@/components/game3d/engine3d";

const chicken = (overrides: Partial<Chicken3D>): Chicken3D => ({
  id: 1,
  band: "mid",
  golden: false,
  pos: { x: 0, y: 5, z: -25 },
  vx: 10,
  baseY: 5,
  weavePhase: 0,
  falling: false,
  fallVy: 0,
  ...overrides,
});

const withChickens = (...chickens: Chicken3D[]): GameState3D => ({
  ...startRound(createInitialState()),
  spawnCooldown: 99,
  chickens,
});

// straight down -z from height y — a guaranteed center hit at matching x/y
const rayAt = (x: number, y: number): Ray => ({
  origin: { x, y, z: 0 },
  dir: { x: 0, y: 0, z: -1 },
});

describe("ray-sphere hit testing", () => {
  it("returns the distance to a center hit", () => {
    expect(rayDistanceTo(rayAt(0, 5), chicken({}))).toBeCloseTo(25 - CHICKEN_RADIUS);
  });

  it("misses beyond the hit radius and grazes inside it", () => {
    expect(rayDistanceTo(rayAt(CHICKEN_RADIUS + 0.2, 5), chicken({}))).toBeNull();
    expect(rayDistanceTo(rayAt(CHICKEN_RADIUS - 0.1, 5), chicken({}))).not.toBeNull();
  });

  it("never hits chickens behind the ray", () => {
    expect(rayDistanceTo(rayAt(0, 5), chicken({ pos: { x: 0, y: 5, z: 25 } }))).toBeNull();
  });
});

describe("shooting and combos", () => {
  it("scores band points, drops the chicken, and raises the combo", () => {
    const { state, events } = shoot(withChickens(chicken({})), rayAt(0, 5));
    expect(state.shells).toBe(7);
    expect(state.score).toBe(10); // mid band at ×1
    expect(state.multiplier).toBe(2);
    expect(state.chickens[0].falling).toBe(true);
    expect(events).toContainEqual({ type: "shot" });
    expect(events).toContainEqual({ type: "hit", points: 10, pos: { x: 0, y: 5, z: -25 }, golden: false });
    expect(events).toContainEqual({ type: "combo", multiplier: 2 });
  });

  it("applies the current multiplier and caps it", () => {
    const s = { ...withChickens(chicken({})), multiplier: MAX_MULTIPLIER };
    const { state, events } = shoot(s, rayAt(0, 5));
    expect(state.score).toBe(10 * MAX_MULTIPLIER);
    expect(state.multiplier).toBe(MAX_MULTIPLIER);
    expect(events.some((e) => e.type === "combo")).toBe(false);
  });

  it("pays golden points times the multiplier", () => {
    const s = { ...withChickens(chicken({ golden: true })), multiplier: 2 };
    const { state } = shoot(s, rayAt(0, 5));
    expect(state.score).toBe(GOLDEN_POINTS * 2);
  });

  it("hits the nearest chicken along the ray", () => {
    const near = chicken({ id: 1, band: "near", pos: { x: 0, y: 5, z: -12 } });
    const mid = chicken({ id: 2, band: "mid", pos: { x: 0, y: 5, z: -25 } });
    const { state } = shoot(withChickens(mid, near), rayAt(0, 5));
    expect(state.score).toBe(5); // near band
    expect(state.chickens.find((c) => c.id === 1)?.falling).toBe(true);
    expect(state.chickens.find((c) => c.id === 2)?.falling).toBe(false);
  });

  it("resets the combo on a miss but still spends the shell", () => {
    const s = { ...withChickens(chicken({})), multiplier: 3 };
    const { state, events } = shoot(s, rayAt(50, 50));
    expect(state.shells).toBe(7);
    expect(state.multiplier).toBe(1);
    expect(events).toEqual([{ type: "shot" }]);
  });

  it("resets the combo on an empty chamber", () => {
    const s = { ...withChickens(chicken({})), shells: 0, multiplier: 3 };
    const { state, events } = shoot(s, rayAt(0, 5));
    expect(events).toEqual([{ type: "empty" }]);
    expect(state.multiplier).toBe(1);
    expect(state.chickens[0].falling).toBe(false);
  });

  it("does not shoot while reloading or outside play", () => {
    const reloading = { ...withChickens(chicken({})), reloading: true };
    expect(shoot(reloading, rayAt(0, 5)).events).toEqual([]);
    const ready = { ...createInitialState(), chickens: [chicken({})] };
    expect(shoot(ready, rayAt(0, 5)).events).toEqual([]);
  });

  it("ignores chickens that are already falling", () => {
    const { state, events } = shoot(withChickens(chicken({ falling: true })), rayAt(0, 5));
    expect(state.score).toBe(0);
    expect(events).toEqual([{ type: "shot" }]);
  });
});
