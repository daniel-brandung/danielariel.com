"use client";

import { useEffect, useState } from "react";
import { loadBest } from "@/components/game/storage";

// Renders after mount only — localStorage is unavailable during prerender.
export function PersonalBest({ storageKey }: { storageKey: string }) {
  const [best, setBest] = useState<number | null>(null);
  useEffect(() => {
    setBest(loadBest(storageKey));
  }, [storageKey]);
  return (
    <span className="font-mono text-xs text-muted">
      {best !== null && best > 0 ? `personal best: ${best}` : "no round played yet"}
    </span>
  );
}
