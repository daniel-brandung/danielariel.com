import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/content";
import { Moorhuhn3DLoader } from "@/components/game3d/Moorhuhn3DLoader";

export const metadata: Metadata = {
  title: `Moorhuhn 3D — ${site.name}`,
  description:
    "A low-poly 3D Moorhuhn sequel: 90 seconds, 8 shells, combo multipliers, and one golden chicken.",
};

export default function Play3DPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-[1100px] flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Moorhuhn, now with a third dimension
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            90 seconds · 8 shells · combos stack · one golden chicken
          </p>
        </div>
        <Link
          href="/play"
          className="font-mono text-xs text-accent underline underline-offset-4 hover:text-accent-soft"
        >
          ← all games
        </Link>
      </header>
      <Moorhuhn3DLoader />
    </main>
  );
}
