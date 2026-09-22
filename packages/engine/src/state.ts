import {
  centreSpot,
  DEFAULT_FORMAT,
  FORMAT_PROFILES,
  MatchRulesSchema,
  mirrorPosition,
  playerIdFor,
  ROLE_PROFILES,
  TEAMS,
  type MatchFormat,
  type MatchRules,
  type MatchState,
  type Player,
  type Position,
  type Role,
  type Team,
} from "@gaffer/shared";

/** Options for {@link createInitialState}. */
export interface CreateInitialStateOptions {
  /**
   * Which game type to play. Defaults to 5-a-side.
   *
   * The engine treats this as nothing more than a source of a board, a line-up
   * and a set of numbers. No rule anywhere reads it — `legalActions` and the
   * resolvers were already written against a board and a squad rather than
   * against seven columns and five players, which is what makes a second and
   * third format data rather than code.
   */
  format?: MatchFormat;
  /**
   * Which side takes the kickoff, and therefore acts first and starts with the
   * ball. Defaults to `"home"`.
   */
  kickingOff?: Team;
  /**
   * Numbers to play this format under, overriding its own.
   *
   * For a match whose setup differs from the format's defaults — a tester
   * trying 11-a-side with two actions a turn, say. Merged over the format's
   * rules and validated, so an impossible set (an odd turn cap, which would
   * hand one side an extra go) throws here rather than producing a match that
   * is quietly unfair.
   *
   * The result is copied onto the state, so the match keeps these numbers for
   * its whole life — including across the rebuild after a goal.
   */
  rules?: Partial<MatchRules>;
}

/** A player from the line-up, before the kickoff spot is decided. */
interface Placed {
  /** Unique within the match. */
  id: string;
  /** Which side. */
  team: Team;
  /** The role, which fixes stats and move range. */
  role: Role;
  /** Where the line-up puts them. */
  position: Position;
}

/**
 * Lay a side out from its format's line-up.
 *
 * Home uses the shape as written; away uses its 180° rotation, so a formation is
 * authored once and is symmetric by construction. Ids number each role within
 * its side, which is what lets a back four exist at all.
 */
function placeSide(team: Team, format: MatchFormat): Placed[] {
  const { board, lineup } = FORMAT_PROFILES[format];
  const seen = new Map<Role, number>();

  return lineup.map((slot) => {
    const index = (seen.get(slot.role) ?? 0) + 1;
    seen.set(slot.role, index);

    return {
      id: playerIdFor(team, slot.role, index),
      team,
      role: slot.role,
      position: team === "home" ? { ...slot.at } : mirrorPosition(slot.at, board),
    };
  });
}

/**
 * Build the state a match starts from: both squads in formation, nobody has
 * moved, and the ball is on the centre spot with the kicking-off striker.
 *
 * Deterministic and side-effect free — no clock, no randomness. Calling it twice
 * with the same options produces equal (but not shared) states, so a caller can
 * mutate what it receives without reaching into anyone else's match.
 *
 * The pitch, the squad and every number that scales with them come from the
 * format (GDD §5, §12). The rules are copied onto the state rather than left to
 * be looked up, so a saved match replays identically even if the format table is
 * later retuned.
 *
 * @example
 * ```ts
 * const state = createInitialState();
 * state.players.length;                 // 10
 * state.ball.carrierId;                 // "home-striker-1"
 *
 * createInitialState({ format: "11v11" }).players.length;   // 22
 * createInitialState({ kickingOff: "away" }).activeTeam;    // "away"
 *
 * // A format's pitch and squad, played under a different action economy.
 * createInitialState({ format: "11v11", rules: { actionsPerTurn: 2 } });
 * ```
 */
export function createInitialState(options: CreateInitialStateOptions = {}): MatchState {
  const format = options.format ?? DEFAULT_FORMAT;
  const kickingOff = options.kickingOff ?? "home";
  const profile = FORMAT_PROFILES[format];
  const rules = MatchRulesSchema.parse({ ...profile.rules, ...options.rules });
  const spot = centreSpot(profile.board);

  /*
   * The side kicking off advances its first striker onto the centre spot to
   * stand over the ball. "First" is line-up order, which is why that order is
   * part of a format rather than an implementation detail.
   */
  const kickoffTakerId = (() => {
    const striker = profile.lineup.findIndex((slot) => slot.role === "striker");
    if (striker === -1) {
      throw new Error(`Format "${format}" has no striker to take the kickoff`);
    }
    const before = profile.lineup
      .slice(0, striker)
      .filter((slot) => slot.role === "striker").length;
    return playerIdFor(kickingOff, "striker", before + 1);
  })();

  const players: Player[] = TEAMS.flatMap((team) =>
    placeSide(team, format).map((placed): Player => {
      const stats = ROLE_PROFILES[placed.role].stats;
      return {
        id: placed.id,
        team: placed.team,
        role: placed.role,
        position: placed.id === kickoffTakerId ? { ...spot } : placed.position,
        stats: { ...stats },
        moveRange: ROLE_PROFILES[placed.role].moveRange,
      };
    }),
  );

  const kickoffTaker = players.find((player) => player.id === kickoffTakerId);

  /* Unreachable: the id was built from a slot the line-up definitely has. The
     throw keeps the invariant explicit rather than relying on an assertion. */
  if (!kickoffTaker) {
    throw new Error(`Formation is missing a striker for the "${kickingOff}" side`);
  }

  return {
    format,
    rules,
    board: { ...profile.board },
    players,
    ball: {
      position: { ...kickoffTaker.position },
      carrierId: kickoffTaker.id,
    },
    possession: kickingOff,
    turn: 1,
    activeTeam: kickingOff,
    actionsRemaining: rules.actionsPerTurn,
    score: { home: 0, away: 0 },
    kickedOff: kickingOff,
    // Every kickoff is a pass, including the ones after a goal (GDD §7).
    kickoffPending: kickingOff,
    stats: {
      shotsAttempted: { home: 0, away: 0 },
      duelsWon: { home: 0, away: 0 },
    },
    result: null,
  };
}
