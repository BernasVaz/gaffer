import {
  ACTIONS_PER_TURN,
  CENTRE_SPOT,
  DEFAULT_BOARD,
  HOME_FORMATION,
  mirrorPosition,
  playerIdFor,
  ROLE_PROFILES,
  ROLES,
  TEAMS,
  type MatchState,
  type Player,
  type Position,
  type Role,
  type Team,
} from "@gaffer/shared";

/** Options for {@link createInitialState}. */
export interface CreateInitialStateOptions {
  /**
   * Which side takes the kickoff, and therefore acts first and starts with the
   * ball. Defaults to `"home"`.
   */
  kickingOff?: Team;
}

/**
 * Where a role stands at kickoff for a given side.
 *
 * Home uses the formation as written; away uses its 180° rotation. The side
 * kicking off advances its striker onto the centre spot to stand over the ball.
 */
function kickoffPosition(team: Team, role: Role, kickingOff: Team): Position {
  if (role === "striker" && team === kickingOff) {
    return { ...CENTRE_SPOT };
  }

  const base = HOME_FORMATION[role];
  return team === "home" ? { ...base } : mirrorPosition(base, DEFAULT_BOARD);
}

/**
 * Build the state a match starts from: both squads in formation, nobody has
 * moved, and the ball is on the centre spot with the kicking-off striker.
 *
 * Deterministic and side-effect free — no clock, no randomness. Calling it twice
 * with the same options produces equal (but not shared) states, so a caller can
 * mutate what it receives without reaching into anyone else's match.
 *
 * The pitch is the v1 7 × 5 board (GDD §5). Larger boards for 7-a-side and
 * 11-a-side are a later mode, and will arrive as an option here rather than as
 * a change to the rules.
 *
 * @example
 * ```ts
 * const state = createInitialState();
 * state.players.length;                 // 10
 * state.ball.carrierId;                 // "home-striker"
 * state.score;                          // { home: 0, away: 0 }
 *
 * createInitialState({ kickingOff: "away" }).activeTeam;  // "away"
 * ```
 */
export function createInitialState(options: CreateInitialStateOptions = {}): MatchState {
  const kickingOff = options.kickingOff ?? "home";

  const players: Player[] = TEAMS.flatMap((team) =>
    ROLES.map((role): Player => {
      const profile = ROLE_PROFILES[role];
      return {
        id: playerIdFor(team, role),
        team,
        role,
        position: kickoffPosition(team, role, kickingOff),
        stats: { ...profile.stats },
        moveRange: profile.moveRange,
      };
    }),
  );

  const kickoffTaker = players.find(
    (player) => player.team === kickingOff && player.role === "striker",
  );

  /* Unreachable: the formation defines a striker for every side. The throw keeps
     the invariant explicit rather than relying on a non-null assertion. */
  if (!kickoffTaker) {
    throw new Error(`Formation is missing a striker for the "${kickingOff}" side`);
  }

  return {
    board: { ...DEFAULT_BOARD },
    players,
    ball: {
      position: { ...kickoffTaker.position },
      carrierId: kickoffTaker.id,
    },
    possession: kickingOff,
    turn: 1,
    activeTeam: kickingOff,
    actionsRemaining: ACTIONS_PER_TURN,
    score: { home: 0, away: 0 },
    kickedOff: kickingOff,
    stats: {
      shotsAttempted: { home: 0, away: 0 },
      duelsWon: { home: 0, away: 0 },
    },
    result: null,
  };
}
