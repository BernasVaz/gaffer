import {
  attackingGoalMouth,
  DEFAULT_BOARD,
  defendingGoalMouth,
  duelWinChance,
  goalMouthOwner,
  ROLE_PROFILES,
  SHOOT_COVERING_BONUS,
  SHOT_RANGE,
  chebyshevDistance,
  type MatchState,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { createInitialState, legalActions, previewDuel } from "../src/index.js";
import { makeState, scriptedRng } from "./helpers.js";
import { resolveAction } from "../src/resolve.js";

const shotFrom = (state: MatchState, playerId: string) =>
  legalActions(state).find((action) => action.type === "shoot" && action.playerId === playerId);

describe("the goal mouth belongs to its keeper", () => {
  it("names which side defends each mouth", () => {
    // Home attacks x = 6, so away defends it.
    expect(goalMouthOwner({ x: 6, y: 2 }, DEFAULT_BOARD)).toBe("away");
    expect(goalMouthOwner({ x: 0, y: 2 }, DEFAULT_BOARD)).toBe("home");
  });

  it("treats everything else as ordinary pitch", () => {
    expect(goalMouthOwner({ x: 6, y: 0 }, DEFAULT_BOARD)).toBeNull();
    expect(goalMouthOwner({ x: 6, y: 4 }, DEFAULT_BOARD)).toBeNull();
    expect(goalMouthOwner({ x: 5, y: 2 }, DEFAULT_BOARD)).toBeNull();
    expect(goalMouthOwner({ x: 3, y: 2 }, DEFAULT_BOARD)).toBeNull();
  });

  it("gives each side the mouth it defends", () => {
    expect(defendingGoalMouth("away", DEFAULT_BOARD)).toEqual(
      attackingGoalMouth("home", DEFAULT_BOARD),
    );
  });

  it("lets the defending keeper move within its own mouth", () => {
    const state = makeState([
      { team: "away", role: "goalkeeper", at: [6, 2] },
      { team: "home", role: "striker", at: [1, 2], ball: true },
    ]);
    const moves = legalActions({ ...state, activeTeam: "away" })
      .filter((action) => action.playerId === "away-goalkeeper-0")
      .flatMap((action) =>
        action.type === "move" || action.type === "dribble"
          ? [`${action.target.x},${action.target.y}`]
          : [],
      );

    expect(moves).toContain("6,1");
    expect(moves).toContain("6,3");
  });

  it("keeps outfielders out of the mouth entirely", () => {
    // A striker beside the mouth may step to the goal-line corners but not into
    // the goal itself — you shoot into it, you do not stand in it.
    const state = makeState([{ team: "home", role: "striker", at: [5, 2], ball: true }]);
    const cells = legalActions(state).flatMap((action) =>
      action.type === "move" || action.type === "dribble"
        ? [`${action.target.x},${action.target.y}`]
        : [],
    );

    expect(cells).not.toContain("6,1");
    expect(cells).not.toContain("6,2");
    expect(cells).not.toContain("6,3");
  });

  it("still lets an attacker reach the goal-line corners beside the mouth", () => {
    // From (4,2) the corners sit on a diagonal ray; from (5,2) they do not,
    // which is ray geometry rather than the new rule.
    const state = makeState([{ team: "home", role: "striker", at: [4, 2], ball: true }]);
    const cells = legalActions(state).flatMap((action) =>
      action.type === "move" || action.type === "dribble"
        ? [`${action.target.x},${action.target.y}`]
        : [],
    );

    expect(cells).toContain("6,0");
    expect(cells).toContain("6,4");
  });

  it("keeps a defending outfielder out of its own mouth too", () => {
    const state = makeState(
      [
        { team: "away", role: "defender", at: [5, 2] },
        { team: "home", role: "striker", at: [1, 2], ball: true },
      ],
      { activeTeam: "away" },
    );
    const cells = legalActions(state).flatMap((action) =>
      action.playerId === "away-defender-0" && (action.type === "move" || action.type === "dribble")
        ? [`${action.target.x},${action.target.y}`]
        : [],
    );

    expect(cells).not.toContain("6,2");
  });

  it("does not let the attacking keeper wander into the far goal", () => {
    const state = makeState([{ team: "home", role: "goalkeeper", at: [5, 2], ball: true }]);
    const cells = legalActions(state).flatMap((action) =>
      action.type === "move" || action.type === "dribble"
        ? [`${action.target.x},${action.target.y}`]
        : [],
    );
    expect(cells).not.toContain("6,2");
  });

  it("leaves the starting formation legal", () => {
    // Both keepers stand on a mouth cell at kickoff; that must stay allowed.
    const state = createInitialState();
    for (const keeper of state.players.filter((p) => p.role === "goalkeeper")) {
      expect(goalMouthOwner(keeper.position, state.board)).toBe(keeper.team);
    }
  });
});

describe("a shot is always offered from anywhere it could sensibly be taken", () => {
  it("offers one from every legal cell within SHOT_RANGE", () => {
    // The "standing uselessly near the goal with no shot" state must not exist.
    const { width, height } = DEFAULT_BOARD;
    const mouth = attackingGoalMouth("home", DEFAULT_BOARD);

    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) {
        const cell = { x, y };
        // Outfielders cannot stand in the mouth, so those cells are not legal
        // shooting positions to begin with.
        if (goalMouthOwner(cell, DEFAULT_BOARD) !== null) continue;

        const distance = Math.min(...mouth.map((m) => chebyshevDistance(cell, m)));
        const state = makeState([
          { team: "home", role: "striker", at: [x, y], ball: true },
          { team: "away", role: "goalkeeper", at: [6, 2] },
        ]);

        const shot = shotFrom(state, "home-striker-0");
        expect(Boolean(shot), `from (${x},${y}), distance ${distance}`).toBe(
          distance <= SHOT_RANGE,
        );
      }
    }
  });
});

