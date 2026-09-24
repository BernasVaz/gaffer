import { applyAction, createInitialState, createRng } from "@gaffer/engine";
import { FORMAT_PROFILES, parseSeed, totalTurns, type MatchState } from "@gaffer/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShootoutScreen } from "../src/match/Shootout";

const RULES = FORMAT_PROFILES["5v5"].rules;

/** A match sitting level on the final whistle, so ending the turn goes to penalties. */
function levelAtTheEnd(): MatchState {
  const base = createInitialState();
  return {
    ...base,
    turn: totalTurns(RULES),
    score: { home: 1, away: 1 },
    kickoffPending: null,
  };
}

/** The shootout the engine resolves for that match. */
function shootoutOf(seed: number) {
  const state = levelAtTheEnd();
  const played = applyAction(state, { type: "endTurn", team: "home" }, createRng(parseSeed(seed)));
  if (!played.ok) throw new Error(played.reason);
  return { state: played.state, shootout: played.state.result!.shootout! };
}

describe("taking the penalties", () => {
  it("shows the odds before the kick, and the dice only after it", async () => {
    /* The whole promise of the game in miniature: you see the number, then you
       commit, then you find out. The engine has in fact already decided — but
       nothing on screen may say so before the press (ADR 0026). */
    const user = userEvent.setup();
    const { state, shootout } = shootoutOf(20260924);
    const first = shootout.kicks[0]!;

    const Harness = () => {
      const [revealed, setRevealed] = [0, vi.fn()] as const;
      void revealed;
      return (
        <ShootoutScreen
          state={state}
          kicks={shootout.kicks}
          revealed={0}
          onTake={setRevealed}
          onFinish={() => {}}
          seat={null}
        />
      );
    };

    render(<Harness />);

    const take = screen.getByRole("button", { name: /^Take the kick/ });
    expect(take.getAttribute("aria-label")).toContain(`${Math.round(first.winChance * 100)}%`);

    // Nothing about the outcome is on screen yet.
    expect(screen.queryByText(/saves it|scores|buries it|keeps it out/)).toBeNull();
    await user.click(take);
  });

  it("walks the kicks one at a time and keeps the running score", () => {
    const { state, shootout } = shootoutOf(4242);
    const throughTwo = shootout.kicks.slice(0, 2);

    render(
      <ShootoutScreen
        state={state}
        kicks={shootout.kicks}
        revealed={2}
        onTake={() => {}}
        onFinish={() => {}}
        seat={null}
      />,
    );

    const panel = screen.getByRole("region", { name: "Penalty shootout" });
    const scored = (team: "home" | "away") =>
      throughTwo.filter((kick) => kick.team === team && kick.scored).length;

    /* Both running totals are on screen — which is what makes it a shootout
       rather than a list of dice. */
    expect(panel.textContent).toContain(String(scored("home")));
    expect(panel.textContent).toContain(String(scored("away")));
  });

  it("offers the result only once every kick has been taken", async () => {
    const user = userEvent.setup();
    const { state, shootout } = shootoutOf(31337);
    const onFinish = vi.fn();

    render(
      <ShootoutScreen
        state={state}
        kicks={shootout.kicks}
        revealed={shootout.kicks.length}
        onTake={() => {}}
        onFinish={onFinish}
        seat="home"
      />,
    );

    expect(screen.queryByRole("button", { name: /^Take the kick/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /See the result/ }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("reads the dice off the kick rather than rolling its own", () => {
    /* A second calculation is a second source of truth, and this one would be
       comparing different numbers to the ones the winner was decided by. */
    const { state, shootout } = shootoutOf(777);
    const first = shootout.kicks[0]!;

    render(
      <ShootoutScreen
        state={state}
        kicks={shootout.kicks}
        revealed={1}
        onTake={() => {}}
        onFinish={() => {}}
        seat={null}
      />,
    );

    const panel = screen.getByRole("region", { name: "Penalty shootout" });
    const attackStat = first.attackerTotal - first.attackerRoll;
    const defenceStat = first.defenderTotal - first.defenderRoll;

    expect(panel.textContent).toContain(`${attackStat}+${first.attackerRoll}`);
    expect(panel.textContent).toContain(`${defenceStat}+${first.defenderRoll}`);
  });
});
