import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createSkyDome,
  createStars,
  createTerrain,
  createTrees,
  createWindmill,
  seeded,
  terrainHeight,
} from "@/components/game3d/world";
import { createChickenTemplate, flapChicken, makeGolden } from "@/components/game3d/chicken";
import { FeatherParticles } from "@/components/game3d/particles";

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

describe("chicken mesh", () => {
  it("has flappable wings", () => {
    const c = createChickenTemplate();
    flapChicken(c, 0.5, false);
    const wingL = c.getObjectByName("wingL");
    const wingR = c.getObjectByName("wingR");
    expect(wingL).toBeDefined();
    expect(wingL!.rotation.x).not.toBe(0);
    expect(wingR!.rotation.x).toBeCloseTo(-wingL!.rotation.x);
  });

  it("golden variant gets its own emissive materials without touching the template", () => {
    const template = createChickenTemplate();
    const golden = template.clone();
    makeGolden(golden);
    const templateBody = template.getObjectByName("body") as THREE.Mesh;
    const goldenBody = golden.getObjectByName("body") as THREE.Mesh;
    expect((goldenBody.material as THREE.MeshLambertMaterial).color.getHex()).toBe(0xf5c542);
    expect((templateBody.material as THREE.MeshLambertMaterial).color.getHex()).toBe(0x8a5a33);
  });
});

describe("feather particles", () => {
  it("activates, moves, and expires a burst", () => {
    const p = new FeatherParticles();
    p.burst({ x: 1, y: 2, z: -10 }, false, () => 0.5);
    const pos = p.points.geometry.getAttribute("position") as THREE.BufferAttribute;
    expect(pos.getX(0)).toBeCloseTo(1);
    p.update(0.1);
    expect(pos.getX(0)).not.toBeCloseTo(1); // integrated along its velocity
    p.update(0.7); // past the 0.7 s lifetime
    expect(pos.getY(0)).toBe(9999); // dead particles are parked far away
    p.dispose();
  });
});
