import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="relative text-[96px]/none font-semibold tracking-[-0.03em]">
        404
        <span
          aria-hidden
          className="absolute -inset-1.5 rounded-[3px] border border-dashed border-accent"
        />
      </p>
      <p className="text-lg text-muted">This page doesn’t exist — but the one-pager does.</p>
      <Link
        href="/"
        className="inline-flex h-12 items-center rounded bg-ink px-6 font-medium text-white transition-colors hover:bg-accent"
      >
        Back to the homepage
      </Link>
    </main>
  );
}
