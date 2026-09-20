import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETUP,
  DIFFICULTIES,
  KICKING_OFF,
  MATCH_MODES,
  MatchSetupSchema,
  parseSetup,
  setupToQuery,
  type MatchSetup,
} from "../src/index.js";

describe("the setup contract", () => {
  it("offers three difficulties and two modes", () => {
    expect(DIFFICULTIES).toEqual(["casual", "pro", "elite"]);
    expect(MATCH_MODES).toEqual(["solo", "hotseat"]);
  });

  it("defaults to a solo match, because that is what a link is for", () => {
    expect(DEFAULT_SETUP.mode).toBe("solo");
    expect(MatchSetupSchema.parse(DEFAULT_SETUP)).toEqual(DEFAULT_SETUP);
  });

  it("names the side that kicks off, so the choice can be made honestly", () => {
    expect(KICKING_OFF).toBe("home");
  });

  it("rejects a setup with an impossible seed", () => {
    expect(MatchSetupSchema.safeParse({ ...DEFAULT_SETUP, seed: -1 }).success).toBe(false);
    expect(MatchSetupSchema.safeParse({ ...DEFAULT_SETUP, seed: 1.5 }).success).toBe(false);
    expect(MatchSetupSchema.safeParse({ ...DEFAULT_SETUP, seed: 2 ** 32 }).success).toBe(false);
  });
});

describe("parseSetup", () => {
  it("reads a complete link", () => {
    expect(parseSetup("?seed=42&mode=solo&side=away&level=elite")).toEqual({
      seed: 42,
      mode: "solo",
      side: "away",
      difficulty: "elite",
    });
  });

  it("does not mind the leading question mark", () => {
    expect(parseSetup("seed=7")).toEqual(parseSetup("?seed=7"));
  });

  it("falls back per field rather than giving up on the whole link", () => {
    // A link is typed, pasted, truncated and edited out of curiosity. The useful
    // answer to a mangled one is a playable match, not a blank page.
    const setup = parseSetup("?seed=banana&mode=chess&side=middle&level=impossible");
    expect(setup).toEqual(DEFAULT_SETUP);
  });

  it("keeps the good fields of a partly broken link", () => {
    expect(parseSetup("?seed=99&mode=nonsense")).toEqual({
      ...DEFAULT_SETUP,
      seed: 99,
    });
  });

  it("returns the defaults for an empty query", () => {
    expect(parseSetup("")).toEqual(DEFAULT_SETUP);
    expect(parseSetup("?")).toEqual(DEFAULT_SETUP);
  });

  it("takes the first value when a key is repeated", () => {
    // Otherwise an appended `&seed=…` could quietly override the visible link.
    expect(parseSetup("?seed=5&seed=9").seed).toBe(5);
  });

  it("survives a query it cannot decode", () => {
    expect(() => parseSetup("?seed=%&mode=%E0%A4%A")).not.toThrow();
    expect(parseSetup("?seed=%")).toEqual(DEFAULT_SETUP);
  });

  it("rejects a seed outside the 32-bit range the engine's RNG works in", () => {
    expect(parseSetup("?seed=99999999999").seed).toBe(DEFAULT_SETUP.seed);
    expect(parseSetup("?seed=-3").seed).toBe(DEFAULT_SETUP.seed);
  });
});

describe("setupToQuery", () => {
  it("round-trips every setup it can produce", () => {
    for (const mode of MATCH_MODES) {
      for (const side of ["home", "away"] as const) {
        for (const difficulty of DIFFICULTIES) {
          const setup: MatchSetup = { mode, side, difficulty, seed: 1234 };
          const back = parseSetup(setupToQuery(setup));

          // Hotseat has no opponent, so it carries neither side nor difficulty
          // and those come back as defaults. Everything that matters survives.
          if (mode === "solo") expect(back).toEqual(setup);
          else expect(back).toEqual({ ...DEFAULT_SETUP, mode: "hotseat", seed: 1234 });
        }
      }
    }
  });

  it("always carries the seed, which is what makes a link a match", () => {
    expect(setupToQuery({ ...DEFAULT_SETUP, seed: 777 })).toContain("seed=777");
  });

  it("leaves the opponent out of a hotseat link", () => {
    const query = setupToQuery({ ...DEFAULT_SETUP, mode: "hotseat" });
    expect(query).not.toContain("level=");
    expect(query).not.toContain("side=");
  });
});
