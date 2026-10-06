import { beforeEach, describe, expect, it } from "vitest";
import {
  DAILY_KEY,
  GHOST_EVERY,
  dailyNumber,
  dailySeed,
  ghostPoseAt,
  loadDailyBest,
  pushSample,
  saveDailyBest,
  shouldSample,
  todayKey,
} from "@/components/icytower/ghost";

describe("daily tower", () => {
  it("keys days by the local calendar date", () => {
    expect(todayKey(new Date(2026, 9, 6, 23, 59))).toBe("2026-10-06");
    expect(todayKey(new Date(2027, 0, 2))).toBe("2027-01-02");
  });

  it("numbers days from launch", () => {
    expect(dailyNumber("2026-10-06")).toBe(1);
    expect(dailyNumber("2026-10-07")).toBe(2);
    expect(dailyNumber("2027-10-06")).toBe(366);
  });

  it("gives every day its own seed", () => {
    expect(dailySeed("2026-10-06")).toBe(dailySeed("2026-10-06"));
    expect(dailySeed("2026-10-06")).not.toBe(dailySeed("2026-10-07"));
  });
});

describe("ghost replay", () => {
  it("samples every GHOST_EVERY steps", () => {
    expect(shouldSample(0)).toBe(true);
    expect(shouldSample(GHOST_EVERY - 1)).toBe(false);
    expect(shouldSample(GHOST_EVERY * 3)).toBe(true);
  });

  it("interpolates between samples and reports when the run is over", () => {
    const samples: number[] = [];
    pushSample(samples, 10.4, 0);
    pushSample(samples, 30, 80.6);
    expect(samples).toEqual([10, 0, 30, 81]);
    const mid = ghostPoseAt(samples, GHOST_EVERY / 2);
    expect(mid?.x).toBeCloseTo(20);
    expect(mid?.y).toBeCloseTo(40.5);
    expect(mid?.done).toBe(false);
    expect(ghostPoseAt(samples, GHOST_EVERY * 5)).toEqual({ x: 30, y: 81, vx: 0, done: true });
    expect(ghostPoseAt([], 0)).toBeNull();
  });

  describe("storage", () => {
    beforeEach(() => window.localStorage.clear());

    it("round-trips today's best run", () => {
      const run = { date: "2026-10-06", score: 420, floor: 30, samples: [1, 2, 3, 4] };
      saveDailyBest(run);
      expect(loadDailyBest("2026-10-06")).toEqual(run);
    });

    it("ignores runs from other days and corrupt data", () => {
      saveDailyBest({ date: "2026-10-05", score: 1, floor: 1, samples: [] });
      expect(loadDailyBest("2026-10-06")).toBeNull();
      window.localStorage.setItem(DAILY_KEY, "{not json");
      expect(loadDailyBest("2026-10-06")).toBeNull();
      window.localStorage.setItem(DAILY_KEY, JSON.stringify({ date: "2026-10-06", samples: [1] }));
      expect(loadDailyBest("2026-10-06")).toBeNull();
    });
  });
});
