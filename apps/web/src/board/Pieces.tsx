import type { Board, MatchState, Player, Position } from "@gaffer/shared";

import { SQUADS } from "./squads";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** Position and size a piece so it lands exactly on one cell. */
function cellStyle(position: Position, board: Board, duration: string): React.CSSProperties {
  return {
    width: `${100 / board.width}%`,
    height: `${100 / board.height}%`,
    // A transform, not top/left: it is the property browsers can animate without
    // re-laying out the page on every frame. Each piece is one cell wide, so
    // translating by whole multiples of its own size steps it cell to cell.
    transform: `translate(${position.x * 100}%, ${position.y * 100}%)`,
    transitionProperty: "transform",
    transitionDuration: duration,
    transitionTimingFunction: "var(--travel-ease)",
  };
}

function Shirt({ player, dimmed }: { player: Player; dimmed: boolean }) {
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

/**
 * The players and the ball, floating above the grid.
 *
 * They live here rather than inside their cells for one reason: a piece drawn
 * inside a cell is unmounted and remounted somewhere else when it moves, and a
 * DOM node that ceases to exist cannot travel anywhere. Keyed by player id, each
 * piece is a single node for the whole match — even across the rebuild that
 * follows a goal, because ids are stable — so a change of position is a change
 * of transform, which the browser tweens for free.
 *
 * The layer is inert to the mouse. Every click still lands on the grid beneath,
 * which owns targeting and selection, so animation can neither swallow input nor
 * delay it.
 *
 * Purely cosmetic. It draws whatever state it is handed and reports nothing back;
 * the board's accessible description lives on the grid's cells and updates the
 * instant the engine does, without waiting for any of this.
 */
export function Pieces({ state }: { state: MatchState }) {
  const carried = state.ball.carrierId !== null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {state.players.map((player) => (
        <div
          key={player.id}
          data-player={player.id}
          data-cell={`${player.position.x},${player.position.y}`}
          style={cellStyle(player.position, state.board, "var(--piece-travel)")}
          className="absolute top-0 left-0 flex flex-col items-center justify-center"
        >
          <Shirt player={player} dimmed={state.result !== null} />
        </div>
      ))}

      {/*
       * The ball is its own piece, not a dot pinned to a shirt. That is what
       * lets it travel down a pass on its own while both players stand still.
       */}
      <div
        data-ball
        data-cell={`${state.ball.position.x},${state.ball.position.y}`}
        style={cellStyle(state.ball.position, state.board, "var(--ball-travel)")}
        className="absolute top-0 left-0 flex items-center justify-center"
      >
        <span
          className={cx(
            "block h-[26%] w-[26%] rounded-full bg-amber-300 shadow ring-2 ring-amber-800",
            // Tucked at the shoulder when carried, centred when loose, so it is
            // always obvious whether anyone actually has it.
            carried && "translate-x-[52%] -translate-y-[62%]",
          )}
          style={{
            transitionProperty: "transform",
            transitionDuration: "var(--ball-travel)",
            transitionTimingFunction: "var(--travel-ease)",
          }}
        />
      </div>
    </div>
  );
}
