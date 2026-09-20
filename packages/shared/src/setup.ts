import { z } from "zod";

import { SeedSchema, type Seed } from "./seed.js";
import { TeamSchema, type Team } from "./team.js";

/**
 * How hard the solo opponent tries.
 *
 * Lives here rather than in `@gaffer/ai` because it arrives from outside: it is
 * part of a shared match link, so it crosses a trust boundary and has to be
 * parsed like everything else that does. `@gaffer/ai` imports it and decides
 * what each setting actually *does* — that part is behaviour, not contract.
 */
export const DIFFICULTIES = ["casual", "pro", "elite"] as const;

/** A validated difficulty. See {@link DIFFICULTIES}. */
export const DifficultySchema = z.enum(DIFFICULTIES);

/** A validated difficulty. See {@link DifficultySchema}. */
export type Difficulty = z.infer<typeof DifficultySchema>;

/** Who is playing: two people at one screen, or one against the machine. */
export const MATCH_MODES = ["solo", "hotseat"] as const;

/** A validated mode. See {@link MATCH_MODES}. */
export const MatchModeSchema = z.enum(MATCH_MODES);

/** A validated mode. See {@link MatchModeSchema}. */
export type MatchMode = z.infer<typeof MatchModeSchema>;

/**
 * Everything chosen before kickoff, and everything a link needs to carry.
 *
 * A match is fully determined by this: the seed fixes the dice, the mode and
 * side fix who commands whom, and the difficulty fixes the opponent — which is
 * itself deterministic. Two people opening the same link and playing the same
 * moves therefore see the same match, which is the whole point of sharing one.
 */
export const MatchSetupSchema = z.object({
  /** Two people at one screen, or one against the opponent. */
  mode: MatchModeSchema,
  /** The side the person at the keyboard commands. Ignored in hotseat. */
  side: TeamSchema,
  /** How hard the opponent tries. Ignored in hotseat. */
  difficulty: DifficultySchema,
  /** The match seed. Every die in the match comes from it. */
  seed: SeedSchema,
});

/** A validated setup. See {@link MatchSetupSchema}. */
export type MatchSetup = z.infer<typeof MatchSetupSchema>;

/**
 * What you get if you ask for nothing.
 *
 * Solo, because the first thing anyone does with a link is play it alone, and
 * `pro`, because that is the setting the balance was tuned against.
 */
export const DEFAULT_SETUP: MatchSetup = {
  mode: "solo",
  side: "home",
  difficulty: "pro",
  seed: 1,
};

/**
 * Which side takes the opening kickoff.
 *
 * Always home, and deliberately not a separate choice. Self-play puts the
 * kickoff at roughly 62% of matches (ADR 0007), so it is the single most
 * consequential thing about a setup — which makes hiding it in a third control
 * worse than folding it into one. Choosing a side *is* choosing whether you
 * kick off, and the setup screen says so in as many words.
 */
export const KICKING_OFF: Team = "home";

/**
 * Split a query string into its parameters.
 *
 * Hand-rolled rather than using `URLSearchParams`, which this package cannot
 * reach: `@gaffer/shared` compiles against the language and nothing else — no
 * DOM, no Node — precisely so that the same contracts hold in a browser, on a
 * server and in a test with no environment at all. A dozen lines is a small
 * price for that, and every value a Gaffer link carries is a short identifier
 * or a number.
 *
 * The first occurrence of a key wins, so a doctored `?seed=1&seed=2` cannot
 * quietly override what the visible part of the link says.
 */
function readQuery(search: string): Map<string, string> {
  const params = new Map<string, string>();

  for (const pair of search.replace(/^[?#]/, "").split("&")) {
    if (pair === "") continue;

    const equals = pair.indexOf("=");
    const key = equals === -1 ? pair : pair.slice(0, equals);
    const value = equals === -1 ? "" : pair.slice(equals + 1);

    let decoded: string;
    try {
      decoded = decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      // A lone "%" is not valid encoding. Keep the raw text and let the schema
      // reject it, rather than throwing out of a function that must not throw.
      decoded = value;
    }

    if (!params.has(key)) params.set(key, decoded);
  }

  return params;
}

/**
 * Read a setup out of a URL query string.
 *
 * Every field is validated and every invalid field falls back to its default
 * rather than throwing. That is the right trade for this particular boundary:
 * a link is typed by hand, pasted, truncated by chat clients and edited out of
 * curiosity, and the useful response to `?seed=banana` is a playable match, not
 * a blank page. A link is an invitation, not an API call.
 *
 * @param search - A query string, with or without its leading `?`.
 * @returns A setup that is always valid, however mangled the input.
 *
 * @example
 * ```ts
 * parseSetup("?seed=42&mode=hotseat");   // { mode: "hotseat", side: "home", … }
 * parseSetup("?seed=banana");            // falls back to the default seed
 * ```
 */
export function parseSetup(search: string): MatchSetup {
  const params = readQuery(search);

  const pick = <T>(schema: z.ZodType<T>, raw: unknown, fallback: T): T => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : fallback;
  };

  const rawSeed = params.get("seed");

  return {
    mode: pick(MatchModeSchema, params.get("mode"), DEFAULT_SETUP.mode),
    side: pick(TeamSchema, params.get("side"), DEFAULT_SETUP.side),
    difficulty: pick(DifficultySchema, params.get("level"), DEFAULT_SETUP.difficulty),
    seed: pick(SeedSchema, rawSeed === undefined ? null : Number(rawSeed), DEFAULT_SETUP.seed),
  };
}

/**
 * Write a setup back out as a query string, ready to be shared.
 *
 * The inverse of {@link parseSetup}, and round-trip stable: parsing what this
 * produces gives back the setup it was given.
 */
export function setupToQuery(setup: MatchSetup): string {
  const pairs: string[] = [`seed=${setup.seed}`, `mode=${setup.mode}`];

  // Side and difficulty describe the opponent, which hotseat does not have.
  if (setup.mode === "solo") {
    pairs.push(`side=${setup.side}`, `level=${setup.difficulty}`);
  }

  return `?${pairs.join("&")}`;
}

/** The largest seed a match can have, so a picker can offer the whole range. */
export const MAX_SEED: Seed = 0xffffffff;
