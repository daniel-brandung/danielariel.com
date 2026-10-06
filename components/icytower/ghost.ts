// The daily tower: everyone gets the same seed for the day, and your best
// climb on it comes back as a ghost to race. Samples are taken every
// GHOST_EVERY engine steps, so replay stays in lockstep with game time.
import { hashSeed } from "@/components/icytower/tower";

export const GHOST_EVERY = 6; // engine steps per sample → 20 Hz at STEP = 1/120
export const DAILY_KEY = "icytower.daily";
const LAUNCH_DAY = Date.UTC(2026, 9, 6); // Daily #1
const DAY_MS = 86_400_000;

export interface GhostRun {
  date: string;
  score: number;
  floor: number;
  samples: number[]; // flat [x0, y0, x1, y1, …], one pair per GHOST_EVERY steps
}

export interface GhostPose {
  x: number;
  y: number;
  vx: number; // world units per sample, for facing and lean
  done: boolean; // the recorded run ended before this point
}

/** Local calendar day, so the tower turns over at the player's midnight. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dailySeed(dateKey: string): number {
  return hashSeed(`icy-tower:${dateKey}`);
}

export function dailyNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.max(1, Math.round((Date.UTC(y, m - 1, d) - LAUNCH_DAY) / DAY_MS) + 1);
}

export function shouldSample(steps: number): boolean {
  return steps % GHOST_EVERY === 0;
}

export function pushSample(samples: number[], x: number, y: number): void {
  samples.push(Math.round(x), Math.round(y));
}

/** Interpolated ghost position at engine step `steps`; null when there is nothing to show. */
export function ghostPoseAt(samples: number[], steps: number): GhostPose | null {
  const count = samples.length / 2;
  if (count === 0) return null;
  const t = steps / GHOST_EVERY;
  if (t >= count - 1) {
    const i = (count - 1) * 2;
    return { x: samples[i], y: samples[i + 1], vx: 0, done: true };
  }
  const i = Math.max(0, Math.floor(t));
  const f = t - i;
  const x0 = samples[i * 2];
  const y0 = samples[i * 2 + 1];
  const x1 = samples[i * 2 + 2];
  const y1 = samples[i * 2 + 3];
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, vx: x1 - x0, done: false };
}

function isGhostRun(value: unknown): value is GhostRun {
  if (typeof value !== "object" || value === null) return false;
  const run = value as Record<string, unknown>;
  return (
    typeof run.date === "string" &&
    typeof run.score === "number" &&
    typeof run.floor === "number" &&
    Array.isArray(run.samples) &&
    run.samples.length % 2 === 0 &&
    run.samples.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Today's best run, or null if there is none (or it belongs to another day). */
export function loadDailyBest(dateKey: string): GhostRun | null {
  try {
    const raw = window.localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGhostRun(parsed) && parsed.date === dateKey ? parsed : null;
  } catch {
    return null; // storage unavailable or corrupt — race without a ghost
  }
}

export function saveDailyBest(run: GhostRun): void {
  try {
    window.localStorage.setItem(DAILY_KEY, JSON.stringify(run));
  } catch {
    // storage unavailable or full — the ghost just won't persist
  }
}
