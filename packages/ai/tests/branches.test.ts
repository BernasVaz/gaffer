import {
  applyAction,
  createInitialState,
  createRng,
  legalActions,
  previewDuel,
} from "@gaffer/engine";
import { parseSeed, type Action } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { outcomesOf } from "../src/index.js";

const kickoff = () => createInitialState();

/** The first legal action of a given type, for building a specific scenario. */
const firstOfType = (type: Action["type"]) =>
  legalActions(kickoff()).find((action) => action.type === type);

describe("outcomesOf", () => {
  it("gives one certain outcome for an uncontested action", () => {
    const state = kickoff();
    const move = legalActions(state).find(
      (action) => action.type === "move" && previewDuel(state, action) === null,
    )!;

    const outcomes = outcomesOf(state, move);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.probability).toBe(1);
  });

  it("gives both branches of a contested action, weighted by the engine's own odds", () => {
    const state = kickoff();
    const contested = legalActions(state).find((action) => {
      const duel = previewDuel(state, action);
      return duel !== null && duel.winChance > 0 && duel.winChance < 1;
    })!;

    const outcomes = outcomesOf(state, contested);
    const chance = previewDuel(state, contested)!.winChance;

    expect(outcomes).toHaveLength(2);
    expect(outcomes[0]!.probability).toBeCloseTo(chance, 10);
    expect(outcomes[1]!.probability).toBeCloseTo(1 - chance, 10);
  });

  it("always reports probabilities that sum to one", () => {
    const state = kickoff();

    for (const action of legalActions(state)) {
      const total = outcomesOf(state, action).reduce((sum, o) => sum + o.probability, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it("produces genuinely different boards for the two branches", () => {
    const state = kickoff();
    const contested = legalActions(state).find((action) => {
      const duel = previewDuel(state, action);
      return duel !== null && duel.winChance > 0 && duel.winChance < 1;
    })!;

    const [won, lost] = outcomesOf(state, contested);

    // A contested action that resolved the same way both times would mean the
    // rigged generator was not actually rigging anything.
    expect(won!.state.possession).not.toBe(lost!.state.possession);
  });

  it("reports nothing for a command the engine refuses", () => {
    const state = kickoff();
    const notYours: Action = { type: "move", playerId: "away-winger", target: { x: 4, y: 0 } };

    expect(outcomesOf(state, notYours)).toEqual([]);
  });

  it("leaves the match's own generator untouched", () => {
    /*
     * The search must be free to explore without spending dice the match will
     * need. This is the structural guarantee behind that: exploring every legal
     * action from a board cannot move a generator it was never handed.
     */
    const state = kickoff();
    const rng = createRng(parseSeed(7));
    const before = rng.state();

    for (const action of legalActions(state)) outcomesOf(state, action);

    expect(rng.state()).toBe(before);

    // And the generator still produces what it would have produced.
    const fresh = createRng(parseSeed(7));
    expect(applyAction(state, firstOfType("pass")!, rng)).toEqual(
      applyAction(state, firstOfType("pass")!, fresh),
    );
  });
});
