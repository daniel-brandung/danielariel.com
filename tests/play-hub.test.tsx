import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    await screen.findByText("personal best: 120");
    // Get the last main element (final render after StrictMode cleanup)
    const mains = screen.queryAllByRole("main");
    const lastMain = mains[mains.length - 1];
    const classicText = lastMain.textContent?.includes("Moorhuhn Classic");
    const hasClassicBest = lastMain.textContent?.includes("personal best: 120");
    const hasNoBest = lastMain.textContent?.includes("no round played yet");
    expect(classicText).toBe(true);
    expect(hasClassicBest).toBe(true);
    expect(hasNoBest).toBe(true);
  });
});
