import { z } from "zod";

import { DEFAULT_BOARD, type Board, type Position } from "./pitch.js";
import type { Role } from "./roles.js";

/**
 * The game types a match can be played at.
 *
 * Named the way a player would say them out loud, because this is the one piece
 * of configuration that appears in the interface and in a shared link.
 */
export const FORMATS = ["5v5", "7v7", "11v11"] as const;

/** A validated game type. See {@link FORMATS}. */
export const MatchFormatSchema = z.enum(FORMATS);

/** A validated game type. See {@link MatchFormatSchema}. */
export type MatchFormat = z.infer<typeof MatchFormatSchema>;

/**
 * Every number that changes with the size of the game.
 *
 * These live on the match state rather than as module constants, for the same
 * reason a player's stats are copied onto the player at kickoff: a state has to
 * be self-contained. A saved, shared or transmitted match replays identically
 * even if the tuning table underneath is later changed, and one page can hold a
 * 5v5 and an 11v11 without either of them reading the other's numbers.
 *
 * Deliberately *not* in here: the width of a goal. A goal is a fixed physical
 * size in football and the pitch grows around it, which is also what keeps the
 * keeper coherent — `GOAL_MOUTH_HEIGHT` is exactly what a keeper on its line can
 * cover with a move range of 1, at every format.
 */
export const MatchRulesSchema = z
  .object({
    /** Actions a side may spend per turn (GDD §13). */
    actionsPerTurn: z.number().int().min(1),
    /** Turns of regulation, counted across both sides. */
    turnCap: z.number().int().min(2),
    /** Turns of golden-goal extra time, counted across both sides. */
    extraTimeTurns: z.number().int().min(0),
    /** How far from the goal mouth a carrier may shoot, in steps. */
    shotRange: z.number().int().min(1),
  })
  .refine((rules) => rules.turnCap % 2 === 0, {
    message: "turnCap must be even, or one side gets an extra turn",
    path: ["turnCap"],
  })
  .refine((rules) => rules.extraTimeTurns % 2 === 0, {
    message: "extraTimeTurns must be even, or one side gets an extra turn",
    path: ["extraTimeTurns"],
  });

/** Validated per-format numbers. See {@link MatchRulesSchema}. */
export type MatchRules = z.infer<typeof MatchRulesSchema>;

/** One player in a starting line-up: what they are, and where they stand. */
export interface LineupSlot {
  /** The role, which fixes stats and move range. */
  role: Role;
  /** The home-side cell. The away side is this rotated 180°. */
  at: Position;
}

/** Everything that makes one game type what it is. */
export interface FormatProfile {
  /** The id, as it appears in a link. */
  id: MatchFormat;
  /** How it is named in the interface. */
  label: string;
  /** The shape, in the shorthand a football supporter would recognise. */
  shape: string;
  /** How settled the numbers are. `alpha` means expect them to move. */
  status: "stable" | "alpha";
  /** Pitch dimensions. Both must be odd, so the pitch has a true centre. */
  board: Board;
  /**
   * The starting eleven — or five, or seven — for the home side.
   *
   * The away side is this rotated 180°, so a shape is written once and is
   * symmetric by construction. Order matters in one respect: the first striker
   * is the one that steps onto the centre spot to take a kickoff.
   */
  lineup: readonly LineupSlot[];
  /** The numbers that scale with the pitch. */
  rules: MatchRules;
}

const cell = (x: number, y: number): Position => ({ x, y });

/**
 * The three game types, as data.
 *
 * GDD §5 promised this: "pitch and squad size are config, so 7-a-side and
 * 11-a-side become game modes later." This is the later. Nothing in the engine
 * changed to add them — the rules were already written against a board and a
 * squad rather than against seven columns and five players.
 *
 * Two constraints hold for every line-up here, and the tests enforce them on any
 * that is added:
 *
 * - **Both pitch dimensions are odd.** The away side is the home side rotated
 *   180°, and a rotation needs a single fixed point to rotate about. That fixed
 *   point is the centre spot, which is also where the ball starts.
 * - **Nobody stands on the centre spot, and no home cell is the mirror of
 *   another.** Otherwise two players would start on one cell. The side kicking
 *   off steps its first striker onto the spot, which is how a real kickoff
 *   lines up.
 */
