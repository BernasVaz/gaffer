import type { Board, MatchState, Player, Position } from "@gaffer/shared";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { BALL_ARC, BALL_SPRING, IDLE, INSTANT, PIECE_SPRING, SQUASH } from "../feel";
import { SQUADS } from "./squads";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** One cell, as a percentage of a piece's own size — so `x: "300%"` is column 3. */
const atCell = (position: Position) => ({
  x: `${position.x * 100}%`,
  y: `${position.y * 100}%`,
});

const sizeOf = (board: Board) => ({
  width: `${100 / board.width}%`,
  height: `${100 / board.height}%`,
});

/**
 * Squash and stretch, fired whenever a piece changes cell.
 *
 * A shirt stretches along its direction of travel as it leaves, compresses as it
 * lands, then settles. It is the difference between a token that is *moved* and
 * one that *moves* — nearly all of the sense of weight comes from the landing.
 *
 * Driven by animation controls rather than by state, so a move triggers an
 * animation without triggering a render.
 */
function useSquashOnMove(position: Position, still: boolean) {
  const controls = useAnimationControls();
  const previous = useRef(position);

  // Depend on the coordinates rather than the object: what matters is that the
  // piece changed cell, not that React handed us a new wrapper for the same one.
  const { x, y } = position;

  useEffect(() => {
    const from = previous.current;
    previous.current = { x, y };

    const dx = x - from.x;
    const dy = y - from.y;
    if (still || (dx === 0 && dy === 0)) return;

    // Stretch along the way it is going, thin across it, then invert on landing.
    const along = [1, SQUASH.stretch, SQUASH.squash, 1];
    const across = [1, SQUASH.thin, SQUASH.bulge, 1];
    const transition = {
      duration: SQUASH.duration,
      times: [0, 0.28, 0.6, 1],
      ease: "easeOut" as const,
    };

    void controls.start(
      Math.abs(dx) >= Math.abs(dy)
        ? { scaleX: along, scaleY: across, transition }
        : { scaleY: along, scaleX: across, transition },
    );
  }, [x, y, controls, still]);

  return controls;
}

function Shirt({ player, ready, dimmed }: { player: Player; ready: boolean; dimmed: boolean }) {
  const kit = SQUADS[player.team][player.role];
  const isHome = player.team === "home";
  const shirt = isHome ? "bg-white text-emerald-950" : "bg-zinc-900 text-white";

  return (
    <>
      <span
        className={cx(
          "relative flex w-[54%] items-center justify-center rounded-[26%] py-[16%]",
          "text-[min(3.1vw,1rem)] leading-none font-bold tabular-nums ring-1",
          shirt,
          isHome ? "ring-emerald-950/25" : "ring-white/25",
          dimmed && "opacity-70",
        )}
      >
        {/* A player who can be commanded quietly says so. */}
        {ready && (
          <span className="pitch-ready absolute -inset-[14%] rounded-[30%] ring-2 ring-white/45" />
        )}
        <span
          className={cx("absolute top-[6%] -left-[30%] h-[42%] w-[30%] rounded-l-[45%]", shirt)}
        />
        <span
          className={cx("absolute top-[6%] -right-[30%] h-[42%] w-[30%] rounded-r-[45%]", shirt)}
        />
        <span
          className={cx(
            "absolute top-0 h-[16%] w-[38%] rounded-b-full",
            isHome ? "bg-emerald-950/20" : "bg-white/25",
          )}
        />
        <span className="relative">{kit.number}</span>
      </span>
      <span className="mt-[6%] max-w-full truncate px-[4%] text-[min(1.6vw,0.55rem)] leading-none font-medium text-white/85">
        {kit.name}
      </span>
    </>
  );
}

