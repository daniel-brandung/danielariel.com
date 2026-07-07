"use client";

import { useSyncExternalStore } from "react";
import { loadBest } from "@/components/game/storage";

// localStorage is an external store: read it via useSyncExternalStore so the
// server snapshot (null) hydrates cleanly and cross-tab updates re-render.
const subscribe = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
};

export function PersonalBest({ storageKey }: { storageKey: string }) {
  const best = useSyncExternalStore(
    subscribe,
    () => loadBest(storageKey),
    () => null,
  );
  return (
    <span className="font-mono text-xs text-muted">
      {best !== null && best > 0 ? `personal best: ${best}` : "no round played yet"}
    </span>
  );
}
