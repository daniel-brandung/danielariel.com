import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadBest, saveBest } from "@/components/game/storage";

describe("personal best storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns 0 when nothing is stored", () => {
    expect(loadBest()).toBe(0);
  });

  it("round-trips a saved score", () => {
    saveBest(120);
    expect(loadBest()).toBe(120);
  });

  it("ignores corrupted values", () => {
    window.localStorage.setItem("moorhuhn.best", "not-a-number");
    expect(loadBest()).toBe(0);
  });

  it("survives an unavailable storage", () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadBest()).toBe(0);
    getSpy.mockRestore();

    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => saveBest(50)).not.toThrow();
    setSpy.mockRestore();
  });
});
