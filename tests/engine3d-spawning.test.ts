import { describe, expect, it } from "vitest";
import {
  BANDS,
  GOLDEN_SPEED_FACTOR,
  GOLDEN_WEAVE_AMPLITUDE,
  GOLDEN_WEAVE_SPEED,
  GROUND_Y,
  MAX_CHICKENS,
  ROUND_SECONDS,
  createInitialState,
  startRound,
  update,
  type Chicken3D,
  type GameState3D,
} from "@/components/game3d/engine3d";

const noRand = () => 0.5;

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

// spawnCooldown 99 keeps the spawner quiet so movement asserts stay exact
const withChickens = (...chickens: Chicken3D[]): GameState3D => ({
  ...startRound(createInitialState()),
  spawnCooldown: 99,
  chickens,
});

describe("spawning", () => {
  it("spawns a deterministic chicken from the rand sequence", () => {
    // rand 0.5 → band mid, not golden, from the right, speed 10, y 6.5, z -25
    const { state } = update(startRound(createInitialState()), 0.016, noRand);
    expect(state.chickens).toHaveLength(1);
    const c = state.chickens[0];
    expect(c.band).toBe("mid");
    expect(c.golden).toBe(false);
    expect(c.pos.x).toBe(BANDS.mid.xExtent);
    expect(c.vx).toBeCloseTo(-10);
    expect(c.baseY).toBeCloseTo(6.5);
    expect(c.pos.z).toBeCloseTo(BANDS.mid.z);
    expect(state.spawnCooldown).toBeGreaterThan(0);
  });

  it("caps simultaneous flying chickens", () => {
    const s = {
      ...startRound(createInitialState()),
      spawnCooldown: 0,
      chickens: Array.from({ length: MAX_CHICKENS }, (_, i) => chicken({ id: i + 1 })),
    };
    const { state } = update(s, 0.016, noRand);
    expect(state.chickens).toHaveLength(MAX_CHICKENS);
    expect(state.spawnCooldown).toBeGreaterThan(0); // cooldown still re-arms
  });

  it("rolls a natural golden chicken", () => {
    // call order: band, golden, side, speed, altitude, depth jitter, weave, interval jitter
    const seq = [0.5, 0.01, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    let i = 0;
    const rand = () => seq[Math.min(i++, seq.length - 1)];
    const { state, events } = update(startRound(createInitialState()), 0.016, rand);
    expect(state.chickens[0].golden).toBe(true);
    expect(state.chickens[0].vx).toBeCloseTo(-10 * GOLDEN_SPEED_FACTOR);
    expect(state.goldenSpawned).toBe(true);
    expect(events).toContainEqual({ type: "goldenSpawn" });
  });

  it("forces a golden chicken in the second half if none appeared", () => {
    const s = { ...startRound(createInitialState()), timeLeft: ROUND_SECONDS / 2 };
    const { state, events } = update(s, 0.016, noRand);
    expect(state.chickens[0]?.golden).toBe(true);
    expect(state.goldenSpawned).toBe(true);
    expect(events).toContainEqual({ type: "goldenSpawn" });
  });

  it("does not force gold in the first half", () => {
    const { state } = update(startRound(createInitialState()), 0.016, noRand);
    expect(state.chickens[0]?.golden).toBe(false);
  });
});

describe("movement", () => {
  it("moves flying chickens along x", () => {
    const { state } = update(withChickens(chicken({})), 0.5, noRand);
    expect(state.chickens[0].pos.x).toBeCloseTo(5);
    expect(state.chickens[0].pos.y).toBeCloseTo(5); // non-golden altitude is stable
  });

  it("weaves golden chickens around their base altitude", () => {
    const { state } = update(withChickens(chicken({ golden: true, baseY: 6, pos: { x: 0, y: 6, z: -25 } })), 0.1, noRand);
    const expectedY = 6 + Math.sin(0.1 * GOLDEN_WEAVE_SPEED) * GOLDEN_WEAVE_AMPLITUDE;
    expect(state.chickens[0].pos.y).toBeCloseTo(expectedY);
  });

  it("drops shot chickens and culls them below the ground", () => {
    const dropped = update(withChickens(chicken({ falling: true, fallVy: 5, pos: { x: 0, y: 3, z: -25 } })), 0.1, noRand).state;
    expect(dropped.chickens[0].pos.y).toBeLessThan(3);
    expect(dropped.chickens[0].fallVy).toBeGreaterThan(5);

    const culled = update(withChickens(chicken({ falling: true, fallVy: 5, pos: { x: 0, y: GROUND_Y - 0.1, z: -25 } })), 0.016, noRand).state;
    expect(culled.chickens).toHaveLength(0);
  });

  it("despawns chickens beyond their band extent", () => {
    const { state } = update(withChickens(chicken({ pos: { x: 200, y: 5, z: -25 } })), 0.016, noRand);
    expect(state.chickens).toHaveLength(0);
  });
});
