import { DEFAULT_FORMAT, FORMAT_PROFILES, type MatchCommand } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { buildMatch } from "../src/match/replay";

const RULES = FORMAT_PROFILES[DEFAULT_FORMAT].rules;

const build = (replay: MatchCommand[]) =>
  buildMatch({
    seed: 1,
    format: DEFAULT_FORMAT,
    actionsPerTurn: RULES.actionsPerTurn,
    replay,
  });

describe("a replay that stops short", () => {
  it("says nothing diverged when the log plays out", () => {
    /* The ordinary case, and the one a local archive is always in. */
    expect(build([]).diverged).toBeNull();
  });

  it("names the command it refused, and why", () => {
    /*
     * A log and an engine disagreeing is a stale archive locally and a **desync**
     * once a match is shared (ADR 0029). Reporting the index is the difference
     * between "diverged at command 1" and a board that is quietly wrong.
     */
    const nonsense: MatchCommand[] = [
      { type: "pass", playerId: "home-striker-1", target: "nobody-at-all" },
    ];

    const { diverged } = build(nonsense);

    expect(diverged).not.toBeNull();
    expect(diverged?.index).toBe(0);
    expect(diverged?.reason).toBeTruthy();
  });

  it("points at the offending command rather than the start of the log", () => {
    /* Two good commands then a bad one: the index has to be the bad one's, or
       it tells you where the log begins instead of where it broke. */
    const opening = buildMatch({
      seed: 1,
      format: DEFAULT_FORMAT,
      actionsPerTurn: RULES.actionsPerTurn,
    });

    const kickoff = opening.state.players.find(
      (player) => player.id === opening.state.ball.carrierId,
    )!;

    const good: MatchCommand[] = [
      { type: "pass", playerId: kickoff.id, target: "home-midfielder-1" },
    ];
    const { diverged } = build([...good, { type: "shoot", playerId: "nobody", target: null }]);

    expect(diverged?.index).toBe(good.length);
  });
});
