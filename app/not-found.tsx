import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-7xl text-accent">404</p>
      <p className="text-lg text-muted">This page doesn’t exist — but the one-pager does.</p>
      <Link
        href="/"
        className="rounded border border-accent px-6 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg"
      >
        cd ~/
      </Link>
    </main>
  );
}
