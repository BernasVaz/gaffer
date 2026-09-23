import { chebyshevDistance, type Action, type MatchState } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { applyAction, createRng, legalActions, previewDuel } from "../src/index.js";
import { makeState } from "./helpers.js";

/** Every dribble the side to move may play with a given player. */
const dribbles = (state: MatchState, playerId: string): Action[] =>
  legalActions(state).filter((action) => action.type === "dribble" && action.playerId === playerId);

/** A carrier with one opponent directly in front of it, and space beyond. */
const manInFront = (overrides: Parameters<typeof makeState>[1] = {}) =>
  makeState(
    [
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [2, 2], ball: true },
      { team: "away", role: "defender", at: [3, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ],
    overrides,
  );

describe("going through the man in front", () => {
  it("offers the cell beyond him, which no plain move can reach", () => {
    const state = manInFront();
    const targets = dribbles(state, "home-striker-1").map((action) =>
      action.type === "dribble" ? `${action.target.x},${action.target.y}` : "",
    );

    expect(targets).toContain("4,2");

    // And nothing may land *on* him.
    expect(targets).not.toContain("3,2");
    expect(legalActions(state).some((a) => a.type === "move")).toBe(true);
  });

  it("is a duel with the man being gone through, not with whoever is strongest", () => {
    /* A stronger defender standing beside the run must not take over the duel:
       you are beating the player in your way, and the rest are covering. */
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [2, 2], ball: true },
      { team: "away", role: "winger", at: [3, 2] },
      { team: "away", role: "defender", at: [3, 3] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const through = dribbles(state, "home-striker-1").find(
      (action) => action.type === "dribble" && action.target.x === 4 && action.target.y === 2,
    )!;

    const duel = previewDuel(state, through)!;
    expect(duel.defender.playerId).toBe("away-winger-2");
    expect(duel.coveringPlayerIds).toContain("away-defender-3");
  });

  it("is not offered when there is nowhere to land", () => {
    const blocked = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [2, 2], ball: true },
      { team: "away", role: "defender", at: [3, 2] },
      { team: "away", role: "midfielder", at: [4, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const targets = dribbles(blocked, "home-striker-1").map((action) =>
      action.type === "dribble" ? `${action.target.x},${action.target.y}` : "",
    );
    expect(targets).not.toContain("5,2");
  });

  it("is not offered off the edge of the pitch", () => {
    /* The defender on the last column: there is no cell beyond them to land on,
       so taking them on is simply not a thing that can be done here. */
    const edge = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [5, 0], ball: true },
      { team: "away", role: "defender", at: [6, 0] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const targets = dribbles(edge, "home-striker-1").map((action) =>
      action.type === "dribble" ? `${action.target.x},${action.target.y}` : "",
    );
    expect(targets).not.toContain("7,0");
  });

  it("is not offered into a goal mouth the carrier may not enter", () => {
    /* The mouth is what a shot is aimed into, not somewhere an outfielder
       stands — so a defender on its lip cannot be gone through into it. */
    const atTheMouth = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "defender", at: [5, 2] },
      { team: "away", role: "goalkeeper", at: [6, 1] },
    ]);

    const targets = dribbles(atTheMouth, "home-striker-1").map((action) =>
      action.type === "dribble" ? `${action.target.x},${action.target.y}` : "",
    );
    expect(targets).not.toContain("6,2");
  });

  it("is not offered through a team-mate", () => {
    const mate = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [2, 2], ball: true },
      { team: "home", role: "midfielder", at: [3, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const targets = dribbles(mate, "home-striker-1").map((action) =>
      action.type === "dribble" ? `${action.target.x},${action.target.y}` : "",
    );
    expect(targets).not.toContain("4,2");
  });

  it("is only ever offered to a carrier", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [2, 2] },
      { team: "home", role: "midfielder", at: [4, 4], ball: true },
      { team: "away", role: "defender", at: [3, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(dribbles(state, "home-striker-1")).toHaveLength(0);
  });
});

