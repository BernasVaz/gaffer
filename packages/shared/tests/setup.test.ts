import { describe, expect, it } from "vitest";

import {
  DEFAULT_FORMAT,
  DEFAULT_SETUP,
  DIFFICULTIES,
  FORMATS,
  KICKING_OFF,
  MatchSetupSchema,
  parseSetup,
  PLAY_MODES,
  setupToQuery,
  type MatchSetup,
} from "../src/index.js";

describe("the setup contract", () => {
  it("offers three difficulties and two modes", () => {
    expect(DIFFICULTIES).toEqual(["casual", "pro", "elite"]);
    expect(PLAY_MODES).toEqual(["solo", "hotseat"]);
  });

  it("defaults to a solo match at the one settled game type", () => {
    expect(DEFAULT_SETUP.play).toBe("solo");
    expect(DEFAULT_SETUP.mode).toBe(DEFAULT_FORMAT);
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
    expect(parseSetup("?seed=42&mode=5v5&play=solo&side=away&level=elite")).toEqual({
      seed: 42,
      mode: "5v5",
      play: "solo",
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
    const setup = parseSetup("?seed=banana&mode=chess&play=alone&side=middle&level=impossible");
    expect(setup).toEqual(DEFAULT_SETUP);
  });

  it("keeps the good fields of a partly broken link", () => {
    expect(parseSetup("?seed=99&mode=nonsense&play=nonsense")).toEqual({
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
    for (const play of PLAY_MODES) {
      for (const side of ["home", "away"] as const) {
        for (const difficulty of DIFFICULTIES) {
          const setup: MatchSetup = { mode: "5v5", play, side, difficulty, seed: 1234 };
          const back = parseSetup(setupToQuery(setup));

          // Hotseat has no opponent, so it carries neither side nor difficulty
          // and those come back as defaults. Everything that matters survives.
          if (play === "solo") expect(back).toEqual(setup);
          else expect(back).toEqual({ ...DEFAULT_SETUP, play: "hotseat", seed: 1234 });
        }
      }
    }
  });

  it("always carries the seed, which is what makes a link a match", () => {
    expect(setupToQuery({ ...DEFAULT_SETUP, seed: 777 })).toContain("seed=777");
  });

  it("leaves the opponent out of a hotseat link", () => {
    const query = setupToQuery({ ...DEFAULT_SETUP, play: "hotseat" });
    expect(query).not.toContain("level=");
    expect(query).not.toContain("side=");
  });
});

describe("the game type in a link", () => {
  it("is carried by every link", () => {
    for (const mode of FORMATS) {
      expect(setupToQuery({ ...DEFAULT_SETUP, mode })).toContain(`mode=${mode}`);
      expect(parseSetup(setupToQuery({ ...DEFAULT_SETUP, mode })).mode).toBe(mode);
    }
  });

  it("round-trips alongside everything else", () => {
    const setup: MatchSetup = {
      mode: "11v11",
      play: "solo",
      side: "away",
      difficulty: "elite",
      seed: 909,
    };
    expect(parseSetup(setupToQuery(setup))).toEqual(setup);
  });

  it("falls back to the settled game type when a link names nonsense", () => {
    expect(parseSetup("?seed=1&mode=9v9").mode).toBe(DEFAULT_FORMAT);
  });

  it("still understands a link written before game types existed", () => {
    /*
     * `mode` used to mean solo-or-hotseat. Those links are out in the world, and
     * silently reinterpreting one as "5-a-side, solo" would change what somebody
     * sent — a hotseat link would arrive as a match against the machine.
     */
    expect(parseSetup("?seed=42&mode=hotseat")).toEqual({
      ...DEFAULT_SETUP,
      play: "hotseat",
      seed: 42,
    });
    expect(parseSetup("?seed=42&mode=solo&side=away&level=casual")).toEqual({
      mode: DEFAULT_FORMAT,
      play: "solo",
      side: "away",
      difficulty: "casual",
      seed: 42,
    });
  });

  it("prefers the new spelling when a link somehow carries both", () => {
    expect(parseSetup("?seed=1&mode=7v7&play=hotseat")).toMatchObject({
      mode: "7v7",
      play: "hotseat",
    });
  });
});
