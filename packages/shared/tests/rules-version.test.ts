import { describe, expect, it } from "vitest";

import {
  replaysFaithfully,
  RULES_VERSION,
  RulesVersionSchema,
  rulesStanding,
} from "../src/index.js";

describe("the rules edition", () => {
  it("is a whole number that counts up", () => {
    expect(RulesVersionSchema.safeParse(RULES_VERSION).success).toBe(true);
    expect(RulesVersionSchema.safeParse(0).success).toBe(false);
    expect(RulesVersionSchema.safeParse(1.5).success).toBe(false);
  });

  it("places a match against the rules it is being replayed under", () => {
    expect(rulesStanding(RULES_VERSION)).toBe("current");
    expect(rulesStanding(RULES_VERSION - 1)).toBe("older");
    expect(rulesStanding(RULES_VERSION + 1)).toBe("newer");
  });

  it("says it cannot place a match saved before this existed", () => {
    /* Not "older" — a match saved five minutes before the field shipped is not
       older than the current rules, and guessing would be worse than saying so. */
    expect(rulesStanding(undefined)).toBe("unknown");
  });

  it("only vouches for a replay of the edition it is running", () => {
    expect(replaysFaithfully(RULES_VERSION)).toBe(true);
    expect(replaysFaithfully(RULES_VERSION - 1)).toBe(false);
    expect(replaysFaithfully(RULES_VERSION + 1)).toBe(false);
    expect(replaysFaithfully(undefined)).toBe(false);
  });
});