function Piece({
  player,
  board,
  index,
  ready,
  dimmed,
  still,
}: {
  player: Player;
  board: Board;
  index: number;
  ready: boolean;
  dimmed: boolean;
  still: boolean;
}) {
  const squash = useSquashOnMove(player.position, still);

  return (
    <motion.div
      data-player={player.id}
      data-cell={`${player.position.x},${player.position.y}`}
      style={sizeOf(board)}
      initial={false}
      animate={atCell(player.position)}
      transition={still ? INSTANT : PIECE_SPRING}
      className="absolute top-0 left-0"
    >
      {/* Idle breath. Its own layer so it never fights the travel transform. */}
      <div
        className={cx(
          "flex h-full w-full flex-col items-center justify-center",
          !still && "pitch-breathe",
        )}
        style={{ animationDelay: `${-index * IDLE.stagger}s` }}
      >
        <motion.div
          animate={squash}
          className="flex h-full w-full flex-col items-center justify-center"
        >
          <Shirt player={player} ready={ready} dimmed={dimmed} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * The ball: it rolls, it hops, it settles.
 *
 * Four layers, each doing exactly one thing, because transforms on one element
 * would fight each other: travel, the arc it rises through, the offset that tucks
 * it at a carrier's shoulder, and the roll. Only the arc and the roll know
 * anything about *how far* it went — a pass across the pitch spins further than
 * a step.
 */
function Ball({ state, still }: { state: MatchState; still: boolean }) {
  const position = state.ball.position;
  const carried = state.ball.carrierId !== null;

  const arc = useAnimationControls();
  const spin = useAnimationControls();
  const previous = useRef(position);
  const rotation = useRef(0);

  const { x, y } = position;

  useEffect(() => {
    const from = previous.current;
    previous.current = { x, y };

    const distance = Math.max(Math.abs(x - from.x), Math.abs(y - from.y));
    if (still || distance === 0) return;

    // A longer pass rises higher and rolls further, so distance is legible in
    // the motion itself rather than only in where it ends up.
    const lift = Math.min(1, distance / 3) * BALL_ARC.lift * 100;
    void arc.start({
      y: [0, -lift, 0],
      transition: { duration: BALL_ARC.duration, times: [0, 0.45, 1], ease: "easeOut" },
    });

    rotation.current += distance * BALL_ARC.spinPerCell;
    void spin.start({
      rotate: rotation.current,
      transition: { duration: BALL_ARC.duration * 1.25, ease: [0.22, 0.61, 0.36, 1] },
    });
  }, [x, y, arc, spin, still]);

  return (
    <motion.div
      data-ball
      data-cell={`${position.x},${position.y}`}
      style={sizeOf(state.board)}
      initial={false}
      animate={atCell(position)}
      transition={still ? INSTANT : BALL_SPRING}
      className="absolute top-0 left-0"
    >
      <motion.div animate={arc} className="flex h-full w-full items-center justify-center">
        <div
          className={cx(
            "flex h-full w-full items-center justify-center transition-transform duration-200",
            carried && "translate-x-[19%] -translate-y-[23%]",
          )}
        >
          <motion.div animate={spin} className="h-[26%] w-[26%]">
            <span className="relative block h-full w-full rounded-full bg-amber-300 shadow-lg ring-2 ring-amber-800">
              {/* One off-centre mark, so the roll is actually visible. */}
              <span className="absolute top-[18%] left-[20%] h-[26%] w-[26%] rounded-full bg-amber-800/70" />
            </span>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * The players and the ball, floating above the grid.
 *
 * They live here rather than inside their cells because a piece drawn inside a
 * cell is unmounted and remounted somewhere else when it moves, and a node that
 * ceases to exist cannot travel. Keyed by player id, each piece is a single node
 * for the whole match — even across the rebuild that follows a goal — so a change
 * of position is a change of transform.
 *
 * The layer is inert to the mouse: every click lands on the grid beneath, which
 * owns targeting and selection, so no amount of motion can swallow input.
 *
 * Purely cosmetic. It draws whatever state it is handed and reports nothing back;
 * the board's accessible description lives on the grid's cells and updates the
 * instant the engine does.
 */
export function Pieces({
  state,
  readyIds,
}: {
  state: MatchState;
  /** Players that can be commanded right now, drawn as ready. */
  readyIds?: ReadonlySet<string>;
}) {
  const still = useReducedMotion() ?? false;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {state.players.map((player, index) => (
        <Piece
          key={player.id}
          player={player}
          board={state.board}
          index={index}
          ready={readyIds?.has(player.id) ?? false}
          dimmed={state.result !== null}
          still={still}
        />
      ))}

      <Ball state={state} still={still} />
    </div>
  );
}
