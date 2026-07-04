import { describe, expect, it } from "vitest";
import { site } from "@/lib/content";

describe("site content", () => {
  it("has a valid public email", () => {
    expect(site.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
  it("links to LinkedIn over https", () => {
    expect(site.linkedin).toMatch(/^https:\/\/www\.linkedin\.com\//);
  });
  it("nav matches the section anchors the page renders", () => {
    expect(site.nav.map((n) => n.href)).toEqual([
      "#about",
      "#what-i-do",
      "#experience",
      "#skills",
      "#contact",
    ]);
  });
  it("has five experience entries", () => {
    expect(site.experience).toHaveLength(5);
  });
  it("has three rotating roles for the hero", () => {
    expect(site.roles).toHaveLength(3);
  });
});