describe("the keeper only defends from its goal", () => {
  const shooting = (keeperAt: [number, number], extra: Parameters<typeof makeState>[0] = []) =>
    makeState([
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "goalkeeper", at: keeperAt },
      ...extra,
    ]);

  it("contests the shot while it stands in the mouth", () => {
    const state = shooting([6, 2]);
    const duel = previewDuel(state, shotFrom(state, "home-striker-0")!)!;

    expect(duel.defender.playerId).toBe("away-goalkeeper-1");
    expect(duel.defender.stat).toBe(ROLE_PROFILES.goalkeeper.stats.def);
  });

  it("still defends from the mouth's outer cells", () => {
    for (const at of [
      [6, 1],
      [6, 3],
    ] as Array<[number, number]>) {
      const state = shooting(at);
      const duel = previewDuel(state, shotFrom(state, "home-striker-0")!)!;
      expect(duel.defender.playerId).toBe("away-goalkeeper-1");
    }
  });

  it("defends nothing once drawn off its line — an open goal", () => {
    const state = shooting([5, 0]);
    const shot = shotFrom(state, "home-striker-0")!;

    // No keeper in the goal and nobody in the lane: there is no duel at all.
    expect(previewDuel(state, shot)).toBeNull();
  });

  it("scores an open goal without rolling a die", () => {
    const state = shooting([5, 0]);
    const rng = scriptedRng([]); // any roll would throw
    const { state: next, duel } = resolveAction(state, shotFrom(state, "home-striker-0")!, rng);

    expect(duel).toBeNull();
    expect(next.score).toEqual({ home: 1, away: 0 });
  });

  it("still faces whoever is in the lane when the keeper has come out", () => {
    const state = shooting([6, 0], [{ team: "away", role: "defender", at: [5, 2] }]);
    const duel = previewDuel(state, shotFrom(state, "home-striker-0")!)!;

    // The keeper at (6,0) is off the mouth, so the defender in the lane leads.
    expect(duel.defender.playerId).toBe("away-defender-2");
    expect(duel.defender.stat).toBe(ROLE_PROFILES.defender.stats.def);
  });
});

describe("the four shots that matter", () => {
  const striker = ROLE_PROFILES.striker.stats.atk;
  const keeper = ROLE_PROFILES.goalkeeper.stats.def;

  const shot = (extra: Parameters<typeof makeState>[0]) => {
    const state = makeState([
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "goalkeeper", at: [6, 2] },
      ...extra,
    ]);
    return previewDuel(state, shotFrom(state, "home-striker-0")!);
  };

  it("a clean striker beats the keeper two times in three", () => {
    expect(shot([])!.winChance).toBeCloseTo(duelWinChance(striker, keeper), 10);
    expect(shot([])!.winChance).toBeCloseTo(6 / 9, 10);
  });

  it("one defender in the lane makes it an even-ish gamble", () => {
    const duel = shot([{ team: "away", role: "defender", at: [5, 2] }])!;
    expect(duel.coveringPlayerIds).toHaveLength(1);
    expect(duel.defender.modifier).toBe(SHOOT_COVERING_BONUS);
    expect(duel.winChance).toBeCloseTo(3 / 9, 10);
  });

  it("two defenders in the lane make it a long shot, not an impossibility", () => {
    const duel = shot([
      { team: "away", role: "defender", at: [5, 2] },
      { team: "away", role: "midfielder", at: [5, 1] },
    ])!;
    expect(duel.coveringPlayerIds.length).toBeGreaterThanOrEqual(1);
    expect(duel.winChance).toBeGreaterThan(0);
  });

  it("an empty net is a certainty, not a duel", () => {
    const state = makeState([
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "goalkeeper", at: [4, 0] },
    ]);
    expect(previewDuel(state, shotFrom(state, "home-striker-0")!)).toBeNull();
  });
});

describe("covering is softer on shots than in the field", () => {
  it("adds less to a keeper than to a defender in a dribble", () => {
    expect(SHOOT_COVERING_BONUS).toBe(1);
    expect(SHOOT_COVERING_BONUS).toBeLessThan(2);
  });

  it("leaves a dribble's covering bonus alone", () => {
    const state = makeState([
      { team: "home", role: "striker", at: [3, 2], ball: true },
      { team: "away", role: "defender", at: [4, 2] },
      { team: "away", role: "midfielder", at: [4, 1] },
    ]);
    const dribble = legalActions(state).find((action) => action.type === "dribble")!;
    expect(previewDuel(state, dribble)!.defender.modifier).toBe(2);
  });
});