describe("what beating him does", () => {
  it("puts the carrier past him with the ball", () => {
    const seen = new Set<string>();

    for (let seed = 1; seed <= 80; seed += 1) {
      const state = manInFront();
      const through = dribbles(state, "home-striker-1").find(
        (action) => action.type === "dribble" && action.target.x === 4 && action.target.y === 2,
      )!;

      const result = applyAction(state, through, createRng(seed));
      if (!result.ok) throw new Error("the engine refused an action it offered");

      const striker = result.state.players.find((p) => p.id === "home-striker-1")!;

      if (result.duel!.attackerWon) {
        /* Through the man on (3,2), onto (4,2), and carried on to (5,2) —
           winning buys ground as well as the beating (ADR 0023). */
        expect(striker.position).toEqual({ x: 5, y: 2 });
        expect(result.state.ball.carrierId).toBe("home-striker-1");
        seen.add("won");
      } else {
        // A turnover, and the run does not happen — as already decided.
        expect(striker.position).toEqual({ x: 2, y: 2 });
        expect(result.state.ball.carrierId).toBe("away-defender-2");
        seen.add("lost");
      }
    }

    expect(seen).toEqual(new Set(["won", "lost"]));
  });

  it("never leaves two players on one cell", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = manInFront();
      const through = dribbles(state, "home-striker-1").find(
        (action) => action.type === "dribble" && action.target.x === 4 && action.target.y === 2,
      )!;

      const result = applyAction(state, through, createRng(seed));
      if (!result.ok) throw new Error("refused");

      const cells = result.state.players.map((p) => `${p.position.x},${p.position.y}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it("carries the carrier three cells: past him, and on", () => {
    const state = manInFront();
    const through = dribbles(state, "home-striker-1").find(
      (action) => action.type === "dribble" && action.target.x === 4 && action.target.y === 2,
    )!;

    const result = applyAction(state, through, createRng(3));
    if (!result.ok) throw new Error("refused");
    if (!result.duel!.attackerWon) return;

    const striker = result.state.players.find((p) => p.id === "home-striker-1")!;
    expect(chebyshevDistance({ x: 2, y: 2 }, striker.position)).toBe(3);
  });

  it("replays identically from the same seed", () => {
    const play = () => {
      const state = manInFront();
      const through = dribbles(state, "home-striker-1").find(
        (action) => action.type === "dribble" && action.target.x === 4 && action.target.y === 2,
      )!;
      return applyAction(state, through, createRng(77));
    };

    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });
});

describe("a won dribble carries on", () => {
  /** A carrier with an ordinary contested run into open space. */
  const contestedRun = () =>
    makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "midfielder", at: [2, 2], ball: true },
      { team: "away", role: "winger", at: [2, 3] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

  /** The one dribble aimed at a given cell. */
  const aimedAt = (state: MatchState, playerId: string, x: number, y: number) =>
    dribbles(state, playerId).find(
      (action) => action.type === "dribble" && action.target.x === x && action.target.y === y,
    );

  it("takes an ordinary won dribble one cell past where it was aimed", () => {
    /* The other half of the change: every won dribble buys ground, not only
       the ones that go through somebody. Without this, a dribble still paid a
       duel for ground a move covers for free. */
    const state = contestedRun();
    const run = aimedAt(state, "home-midfielder-1", 3, 2)!;
    expect(run).toBeDefined();

    for (let seed = 1; seed <= 40; seed += 1) {
      const result = applyAction(contestedRun(), run, createRng(seed));
      if (!result.ok) throw new Error("refused");

      const carrier = result.state.players.find((p) => p.id === "home-midfielder-1")!;
      if (result.duel!.attackerWon) {
        expect(carrier.position).toEqual({ x: 4, y: 2 });
      } else {
        expect(carrier.position).toEqual({ x: 2, y: 2 });
      }
    }
  });

  it("stops where it was aimed when the cell beyond is taken", () => {
    const crowded = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "midfielder", at: [2, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "winger", at: [2, 3] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const run = aimedAt(crowded, "home-midfielder-1", 3, 2)!;
    const result = applyAction(crowded, run, createRng(7));
    if (!result.ok) throw new Error("refused");
    if (!result.duel!.attackerWon) return;

    expect(result.state.players.find((p) => p.id === "home-midfielder-1")!.position).toEqual({
      x: 3,
      y: 2,
    });
  });

  it("stops at the touchline rather than running off it", () => {
    const edge = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "midfielder", at: [2, 1], ball: true },
      { team: "away", role: "winger", at: [2, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const run = aimedAt(edge, "home-midfielder-1", 2, 0)!;
    expect(run).toBeDefined();

    const result = applyAction(edge, run, createRng(4));
    if (!result.ok) throw new Error("refused");
    if (!result.duel!.attackerWon) return;

    expect(result.state.players.find((p) => p.id === "home-midfielder-1")!.position).toEqual({
      x: 2,
      y: 0,
    });
  });

  it("never carries an outfielder into a goal mouth", () => {
    /* A mouth is what a shot is aimed into, not somewhere anybody stands. */
    const nearGoal = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "winger", at: [4, 3] },
      { team: "away", role: "goalkeeper", at: [6, 1] },
    ]);

    const run = aimedAt(nearGoal, "home-striker-1", 5, 2)!;
    expect(run).toBeDefined();

    const result = applyAction(nearGoal, run, createRng(6));
    if (!result.ok) throw new Error("refused");
    if (!result.duel!.attackerWon) return;

    expect(result.state.players.find((p) => p.id === "home-striker-1")!.position).toEqual({
      x: 5,
      y: 2,
    });
  });

  it("leaves a lost dribble exactly where it was", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const result = applyAction(
        contestedRun(),
        aimedAt(contestedRun(), "home-midfielder-1", 3, 2)!,
        createRng(seed),
      );
      if (!result.ok) throw new Error("refused");
      if (result.duel!.attackerWon) continue;

      expect(result.state.players.find((p) => p.id === "home-midfielder-1")!.position).toEqual({
        x: 2,
        y: 2,
      });
      expect(result.state.ball.carrierId).toBe("away-winger-2");
    }
  });
});
