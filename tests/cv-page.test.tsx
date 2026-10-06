import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CvPage from "@/app/cv/page";
import { site } from "@/lib/content";

// next/font/local only works inside Next's compiler
vi.mock("next/font/local", () => ({ default: () => ({ className: "cv-font" }) }));

describe("CV page", () => {
  afterEach(() => cleanup());

  it("links every contact channel", () => {
    render(<CvPage />);
    expect(screen.getByRole("link", { name: site.email }).getAttribute("href")).toBe(
      `mailto:${site.email}`
    );
    expect(
      screen.getByRole("link", { name: "linkedin.com/in/danielariel" }).getAttribute("href")
    ).toBe(site.linkedin);
    expect(screen.getByRole("link", { name: "danielariel.com" }).getAttribute("href")).toBe(
      "https://danielariel.com"
    );
  });

  it("lists every role and every client", () => {
    const { container } = render(<CvPage />);
    const text = container.textContent ?? "";
    for (const job of site.experience) expect(text).toContain(job.title);
    for (const project of site.projects) expect(text).toContain(project.name);
  });
});
