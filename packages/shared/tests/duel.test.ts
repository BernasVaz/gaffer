import { describe, expect, it } from "vitest";

import { COVERING_DEFENDER_BONUS, DUEL_DIE_SIDES, duelWinChance } from "../src/index.js";

describe("duel constants", () => {
  it("uses an opposed d4 and +2 per covering defender, per GDD §13", () => {
    expect(DUEL_DIE_SIDES).toBe(4);
    expect(COVERING_DEFENDER_BONUS).toBe(2);
  });
});

describe("duelWinChance", () => {
  /*
   * The odds are computed by enumerating all 16 equally likely d4 pairs, never
   * by sampling. These four cases are the ones GDD §9 states in prose, so if the
   * die or the tie rule ever changes, the design doc and the engine disagree
   * loudly instead of drifting apart.
   */
  it.each([
    { edge: "+2", attacker: 5, defender: 3, expected: 13 / 16, gdd: "≈81%" },
    { edge: "+1", attacker: 5, defender: 4, expected: 10 / 16, gdd: "≈63%" },
    { edge: "level", attacker: 4, defender: 4, expected: 6 / 16, gdd: "ties to the defender" },
    { edge: "−1", attacker: 5, defender: 6, expected: 3 / 16, gdd: "~19%" },
  ])("$edge edge is $gdd", ({ attacker, defender, expected }) => {
    expect(duelWinChance(attacker, defender)).toBeCloseTo(expected, 10);
  });

  it("reproduces the GDD §9 worked example exactly", () => {
    // Striker ATK 5 dribbles a lone Defender DEF 4 → ~63%.
    expect(duelWinChance(5, 4)).toBeCloseTo(10 / 16, 10);
    // Add a covering Midfielder (+2 DEF → effective 6) → the striker is the
    // underdog at ~19%.
    expect(duelWinChance(5, 4 + COVERING_DEFENDER_BONUS)).toBeCloseTo(3 / 16, 10);
  });

  it("gives a level duel to the defender, so the attacker sits at 6/16", () => {
    // A tie goes to the defender, so "even stats" is not a coin flip. This is
    // intended (GDD §9) and load-bearing for how much pressing is worth.
    expect(duelWinChance(3, 3)).toBeCloseTo(3 / 8, 10);
    expect(duelWinChance(3, 3)).toBeLessThan(0.5);
  });

  it("only ever returns an exact sixteenth", () => {
    for (let attacker = 0; attacker <= 8; attacker += 1) {
      for (let defender = 0; defender <= 8; defender += 1) {
        const sixteenths = duelWinChance(attacker, defender) * 16;
        expect(Math.abs(sixteenths - Math.round(sixteenths))).toBeLessThan(1e-9);
      }
    }
  });

  it("never falls outside 0…1, and saturates at both ends", () => {
    expect(duelWinChance(0, 99)).toBe(0);
    expect(duelWinChance(99, 0)).toBe(1);
    /*
     * The die spans 4, so certainty now needs a 4-point edge. Leaving a sliver
     * at +3 is the whole reason the die was widened — GDD §13's watch-list
     * called out that an opposed d3 made a Winger's tackle on a Striker a
     * mathematical impossibility rather than a long shot.
     */
    expect(duelWinChance(6, 3)).toBeLessThan(1);
    expect(duelWinChance(6, 3)).toBeGreaterThan(0.9);
    expect(duelWinChance(7, 3)).toBe(1);
  });

  it("never decreases as the attacker improves", () => {
    for (let defender = 0; defender <= 6; defender += 1) {
      for (let attacker = 0; attacker < 6; attacker += 1) {
        expect(duelWinChance(attacker + 1, defender)).toBeGreaterThanOrEqual(
          duelWinChance(attacker, defender),
        );
      }
    }
  });

  it("depends only on the gap between the two scores", () => {
    expect(duelWinChance(5, 4)).toBe(duelWinChance(2, 1));
    expect(duelWinChance(9, 7)).toBe(duelWinChance(3, 1));
  });
});
