import { z } from "zod";

import { DEFAULT_FORMAT, FORMAT_PROFILES, MatchFormatSchema } from "./format.js";
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
export const PLAY_MODES = ["solo", "hotseat"] as const;

/** A validated play mode. See {@link PLAY_MODES}. */
export const PlayModeSchema = z.enum(PLAY_MODES);

/** A validated play mode. See {@link PlayModeSchema}. */
export type PlayMode = z.infer<typeof PlayModeSchema>;

/**
 * The fewest actions a turn can grant, and the most.
 *
 * One is the smallest turn that is still a turn. Four is where the top of the
 * range sits because it is what 11-a-side needs, and because past it a turn
 * stops being a decision and becomes a shopping list — the whole tension of
 * GDD §8 is that two actions is *not enough* to do everything you want.
 *
 * The range is deliberately small. This is a knob for a tester to feel the
 * difference with, not a slider to get lost in.
 */
export const MIN_ACTIONS_PER_TURN = 1;

/** The most actions a turn can grant. See {@link MIN_ACTIONS_PER_TURN}. */
export const MAX_ACTIONS_PER_TURN = 4;

/** A validated actions-per-turn choice. */
export const ActionsPerTurnSchema = z
  .number()
  .int()
  .min(MIN_ACTIONS_PER_TURN)
  .max(MAX_ACTIONS_PER_TURN);

/**
 * Everything chosen before kickoff, and everything a link needs to carry.
 *
 * A match is fully determined by this: the game type fixes the pitch, the squad
 * and the numbers; the seed fixes the dice; the play mode and side fix who
 * commands whom; and the difficulty fixes the opponent, which is itself
 * deterministic. Two people opening the same link and playing the same moves
 * therefore see the same match, which is the whole point of sharing one.
 *
 * **On the two things both called "mode".** A player says "mode" about the game
 * type — 5v5, 7v7, 11v11 — so that is what `mode` means here and in a link.
 * Whether the other side is a person or the machine is `play`. The two were the
 * other way round before game types existed, so {@link parseSetup} still reads a
 * legacy `?mode=solo` correctly; it can tell them apart by value, since no game
 * type is called "solo" and no play mode is called "5v5".
 */
export const MatchSetupSchema = z.object({
  /** The game type: which pitch, which squad, which numbers. */
  mode: MatchFormatSchema,
  /** Two people at one screen, or one against the opponent. */
  play: PlayModeSchema,
  /** The side the person at the keyboard commands. Ignored in hotseat. */
  side: TeamSchema,
  /** How hard the opponent tries. Ignored in hotseat. */
  difficulty: DifficultySchema,
  /**
   * Actions a turn grants, overriding the game type's own number.
   *
   * Always concrete rather than optional, so a setup means one thing and a link
   * carries what it is actually playing. {@link parseSetup} fills it from the
   * game type when a link does not say, which is what keeps `?mode=11v11` on
   * its own correct rather than quietly 5-a-side's two.
   */
  actions: ActionsPerTurnSchema,
  /** The match seed. Every die in the match comes from it. */
  seed: SeedSchema,
});

/** A validated setup. See {@link MatchSetupSchema}. */
export type MatchSetup = z.infer<typeof MatchSetupSchema>;

/**
 * What you get if you ask for nothing.
 *
 * 5-a-side, because it is the only game type whose balance is settled. Solo,
 * because the first thing anyone does with a link is play it alone. And
 * **`casual`**, because the first thing anyone does with a link is also the
 * first game they have ever played.
 *
 * It was `pro` — the setting the balance was tuned against, which is a good
 * reason for a balance run and a poor one for somebody's first match. `pro`
 * plans a whole turn ahead and punishes a keeper left off its line; it is meant
 * to be worth beating, not meant to be met cold. Every level stays selectable on
 * the setup screen and in the link, so nothing is taken away — this only changes
 * what you get when you ask for nothing (ADR 0026).
 */
export const DEFAULT_SETUP: MatchSetup = {
  mode: DEFAULT_FORMAT,
  play: "solo",
  actions: FORMAT_PROFILES[DEFAULT_FORMAT].rules.actionsPerTurn,
  side: "home",
  difficulty: "casual",
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
 * parseSetup("?seed=42&mode=11v11");     // { mode: "11v11", play: "solo", … }
 * parseSetup("?seed=42&mode=hotseat");   // a link from before game types existed
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
  const rawMode = params.get("mode");
  const rawActions = params.get("actions");

  /*
   * `mode` used to mean solo-or-hotseat and now means the game type. A link
   * shared before game types existed still says `?mode=solo`, and the two
   * vocabularies do not overlap — so the old spelling is recognised by value
   * rather than being left to fall back to a default and quietly change what
   * somebody sent.
   */
  const legacyPlay = PlayModeSchema.safeParse(rawMode);

  const mode = pick(MatchFormatSchema, rawMode, DEFAULT_SETUP.mode);

  return {
    mode,
    play: legacyPlay.success
      ? legacyPlay.data
      : pick(PlayModeSchema, params.get("play"), DEFAULT_SETUP.play),
    side: pick(TeamSchema, params.get("side"), DEFAULT_SETUP.side),
    difficulty: pick(DifficultySchema, params.get("level"), DEFAULT_SETUP.difficulty),
    /* A link that says nothing about actions means the game type's own number,
       not 5-a-side's — otherwise `?mode=11v11` would silently be a different
       game from the one the selector produces. */
    actions: pick(
      ActionsPerTurnSchema,
      rawActions === undefined ? null : Number(rawActions),
      FORMAT_PROFILES[mode].rules.actionsPerTurn,
    ),
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
  const pairs: string[] = [
    `seed=${setup.seed}`,
    `mode=${setup.mode}`,
    `play=${setup.play}`,
    `actions=${setup.actions}`,
  ];

  // Side and difficulty describe the opponent, which hotseat does not have.
  if (setup.play === "solo") {
    pairs.push(`side=${setup.side}`, `level=${setup.difficulty}`);
  }

  return `?${pairs.join("&")}`;
}

/**
 * How far into a match's move log to wind before handing it over, if a link says.
 *
 * Deliberately **not** part of {@link MatchSetup}. A setup is what match this
 * *is* — it keys the saved feedback and it is what a shared link promises —
 * whereas this is a place to stand inside that match. Folding it in would make
 * two views of one match look like two different matches.
 *
 * Returns undefined for anything that is not a plain non-negative whole number,
 * on the same principle as the rest of this file: a mangled link should open a
 * playable match rather than nothing at all.
 */
export function parseReplayTo(search: string): number | undefined {
  const raw = readQuery(search).get("replayTo");
  /* An empty value means the key was typed and left blank, which is a request
     for nothing — and `Number("")` is 0, which would silently be a request to
     wind all the way back to kickoff. */
  if (raw === undefined || raw.trim() === "") return undefined;

  const parsed = z.number().int().min(0).safeParse(Number(raw));
  return parsed.success ? parsed.data : undefined;
}

/** The largest seed a match can have, so a picker can offer the whole range. */
export const MAX_SEED: Seed = 0xffffffff;
