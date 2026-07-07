import type { ReactNode } from "react";

export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/70 p-6 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}

export function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-accent bg-accent/10 px-6 py-2 font-mono text-sm text-accent hover:bg-accent/20"
    >
      {children}
    </button>
  );
}
