import { DUEL_DIE_SIDES, type Duel, type MatchState } from "@gaffer/shared";

import { kitFor } from "../board/squads";
import type { RecordedEvent } from "./replay";

/** A line of commentary, and how loudly it should be said. */
export interface Remark {
  /** Position in the log it describes. */
  index: number;
  /** The headline — what a commentator would actually shout. */
  says: string;
  /** The dice behind it, when dice decided it. */
  dice: string | null;
  /** Which side it went for, when it went for one. */
  team: "home" | "away" | null;
  /** True for the moments worth colouring. */
  loud: boolean;
}

/** A player's name as it is printed on the shirt. */
function nameOf(state: MatchState, playerId: string): string {
  const player = state.players.find((candidate) => candidate.id === playerId);
  return player ? kitFor(player, state).name : playerId;
}

/**
 * The dice, written out.
 *
 * `D4 3+2 v 3+1` — the die, then each side's stat and what it rolled. Showing
 * only the total would hide the thing a player actually wants to know after a
 * surprise, which is whether they were beaten by the stat or by the die.
 */
export function diceOf(duel: Duel): string {
  const attack = `${duel.attacker.stat + duel.attacker.modifier}+${duel.attackerRoll}`;
  const defend = `${duel.defender.stat + duel.defender.modifier}+${duel.defenderRoll}`;
  return `D${DUEL_DIE_SIDES} ${attack} v ${defend}`;
}

/**
 * One line of commentary for one thing that happened.
 *
 * Written the way a commentator would: the outcome first and loudest, the
 * numbers after it for anyone who wants them. "Great save! · D4 4+1 v 3+4" says
 * what happened and then, quietly, exactly why.
 *
 * Derived from the log rather than recorded alongside it — the log is the
 * match, and anything said about it has to come out of the match rather than
 * be remembered separately and risk disagreeing with it.
 */
export function remarkFor(event: RecordedEvent, state: MatchState): Remark {
  const { command, duel, scored, index } = event;
  const dice = duel ? diceOf(duel) : null;

  if (command.type === "endTurn") {
    return { index, says: `${command.team} hand it over.`, dice: null, team: null, loud: false };
  }

  const who = nameOf(state, command.playerId);
  const won = duel === null || duel.attackerWon;

  switch (command.type) {
    case "shoot":
      if (scored) {
        return { index, says: `GOAL! ${who} buries it.`, dice, team: event.team, loud: true };
      }
      return {
        index,
        says: duel ? `Great save! ${who} denied.` : `${who} shoots — gathered.`,
        dice,
        team: null,
        loud: true,
      };

    case "pass":
      return won
        ? { index, says: `${who} finds a team-mate.`, dice, team: null, loud: false }
        : { index, says: `Intercepted! ${who}'s pass is cut out.`, dice, team: null, loud: true };

    case "launch":
      return won
        ? { index, says: `${who} launches it upfield.`, dice, team: null, loud: true }
        : { index, says: `${who}'s long ball is read and claimed.`, dice, team: null, loud: true };

    case "dribble":
      return won
        ? { index, says: `${who} beats the man.`, dice, team: null, loud: dice !== null }
        : { index, says: `Dispossessed! ${who} loses it.`, dice, team: null, loud: true };

    case "tackle":
      return won
        ? { index, says: `${who} wins it back.`, dice, team: null, loud: true }
        : { index, says: `${who} goes in and misses.`, dice, team: null, loud: false };

    case "move":
      return { index, says: `${who} moves into space.`, dice: null, team: null, loud: false };
  }
}

/**
 * The commentary so far, newest first.
 *
 * Reversed because a ticker is read from the top and the last thing that
 * happened is the thing you want, and capped because nobody scrolls a match
 * report looking for the twentieth-most-recent pass.
 */
export function commentary(log: readonly RecordedEvent[], state: MatchState, limit = 40): Remark[] {
  return log
    .slice(-limit)
    .map((event) => remarkFor(event, state))
    .reverse();
}
