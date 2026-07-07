import { beforeEach, describe, expect, it } from "vitest";
import { Sfx } from "@/components/game/audio";

describe("Sfx", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to muted when no preference is stored", () => {
    expect(new Sfx().muted).toBe(true);
  });

  it("persists the mute preference across instances", () => {
    const sfx = new Sfx();
    sfx.setMuted(false);
    expect(window.localStorage.getItem("moorhuhn.muted")).toBe("0");
    expect(new Sfx().muted).toBe(false);
    sfx.setMuted(true);
    expect(window.localStorage.getItem("moorhuhn.muted")).toBe("1");
  });

  it("is safe to trigger sounds with no AudioContext available", () => {
    // jsdom has no AudioContext — every trigger must be a silent no-op
    const sfx = new Sfx();
    sfx.setMuted(false);
    expect(() => {
      sfx.shot();
      sfx.empty();
      sfx.reload();
      sfx.squawk();
      sfx.jingle();
      sfx.combo(2);
      sfx.fanfare();
    }).not.toThrow();
  });
});
