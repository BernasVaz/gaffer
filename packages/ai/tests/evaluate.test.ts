import { createInitialState } from "@gaffer/engine";
import { defendingGoalMouth, type MatchState, type Player, type Team } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { evaluateState, shotThreat, WEIGHTS } from "../src/index.js";

const kickoff = () => createInitialState();

/** Put one player somewhere, leaving the rest of the board alone. */
function place(state: MatchState, id: string, x: number, y: number): MatchState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === id ? { ...player, position: { x, y } } : player,
    ),
    ball: state.ball.carrierId === id ? { position: { x, y }, carrierId: id } : state.ball,
  };
}

const keeperOf = (state: MatchState, team: Team): Player =>
  state.players.find((player) => player.team === team && player.role === "goalkeeper")!;

describe("evaluateState", () => {
  it("values a goal far above any position", () => {
    const level = kickoff();
    const ahead: MatchState = { ...level, score: { home: 1, away: 0 } };

    expect(evaluateState(ahead, "home") - evaluateState(level, "home")).toBe(WEIGHTS.goal);
    expect(evaluateState(ahead, "away")).toBeLessThan(evaluateState(level, "away"));
  });

  it("values a won match above any scoreline", () => {
    const state = kickoff();
    const won: MatchState = {
      ...state,
      result: { winner: "home", decidedBy: "regulation", shootout: null },
    };

    expect(evaluateState(won, "home")).toBe(WEIGHTS.win);
    expect(evaluateState(won, "away")).toBe(-WEIGHTS.win);
  });

  it("does not believe a shootout it did not roll", () => {
    /*
     * The search reaches a shootout only through a generator whose dice it
     * rigged itself, so trusting the winner would be trusting its own thumb.
     * A shootout result is therefore worth far less than a win in football.
     */
    const state = kickoff();
    const onPenalties: MatchState = {
      ...state,
      result: {
        winner: "home",
        decidedBy: "shootout",
        shootout: { home: 3, away: 2, kicks: [] },
      },
    };

    expect(Math.abs(evaluateState(onPenalties, "home"))).toBeLessThan(WEIGHTS.win);
  });

  it("prefers having the ball to not having it", () => {
    const state = kickoff();
    expect(evaluateState(state, "home")).toBeGreaterThan(evaluateState(state, "away"));
  });

  it("charges a keeper that has left its goal, whoever has the ball", () => {
    const state = kickoff();
    const mouth = defendingGoalMouth("home", state.board);
    const keeper = keeperOf(state, "home");

    expect(mouth).toContainEqual(keeper.position);

    const adrift = place(state, keeper.id, 2, 4);
    expect(evaluateState(adrift, "home")).toBeLessThan(evaluateState(state, "home"));
  });

  it("charges an adrift keeper more once the other side has the ball", () => {
    const ours = kickoff();
    const theirs = createInitialState({ kickingOff: "away" });
    const keeper = keeperOf(ours, "home");

    const costWithBall =
      evaluateState(ours, "home") - evaluateState(place(ours, keeper.id, 2, 4), "home");
    const costWithout =
      evaluateState(theirs, "home") - evaluateState(place(theirs, keeper.id, 2, 4), "home");

    expect(costWithout).toBeGreaterThan(costWithBall);
  });

  it("is blind to all of that when asked to be reckless", () => {
    // A reckless reader has no opinion about its own goal, which is exactly what
    // makes the casual opponent play like someone who has not been punished yet.
    const state = createInitialState({ kickingOff: "away" });
    const keeper = keeperOf(state, "home");
    const adrift = place(state, keeper.id, 2, 4);

    expect(evaluateState(adrift, "home", { reckless: true })).toBe(
      evaluateState(state, "home", { reckless: true }),
    );
    expect(evaluateState(adrift, "home")).toBeLessThan(evaluateState(state, "home"));
  });

  it("prices a shooting threat below converting it", () => {
    // The mistake this guards against: an evaluation that rates standing in the
    // box as highly as scoring will stand in the box for the whole match.
    expect(WEIGHTS.shotThreat).toBeLessThan(WEIGHTS.goal / 2);
  });
});

describe("shotThreat", () => {
  it("is nothing when the ball is nowhere near a goal", () => {
    expect(shotThreat(kickoff())).toBe(0);
  });

  it("is a certainty when the net is empty and the lane is clear", () => {
    let state = kickoff();
    // Walk the away keeper out of its goal, clear the one cell on the lane, and
    // bring the home striker into range. An open goal is not a duel (ADR 0004).
    state = place(state, keeperOf(state, "away").id, 4, 0);
    state = place(state, "away-defender", 6, 0);
    state = place(state, "home-striker", 4, 2);

    expect(shotThreat(state)).toBe(1);
  });

  it("is the duel's own odds when the keeper is home", () => {
    const state = place(kickoff(), "home-striker", 4, 2);
    const threat = shotThreat(state);

    expect(threat).toBeGreaterThan(0);
    expect(threat).toBeLessThan(1);
  });
});
