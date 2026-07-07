export const CLASSIC_BEST_KEY = "moorhuhn.best";
export const BEST_3D_KEY = "moorhuhn3d.best";

export function loadBest(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw === null ? 0 : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0; // storage unavailable (e.g. private mode) — play without persistence
  }
}

export function saveBest(key: string, score: number): void {
  try {
    window.localStorage.setItem(key, String(score));
  } catch {
    // storage unavailable — skip persistence
  }
}
