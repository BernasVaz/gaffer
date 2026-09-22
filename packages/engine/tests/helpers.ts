import {
  DEFAULT_FORMAT,
  FORMAT_PROFILES,
  MatchStateSchema,
  ROLE_PROFILES,
  type MatchFormat,
  type MatchState,
  type Player,
  type Role,
  type Team,
} from "@gaffer/shared";

import type { Rng } from "../src/index.js";

/** One player to place. */
export interface Spec {
  /** Which side the player belongs to. */
  team: Team;
  /** The role, which fixes stats and move range. */
  role: Role;
  /** Cell as `[x, y]`. */
  at: [number, number];
  /** Set on exactly one spec to give that player the ball. */
  ball?: boolean;
}

/**
 * Build a valid match state from a handful of placed players, so a test can
 * describe exactly the board it cares about instead of the full kickoff ten.
 *
 * Throws if the result is not a legal state — a fixture that could never occur
 * proves nothing about the rules.
 */
export function makeState(
  specs: readonly Spec[],
  opts: {
    activeTeam?: Team;
    actionsRemaining?: number;
    format?: MatchFormat;
    /** Which side still owes a kickoff pass. A hand-built board owes none. */
    kickoffPending?: Team | null;
  } = {},
): MatchState {
  /* Fixtures are 5-a-side unless a test is specifically about another format:
     the rules are the same at every scale, so a rule is best pinned on the
     smallest board that can express it. */
  const format = opts.format ?? DEFAULT_FORMAT;
  const profile = FORMAT_PROFILES[format];
  const players: Player[] = specs.map((spec, index) => ({
    id: `${spec.team}-${spec.role}-${index}`,
    team: spec.team,
    role: spec.role,
    position: { x: spec.at[0], y: spec.at[1] },
    stats: { ...ROLE_PROFILES[spec.role].stats },
    moveRange: ROLE_PROFILES[spec.role].moveRange,
  }));

  const carrierIndex = specs.findIndex((spec) => spec.ball === true);
  const carrier = carrierIndex >= 0 ? players[carrierIndex] : undefined;

  const state: MatchState = {
    format,
    rules: { ...profile.rules },
    board: { ...profile.board },
    players,
    ball: carrier
      ? { position: { ...carrier.position }, carrierId: carrier.id }
      : { position: { x: 0, y: profile.board.height - 1 }, carrierId: null },
    possession: carrier ? carrier.team : null,
    turn: 1,
    activeTeam: opts.activeTeam ?? "home",
    actionsRemaining: opts.actionsRemaining ?? profile.rules.actionsPerTurn,
    score: { home: 0, away: 0 },
    /* A fixture describes a moment mid-match unless a test says otherwise, so
       the kickoff obligation is off by default — otherwise every rule test
       would find the board offering nothing but a pass. */
    kickoffPending: opts.kickoffPending ?? null,
    kickedOff: "home",
    stats: {
      shotsAttempted: { home: 0, away: 0 },
      duelsWon: { home: 0, away: 0 },
    },
    result: null,
  };

  const parsed = MatchStateSchema.safeParse(state);
  if (!parsed.success) {
    throw new Error(`test fixture is not a valid state: ${parsed.error.message}`);
  }
  return state;
}

/**
 * An {@link Rng} that hands out a fixed sequence of die results.
 *
 * Lets an outcome test say "the attacker rolls 3, the defender rolls 1" instead
 * of hunting for a seed that happens to produce it. Determinism tests use the
 * real seeded generator; these are for pinning win and loss branches.
 */
export function scriptedRng(rolls: readonly number[]): Rng & { used: () => number } {
  let index = 0;
  return {
    next: () => {
      throw new Error("scriptedRng only supports int()");
    },
    int: () => {
      const roll = rolls[index];
      if (roll === undefined) throw new Error(`scriptedRng ran out after ${index} rolls`);
      index += 1;
      return roll;
    },
    state: () => index,
    used: () => index,
  };
}
