import { describe, expect, it } from "vitest";
import {
  MAX_SHELLS,
  ROUND_SECONDS,
  createInitialState,
  pause,
  resume,
  startRound,
  update,
} from "@/components/game/engine";

const noRand = () => 0.5;

describe("round lifecycle", () => {
  it("starts in the ready phase with a full loadout", () => {
    const s = createInitialState();
    expect(s.phase).toBe("ready");
    expect(s.timeLeft).toBe(ROUND_SECONDS);
    expect(s.shells).toBe(MAX_SHELLS);
    expect(s.score).toBe(0);
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
