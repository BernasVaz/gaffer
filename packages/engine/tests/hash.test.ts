import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  applyAction,
  createInitialState,
  createRng,
  legalActions,
  stateHash,
} from "../src/index.js";

describe("the fingerprint two clients compare", () => {
  it("is the same board twice", () => {
    const state = createInitialState({ format: "5v5" });
    expect(stateHash(state)).toBe(stateHash(state));
  });

  it("does not depend on the order players sit in the array", () => {
    /* The order an array happens to be in is not part of a position. Two
       clients that agree about the football must agree about the hash, or the
       desync check fires on matches that never diverged. */
    const state = createInitialState({ format: "5v5" });
    const shuffled = { ...state, players: [...state.players].reverse() };
    expect(stateHash(shuffled)).toBe(stateHash(state));
  });

  it("moves when anything about the board does", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const before = createInitialState({ format: "5v5" });
      const played = applyAction(before, legalActions(before)[0]!, createRng(seed));
      expect(played.ok).toBe(true);
      if (!played.ok) continue;
      expect(stateHash(played.state), `seed ${seed}`).not.toBe(stateHash(before));
    }
  });

  it("separates boards that differ only in the score", () => {
    const state = createInitialState({ format: "5v5" });
    expect(stateHash({ ...state, score: { home: 1, away: 0 } })).not.toBe(stateHash(state));
    expect(stateHash({ ...state, score: { home: 0, away: 1 } })).not.toBe(
      stateHash({ ...state, score: { home: 1, away: 0 } }),
    );
  });

  it("agrees along a whole match, replayed twice", () => {
    /* The property the online layer leans on: replay the same log and you get
       the same fingerprint, so a mismatch means a real disagreement. */
    const play = (seed: number) => {
      let state = createInitialState({ format: "5v5" });
      const rng = createRng(seed);
      const hashes: string[] = [];
      for (let step = 0; step < 30 && state.result === null; step += 1) {
        const played = applyAction(state, legalActions(state)[0]!, rng);
        if (!played.ok) break;
        state = played.state;
        hashes.push(stateHash(state));
      }
      return hashes;
    };

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5000 }), (seed) => {
        expect(play(seed)).toEqual(play(seed));
      }),
      { numRuns: 25 },
    );
  });

  it("is sixteen hex characters", () => {
    expect(stateHash(createInitialState({ format: "11v11" }))).toMatch(/^[0-9a-f]{16}$/);
  });
});
