import { describe, expect, it } from "vitest";
import {
  CHICKEN_WIDTH,
  LAYERS,
  createInitialState,
  hitTest,
  shoot,
  startRound,
  update,
  type Chicken,
  type GameState,
} from "@/components/game/engine";

const noRand = () => 0.5;

const chicken = (overrides: Partial<Chicken>): Chicken => ({
  id: 1,
  layer: "mid",
  x: 400,
  y: 300,
  vx: 180,
  falling: false,
  fallVy: 0,
  ...overrides,
});

const withChickens = (...chickens: Chicken[]): GameState => ({
  ...startRound(createInitialState()),
  spawnCooldown: 99,
  chickens,
});

describe("hit testing and scoring", () => {
  it("hit-tests against the scaled sprite box", () => {
    const far = chicken({ layer: "far" });
    const halfW = (CHICKEN_WIDTH * LAYERS.far.scale) / 2;
    expect(hitTest(far, 400 + halfW - 1, 300)).toBe(true);
    expect(hitTest(far, 400 + halfW + 2, 300)).toBe(false);
  });

  it("awards layer points, drops the chicken, and spawns effects", () => {
    const s = withChickens(chicken({ layer: "far", id: 7 }));
    const { state, events } = shoot(s, 400, 300);
    expect(state.score).toBe(15);
    expect(state.chickens[0].falling).toBe(true);
    expect(state.popups).toHaveLength(1);
    expect(state.popups[0]).toMatchObject({ points: 15, x: 400, y: 300 });
    expect(state.bursts).toHaveLength(1);
    expect(events).toContainEqual({ type: "hit", points: 15, x: 400, y: 300 });
  });

  it("prefers the nearest layer when chickens overlap", () => {
    const s = withChickens(chicken({ id: 1, layer: "far" }), chicken({ id: 2, layer: "near" }));
    const { state } = shoot(s, 400, 300);
    expect(state.score).toBe(LAYERS.near.points);
    expect(state.chickens.find((c) => c.id === 2)?.falling).toBe(true);
    expect(state.chickens.find((c) => c.id === 1)?.falling).toBe(false);
  });

  it("does not hit chickens that are already falling", () => {
    const s = withChickens(chicken({ falling: true }));
    const { state, events } = shoot(s, 400, 300);
    expect(state.score).toBe(0);
    expect(events).toEqual([{ type: "shot" }]);
  });

  it("ages score popups and feather bursts out", () => {
    let s = withChickens(chicken({}));
    s = shoot(s, 400, 300).state;
    const mid = update(s, 0.3, noRand).state;
    expect(mid.popups).toHaveLength(1);
    expect(mid.bursts).toHaveLength(1); // burst lives 0.5 s
    const later = update(mid, 0.4, noRand).state;
    expect(later.bursts).toHaveLength(0);
    expect(later.popups).toHaveLength(1); // popup lives 0.8 s (age 0.7 here)
    expect(update(later, 0.2, noRand).state.popups).toHaveLength(0);
  });
});
