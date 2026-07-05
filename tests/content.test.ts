import { describe, expect, it } from "vitest";
import { site } from "@/lib/content";

describe("site content", () => {
  it("has a valid public email", () => {
    expect(site.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
  it("links to LinkedIn over https", () => {
    expect(site.linkedin).toMatch(/^https:\/\/www\.linkedin\.com\//);
  });
  it("links the K5 talk over https", () => {
    expect(site.whatIDo[0].talk.url).toMatch(/^https:\/\/k5\.de\//);
  });
  it("nav matches the section anchors the page renders", () => {
    expect(site.nav.map((n) => n.href)).toEqual([
      "#about",
      "#what-i-do",
      "#projects",
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
