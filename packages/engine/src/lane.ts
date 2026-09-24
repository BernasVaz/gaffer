import { chebyshevDistance, type Position } from "@gaffer/shared";

/**
 * The cells a ball's flight crosses on its way between two players.
 *
 * Endpoints are excluded: a lane is what the ball travels *through*, not where
 * it starts or ends. Neighbouring players therefore have an empty lane between
 * them, which is why a pass to somebody beside you can never be blocked or
 * intercepted.
 *
 * **The geometry, stated once.** Draw the straight line from the middle of one
 * cell to the middle of the other. A cell is on the lane when the ball's flight
 * crosses its square — formally, when the cell's centre lies less than half a
 * cell from that line, and the cell sits between the two ends. Clipping a corner
 * does not count, which is what keeps a pure diagonal a two-cell lane rather
 * than a four-cell one.
 *
 * Worked through, because "half a cell" is easier to picture than to trust:
 *
 * - **(0,0) → (3,0)**, straight: the lane is (1,0) and (2,0). The cells above
 *   and below are a full cell away and do not block.
 * - **(0,0) → (2,2)**, diagonal: the lane is (1,1) alone. (1,0) and (0,1) are
 *   0.71 of a cell from the line — the flight clips their corners and no more.
 * - **(0,0) → (2,1)**, the shape that was impossible before: the lane is *both*
 *   (1,0) and (1,1), because the flight genuinely crosses both squares on its
 *   way. Either body blocks it, which is what stops the new angles from being
 *   free.
 *
 * Every ray lane is unchanged by this, so no pass that was legal before is
 * refused now.
 *
 * **Exact integer arithmetic, no floating point.** Determinism is the engine's
 * whole contract, and a lane decided by a rounding error would be a lane that
 * differs between two machines replaying the same seed. The half-cell test
 * `4·cross² < |AB|²` and the betweenness test `0 < (C−A)·(B−A) < |AB|²` are both
 * comparisons of integers.
 *
 * Symmetric by construction: a lane from A to B holds exactly the cells of the
 * lane from B to A, so a pass cannot be legal in one direction and blocked in
 * the other.
 *
 * @param from - Where the ball starts.
 * @param to - Where it is going.
 * @returns The cells crossed, strictly between the two. Empty for neighbours.
 */
export function laneBetween(from: Position, to: Position): Position[] {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  if (deltaX === 0 && deltaY === 0) return [];

  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const lane: Position[] = [];

  /* Only the box the flight is inside can hold a cell it crosses. Walked in a
     fixed order so the lane is the same list every time it is asked for. */
  const lowX = Math.min(from.x, to.x);
  const highX = Math.max(from.x, to.x);
  const lowY = Math.min(from.y, to.y);
  const highY = Math.max(from.y, to.y);

  for (let x = lowX; x <= highX; x += 1) {
    for (let y = lowY; y <= highY; y += 1) {
      const alongX = x - from.x;
      const alongY = y - from.y;

      // Strictly between the two ends, so neither endpoint is its own blocker.
      const along = alongX * deltaX + alongY * deltaY;
      if (along <= 0 || along >= lengthSquared) continue;

      // Within half a cell of the line: 2·|cross| < |AB|, squared to stay whole.
      const cross = alongX * deltaY - alongY * deltaX;
      if (4 * cross * cross >= lengthSquared) continue;

      lane.push({ x, y });
    }
  }

  return lane;
}

/**
 * How far a ball has to travel between two cells, in the game's own units.
 *
 * The same measure a player's legs use, so "within your passing range" means
 * the distance a player of that range could walk — a step counts the same
 * whether it is straight or diagonal (GDD §5).
 *
 * Kept here beside {@link laneBetween} because range and lane are the two halves
 * of one question — *can this ball be played* — and splitting them across
 * modules is how they drift apart.
 */
export function ballDistance(from: Position, to: Position): number {
  return chebyshevDistance(from, to);
}
