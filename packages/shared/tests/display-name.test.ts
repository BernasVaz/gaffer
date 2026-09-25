import { describe, expect, it } from "vitest";

import { displayNameProblem, MAX_DISPLAY_NAME, normaliseDisplayName } from "../src/index.js";

describe("the name an opponent sees", () => {
  it("accepts an ordinary name", () => {
    for (const name of ["Sam", "Bernardo", "O'Neill", "Jean-Luc", "李明", "Player 2"]) {
      expect(displayNameProblem(name), name).toBeNull();
    }
  });

  it("wants something rather than nothing", () => {
    expect(displayNameProblem("")).toMatch(/needs something/);
    expect(displayNameProblem("   ")).toMatch(/needs something/);
  });

  it("caps the length", () => {
    expect(displayNameProblem("a".repeat(MAX_DISPLAY_NAME))).toBeNull();
    expect(displayNameProblem("a".repeat(MAX_DISPLAY_NAME + 1))).toMatch(/longer than/);
  });

  it("refuses names that will not render", () => {
    /* Combining marks stacked into a "zalgo" name, and zero-width characters
       used to make two players look like the same person. */
    expect(displayNameProblem("Sam̀́̂")).toMatch(/display properly/);
    expect(displayNameProblem("Sa​m")).toMatch(/display properly/);
  });

  it("turns away the obvious ones", () => {
    for (const name of ["fuck", "Big Shit", "a cunt"]) {
      expect(displayNameProblem(name), name).toMatch(/happy for your opponent/);
    }
  });

  it("sees through the usual substitutions", () => {
    expect(displayNameProblem("sh1t")).toMatch(/happy for your opponent/);
    expect(displayNameProblem("f4ggot")).toMatch(/happy for your opponent/);
  });

  it("does not punish an innocent name that contains one", () => {
    /* The Scunthorpe problem, which is why the match is on word boundaries.
       A filter that rejects real names is worse than one that misses a rude
       one, because the person it fails is a real person trying to play. */
    for (const name of ["Scunthorpe United", "Assumpta", "Penistone"]) {
      expect(displayNameProblem(name), name).toBeNull();
    }
  });

  it("stores one name rather than several that look alike", () => {
    expect(normaliseDisplayName("  Sam   Smith ")).toBe("Sam Smith");
  });
});
