import {
  COVERING_DEFENDER_BONUS,
  duelWinChance,
  FORMAT_PROFILES,
  FORMATS,
  LAUNCH_INTERCEPT_BONUS,
  ROLE_PROFILES,
  type Action,
  type MatchState,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { applyAction, createRng, legalActions, previewDuel } from "../src/index.js";
import { makeState } from "./helpers.js";

/** Every launch the side to move may play. */
const launches = (state: MatchState) =>
  legalActions(state).filter((action) => action.type === "launch");

/** Every pass it may play. */
const passes = (state: MatchState) =>
  legalActions(state).filter((action) => action.type === "pass");

/** Who a launch or pass is aimed at. */
const aimedAt = (actions: Action[]) =>
  actions.map((action) =>
    action.type === "launch" || action.type === "pass" ? action.target : "",
  );

const KEEPER_PAS = ROLE_PROFILES.goalkeeper.stats.pas;

describe("who may launch", () => {
  it("is the goalkeeper, when it has the ball", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(aimedAt(launches(state))).toEqual(["home-striker-1"]);
  });

  it("is nobody else, however far the team-mate is", () => {
    // The same geometry with an outfield player on the ball: the distant
    // team-mate is simply out of range, and there is no long option at all.
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "midfielder", at: [1, 2], ball: true },
      { team: "home", role: "striker", at: [5, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(launches(state)).toHaveLength(0);
  });

  it("is not a keeper standing off the ball", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(launches(state)).toHaveLength(0);
  });

  it("is not the keeper of the side that is not to move", () => {
    const state = makeState(
      [
        { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
        { team: "home", role: "striker", at: [4, 2] },
        { team: "away", role: "goalkeeper", at: [6, 2] },
      ],
      { activeTeam: "away" },
    );

    expect(launches(state)).toHaveLength(0);
  });
});

describe("how far a launch reaches", () => {
  it("goes past the keeper's own passing range", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [KEEPER_PAS + 1, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(aimedAt(launches(state))).toEqual(["home-striker-1"]);
    expect(passes(state)).toHaveLength(0);
  });

  it("stops at the format's launch range", () => {
    const { launchRange } = FORMAT_PROFILES["5v5"].rules;
    const tooFar = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [launchRange + 1, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);
    const justInside = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [launchRange, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(launches(tooFar)).toHaveLength(0);
    expect(launches(justInside)).toHaveLength(1);
  });

  it("never offers both a pass and a launch to the same team-mate", () => {
    /* A launch to somebody already in passing range would be the same ball at
       worse odds — an option nobody would ever take, cluttering the board. */
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "defender", at: [1, 2] },
      { team: "home", role: "striker", at: [1, 3] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const both = aimedAt(passes(state)).filter((id) => aimedAt(launches(state)).includes(id));
    expect(both).toEqual([]);
  });

  it("clears the halfway line at every format", () => {
    // What the range is *for*: a keeper on its own line can always find
    // somebody in the opposition half, if the lane is clear.
    for (const format of FORMATS) {
      const { board, rules } = FORMAT_PROFILES[format];
      expect(rules.launchRange).toBeGreaterThan(board.width / 2 - 1);
      expect(rules.launchRange).toBeGreaterThan(ROLE_PROFILES.goalkeeper.stats.pas);
    }
  });
});

describe("the lane a launch travels", () => {
  it("is one of the eight rays, like every other ball", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 0], ball: true },
      // Off every ray from (0, 0): two across and one down.
      { team: "home", role: "striker", at: [2, 1] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(launches(state)).toHaveLength(0);
  });

  it("is blocked by the first body on it, even an opponent far short of the target", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "away", role: "midfielder", at: [2, 2] },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(launches(state)).toHaveLength(0);
  });

  it("is blocked by a team-mate standing in front of the one being aimed at", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "midfielder", at: [2, 2] },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    // The midfielder is the outlet, at passing range; the striker behind it is
    // unreachable by any ball at all.
    expect(aimedAt(launches(state))).toEqual([]);
    expect(aimedAt(passes(state))).toEqual(["home-midfielder-1"]);
  });
});

