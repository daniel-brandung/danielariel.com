import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import PlayHubPage from "@/app/play/page";

// keep the test independent of the app-router runtime
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: ComponentProps<"a">) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

describe("play hub", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => {
    // @testing-library/react only self-registers auto-cleanup when it finds a
    // global `afterEach` at import time; this project's vitest config doesn't
    // set `test.globals`, so each render() would otherwise stay mounted and
    // leak into the next test's queries. Clean up explicitly instead.
    cleanup();
  });

  it("links to both games", () => {
    render(<PlayHubPage />);
    const classic = screen.getByRole("link", { name: /moorhuhn classic/i });
    const threeD = screen.getByRole("link", { name: /moorhuhn 3d/i });
    expect(classic.getAttribute("href")).toBe("/play/classic");
    expect(threeD.getAttribute("href")).toBe("/play/3d");
  });

  it("shows a stored personal best per game", async () => {
    window.localStorage.setItem("moorhuhn.best", "120");
    render(<PlayHubPage />);
    expect(await screen.findByText("personal best: 120")).toBeDefined();
    expect(screen.getAllByText(/no round played yet/i)).toHaveLength(1);
  });
});
