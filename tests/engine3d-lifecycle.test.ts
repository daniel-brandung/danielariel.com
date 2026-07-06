import { describe, expect, it } from "vitest";
import {
  MAX_SHELLS,
  RELOAD_SECONDS,
  ROUND_SECONDS,
  createInitialState,
  pause,
  resume,
  startReload,
  startRound,
  update,
} from "@/components/game3d/engine3d";

const noRand = () => 0.5;

describe("3D round lifecycle", () => {
  it("starts ready with a full loadout and no combo", () => {
    const s = createInitialState();
    expect(s.phase).toBe("ready");
    expect(s.timeLeft).toBe(ROUND_SECONDS);
    expect(s.shells).toBe(MAX_SHELLS);
    expect(s.score).toBe(0);
    expect(s.multiplier).toBe(1);
    expect(s.goldenSpawned).toBe(false);
    expect(s.chickens).toEqual([]);
  });

  it("does not advance while ready", () => {
    const s = createInitialState();
    const { state, events } = update(s, 1, noRand);
    expect(state).toBe(s);
    expect(events).toEqual([]);
  });

  it("counts the round timer down while playing", () => {
    const s = startRound(createInitialState());
    const { state } = update(s, 1.5, noRand);
    expect(state.timeLeft).toBeCloseTo(ROUND_SECONDS - 1.5);
  });

  it("ends the round when the timer runs out", () => {
    let s = startRound(createInitialState());
    s = { ...s, timeLeft: 0.2, score: 42 };
    const { state, events } = update(s, 0.5, noRand);
    expect(state.timeLeft).toBe(0);
    expect(state.phase).toBe("ended");
    expect(events).toContainEqual({ type: "roundEnd", score: 42 });
  });

  it("freezes after the round has ended", () => {
    let s = startRound(createInitialState());
    s = { ...s, timeLeft: 0.1 };
    const ended = update(s, 1, noRand).state;
    const after = update(ended, 1, noRand);
    expect(after.state).toBe(ended);
    expect(after.events).toEqual([]);
  });

  it("pauses and resumes only from the right phases", () => {
    const ready = createInitialState();
    expect(pause(ready).phase).toBe("ready");
    const playing = startRound(ready);
    const paused = pause(playing);
    expect(paused.phase).toBe("paused");
    expect(update(paused, 1, noRand).state.timeLeft).toBe(ROUND_SECONDS);
    expect(resume(paused).phase).toBe("playing");
    expect(resume(ready).phase).toBe("ready");
  });
});

describe("3D reload", () => {
  it("starts a reload only when playing with shells missing", () => {
    const full = startRound(createInitialState());
    expect(startReload(full).events).toEqual([]);
    expect(startReload(createInitialState()).events).toEqual([]);

    const some = { ...full, shells: 3 };
    const { state, events } = startReload(some);
    expect(state.reloading).toBe(true);
    expect(state.reloadTimeLeft).toBe(RELOAD_SECONDS);
    expect(events).toEqual([{ type: "reloadStart" }]);
    expect(startReload(state).events).toEqual([]); // already reloading — no-op
  });

  it("refills shells when the reload timer completes", () => {
    let s = { ...startRound(createInitialState()), shells: 0 };
    s = startReload(s).state;
    const partway = update(s, 0.3, noRand).state;
    expect(partway.reloading).toBe(true);
    expect(partway.shells).toBe(0);
    const { state, events } = update(partway, RELOAD_SECONDS, noRand);
    expect(state.reloading).toBe(false);
    expect(state.shells).toBe(MAX_SHELLS);
    expect(events).toContainEqual({ type: "reloadEnd" });
  });
});