describe("what a launch risks", () => {
  it("is free down a genuinely clear lane", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    expect(previewDuel(state, launches(state)[0]!)).toBeNull();
  });

  it("is worse than the same ball as a pass", () => {
    /* The point of the trade-off: an identical lane and an identical defender,
       and the long one is the riskier of the two. */
    const lane = (role: "midfielder") =>
      makeState([
        { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
        { team: "home", role: "striker", at: [4, 2] },
        { team: "away", role, at: [2, 3] },
        { team: "away", role: "goalkeeper", at: [6, 2] },
      ]);

    const state = lane("midfielder");
    const launch = previewDuel(state, launches(state)[0]!)!;

    // The same duel priced as a pass, by hand.
    const marker = ROLE_PROFILES.midfielder.stats.def;
    const asPass = duelWinChance(KEEPER_PAS, marker);

    expect(launch.winChance).toBeLessThan(asPass);
    expect(launch.defender.modifier).toBe(LAUNCH_INTERCEPT_BONUS);
    expect(launch.winChance).toBe(duelWinChance(KEEPER_PAS, marker + LAUNCH_INTERCEPT_BONUS));
  });

  it("charges the airborne penalty on top of covering defenders, not instead of them", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "defender", at: [2, 3] },
      { team: "away", role: "winger", at: [3, 3] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const duel = previewDuel(state, launches(state)[0]!)!;

    expect(duel.coveringPlayerIds).toHaveLength(1);
    expect(duel.defender.modifier).toBe(COVERING_DEFENDER_BONUS + LAUNCH_INTERCEPT_BONUS);
  });

  it("is read by the strongest defender beside the lane", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "striker", at: [1, 3] },
      { team: "away", role: "defender", at: [3, 3] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const duel = previewDuel(state, launches(state)[0]!)!;
    expect(duel.defender.playerId).toBe("away-defender-3");
  });
});

describe("playing a launch", () => {
  const contested = () =>
    makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "winger", at: [2, 3] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

  it("puts the ball on the team-mate when it comes off", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const result = applyAction(state, launches(state)[0]!, createRng(1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.ball.carrierId).toBe("home-striker-1");
    expect(result.state.possession).toBe("home");
    expect(result.duel).toBeNull();
  });

  it("hands it to the interceptor when it does not", () => {
    /* Rolled rather than asserted on one seed: the outcome is a die, and what
       is being checked is that *either* outcome puts the ball somewhere sane. */
    const seen = new Set<string>();

    for (let seed = 1; seed <= 60; seed += 1) {
      const state = contested();
      const result = applyAction(state, launches(state)[0]!, createRng(seed));
      if (!result.ok) throw new Error("the engine refused an action it offered");

      expect(result.duel).not.toBeNull();
      seen.add(result.state.ball.carrierId!);
    }

    expect(seen).toEqual(new Set(["home-striker-1", "away-winger-2"]));
  });

  it("costs exactly one action, like every other verb", () => {
    const state = contested();
    const result = applyAction(state, launches(state)[0]!, createRng(3));
    if (!result.ok) throw new Error("refused");

    expect(result.state.actionsRemaining).toBe(state.actionsRemaining - 1);
  });

  it("is refused when the rules do not offer it", () => {
    // A keeper without the ball: well-formed, and illegal.
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2] },
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const result = applyAction(
      state,
      { type: "launch", playerId: "home-goalkeeper-0", target: "home-striker-1" },
      createRng(1),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("illegal-action");
  });

  it("is refused when it names somebody who is not on the pitch", () => {
    const state = makeState([
      { team: "home", role: "goalkeeper", at: [0, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
      { team: "away", role: "goalkeeper", at: [6, 2] },
    ]);

    const result = applyAction(
      state,
      { type: "launch", playerId: "home-goalkeeper-0", target: "home-ghost-9" },
      createRng(1),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unknown-target");
  });

  it("replays identically from the same seed", () => {
    const play = () => {
      const state = contested();
      return applyAction(state, launches(state)[0]!, createRng(99));
    };

    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });
});

describe("every format", () => {
  it.each(FORMATS)("%s gives its keeper a long outlet at kickoff depth", (format) => {
    const { board, rules } = FORMAT_PROFILES[format];
    const mid = board.height >> 1;

    const state = makeState(
      [
        { team: "home", role: "goalkeeper", at: [0, mid], ball: true },
        { team: "home", role: "striker", at: [rules.launchRange, mid] },
        { team: "away", role: "goalkeeper", at: [board.width - 1, mid] },
      ],
      { format },
    );

    expect(aimedAt(launches(state))).toEqual(["home-striker-1"]);
    // And it genuinely leaves the keeper's half.
    expect(rules.launchRange).toBeGreaterThanOrEqual(Math.ceil(board.width / 2));
  });
});
