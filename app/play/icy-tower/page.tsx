import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/content";
import { IcyTowerLoader } from "@/components/icytower/IcyTowerLoader";

export const metadata: Metadata = {
  title: `Icy Tower: Aurora — ${site.name}`,
  description:
    "An Icy Tower remix: momentum jumps, wall bounces and combos that build the soundtrack, through six strata of an endless tower — plus a daily tower with a ghost of your best climb.",
};

export default function PlayIcyTowerPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-[1100px] flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Icy Tower, after the aurora</h1>
          <p className="mt-1 font-mono text-xs text-muted">
            speed makes height · combos make music · six strata · a new daily tower every day
          </p>
        </div>
        <Link
          href="/play"
          className="font-mono text-xs text-accent underline underline-offset-4 hover:text-accent-soft"
        >
          ← all games
        </Link>
      </header>
      <IcyTowerLoader />
    </main>
  );
}
