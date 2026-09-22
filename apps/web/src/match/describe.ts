import type { Duel, MatchCommand, MatchState } from "@gaffer/shared";

import { kitFor } from "../board/squads";
import type { RecordedEvent } from "./useMatch";

/** How a player is named in prose: "9 Pike". */
export function playerName(state: MatchState, playerId: string): string {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return playerId;

  const kit = kitFor(player, state);
  return `${kit.number} ${kit.name}`;
}

/** What a command did, in words, with nothing about how it turned out. */
export function describeCommand(command: MatchCommand, state: MatchState): string {
  if (command.type === "endTurn") return `${command.team} ended the turn`;

  const who = playerName(state, command.playerId);

  switch (command.type) {
    case "move":
      return `${who} moved to (${command.target.x}, ${command.target.y})`;
    case "dribble":
      return `${who} dribbled to (${command.target.x}, ${command.target.y})`;
    case "pass":
      return `${who} passed to ${playerName(state, command.target)}`;
    case "launch":
      return `${who} launched it upfield to ${playerName(state, command.target)}`;
    case "tackle":
      return `${who} tackled ${playerName(state, command.target)}`;
    case "shoot":
      return `${who} shot`;
  }
}

/** What the dice said, in words. */
export function describeDuel(duel: Duel): string {
  const odds = `${Math.round(duel.winChance * 100)}%`;
  return `${odds}, rolled ${duel.attackerRoll}–${duel.defenderRoll}, ${
    duel.attackerWon ? "won" : "lost"
  }`;
}

/**
 * One line of history, in plain English.
 *
 * This is what turns a flagged moment from a number into something readable by
 * somebody who was not in the room: "I could not tell what was going on" means
 * very little without the three things that had just happened.
 */
export function describeEvent(event: RecordedEvent, state: MatchState): string {
  const what = describeCommand(event.command, state);
  const dice = event.duel === null ? "" : ` — ${describeDuel(event.duel)}`;
  const goal = event.scored ? " — **GOAL**" : "";

  return `turn ${event.turn}: ${what}${dice}${goal}`;
}
