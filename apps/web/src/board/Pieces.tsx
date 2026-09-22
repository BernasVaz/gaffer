import type { MatchState, Player } from "@gaffer/shared";
import { m, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { Football } from "../art/Football";
import { Footballer, type Gaze } from "../art/Footballer";
import { BALL_ARC, BALL_SPRING, IDLE, INSTANT, PIECE_SPRING, SQUASH } from "../feel";
import type { BoardLayout } from "./orientation";
import { kitFor } from "./squads";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** Where a piece sits on screen: its drawn column and row. */
type Screen = { col: number; row: number };

/** One cell, as a percentage of a piece's own size — so `x: "300%"` is column 3. */
const atCell = ({ col, row }: Screen) => ({
  x: `${col * 100}%`,
  y: `${row * 100}%`,
});

const sizeOf = (layout: BoardLayout) => ({
  width: `${100 / layout.cols}%`,
  height: `${100 / layout.rows}%`,
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
function useSquashOnMove(screen: Screen, still: boolean) {
  const controls = useAnimationControls();
  const previous = useRef(screen);

  // Depend on the coordinates rather than the object: what matters is that the
  // piece changed cell, not that React handed us a new wrapper for the same one.
  // They are the *drawn* coordinates, because a stretch has to run the way the
  // piece appears to travel — on a portrait board a run up the pitch is a run
  // up the screen, and stretching it sideways would read as a skid.
  const { col: x, row: y } = screen;

  useEffect(() => {
    const from = previous.current;
    previous.current = { col: x, row: y };

    const dx = x - from.col;
    const dy = y - from.row;
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

/**
 * Where a player should be looking.
 *
 * Straight at the ball, as a unit-ish vector from the player to it. Divided by a
 * couple of cells rather than normalised, so a player standing next to the ball
 * looks hard at it and one across the pitch merely glances — the intensity of
 * the look carries distance, which a normalised vector would throw away.
 *
 * The carrier looks up the pitch instead. Someone staring at a ball they are
 * already holding looks cross-eyed, and looking where they are going is both
 * more natural and quietly useful: ten heads turned the same way is the
 * direction of play, legible before you have read anything.
 */
function gazeFor(player: Player, state: MatchState, layout: BoardLayout): Gaze {
  /* Worked out on the pitch and then turned, because where a player is looking
     is a fact about the match — at the ball, or upfield — and only the drawing
     of it depends on which way round the board is. */
  if (state.ball.carrierId === player.id) {
    return layout.rotate({ x: player.team === "home" ? 1 : -1, y: 0 });
  }

  const ball = state.ball.position;
  return layout.rotate({
    x: (ball.x - player.position.x) / 2.5,
    y: (ball.y - player.position.y) / 2,
  });
}

function Shirt({
  player,
  state,
  layout,
  ready,
  dimmed,
}: {
  player: Player;
  state: MatchState;
  layout: BoardLayout;
  ready: boolean;
  dimmed: boolean;
}) {
  const kit = kitFor(player, state);

  /*
   * The name is taken out of the flow rather than stacked under the player.
   *
   * Stacked, the two of them came to more than a cell — and a flex column that
   * overflows does not overflow, it *shrinks*: the label was squashed from its
   * 28px line box down to 15px and then cropped by its own `truncate`. Every
   * name on the board was cut in half, most visibly on the top and bottom rows
   * where the remains sat against the pitch edge.
   *
   * Laying it over the boots costs nothing — that quarter of the drawing is a
   * shadow and two feet — and it means the label can never push the player
   * around, at any format or any width.
   */
  return (
    <span className="relative flex h-full w-full items-center justify-center">
      <span className={cx("relative block h-[92%] w-[92%]", dimmed && "opacity-65")}>
        {/* A player who can be commanded quietly says so. */}
        {ready && (
          <span className="pitch-ready absolute inset-[6%] top-[14%] rounded-full ring-[3px] ring-white/55" />
        )}
        <Footballer
          id={player.id}
          team={player.team}
          role={player.role}
          number={kit.number}
          gaze={gazeFor(player, state, layout)}
          hasBall={state.ball.carrierId === player.id}
        />
      </span>
      {/* Dropped once a cell is too small to read it — see `.piece-name`. */}
      <span className="piece-name absolute bottom-[1%] left-1/2 max-w-[118%] -translate-x-1/2 truncate rounded-full bg-black/60 px-[7%] font-semibold text-white/90">
        {kit.name}
      </span>
    </span>
  );
}

function Piece({
  player,
  state,
  layout,
  index,
  ready,
  dimmed,
  still,
}: {
  player: Player;
  state: MatchState;
  layout: BoardLayout;
  index: number;
  ready: boolean;
  dimmed: boolean;
  still: boolean;
}) {
  const screen = layout.toScreen(player.position);
  const squash = useSquashOnMove(screen, still);

  return (
    <m.div
      data-player={player.id}
      data-cell={`${player.position.x},${player.position.y}`}
      style={sizeOf(layout)}
      initial={false}
      animate={atCell(screen)}
      transition={still ? INSTANT : PIECE_SPRING}
      /*
       * Each piece is its own container, and it is exactly one cell wide. That
       * is what lets everything drawn on it size itself against a cell without
       * knowing how many cells the pitch has — a name is 19% of a cell at every
       * format and every window size, and disappears when a cell gets too small
       * to read one.
       */
      className="piece absolute top-0 left-0"
    >
      {/* Idle breath. Its own layer so it never fights the travel transform. */}
      <div
        className={cx(
          "flex h-full w-full flex-col items-center justify-center",
          !still && "pitch-breathe",
        )}
        style={{ animationDelay: `${-index * IDLE.stagger}s` }}
      >
        <m.div animate={squash} className="flex h-full w-full flex-col items-center justify-center">
          <Shirt player={player} state={state} layout={layout} ready={ready} dimmed={dimmed} />
        </m.div>
      </div>
    </m.div>
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
function Ball({
  state,
  layout,
  still,
}: {
  state: MatchState;
  layout: BoardLayout;
  still: boolean;
}) {
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
    <m.div
      data-ball
      data-cell={`${position.x},${position.y}`}
      style={sizeOf(layout)}
      initial={false}
      animate={atCell(layout.toScreen(position))}
      transition={still ? INSTANT : BALL_SPRING}
      className="absolute top-0 left-0"
    >
      <m.div animate={arc} className="flex h-full w-full items-center justify-center">
        <div
          className={cx(
            "flex h-full w-full items-center justify-center transition-transform duration-200",
            carried && "translate-x-[19%] -translate-y-[23%]",
          )}
        >
          <m.div
            animate={spin}
            className="h-[30%] w-[30%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
          >
            <Football />
          </m.div>
        </div>
      </m.div>
    </m.div>
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
  layout,
  readyIds,
}: {
  state: MatchState;
  /** Where each cell is drawn. The pieces float above the grid, so they need it too. */
  layout: BoardLayout;
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
          state={state}
          layout={layout}
          index={index}
          ready={readyIds?.has(player.id) ?? false}
          dimmed={state.result !== null}
          still={still}
        />
      ))}

      <Ball state={state} layout={layout} still={still} />
    </div>
  );
}
