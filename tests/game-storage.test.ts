import { beforeEach, describe, expect, it, vi } from "vitest";
import { BEST_3D_KEY, CLASSIC_BEST_KEY, loadBest, saveBest } from "@/components/game/storage";

describe("personal best storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps the classic key stable so existing bests survive", () => {
    expect(CLASSIC_BEST_KEY).toBe("moorhuhn.best");
    expect(BEST_3D_KEY).toBe("moorhuhn3d.best");
  });

  it("returns 0 when nothing is stored", () => {
    expect(loadBest(CLASSIC_BEST_KEY)).toBe(0);
    expect(loadBest(BEST_3D_KEY)).toBe(0);
  });

  it("round-trips a saved score per key", () => {
    saveBest(CLASSIC_BEST_KEY, 120);
    saveBest(BEST_3D_KEY, 300);
    expect(loadBest(CLASSIC_BEST_KEY)).toBe(120);
    expect(loadBest(BEST_3D_KEY)).toBe(300);
  });

  it("ignores corrupted values", () => {
    window.localStorage.setItem(CLASSIC_BEST_KEY, "not-a-number");
    expect(loadBest(CLASSIC_BEST_KEY)).toBe(0);
  });

  it("survives an unavailable storage", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadBest(CLASSIC_BEST_KEY)).toBe(0);
    getSpy.mockRestore();

    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => saveBest(CLASSIC_BEST_KEY, 50)).not.toThrow();
    setSpy.mockRestore();
  });
});
