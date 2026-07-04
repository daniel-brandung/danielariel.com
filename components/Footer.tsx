import { site } from "@/lib/content";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 px-6 py-8 font-mono text-xs text-muted">
        <p>
          © {new Date().getFullYear()} {site.name}
        </p>
        <p>
          Built with Next.js —{" "}
          <a
            href="#top"
            className="text-accent underline underline-offset-4 hover:text-accent-soft"
          >
            back to top ↑
          </a>
        </p>
      </div>
    </footer>
  );
}
