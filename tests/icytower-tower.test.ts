import { describe, expect, it } from "vitest";
import {
  FIELD_W,
  FLOOR_GAP,
  PLATFORM_MIN_W,
  STRATA,
  hashSeed,
  platformAt,
  platformLeft,
  stratumIndexAt,
} from "@/components/icytower/tower";

const SEED = hashSeed("test-tower");

describe("tower layout", () => {
  it("is deterministic per seed and floor", () => {
    expect(platformAt(SEED, 37)).toEqual(platformAt(SEED, 37));
    const a = Array.from({ length: 20 }, (_, i) => platformAt(SEED, i + 1).x0);
    const b = Array.from({ length: 20 }, (_, i) => platformAt(SEED + 1, i + 1).x0);
    expect(a).not.toEqual(b);
  });

  it("puts every floor FLOOR_GAP above the previous one", () => {
    expect(platformAt(SEED, 0).y).toBe(0);
    expect(platformAt(SEED, 12).y).toBe(12 * FLOOR_GAP);
  });

  it("makes the ground and every stratum gate span the whole tower", () => {
    for (const floor of [0, 50, 100, 150, 200, 250, 300]) {
      const p = platformAt(SEED, floor);
      expect(p.full).toBe(true);
      expect(p.x0).toBe(0);
      expect(p.width).toBe(FIELD_W);
    }
  });

  it("keeps every platform — including its whole drift range — inside the walls", () => {
    for (let floor = 1; floor <= 400; floor++) {
      const p = platformAt(SEED, floor);
      expect(p.width).toBeGreaterThanOrEqual(PLATFORM_MIN_W);
      expect(p.x0 - p.driftAmp).toBeGreaterThanOrEqual(0);
      expect(p.x0 + p.driftAmp + p.width).toBeLessThanOrEqual(FIELD_W);
    }
  });

  it("narrows platforms as the tower rises", () => {
    const avg = (from: number) => {
      let sum = 0;
      for (let f = from; f < from + 40; f++) sum += platformAt(SEED, f).width;
      return sum / 40;
    };
    expect(avg(1)).toBeGreaterThan(avg(301));
  });

  it("introduces drifting ledges in the Storm Shelf and brittle ones in Orbit", () => {
    const kinds = (from: number, to: number) => {
      const set = new Set<string>();
      for (let f = from; f < to; f++) set.add(platformAt(SEED, f).kind);
      return set;
    };
    expect(kinds(1, 100)).toEqual(new Set(["solid"]));
    expect(kinds(101, 150).has("drift")).toBe(true);
    expect(kinds(101, 150).has("brittle")).toBe(false);
    expect(kinds(201, 250).has("brittle")).toBe(true);
  });

  it("sways drift platforms over time and leaves solid ones still", () => {
    let drift = platformAt(SEED, 101);
    for (let f = 102; drift.kind !== "drift"; f++) drift = platformAt(SEED, f);
    expect(platformLeft(drift, 0)).not.toBeCloseTo(platformLeft(drift, 1.3), 1);
    const solid = platformAt(SEED, 3);
    expect(platformLeft(solid, 0)).toBe(platformLeft(solid, 5));
  });

  it("maps floors to strata", () => {
    expect(stratumIndexAt(0)).toBe(0);
    expect(stratumIndexAt(49)).toBe(0);
    expect(stratumIndexAt(50)).toBe(1);
    expect(stratumIndexAt(10_000)).toBe(STRATA.length - 1);
  });
});
