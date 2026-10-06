// Per-stratum colour palettes. The sky, walls and weather blend between
// neighbouring strata as the camera climbs; each platform keeps the palette of
// the stratum it belongs to, so the next zone's ledges show up in its colours.
import { STRATA } from "@/components/icytower/tower";

export interface Palette {
  skyTop: number;
  skyBottom: number;
  auroraA: number;
  auroraB: number;
  aurora: number; // curtain intensity
  stars: number;
  mountain: number;
  planet: number; // 0..1 — the curve of a planet below you in orbit
  wall: number;
  seam: number;
  platform: number;
  rim: number;
  accent: number; // particles and combo text
  ambient: number;
  wind: number; // sideways snow drift, world units/s
  lightning: number; // flashes per second
}

export const PALETTES: readonly Palette[] = [
  // Glacier — polar dusk
  {
    skyTop: 0x06142c, skyBottom: 0x245d8c, auroraA: 0x3dffb0, auroraB: 0x3a8cff, aurora: 0.45,
    stars: 0.55, mountain: 0x081a33, planet: 0, wall: 0x4f9fd6, seam: 0x38d8ff,
    platform: 0x7cc9f2, rim: 0x6ff0ff, accent: 0xaef3ff, ambient: 0x9cc8ff, wind: 8, lightning: 0,
  },
  // Aurora Belt — the curtains come down
  {
    skyTop: 0x030820, skyBottom: 0x0d3446, auroraA: 0x2bff9a, auroraB: 0xb04dff, aurora: 1.15,
    stars: 0.85, mountain: 0x04101c, planet: 0, wall: 0x3fb89c, seam: 0x35ffb0,
    platform: 0x6fe6c8, rim: 0x55ffc0, accent: 0x7dffcf, ambient: 0x8ff0d0, wind: 14, lightning: 0,
  },
  // Storm Shelf — violet weather, sideways snow
  {
    skyTop: 0x090416, skyBottom: 0x33204f, auroraA: 0x8a5cff, auroraB: 0xff4fd8, aurora: 0.55,
    stars: 0.25, mountain: 0x0b0618, planet: 0, wall: 0x7c62d6, seam: 0xb36bff,
    platform: 0xa996f5, rim: 0xc39bff, accent: 0xe0b3ff, ambient: 0xb9a6ff, wind: 120, lightning: 0.18,
  },
  // Stratosphere — sunset under your feet
  {
    skyTop: 0x10042a, skyBottom: 0xd8603f, auroraA: 0xffb86b, auroraB: 0xff4f8b, aurora: 0.45,
    stars: 0.6, mountain: 0x1a0820, planet: 0, wall: 0xc9805e, seam: 0xff8a5c,
    platform: 0xf5b48e, rim: 0xffad70, accent: 0xffd2a8, ambient: 0xffc1a0, wind: 40, lightning: 0,
  },
  // Orbit — black sky, a planet below
  {
    skyTop: 0x000003, skyBottom: 0x070b24, auroraA: 0x4f7dff, auroraB: 0x9b5cff, aurora: 0.2,
    stars: 1.1, mountain: 0x000000, planet: 1, wall: 0x5b70c9, seam: 0x6f8bff,
    platform: 0x9aaaf0, rim: 0x8fa6ff, accent: 0xc6d2ff, ambient: 0xa8b8ff, wind: 0, lightning: 0,
  },
  // The Void — neon in nothing
  {
    skyTop: 0x000000, skyBottom: 0x12001f, auroraA: 0xff2bd6, auroraB: 0x00f0ff, aurora: 0.9,
    stars: 0.7, mountain: 0x000000, planet: 0, wall: 0xb0479a, seam: 0xff2bd6,
    platform: 0xf09ad8, rim: 0x00f0ff, accent: 0xff8ae8, ambient: 0xe0a0ff, wind: 0, lightning: 0.08,
  },
];

const BLEND_FLOORS = 14; // the palette starts shifting this many floors before a gate

/** Which two palettes to mix at `floor`, and how far towards the second. */
export function paletteBlend(floor: number): { from: number; to: number; t: number } {
  let from = 0;
  for (let i = STRATA.length - 1; i > 0; i--) {
    if (floor >= STRATA[i].from) {
      from = i;
      break;
    }
  }
  const to = Math.min(from + 1, STRATA.length - 1);
  if (to === from) return { from, to, t: 0 };
  const next = STRATA[to].from;
  const t = Math.min(1, Math.max(0, (floor - (next - BLEND_FLOORS)) / BLEND_FLOORS));
  return { from, to, t: t * t * (3 - 2 * t) };
}
