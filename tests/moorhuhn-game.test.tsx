import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/game/sprites", () => ({
  // Never resolves: the component must render and play fine without sprites
  loadChickenSprites: () => new Promise(() => {}),
}));

import { MoorhuhnGame } from "@/components/game/MoorhuhnGame";

// Self-returning callable Proxy: every property read, assignment, and call
// succeeds, so the untestable Canvas 2D drawing code can run against jsdom.
function ctx2dStub(): CanvasRenderingContext2D {
  const stub: unknown = new Proxy(function () {}, {
    get: () => stub,
    set: () => true,
    apply: () => stub,
  });
  return stub as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(ctx2dStub()) as never;
  window.localStorage.clear();
});

afterEach(() => {
  // @testing-library/react only self-registers auto-cleanup when it finds a
  // global `afterEach` at import time; this project's vitest config doesn't
  // set `test.globals`, so each render() would otherwise stay mounted and
  // leak into the next test's queries. Clean up explicitly instead.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MoorhuhnGame", () => {
  it("shows the start overlay", () => {
    render(<MoorhuhnGame />);
    expect(screen.getByRole("button", { name: /start round/i })).toBeTruthy();
  });

  it("starts a round and shows the in-game reload button", () => {
    render(<MoorhuhnGame />);
    fireEvent.click(screen.getByRole("button", { name: /start round/i }));
    expect(screen.queryByRole("button", { name: /start round/i })).toBeNull();
    expect(screen.getByRole("button", { name: /reload/i })).toBeTruthy();
  });

  it("toggles and persists the mute preference", () => {
    render(<MoorhuhnGame />);
    fireEvent.click(screen.getByRole("button", { name: /sound off/i }));
    expect(window.localStorage.getItem("moorhuhn.muted")).toBe("0");
    expect(screen.getByRole("button", { name: /sound on/i })).toBeTruthy();
  });
});
