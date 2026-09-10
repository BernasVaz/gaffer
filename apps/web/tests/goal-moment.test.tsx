import { applyAction, createInitialState, createRng, legalActions } from "@gaffer/engine";
import { parseSeed, type MatchState } from "@gaffer/shared";
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GoalBurst } from "../src/board/GoalBurst";
import { Pitch } from "../src/board/Pitch";
import { NO_TARGETS } from "../src/board/targets";
import { GOAL_MOMENT_MS, useGoalMoment } from "../src/match/useGoalMoment";

/** A board where the home striker is clean through on an empty net. */
function openGoal(): MatchState {
  const base = createInitialState();
  return {
    ...base,
    players: base.players.map((player) =>
      player.id === "home-striker"
        ? { ...player, position: { x: 4, y: 2 } }
        : player.id === "away-goalkeeper"
          ? { ...player, position: { x: 5, y: 0 } }
          : player,
    ),
    ball: { position: { x: 4, y: 2 }, carrierId: "home-striker" },
    possession: "home",
  };
}

describe("useGoalMoment", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts with nothing to celebrate", () => {
    const { result } = renderHook(() => useGoalMoment());
    expect(result.current.moment).toBeNull();
  });

  it("holds the board it was handed, exactly", () => {
    const before = createInitialState();
    const { result } = renderHook(() => useGoalMoment());

    act(() => result.current.celebrate(before, "home"));

    expect(result.current.moment?.team).toBe("home");
    expect(result.current.moment?.board).toBe(before); // the very object, unmodified
  });

  it("lets go once the moment has passed", () => {
    const { result } = renderHook(() => useGoalMoment());

    act(() => result.current.celebrate(createInitialState(), "away"));
    expect(result.current.moment).not.toBeNull();

    act(() => vi.advanceTimersByTime(GOAL_MOMENT_MS - 1));
    expect(result.current.moment, "still celebrating a millisecond early").not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.moment).toBeNull();
  });

  it("runs for between a second and a second and a half", () => {
    // The brief was a beat that reads as a reward, not a pause to sit through.
    expect(GOAL_MOMENT_MS).toBeGreaterThanOrEqual(1000);
    expect(GOAL_MOMENT_MS).toBeLessThanOrEqual(1500);
  });

  it("cannot leave the board stuck if it is torn down mid-celebration", () => {
    const { result, unmount } = renderHook(() => useGoalMoment());
    act(() => result.current.celebrate(createInitialState(), "home"));

    unmount();
    // The pending timer is cleared rather than firing into a dead component.
    expect(() => vi.advanceTimersByTime(GOAL_MOMENT_MS * 2)).not.toThrow();
  });
});

describe("the engine is never waiting for the celebration", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("has already scored and reset the pitch before anything is shown", () => {
    /*
     * The premise of the whole slice. The engine finishes the goal — score up,
     * pitch reset, turn passed — synchronously, and the celebration is a view of
     * a board the engine has already discarded.
     */
    const before = openGoal();
    const shot = legalActions(before).find((action) => action.type === "shoot")!;
    const after = applyAction(before, shot, createRng(parseSeed(1)));

    expect(after.ok).toBe(true);
    if (!after.ok) return;

    expect(after.state.score).toEqual({ home: 1, away: 0 });
    // Already home, before a single frame is drawn.
    expect(after.state.players.find((p) => p.id === "home-striker")?.position).not.toEqual({
      x: 4,
      y: 2,
    });

    // The celebration holds the discarded board; the engine's is untouched by it.
    const { result } = renderHook(() => useGoalMoment());
    act(() => result.current.celebrate(before, "home"));
    expect(result.current.moment?.board.score).toEqual({ home: 0, away: 0 });
    expect(after.state.score).toEqual({ home: 1, away: 0 });
  });

  it("does not move the match on when the celebration ends", () => {
    const before = openGoal();
    const shot = legalActions(before).find((action) => action.type === "shoot")!;
    const settled = applyAction(before, shot, createRng(parseSeed(1)));
    if (!settled.ok) throw new Error("fixture did not score");

    const snapshot = JSON.stringify(settled.state);

    const { result } = renderHook(() => useGoalMoment());
    act(() => result.current.celebrate(before, "home"));
    act(() => vi.advanceTimersByTime(GOAL_MOMENT_MS * 3));

    // Time passed, the celebration ended, and the match is exactly where the
    // engine left it. Nothing in this hook can advance a match.
    expect(JSON.stringify(settled.state)).toBe(snapshot);
    expect(result.current.moment).toBeNull();
  });
});

describe("the burst", () => {
  it("names the side that scored", () => {
    render(<GoalBurst team="home" />);
    expect(screen.getByText("GOAL!")).toBeInTheDocument();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("is coloured per side", () => {
    const { unmount } = render(<GoalBurst team="home" />);
    expect(document.querySelector('[data-goal-burst="home"]')).not.toBeNull();
    unmount();

    render(<GoalBurst team="away" />);
    expect(document.querySelector('[data-goal-burst="away"]')).not.toBeNull();
  });

  it("cannot be clicked through to the board beneath", () => {
    render(<GoalBurst team="home" />);
    expect(document.querySelector("[data-goal-burst]")?.className).toContain("pointer-events-none");
  });
});

describe("a frozen board", () => {
  const noop = () => {};

  it("offers no interaction at all while something is being shown", () => {
    render(
      <Pitch
        state={createInitialState()}
        selectedId={null}
        targets={NO_TARGETS}
        onSelect={noop}
        onCommit={noop}
        onFocusTarget={noop}
        frozen
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("still offers selection when nothing is being shown", () => {
    render(
      <Pitch
        state={createInitialState()}
        selectedId={null}
        targets={NO_TARGETS}
        onSelect={noop}
        onCommit={noop}
        onFocusTarget={noop}
      />,
    );
    expect(screen.queryAllByRole("button").length).toBeGreaterThan(0);
  });

  it("keeps describing the board to a screen reader while frozen", () => {
    // Frozen means "you cannot act", not "you cannot know".
    render(
      <Pitch
        state={createInitialState()}
        selectedId={null}
        targets={NO_TARGETS}
        onSelect={noop}
        onCommit={noop}
        onFocusTarget={noop}
        frozen
      />,
    );
    expect(screen.getAllByRole("gridcell")).toHaveLength(35);
    expect(screen.getByLabelText(/home striker.*with the ball/)).toBeInTheDocument();
  });
});
