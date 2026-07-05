import { describe, expect, it } from "vitest";
import { CHICKEN_FRAME_SVGS } from "@/components/game/sprites";

describe("chicken sprite art", () => {
  it("provides two distinct, well-formed SVG frames", () => {
    expect(CHICKEN_FRAME_SVGS).toHaveLength(2);
    expect(CHICKEN_FRAME_SVGS[0]).not.toBe(CHICKEN_FRAME_SVGS[1]);
    for (const svg of CHICKEN_FRAME_SVGS) {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(doc.querySelector("parsererror")).toBeNull();
      expect(doc.documentElement.tagName.toLowerCase()).toBe("svg");
      expect(svg).toContain('viewBox="0 0 96 84"');
    }
  });
});
