import { describe, expect, it } from "vitest";
import { skyColorsAt, type Rgb } from "@/components/game3d/daynight";

const expectRgbClose = (actual: Rgb, expected: Rgb) => {
  expect(actual[0]).toBeCloseTo(expected[0]);
  expect(actual[1]).toBeCloseTo(expected[1]);
  expect(actual[2]).toBeCloseTo(expected[2]);
};

describe("day/night ramp", () => {
  it("starts at the dusk keyframe", () => {
    const c = skyColorsAt(0);
    expectRgbClose(c.horizon, [0.95, 0.52, 0.24]);
    expectRgbClose(c.top, [0.1, 0.16, 0.3]);
    expect(c.starAlpha).toBe(0);
    expect(c.lightIntensity).toBeCloseTo(1);
  });

  it("ends at the night keyframe", () => {
    const c = skyColorsAt(1);
    expectRgbClose(c.top, [0.01, 0.02, 0.06]);
    expect(c.starAlpha).toBeCloseTo(1);
    expect(c.lightIntensity).toBeCloseTo(0.35);
  });

  it("clamps out-of-range progress", () => {
    expect(skyColorsAt(-1)).toEqual(skyColorsAt(0));
    expect(skyColorsAt(2)).toEqual(skyColorsAt(1));
  });

  it("darkens monotonically while stars fade in", () => {
    let prevBrightness = Infinity;
    let prevStars = -1;
    for (let p = 0; p <= 1.001; p += 0.05) {
      const c = skyColorsAt(p);
      const brightness = c.top[0] + c.top[1] + c.top[2];
      expect(brightness).toBeLessThanOrEqual(prevBrightness + 1e-9);
      expect(c.starAlpha).toBeGreaterThanOrEqual(prevStars - 1e-9);
      prevBrightness = brightness;
      prevStars = c.starAlpha;
    }
  });
});
