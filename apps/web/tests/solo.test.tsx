import { DEFAULT_SETUP, type MatchSetup, type Team } from "@gaffer/shared";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OPPONENT } from "../src/feel";
import { Match } from "../src/match/Match";

const solo = (side: Team = "home"): MatchSetup => ({
  ...DEFAULT_SETUP,
  play: "solo",
  side,
  difficulty: "pro",
  seed: 7,
});

/** Let every pending opponent pause elapse, plus room for the one it queues next. */
const letItThink = async (times = 1) => {
  for (let tick = 0; tick < times; tick += 1) {
    await act(async () => {
      vi.advanceTimersByTime(OPPONENT.firstAction + OPPONENT.nextAction + 50);
    });
  }
};

/** The turn number the scoreboard is reporting. */
const turnShown = () => {
  const text = screen.getByLabelText("Scoreboard").textContent ?? "";
  return Number(/Turn (\d+)/.exec(text)?.[1] ?? 0);
};

/** Every player cell the board is offering as selectable. */
const selectable = () =>
  screen
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? "")
    .filter((label) => label.startsWith("Select "));

describe("a solo match", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("offers only your own players, never the opponent's", () => {
    render(<Match setup={solo("home")} onLeave={() => {}} />);

    expect(selectable().length).toBeGreaterThan(0);
    expect(selectable().every((label) => label.includes("home"))).toBe(true);
  });

  it("offers nothing at all while it is the opponent's turn", async () => {
    // Playing away means the opponent kicks off, so the very first thing on
    // screen is a turn that is not yours.
    render(<Match setup={solo("away")} onLeave={() => {}} />);

    expect(selectable()).toHaveLength(0);
    expect(screen.getByLabelText("Match status")).toHaveTextContent(/is thinking/);
  });

  it("takes its turn, then hands it back", async () => {
    render(<Match setup={solo("away")} onLeave={() => {}} />);
    expect(turnShown()).toBe(1);

    await letItThink(2);

    // The opponent has spent its two actions and the turn has passed to us.
    expect(turnShown()).toBe(2);
    expect(selectable().every((label) => label.includes("away"))).toBe(true);
    expect(selectable().length).toBeGreaterThan(0);
  });

  it("does not act until its pause has elapsed", async () => {
    render(<Match setup={solo("away")} onLeave={() => {}} />);

    await act(async () => {
      vi.advanceTimersByTime(OPPONENT.firstAction - 50);
    });

    expect(turnShown()).toBe(1);
    expect(screen.getByLabelText("Match status")).toHaveTextContent(/is thinking/);
  });

  it("names who is thinking, so a pause reads as an opponent rather than a freeze", async () => {
    render(<Match setup={solo("away")} onLeave={() => {}} />);
    // The away side is ours, so the opponent is home — Pike.
    expect(screen.getByLabelText("Match status")).toHaveTextContent(/Pike is thinking/);
  });

  it("plays on for turn after turn without being prodded", async () => {
    render(<Match setup={solo("away")} onLeave={() => {}} />);

    await letItThink(2);
    const mine = turnShown();

    // Hand the turn straight back and let it go again.
    await act(async () => {
      screen.getByRole("button", { name: "End turn" }).click();
    });
    await letItThink(2);

    expect(turnShown()).toBeGreaterThan(mine);
  });
});

describe("a hotseat match", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("never thinks, because nobody is at the other end", async () => {
    render(<Match setup={{ ...DEFAULT_SETUP, play: "hotseat", seed: 7 }} onLeave={() => {}} />);

    const before = turnShown();
    await letItThink(3);

    expect(turnShown()).toBe(before);
    expect(screen.getByLabelText("Match status")).not.toHaveTextContent(/is thinking/);
  });

  it("offers whichever side is to move", async () => {
    render(<Match setup={{ ...DEFAULT_SETUP, play: "hotseat", seed: 7 }} onLeave={() => {}} />);

    expect(selectable().every((label) => label.includes("home"))).toBe(true);

    await act(async () => {
      screen.getByRole("button", { name: "End turn" }).click();
    });

    expect(selectable().length).toBeGreaterThan(0);
    expect(selectable().every((label) => label.includes("away"))).toBe(true);
  });
});
