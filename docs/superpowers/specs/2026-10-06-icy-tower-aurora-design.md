# Icy Tower: Aurora — Design Spec

**Date:** 2026-10-06
**Status:** Built

## Goal

A third arcade game at `/play/icy-tower`: our own take on Icy Tower. Keep the
original's feel (momentum jumps, wall bounces, floor combos, a tower that
scrolls faster and faster) and redesign everything around it: a neon polar
night rendered in WebGL with bloom, an adaptive synthesized soundtrack, altitude
strata that change the rules, and a daily tower with a ghost of your best climb.

## Architecture

Same split as Moorhuhn 3D: a pure, deterministic engine plus a thin client
component that owns Three.js, input, audio and the DOM HUD. The game loads
client-only via `IcyTowerLoader` (`dynamic`, `ssr: false`).

| File | Role |
|---|---|
| `components/icytower/tower.ts` | Pure layout: `platformAt(seed, floor)` derives each floor's ledge from a per-floor hash, so floors can be looked up in any order. Strata table, drift motion. |
| `components/icytower/engine.ts` | Pure physics and rules, advanced in fixed `STEP = 1/120 s` ticks. Emits events (`jump`, `land`, `wallBounce`, `comboStep`, `comboEnd`, `scrollStart`, `hurryUp`, `stratum`, `crack`, `crumble`, `gameOver`). |
| `components/icytower/ghost.ts` | Daily seed and number, ghost sampling (20 Hz) and interpolation, `localStorage` persistence of today's best run. |
| `components/icytower/audio.ts` | Web Audio synth: lookahead-scheduled loop (Am–F–C–G) whose layers follow the run, plus all sound effects. |
| `components/icytower/scene.ts` | Three.js renderer: shader sky, ice-brick walls, pooled platform slabs, particles, post-processing. |
| `components/icytower/{shaders,palette,character,particles}.ts` | GLSL, per-stratum palettes, the climber and scarf, particle pools. |
| `components/icytower/IcyTower.tsx` | rAF loop with a fixed-step accumulator and render interpolation; keyboard, touch and gamepad input; HUD via refs; overlays. |

## Gameplay

- **Movement:** run speed builds jump height (standing jump clears one floor,
  full speed about five and a half). Icy friction, strong turn-around, air
  control, coyote time and jump buffering. Holding jump keeps jumping on every
  landing. Above 70 % speed a jump is a spinning super jump.
- **Walls:** airborne wall hits keep 92 % of the speed.
- **Combos:** landing two or more floors above the previous landing chains a
  combo; a 3 s window refills on each step. A one-floor hop or the clock running
  out ends it. Two or more multi-floor jumps pay `floors²`. Score is
  `10 × highest floor + combo bonuses`. Tier words run from *Cool* to *No Way!*.
- **The rising tower:** the clock starts at floor 5; every 30 s the scroll speed
  steps up ("Hurry up!", eight levels). The camera also chases a player who
  climbs past 60 % of the view. Before the clock starts the camera follows you
  back down; after that, falling off the bottom ends the run.
- **Strata** (every 50 floors, each entered through a full-width gate):
  Glacier → Aurora Belt (narrower) → Storm Shelf (drifting ledges) →
  Stratosphere (low gravity) → Orbit (brittle ledges crumble 0.45 s after
  landing) → The Void (everything). Ledges narrow steadily with height.
- **Daily tower:** one seed per local calendar day ("Daily #N", #1 =
  2026-10-06). Your best run on it is saved with a recording and replays as a
  glowing ghost next time; an edge marker points to it when off-screen. "Random
  tower" plays an unseeded tower without a ghost.

## Presentation

- Perspective camera, gameplay on the z = 0 plane; it always frames the full
  tower width. On tall screens the extra height shows more of the tower above.
- Bloom, chromatic aberration and grain in a final grade; a red glow at the
  bottom edge warns when you are about to fall out. Combo "flow" brightens the
  aurora, wall seams, scarf and eyes, and the music adds layers.
- Big combo payoffs (tier ≥ Glacial) trigger a short bullet time.
- Reduced motion disables shake, flashes, lightning, aberration, grain and
  bullet time.
- A quality governor lowers pixel ratio, then bloom, when frames stay slow.

## Input

Keyboard (←/→ or A/D, Space/↑/W, Esc/P, M), gamepad (stick/d-pad, A/B, Start,
rumble on combos) and touch (a control bar *below* the stage so it never covers
the climb; haptics where supported).

## Storage

- `icytower.best` — all-time best score (shown on the `/play` hub card).
- `icytower.daily` — today's best run including ghost samples.
- `icytower.muted` — sound preference (default muted, like the other games).

## Out of scope

Online leaderboards and sharing ghosts between players. The share button copies
(or, on touch devices, shares) a text summary only.
