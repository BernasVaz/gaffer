/**
 * `@gaffer/engine` — the pure, deterministic rules of Gaffer.
 *
 * This package is the heart of the game and the referee for online play. It is
 * framework-free by construction: no DOM, no React, no Node built-ins, no network,
 * no filesystem, no clock, and no unseeded randomness. Given the same state and the
 * same action it always produces the same next state.
 *
 * That constraint is enforced by ESLint, not just convention — see `eslint.config.js`.
 * It is what makes the engine fully testable without a browser, lets a match replay
 * exactly from a seed and command log, and allows the server to re-verify every move a
 * client claims to have made.
 *
 * **{@link applyAction} is the only way in.** It checks a command against the rules
 * before playing it out, so a client, a server and a replay all travel the same path
 * and meet the same referee. The assumes-legal transition underneath is deliberately
 * not exported: a second, unchecked door would eventually be used by mistake, and the
 * saving is not worth the class of bug it invites.
 *
 * Read the board with {@link legalActions} and {@link previewDuel}; advance it with
 * {@link applyAction}.
 *
 * Currently covers the seeded RNG, the initial state, legal-action generation, duel
 * resolution and the turn economy. The win condition follows (GDD §15).
 *
 * @packageDocumentation
 */

export { createRng, type Rng } from "./rng.js";
export { createInitialState, type CreateInitialStateOptions } from "./state.js";
export { legalActions } from "./legal-actions.js";
export { previewDuel } from "./duel.js";
export { dribbleFinish } from "./resolve.js";
export { ballDistance, laneBetween } from "./lane.js";
export {
  applyAction,
  type CommandAccepted,
  type CommandRejected,
  type CommandResult,
} from "./turn.js";
