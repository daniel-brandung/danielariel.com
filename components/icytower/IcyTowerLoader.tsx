"use client";

import dynamic from "next/dynamic";

// ssr:false is only legal inside a Client Component in this Next.js version —
// see node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
const IcyTower = dynamic(() => import("@/components/icytower/IcyTower").then((mod) => mod.IcyTower), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(80svh,780px)] min-h-[460px] w-full items-center justify-center rounded-xl border border-line bg-[#040814] font-mono text-xs text-muted">
      freezing the tower…
    </div>
  ),
});

export function IcyTowerLoader() {
  return <IcyTower />;
}
