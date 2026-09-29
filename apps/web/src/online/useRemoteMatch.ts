import { FORMAT_PROFILES, type MatchCommand, type MatchState, type Team } from "@gaffer/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buildMatch } from "../match/replay";
import type { MatchController, PlayOutcome } from "../match/useMatch";
import {
  fetchMatch,
  reconstruct,
  submitTurn,
  watchMatch,
  type Blocked,
  type RemoteMatch,
} from "./matches";

/** A match played against somebody else, in the shape the match screen wants. */
export interface RemoteController extends MatchController {
  /** Which side of the board is yours. */
  side: Team;
  /** Whether it is your move — the board is frozen when it is not. */
  yours: boolean;
  /** Why the match is stopped, if it is. */
  blocked: Blocked | null;
  /** The row as last read. */
  row: RemoteMatch;
  /** True while a turn is on its way to the server. */
  sending: boolean;
  /** What went wrong with the last submit, if anything. */
  error: string | null;
}

/**
 * Drive a shared match, locally, with the match's own dice.
 *
 * **The generator is the whole point of this hook.** A match is a seed and a
 * list of commands, and its dice are one generator advanced through that list
 * in order. The first version of online play built a *fresh* generator from
 * `seed + log.length` each render — which is not the match's generator and does
 * not pretend to be. The player saw one duel, the opponent replayed the log and
 * saw another, the state hashes disagreed, and the match stopped dead on the
 * opponent's phone with no way back.
 *
 * So the generator comes from `buildMatch`, which is the same replay the
 * opponent will do, advanced past exactly the commands the server has. Actions
 * taken this turn advance it further; when the turn is submitted, the board that
 * goes up is the board those dice actually produced.
 *
 * Commands accumulate until the turn ends, and the whole turn goes in one
 * write — appending action by action would leave the row in states no engine
 * ever produced, half a turn at a time, and every one of those is a board the
 * opponent could load.
 */
export function useRemoteMatch(match: RemoteMatch, userId: string): RemoteController {
  const [row, setRow] = useState(match);
  const [pending, setPending] = useState<readonly MatchCommand[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  /* The server's truth, and whatever is wrong with it. */
  const confirmed = useMemo(() => reconstruct(row), [row]);

  const profile = FORMAT_PROFILES[row.setup.mode];
  const options = useMemo(
    () => ({
      seed: row.setup.seed,
      format: row.setup.mode,
      actionsPerTurn: row.setup.actions || profile.rules.actionsPerTurn,
    }),
    [row.setup, profile],
  );

  /**
   * The board including this turn's un-sent actions.
   *
   * Replayed from the seed through every command, rather than carried forward
   * in a ref. That is not tidiness: a match's dice are **one** generator walked
   * through its commands in order, and the only way to be certain of holding
   * that generator is to walk it. It is also exactly what the opponent will do
   * when they read the row, so what this shows and what they will see cannot
   * come apart.
   */
  const live = useMemo(
    () => buildMatch({ ...options, replay: [...row.commandLog, ...pending] }),
    [options, row.commandLog, pending],
  );

  /*
   * The opponent's moves arrive here. Realtime is a notification and not a
   * source of truth, so the row it carries is reconstructed and checked like
   * any other read — and a read on subscribe, on returning to the tab and on a
   * lazy timer covers what it misses. A phone drops a socket as a matter of
   * routine, and a missed message in a turn-based game is a stuck match.
   */
  useEffect(() => {
    const accept = (next: RemoteMatch) =>
      setRow((current) => {
        if (next.logVersion < current.logVersion) return current;
        /* A newer log makes anything local stale by definition. */
        setPending([]);
        setRejection(null);
        return next;
      });

    const refresh = () => {
      void fetchMatch(match.id).then((fresh) => {
        if (fresh !== null) accept(fresh);
      });
    };

    const stop = watchMatch(match.id, accept);
    refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, 20_000);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [match.id]);

  const side: Team = row.homeUser === userId ? "home" : "away";
  const yours = row.turnOwner === userId && confirmed.blocked === null && row.status === "in_play";

  /** Put the whole turn on the server, with the board those dice produced. */
  const send = useCallback(
    async (commands: readonly MatchCommand[], resulting: MatchState) => {
      setSending(true);
      setError(null);
      try {
        const opponent = side === "home" ? row.awayUser : row.homeUser;
        const next = await submitTurn(row, commands, resulting, opponent ?? userId);
        setRow(next);
        setPending([]);
      } catch (thrown) {
        /* Loud, always. A turn that did not arrive and says nothing is the
           worst outcome available: the player believes they have moved. */
        setError(
          thrown instanceof Error
            ? `Your turn was not sent — ${thrown.message}`
            : "Your turn was not sent.",
        );
      } finally {
        setSending(false);
      }
    },
    [row, side, userId],
  );

  /**
   * Play one command.
   *
   * Local and immediate, exactly as a hotseat match is — it is the same
   * engine — except that ending the turn also sends it.
   */
  const play = useCallback(
    (command: MatchCommand): PlayOutcome | null => {
      if (!yours || sending) return null;

      const commands = [...pending, command];
      const next = buildMatch({ ...options, replay: [...row.commandLog, ...commands] });

      if (next.diverged !== null) {
        /* Never silently. A refused command means the board offered something
           the rules do not allow, and the player is owed the reason. */
        setRejection(next.diverged.reason);
        setError(`That move was refused: ${next.diverged.reason}`);
        return null;
      }

      setPending(commands);
      setRejection(null);

      if (command.type === "endTurn") void send(commands, next.state);

      const event = next.log[next.log.length - 1];
      return {
        before: live.state,
        after: next.state,
        duel: event?.duel ?? null,
        scored: event?.scored ?? false,
        scorer: event?.scored === true ? live.state.activeTeam : null,
      } as PlayOutcome;
    },
    [yours, sending, pending, options, row.commandLog, live.state, send],
  );

  const restart = useCallback(() => {
    /* There is no restarting a match somebody else is in. */
  }, []);

  return {
    state: live.state,
    log: live.log,
    lastEvent: live.log[live.log.length - 1] ?? null,
    rejection,
    play,
    restart,
    side,
    yours,
    blocked: confirmed.blocked,
    row,
    sending,
    error,
  };
}
