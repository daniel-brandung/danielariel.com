import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/content";
import { MoorhuhnGame } from "@/components/game/MoorhuhnGame";

export const metadata: Metadata = {
  title: `Play Moorhuhn — ${site.name}`,
  description:
    "A 90-second twilight tribute to the classic Moorhuhn shooter. 8 shells, quick reloads, far chickens score more.",
};

export default function PlayClassicPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-[1100px] flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Moorhuhn, but make it twilight</h1>
          <p className="mt-1 font-mono text-xs text-muted">
            90 seconds · 8 shells · far birds score more
          </p>
        </div>
        <Link
          href="/play"
          className="font-mono text-xs text-accent underline underline-offset-4 hover:text-accent-soft"
        >
          ← all games
        </Link>
      </header>
      <MoorhuhnGame />
    </main>
  );
}
