import type { Position } from "./pitch.js";
import type { Role } from "./roles.js";

/**
 * Where each role lines up at kickoff, given for the home side.
 *
 * The away side is this layout rotated 180°, so the shape is defined once. On
 * the 7 × 5 v1 pitch that produces, for home:
 *
 * ```text
 *          0    1    2    3    4    5    6
 *     0    .    .    W    .    .    .    .
 *     1    .    .    .    S    .    .    .
 *     2    G    D    M    .    .    .    .
 *     3    .    .    .    .    .    .    .
 *     4    .    .    .    .    .    .    .
 * ```
 *
 * Reading it: the keeper (G) on its own goal-line centre, the defender (D)
 * central ahead of it, the midfielder (M) central again, the winger (W) wide on
 * a touchline, and the striker (S) furthest forward on the halfway line.
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
  midfielder: { x: 2, y: 2 },
  winger: { x: 2, y: 0 },
  striker: { x: 3, y: 1 },
};
