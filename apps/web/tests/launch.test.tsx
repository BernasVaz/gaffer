import { createInitialState, legalActions, previewDuel } from "@gaffer/engine";
import { FORMAT_PROFILES, type MatchState, type Player } from "@gaffer/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pitch } from "../src/board/Pitch";
import { targetsFor } from "../src/board/targets";
import { StatusBar } from "../src/board/StatusBar";
import { describeCommand } from "../src/match/describe";

const noop = () => {};

/**
 * A keeper on the ball with a clear ball up the middle.
 *
 * Built by moving two players on a real kickoff rather than hand-rolling a
 * state: everything else about the board — the rules, the other eight players,
 * the goal mouths — stays exactly what the engine produces, so what is being
 * tested is the client's handling of a position the engine genuinely allows.
 */
function keeperWithAnOutlet(): MatchState {
  const base = createInitialState();
  const { launchRange } = FORMAT_PROFILES["5v5"].rules;
  const mid = base.board.height >> 1;

  const keeper = base.players.find((p) => p.team === "home" && p.role === "goalkeeper")!;
  const striker = base.players.find((p) => p.team === "home" && p.role === "striker")!;

  /* Everybody else parked beyond the keeper's reach — every spare cell is five
     or more steps from (0, mid), against a launch range of four. Under ray
     lanes it was enough to stand off the eight rays; since ADR 0025 a clear
     lane is a clear lane, so the only way to leave the striker as the keeper's
     sole outlet is to put the rest genuinely out of range. Nobody at x >= 5 can
     reach the lane cells either, so it stays uncontested. */
  const away = base.players.filter((player) => player.team === "away");
  const awayKeeper = away.find((player) => player.role === "goalkeeper")!;

  const spare = [
    [5, 0],
    [5, 1],
    [5, 2],
    [5, 3],
    [5, 4],
    [base.board.width - 1, 0],
    [base.board.width - 1, base.board.height - 1],
  ] as const;

  let next = 0;
  const players: Player[] = base.players.map((player) => {
    if (player.id === keeper.id) return { ...player, position: { x: 0, y: mid } };
    if (player.id === striker.id) return { ...player, position: { x: launchRange, y: mid } };
    /* The away keeper takes its own mouth, which only it may stand in. */
    if (player.id === awayKeeper.id) {
      return { ...player, position: { x: base.board.width - 1, y: mid } };
    }
    const [x, y] = spare[next++]!;
    return { ...player, position: { x, y } };
  });

  return {
    ...base,
    players,
    ball: { position: { x: 0, y: mid }, carrierId: keeper.id },
    possession: "home",
    activeTeam: "home",
    /* Mid-match, not a kickoff: a kickoff narrows the side to its pass (ADR
       0018), which would hide the launch this fixture exists to show. It was
       only ever invisible here because the keeper had no pass to narrow to. */
    kickoffPending: null,
  };
}

const launchOf = (state: MatchState) =>
  legalActions(state).find((action) => action.type === "launch")!;

describe("the board offers a launch as its own thing", () => {
  it("names it, rather than folding it into a pass", async () => {
    const state = keeperWithAnOutlet();
    const keeper = state.players.find((p) => p.id === state.ball.carrierId)!;

    render(
      <Pitch
        state={state}
        seat="both"
        selectedId={keeper.id}
        targets={targetsFor(state, keeper.id)}
        onSelect={noop}
        onCommit={noop}
        onFocusTarget={noop}
      />,
    );

    expect(screen.getByRole("button", { name: /^Launch to number/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pass to number 9/ })).not.toBeInTheDocument();
  });

  it("rings the target in gold, not the blue a pass gets", () => {
    const state = keeperWithAnOutlet();
    const keeper = state.players.find((p) => p.id === state.ball.carrierId)!;

    const { container } = render(
      <Pitch
        state={state}
        seat="both"
        selectedId={keeper.id}
        targets={targetsFor(state, keeper.id)}
        onSelect={noop}
        onCommit={noop}
        onFocusTarget={noop}
      />,
    );

    const rings = [...container.querySelectorAll('[class*="ring-["]')].map((n) => n.className);
    expect(rings.some((c) => c.includes("ring-(--color-gold)"))).toBe(true);
    expect(rings.some((c) => c.includes("ring-sky-200"))).toBe(false);
  });

  it("commits a launch, not a pass, when it is clicked", async () => {
    const user = userEvent.setup();
    const state = keeperWithAnOutlet();
    const keeper = state.players.find((p) => p.id === state.ball.carrierId)!;
    const onCommit = vi.fn();

    render(
      <Pitch
        state={state}
        seat="both"
        selectedId={keeper.id}
        targets={targetsFor(state, keeper.id)}
        onSelect={noop}
        onCommit={onCommit}
        onFocusTarget={noop}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Launch to number/ }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toMatchObject({ type: "launch", playerId: keeper.id });
  });

  it("says so in the breakdown, with the odds the engine gives", () => {
    const state = keeperWithAnOutlet();
    const action = launchOf(state);

    render(
      <StatusBar
        state={state}
        focused={{ action, duel: previewDuel(state, action), carriesTo: null }}
        lastEvent={null}
        rejection={null}
        thinking={null}
      />,
    );

    expect(screen.getByLabelText("Match status").textContent).toMatch(/Launch/);
  });
});

describe("the match log", () => {
  it("reads a launch as a launch", () => {
    const state = keeperWithAnOutlet();
    const action = launchOf(state);

    expect(describeCommand(action, state)).toMatch(/launched it upfield to/);
  });
});
