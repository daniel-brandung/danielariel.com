const BEST_KEY = "moorhuhn.best";

export function loadBest(): number {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const value = raw === null ? 0 : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0; // storage unavailable (e.g. private mode) — play without persistence
  }
}

export function saveBest(score: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // storage unavailable — skip persistence
  }
}
