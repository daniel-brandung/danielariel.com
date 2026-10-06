import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoleRotator } from "@/components/RoleRotator";

describe("RoleRotator", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the first role and gives screen readers all of them", () => {
    const { container } = render(<RoleRotator roles={["AI", "Dev"]} />);
    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("AI");
    expect(container.querySelector(".sr-only")?.textContent).toBe("AI, Dev");
  });

  it("swaps whole roles once the hero intro has settled", async () => {
    const { container } = render(<RoleRotator roles={["AI", "Dev"]} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("AI");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(container.querySelector("[aria-hidden]")?.textContent).toContain("Dev");
  });
});
