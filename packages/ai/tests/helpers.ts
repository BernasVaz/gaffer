import { mirrorPosition, opponentOf, type MatchCommand, type MatchState } from "@gaffer/shared";

/**
 * The same player, described as belonging to the other side.
 *
 * Swaps the prefix rather than rebuilding the id from the role, because a role
 * no longer identifies a player — an 11-a-side side has four defenders, and
 * `playerIdFor(team, "defender")` would name the same one every time.
 */
const swapSide = (id: string) =>
  id.startsWith("home-") ? `away-${id.slice(5)}` : `home-${id.slice(5)}`;

/**
 * The same match seen from the other end of the pitch.
 *
 * Every player swaps side and rotates 180°, so the board is strategically
 * identical but described in the opposite frame. Used to prove the opponent has
 * no directional prejudice: whatever it plays on a board, it must play the
 * mirror of on the mirrored board.
 */
export function mirrorState(state: MatchState): MatchState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      id: swapSide(player.id),
      team: opponentOf(player.team),
      position: mirrorPosition(player.position, state.board),
    })),
    ball: {
      position: mirrorPosition(state.ball.position, state.board),
      carrierId: state.ball.carrierId === null ? null : swapSide(state.ball.carrierId),
    },
    possession: state.possession === null ? null : opponentOf(state.possession),
    activeTeam: opponentOf(state.activeTeam),
    score: { home: state.score.away, away: state.score.home },
    kickedOff: opponentOf(state.kickedOff),
    stats: {
      shotsAttempted: {
        home: state.stats.shotsAttempted.away,
        away: state.stats.shotsAttempted.home,
      },
      duelsWon: { home: state.stats.duelsWon.away, away: state.stats.duelsWon.home },
    },
  };
}

/** The same command, described from the other end of the pitch. */
export function mirrorCommand(command: MatchCommand, state: MatchState): MatchCommand {
  const swapId = swapSide;

  switch (command.type) {
    case "move":
    case "dribble":
      return {
        ...command,
        playerId: swapId(command.playerId),
        target: mirrorPosition(command.target, state.board),
      };
    case "pass":
    case "launch":
    case "tackle":
      return { ...command, playerId: swapId(command.playerId), target: swapId(command.target) };
    case "shoot":
      return { ...command, playerId: swapId(command.playerId) };
    case "endTurn":
      return { type: "endTurn", team: opponentOf(command.team) };
  }
}
