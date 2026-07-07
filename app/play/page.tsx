import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/content";
import { PersonalBest } from "@/components/game/PersonalBest";
import { BEST_3D_KEY, CLASSIC_BEST_KEY } from "@/components/game/storage";

export const metadata: Metadata = {
  title: `Play — ${site.name}`,
  description:
    "Two takes on the classic Moorhuhn shooter: the 2D twilight original and a low-poly 3D sequel.",
};

const games = [
  {
    href: "/play/classic",
    emoji: "🎯",
    name: "Moorhuhn Classic",
    tagline: "The 2D twilight original. 90 seconds, 8 shells, far birds score more.",
    storageKey: CLASSIC_BEST_KEY,
  },
  {
    href: "/play/3d",
    emoji: "🌄",
    name: "Moorhuhn 3D",
    tagline: "The low-poly sequel. Look around, chase combos, find the golden chicken.",
    storageKey: BEST_3D_KEY,
  },
];

export default function PlayHubPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-[1100px] flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The arcade</h1>
          <p className="mt-1 font-mono text-xs text-muted">
            pick a game · personal bests live in your browser
          </p>
        </div>
        <Link
          href="/"
          className="font-mono text-xs text-accent underline underline-offset-4 hover:text-accent-soft"
        >
          ← back home
        </Link>
      </header>
      <div className="grid gap-6 sm:grid-cols-2">
        {games.map((game) => (
          <Link
            key={game.href}
            href={game.href}
            className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-6 transition-colors hover:border-accent/60"
          >
            <span className="text-4xl">{game.emoji}</span>
            <h2 className="text-lg font-semibold tracking-tight group-hover:text-accent">
              {game.name}
            </h2>
            <p className="text-sm text-muted">{game.tagline}</p>
            <PersonalBest storageKey={game.storageKey} />
          </Link>
        ))}
      </div>
    </main>
  );
}
