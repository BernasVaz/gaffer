import { describe, expect, it } from "vitest";

import { COVERING_DEFENDER_BONUS, DUEL_DIE_SIDES, duelWinChance } from "../src/index.js";

describe("duel constants", () => {
  it("uses an opposed d3 and +2 per covering defender, per GDD §13", () => {
    expect(DUEL_DIE_SIDES).toBe(3);
    expect(COVERING_DEFENDER_BONUS).toBe(2);
  });
});

describe("duelWinChance", () => {
  /*
   * The odds are computed by enumerating all 9 equally likely d3 pairs, never
   * by sampling. These four cases are the ones GDD §9 states in prose, so if the
   * die or the tie rule ever changes, the design doc and the engine disagree
   * loudly instead of drifting apart.
   */
  it.each([
    { edge: "+2", attacker: 5, defender: 3, expected: 8 / 9, gdd: "≈89%" },
    { edge: "+1", attacker: 5, defender: 4, expected: 6 / 9, gdd: "≈67%" },
    { edge: "level", attacker: 4, defender: 4, expected: 3 / 9, gdd: "ties to the defender" },
    { edge: "−1", attacker: 5, defender: 6, expected: 1 / 9, gdd: "~11%" },
  ])("$edge edge is $gdd", ({ attacker, defender, expected }) => {
    expect(duelWinChance(attacker, defender)).toBeCloseTo(expected, 10);
  });

  it("reproduces the GDD §9 worked example exactly", () => {
    // Striker ATK 5 dribbles a lone Defender DEF 4 → ~67%.
    expect(duelWinChance(5, 4)).toBeCloseTo(6 / 9, 10);
    // Add a covering Midfielder (+2 DEF → effective 6) → the striker is the
    // underdog at ~11%.
    expect(duelWinChance(5, 4 + COVERING_DEFENDER_BONUS)).toBeCloseTo(1 / 9, 10);
  });

  it("gives a level duel to the defender, so the attacker sits at 3/9", () => {
    // A tie goes to the defender, so "even stats" is not a coin flip. This is
    // intended (GDD §9) and load-bearing for how much pressing is worth.
    expect(duelWinChance(3, 3)).toBeCloseTo(1 / 3, 10);
    expect(duelWinChance(3, 3)).toBeLessThan(0.5);
  });

  it("only ever returns an exact ninth", () => {
    for (let attacker = 0; attacker <= 8; attacker += 1) {
      for (let defender = 0; defender <= 8; defender += 1) {
        const ninths = duelWinChance(attacker, defender) * 9;
        expect(Math.abs(ninths - Math.round(ninths))).toBeLessThan(1e-9);
      }
    }
  });

  it("never falls outside 0…1, and saturates at both ends", () => {
    expect(duelWinChance(0, 99)).toBe(0);
    expect(duelWinChance(99, 0)).toBe(1);
    // The die spans 3, so a 2-point edge is not yet certain but a 3-point one is.
    expect(duelWinChance(5, 3)).toBeLessThan(1);
    expect(duelWinChance(6, 3)).toBe(1);
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
