import { describe, expect, it } from "vitest";
import type * as THREE from "three";
import {
  createSkyDome,
  createStars,
  createTerrain,
  createTrees,
  createWindmill,
  seeded,
  terrainHeight,
} from "@/components/game3d/world";

describe("procedural world", () => {
  it("keeps the near field flat and the distance hilly", () => {
    expect(terrainHeight(0, -5)).toBe(0);
    expect(Math.abs(terrainHeight(80, -80))).toBeGreaterThan(0);
  });

  it("seeds a deterministic prng", () => {
    const a = seeded(7);
    const b = seeded(7);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it("builds a sky dome with gradient uniforms", () => {
    const sky = createSkyDome();
    const material = sky.material as THREE.ShaderMaterial;
    expect(material.uniforms.topColor).toBeDefined();
    expect(material.uniforms.horizonColor).toBeDefined();
  });

  it("builds 300 stars that start invisible", () => {
    const stars = createStars(seeded(1));
    expect(stars.geometry.getAttribute("position").count).toBe(300);
    expect((stars.material as THREE.PointsMaterial).opacity).toBe(0);
  });

  it("builds terrain, instanced trees, and a windmill with blades", () => {
    expect(createTerrain(seeded(2)).name).toBe("terrain");
    const trees = createTrees(seeded(3));
    expect(trees.children).toHaveLength(2); // instanced trunks + canopies
    const windmill = createWindmill();
    expect(windmill.getObjectByName("blades")?.children).toHaveLength(4);
  });
});
