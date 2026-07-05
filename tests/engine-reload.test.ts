import { describe, expect, it } from "vitest";
import {
  MAX_SHELLS,
  RELOAD_SECONDS,
  createInitialState,
  shoot,
  startReload,
  startRound,
  update,
} from "@/components/game/engine";

const noRand = () => 0.5;
const playing = () => startRound(createInitialState());

describe("shells and reloading", () => {
  it("spends a shell per shot", () => {
    const { state, events } = shoot(playing(), 100, 100);
    expect(state.shells).toBe(MAX_SHELLS - 1);
    expect(events).toContainEqual({ type: "shot" });
  });

  it("clicks empty at zero shells and never goes negative", () => {
    let s = playing();
    for (let i = 0; i < MAX_SHELLS; i++) s = shoot(s, 100, 100).state;
    const { state, events } = shoot(s, 100, 100);
    expect(state.shells).toBe(0);
    expect(events).toEqual([{ type: "empty" }]);
  });

  it("starts a reload and blocks shooting until it completes", () => {
    const s = shoot(playing(), 100, 100).state;
    const started = startReload(s);
    expect(started.state.reloading).toBe(true);
    expect(started.state.reloadTimeLeft).toBe(RELOAD_SECONDS);
    expect(started.events).toContainEqual({ type: "reloadStart" });

    const blocked = shoot(started.state, 100, 100);
    expect(blocked.state.shells).toBe(started.state.shells);
    expect(blocked.events).toEqual([]);

    const done = update(started.state, RELOAD_SECONDS, noRand);
    expect(done.state.reloading).toBe(false);
    expect(done.state.shells).toBe(MAX_SHELLS);
    expect(done.events).toContainEqual({ type: "reloadEnd" });
  });

  it("ignores reload requests when full or already reloading", () => {
    const full = startReload(playing());
    expect(full.state.reloading).toBe(false);
    expect(full.events).toEqual([]);

    let s = shoot(playing(), 100, 100).state;
    s = startReload(s).state;
    const again = startReload(s);
    expect(again.state).toBe(s);
    expect(again.events).toEqual([]);
  });

  it("does not shoot outside of play", () => {
    const ready = createInitialState();
    const { state, events } = shoot(ready, 100, 100);
    expect(state).toBe(ready);
    expect(events).toEqual([]);
  });
});
