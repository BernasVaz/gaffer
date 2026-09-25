import { buildMatch } from "../match/replay";
import { stateHash } from "@gaffer/engine";
import {
  FORMAT_PROFILES,
  RULES_VERSION,
  type MatchCommand,
  type MatchSetup,
  type MatchState,
} from "@gaffer/shared";

import { supabase } from "./client";

/** A match as the database holds it. */
export interface RemoteMatch {
  id: string;
  setup: MatchSetup;
  commandLog: MatchCommand[];
  logVersion: number;
  engineEdition: number;
  stateHash: string | null;
  homeUser: string;
  awayUser: string | null;
  status: "awaiting_opponent" | "in_play" | "complete" | "sealed";
  turnOwner: string | null;
  turnNumber: number;
}

/** Why a match cannot be played right now, when it cannot. */
export type Blocked =
  | { kind: "edition"; stored: number; ours: number }
  | { kind: "desync"; index: number; reason: string }
  | { kind: "hashMismatch"; expected: string; actual: string };

/** A remote match, rebuilt locally, with whatever is wrong with it. */
export interface Reconstructed {
  match: RemoteMatch;
  state: MatchState;
  /** `null` when the match is sound and playable. */
  blocked: Blocked | null;
}

const rowToMatch = (row: Record<string, unknown>): RemoteMatch => ({
  id: row["id"] as string,
  setup: row["setup"] as MatchSetup,
  commandLog: (row["command_log"] ?? []) as MatchCommand[],
  logVersion: row["log_version"] as number,
  engineEdition: row["engine_edition"] as number,
  stateHash: (row["state_hash"] ?? null) as string | null,
  homeUser: row["home_user"] as string,
  awayUser: (row["away_user"] ?? null) as string | null,
  status: row["status"] as RemoteMatch["status"],
  turnOwner: (row["turn_owner"] ?? null) as string | null,
  turnNumber: row["turn_number"] as number,
});

const db = () => {
  const client = supabase();
  if (client === null) throw new Error("online play is not configured in this build");
  return client;
};

/**
 * Rebuild a match from its row, and say whether it can be trusted.
 *
 * Three ways it cannot, checked in the order that matters:
 *
 * 1. **The rules moved under it.** A command log reproduces a match only against
 *    the rules that produced it (ADR 0022). A client on a different edition is
 *    given the match to *read* and never to continue — the alternative is a
 *    board that is quietly a different game, which is the exact silent failure
 *    the edition field exists to prevent.
 * 2. **The engine refused a command.** Locally that is a stale archive; shared,
 *    it is a desync, and the index says where.
 * 3. **The hash disagrees.** Both clients replayed the same log and got
 *    different boards, which should be impossible and is therefore worth
 *    stopping over rather than papering across.
 *
 * Reconnecting is this function and nothing else: determinism means a board is
 * a seed plus a list, so there is no session to restore.
 */
export function reconstruct(match: RemoteMatch): Reconstructed {
  const profile = FORMAT_PROFILES[match.setup.mode];
  const built = buildMatch({
    seed: match.setup.seed,
    format: match.setup.mode,
    actionsPerTurn: match.setup.actions || profile.rules.actionsPerTurn,
    replay: match.commandLog,
  });

  if (match.engineEdition !== RULES_VERSION) {
    return {
      match,
      state: built.state,
      blocked: { kind: "edition", stored: match.engineEdition, ours: RULES_VERSION },
    };
  }

  if (built.diverged !== null) {
    return { match, state: built.state, blocked: { kind: "desync", ...built.diverged } };
  }

  const actual = stateHash(built.state);
  if (match.stateHash !== null && match.stateHash !== actual) {
    return {
      match,
      state: built.state,
      blocked: { kind: "hashMismatch", expected: match.stateHash, actual },
    };
  }

  return { match, state: built.state, blocked: null };
}

/** Start a match and take the home seat. */
export async function createMatch(setup: MatchSetup, userId: string): Promise<RemoteMatch> {
  const { data, error } = await db()
    .from("matches")
    .insert({
      setup,
      seed: setup.seed,
      engine_edition: RULES_VERSION,
      home_user: userId,
      turn_owner: userId,
    })
    .select()
    .single();

  if (error !== null) throw new Error(`could not create the match: ${error.message}`);
  return rowToMatch(data as Record<string, unknown>);
}

/** Read one match. Returns null when it is not yours and not open. */
export async function fetchMatch(id: string): Promise<RemoteMatch | null> {
  const { data, error } = await db().from("matches").select().eq("id", id).maybeSingle();
  if (error !== null) throw new Error(`could not load the match: ${error.message}`);
  return data === null ? null : rowToMatch(data as Record<string, unknown>);
}

/**
 * Take the away seat.
 *
 * Guarded on `log_version` like any other write, so two people opening the same
 * invite at the same moment cannot both become the away player — the second
 * update matches no rows and is told the seat is taken.
 */
export async function joinMatch(match: RemoteMatch, userId: string): Promise<RemoteMatch> {
  const { data, error } = await db()
    .from("matches")
    .update({
      away_user: userId,
      status: "in_play",
      log_version: match.logVersion + 1,
    })
    .eq("id", match.id)
    .eq("log_version", match.logVersion)
    .is("away_user", null)
    .select()
    .maybeSingle();

  if (error !== null) throw new Error(`could not join: ${error.message}`);
  if (data === null) throw new Error("somebody else took that seat first");
  return rowToMatch(data as Record<string, unknown>);
}

/**
 * Append a turn's commands and hand the turn over.
 *
 * The whole turn goes in one write. Appending action by action would leave the
 * row in states no rules engine ever produced — half a turn, with the pool part
 * spent and the turn still ours — and every one of those would be a board the
 * opponent could load.
 *
 * The state hash of the board we believe we just produced goes with it. That is
 * Phase 1's honesty: the server cannot check our commands, so we tell it what we
 * think they did, and the other client recomputes.
 */
export async function submitTurn(
  match: RemoteMatch,
  commands: readonly MatchCommand[],
  resulting: MatchState,
  nextTurnOwner: string,
): Promise<RemoteMatch> {
  const { data, error } = await db()
    .from("matches")
    .update({
      command_log: [...match.commandLog, ...commands],
      log_version: match.logVersion + 1,
      turn_owner: nextTurnOwner,
      turn_number: resulting.turn,
      state_hash: stateHash(resulting),
      status: resulting.result === null ? "in_play" : "complete",
      winner: resulting.result?.winner ?? null,
      result: resulting.result ?? null,
    })
    .eq("id", match.id)
    .eq("log_version", match.logVersion)
    .select()
    .maybeSingle();

  if (error !== null) throw new Error(`could not send your turn: ${error.message}`);
  if (data === null) throw new Error("the match moved on while you were thinking — reloading");
  return rowToMatch(data as Record<string, unknown>);
}

/**
 * Watch a match for the other side's moves.
 *
 * Realtime is a *notification*, not a source of truth — it says the row changed
 * and the handler is given the new row, which is then reconstructed and checked
 * like any other read. A missed event is a refresh away from being corrected,
 * which is what keeps this an enhancement rather than a dependency.
 */
export function watchMatch(id: string, onChange: (match: RemoteMatch) => void): () => void {
  const channel = db()
    .channel(`match:${id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${id}` },
      (payload) => onChange(rowToMatch(payload.new as Record<string, unknown>)),
    )
    .subscribe();

  return () => {
    void db().removeChannel(channel);
  };
}
