import type { Position } from "./pitch.js";
import type { Role } from "./roles.js";

/**
 * Where each role lines up at kickoff, given for the home side.
 *
 * The away side is this layout rotated 180°, so the shape is defined once. On
 * the 7 × 5 v1 pitch that produces, with home kicking off:
 *
 * ```text
 *          0    1    2    3    4    5    6
 *     0    .    .    W    .    .    .    .
 *     1    .    .    .    .    m    .    .
 *     2    G    D    .    S*   .    d    g
 *     3    .    .    M    s    .    .    .
 *     4    .    .    .    .    w    .    .
 * ```
 *
 * Reading it as a shape: the keeper (G) on its own goal-line centre and the
 * defender (D) central just ahead of it form a short spine; the winger (W) holds
 * the far touchline, the midfielder (M) sits deeper and inside on the opposite
 * side, and the striker (S) is furthest forward on the halfway line.
 *
 * Two things it is built to avoid. Nobody stands on (2,2), so the spine reads as
 * spaced rather than as a column of players stacked nose to tail. And because
 * the winger and midfielder take opposite flanks at slightly different depths,
 * every one of the five rows has a player on it once the away side is rotated in
 * — the pitch is used, not just its middle.
 *
 * The striker sits one row off centre rather than on the centre spot itself.
 * That is deliberate: the centre spot is the one cell a 180° rotation maps onto
 * itself, so putting a striker there would collide with the opposing striker.
 * Instead the side kicking off steps its striker onto the spot to take the
 * kickoff, leaving the defending striker just off it — which is also how a real
 * kickoff lines up.
 */
export const HOME_FORMATION: Readonly<Record<Role, Position>> = {
  goalkeeper: { x: 0, y: 2 },
  defender: { x: 1, y: 2 },
  midfielder: { x: 2, y: 3 },
  winger: { x: 2, y: 0 },
  striker: { x: 3, y: 1 },
};
