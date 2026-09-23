import { applyAction, createInitialState, createRng } from "@gaffer/engine";
import {
  DEFAULT_SETUP,
  FORMAT_PROFILES,
  FORMATS,
  parseSeed,
  type MatchRules,
} from "@gaffer/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { matchClock } from "../src/board/clock";
import { Scoreboard } from "../src/board/Scoreboard";

const rulesFor = (format: (typeof FORMATS)[number]): MatchRules => FORMAT_PROFILES[format].rules;

describe("the clock", () => {
  it.each(FORMATS)("counts %s's regulation to the turn cap, not past it", (format) => {
    const rules = rulesFor(format);

    expect(matchClock(1, rules)).toMatchObject({ phase: "regulation", turn: 1, of: rules.turnCap });
    expect(matchClock(rules.turnCap, rules)).toMatchObject({
      phase: "regulation",
      turn: rules.turnCap,
      of: rules.turnCap,
    });
  });

  it.each(FORMATS)("starts %s's extra time again from one", (format) => {
    const rules = rulesFor(format);
    const first = matchClock(rules.turnCap + 1, rules);

    expect(first).toMatchObject({ phase: "extraTime", turn: 1, of: rules.extraTimeTurns });
    expect(first.label).toContain("Extra time");
  });

  it.each(FORMATS)("counts %s's extra time to its own end", (format) => {
    const rules = rulesFor(format);
    const last = matchClock(rules.turnCap + rules.extraTimeTurns, rules);

    expect(last).toMatchObject({
      phase: "extraTime",
      turn: rules.extraTimeTurns,
      of: rules.extraTimeTurns,
    });
  });

  it("never names a turn beyond the phase it is in", () => {
    /* The bug this replaces: a denominator of regulation *plus* extra time, so
       a match finishing on the cap read as eight turns short of an ending it
       was never going to have. */
    const rules = rulesFor("5v5");

    for (let turn = 1; turn <= rules.turnCap + rules.extraTimeTurns + 3; turn += 1) {
      const clock = matchClock(turn, rules);
      expect(clock.turn).toBeGreaterThanOrEqual(1);
      expect(clock.turn).toBeLessThanOrEqual(clock.of);
      expect(clock.of).not.toBe(rules.turnCap + rules.extraTimeTurns);
    }
  });

  it("says nothing about extra time during regulation", () => {
    const rules = rulesFor("5v5");
    expect(matchClock(rules.turnCap, rules).label).not.toContain("Extra");
  });
});

describe("the scoreboard's clock", () => {
  /** A board wound to a given turn, the long way, so the state is a real one. */
  function atTurn(turn: number) {
    const rng = createRng(parseSeed(5));
    let state = createInitialState({ format: "5v5" });

    while (state.turn < turn && state.result === null) {
      const result = applyAction(state, { type: "endTurn", team: state.activeTeam }, rng);
      if (!result.ok) break;
      state = result.state;
    }

    return state;
  }

  it("shows the regulation cap while the match is in regulation", () => {
    const state = atTurn(3);
    render(<Scoreboard state={state} />);

    const board = within(screen.getByLabelText("Scoreboard"));
    expect(board.getByText(`Turn ${state.turn} of ${state.rules.turnCap}`)).toBeInTheDocument();
    expect(board.queryByText(/extra time/i)).not.toBeInTheDocument();
  });

  it("says extra time, and counts it from one, once regulation is over", () => {
    const rules = FORMAT_PROFILES["5v5"].rules;
    const state = { ...atTurn(2), turn: rules.turnCap + 1 };

    render(<Scoreboard state={state} />);

    const board = within(screen.getByLabelText("Scoreboard"));
    expect(board.getByText(/extra time/i)).toBeInTheDocument();
    expect(board.getByText(`Turn 1 of ${rules.extraTimeTurns}`)).toBeInTheDocument();
  });

  it("never shows the two caps added together", () => {
    const rules = FORMAT_PROFILES["5v5"].rules;
    const total = rules.turnCap + rules.extraTimeTurns;

    render(<Scoreboard state={atTurn(4)} />);
    expect(screen.queryByText(new RegExp(`of ${total}\\b`))).not.toBeInTheDocument();
    expect(DEFAULT_SETUP.mode).toBe("5v5");
  });
});