export const FORMAT_PROFILES: Readonly<Record<MatchFormat, FormatProfile>> = {
  /**
   * The flagship. Balanced, played, and the only one that is not provisional.
   *
   * ```text
   *          0    1    2    3    4    5    6
   *     0    .    .    W    .    .    .    .
   *     1    .    .    .    .    m    .    .
   *     2    G    D    .    S*   .    d    g
   *     3    .    .    M    s    .    .    .
   *     4    .    .    .    .    w    .    .
   * ```
   */
  "5v5": {
    id: "5v5",
    label: "5-a-side",
    shape: "1-1-2-1",
    status: "stable",
    board: DEFAULT_BOARD,
    lineup: [
      { role: "goalkeeper", at: cell(0, 2) },
      { role: "defender", at: cell(1, 2) },
      { role: "midfielder", at: cell(2, 3) },
      { role: "winger", at: cell(2, 0) },
      { role: "striker", at: cell(3, 1) },
    ],
    rules: { actionsPerTurn: 2, turnCap: 24, extraTimeTurns: 8, shotRange: 2 },
  },

  /**
   * Seven a side, as a 2-3-1: two at the back, three across the middle with the
   * winger holding the touchline, one up top.
   *
   * ```text
   *          0    1    2    3    4    5    6    7    8
   *     0    .    .    W    .    .    .    .    .    .
   *     1    .    .    .    .    .    m    .    .    .
   *     2    .    D    .    .    S*   .    .    d    .
   *     3    G    .    M    .    .    .    m    .    g
   *     4    .    D    .    .    s    .    .    d    .
   *     5    .    .    .    M    .    .    .    .    .
   *     6    .    .    .    .    .    .    w    .    .
   * ```
   */
  "7v7": {
    id: "7v7",
    label: "7-a-side",
    shape: "2-3-1",
    status: "alpha",
    board: { width: 9, height: 7 },
    lineup: [
      { role: "goalkeeper", at: cell(0, 3) },
      { role: "defender", at: cell(1, 2) },
      { role: "defender", at: cell(1, 4) },
      { role: "winger", at: cell(2, 0) },
      { role: "midfielder", at: cell(2, 3) },
      { role: "midfielder", at: cell(3, 5) },
      { role: "striker", at: cell(4, 2) },
    ],
    rules: { actionsPerTurn: 3, turnCap: 32, extraTimeTurns: 10, shotRange: 2 },
  },

  /**
   * Eleven a side, as a 4-4-2: a flat back four, four across midfield with both
   * wingers on the touchlines, and a front two.
   *
   * **The front of this shape was rebuilt twice, and the second time mattered
   * more than the first.**
   *
   * The original put the second striker at (5,6): one cell from the centre spot
   * but off every ray, which left an 11-a-side kickoff with no legal pass at
   * all. Moving it to (4,6) fixed that — and the format still handed the side
   * that kicked off an **18% win rate**, the same in both directions, so the
   * game was symmetric and the kickoff was simply a bad place to be.
   *
   * The cause was the *kind* of outlet rather than the count. The one pass
   * available ran two cells down a diagonal, which can be intercepted; and with
   * four actions a turn the other side had enough to press, win it and break
   * before the kicking side had organised. 5-a-side never had this problem
   * because its kickoff taker has a team-mate *adjacent* — and a pass to an
   * adjacent team-mate crosses an empty lane, so it cannot be intercepted at
   * all. Pulling one midfielder from (3,5) up to (5,5) gives 11-a-side the same
   * out, and took the kicking side from 18% to **40%**, with goals slightly up
   * rather than down.
   *
   * Moving *both* midfielders up was tried and rejected: it fixed the bias just
   * as well (42%) and cost a quarter of the goals (1.20 → 0.88).
   *
   * ```text
   *          0    1    2    3    4    5    6    7    8    9   10   11   12
   *     0    .    .    .    W    .    .    .    .    .    w    .    .    .
   *     1    .    D    .    .    .    .    .    .    .    .    .    d    .
   *     2    .    .    .    .    .    .    .    .    s    .    .    .    .
   *     3    .    D    .    M    .    .    S*   .    m    .    .    d    .
   *     4    G    .    .    .    .    .    .    .    .    .    .    .    g
   *     5    .    D    .    .    .    M    s    .    .    .    .    d    .
   *     6    .    .    .    .    S    .    .    .    .    .    .    .    .
   *     7    .    D    .    .    .    .    .    .    .    .    .    d    .
   *     8    .    .    .    W    .    .    .    .    .    w    .    .    .
   * ```
   */
  "11v11": {
    id: "11v11",
    label: "11-a-side",
    shape: "4-4-2",
    status: "alpha",
    board: { width: 13, height: 9 },
    lineup: [
      { role: "goalkeeper", at: cell(0, 4) },
      { role: "defender", at: cell(1, 1) },
      { role: "defender", at: cell(1, 3) },
      { role: "defender", at: cell(1, 5) },
      { role: "defender", at: cell(1, 7) },
      { role: "winger", at: cell(3, 0) },
      { role: "midfielder", at: cell(3, 3) },
      { role: "midfielder", at: cell(5, 5) },
      { role: "winger", at: cell(3, 8) },
      { role: "striker", at: cell(6, 3) },
      { role: "striker", at: cell(4, 6) },
    ],
    rules: { actionsPerTurn: 4, turnCap: 44, extraTimeTurns: 14, shotRange: 3 },
  },
};

/** The format a match is played at unless something says otherwise. */
export const DEFAULT_FORMAT: MatchFormat = "5v5";

/** How many players a side fields at this format. */
export function squadSize(format: MatchFormat): number {
  return FORMAT_PROFILES[format].lineup.length;
}
