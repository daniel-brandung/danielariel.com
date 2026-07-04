import { render, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Typewriter } from "@/components/Typewriter";

// The component chains timers: each tick schedules the next one inside a
// re-rendered effect, so effects must flush between ticks — hence one
// act() boundary per step instead of a single long advance.
async function advance(ms: number, step = 60) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}

describe("Typewriter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("types the first word character by character", async () => {
    const { container } = render(<Typewriter words={["AI"]} />);
    expect(container.textContent).not.toContain("AI");
    await advance(300);
    expect(container.textContent).toContain("AI");
  });

  it("erases after holding and types the next word", async () => {
    const { container } = render(<Typewriter words={["AI", "Dev"]} />);
    await advance(4500); // type "AI" → hold 2.5s → erase → type "Dev"
    expect(container.textContent).toContain("Dev");
  });
});
