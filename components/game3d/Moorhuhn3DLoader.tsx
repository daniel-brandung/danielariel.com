"use client";

import dynamic from "next/dynamic";

// ssr:false is only legal inside a Client Component in this Next.js version —
// see node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md
const Moorhuhn3D = dynamic(
  () => import("@/components/game3d/Moorhuhn3D").then((mod) => mod.Moorhuhn3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video w-full max-w-[1100px] items-center justify-center rounded-xl border border-line bg-surface font-mono text-xs text-muted">
        loading the third dimension…
      </div>
    ),
  },
);

export function Moorhuhn3DLoader() {
  return <Moorhuhn3D />;
}
