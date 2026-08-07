import { attackingGoalMouth, type MatchState, type Player, type Role } from "@gaffer/shared";

/** The letter shown on a token. */
const ROLE_INITIAL: Record<Role, string> = {
  goalkeeper: "G",
  defender: "D",
  midfielder: "M",
  winger: "W",
  striker: "S",
};

/** Spoken form of a role, for the cell's accessible name. */
const ROLE_NAME: Record<Role, string> = {
  goalkeeper: "goalkeeper",
  defender: "defender",
  midfielder: "midfielder",
  winger: "winger",
  striker: "striker",
};

const cellKey = (x: number, y: number) => `${x},${y}`;

/** Join class names, dropping anything falsy. */
const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

function Token({ player, hasBall }: { player: Player; hasBall: boolean }) {
  const isHome = player.team === "home";

  return (
    <span
      aria-hidden
      className={cx(
        "relative flex h-[78%] w-[78%] items-center justify-center rounded-full",
        "text-[min(3.2vw,1.05rem)] leading-none font-bold ring-2 select-none",
        isHome
          ? "bg-white text-emerald-950 ring-emerald-950/50"
          : "bg-zinc-900 text-white ring-white/60",
      )}
    >
      {ROLE_INITIAL[player.role]}
      {hasBall && (
        <span className="absolute -right-1 -bottom-1 h-[38%] w-[38%] rounded-full bg-amber-300 ring-2 ring-amber-800" />
      )}
    </span>
  );
}

/**
 * The pitch, drawn as a real CSS grid of real DOM elements.
 *
 * GDD §5 chose DOM over canvas for exactly this: each cell is a `gridcell` with
 * an accessible name saying what stands on it, so the board is navigable by a
 * screen reader without a parallel description having to be maintained.
 *
 * Read-only. It renders whatever state it is handed and owns no rules — the
 * engine decides what is true, this only draws it.
 */
export function Pitch({ state }: { state: MatchState }) {
  const { width, height } = state.board;

  const byCell = new Map(
    state.players.map((player) => [cellKey(player.position.x, player.position.y), player]),
  );

  const mouths = new Set(
    [...attackingGoalMouth("home", state.board), ...attackingGoalMouth("away", state.board)].map(
      (cell) => cellKey(cell.x, cell.y),
    ),
  );

  return (
    <div
      role="grid"
      aria-label={`Pitch, ${width} columns by ${height} rows`}
      aria-rowcount={height}
      aria-colcount={width}
      className="grid w-full gap-px overflow-hidden rounded-xl bg-emerald-950/50 p-px shadow-2xl ring-1 ring-emerald-950/40"
      style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: height }, (_unused, y) => (
        // `contents` keeps the row semantic without breaking the single grid.
        <div role="row" aria-rowindex={y + 1} key={y} className="contents">
          {Array.from({ length: width }, (_unusedCell, x) => {
            const key = cellKey(x, y);
            const player = byCell.get(key);
            const hasBall = player !== undefined && state.ball.carrierId === player.id;
            const isMouth = mouths.has(key);

            const name = player
              ? `Column ${x}, row ${y}: ${player.team} ${ROLE_NAME[player.role]}${
                  hasBall ? ", with the ball" : ""
                }`
              : `Column ${x}, row ${y}: empty${isMouth ? ", goal mouth" : ""}`;

            return (
              <div
                key={key}
                role="gridcell"
                aria-colindex={x + 1}
                aria-label={name}
                className={cx(
                  "flex aspect-square items-center justify-center",
                  isMouth
                    ? "bg-(--color-mouth)"
                    : x % 2 === 0
                      ? "bg-(--color-turf)"
                      : "bg-(--color-turf-alt)",
                )}
              >
                {player && <Token player={player} hasBall={hasBall} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
