import { attackingGoalMouth, type MatchState, type Player, type Role } from "@gaffer/shared";

import { SQUADS } from "./squads";

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

/**
 * A player, drawn as a shirt with a number and a name on it.
 *
 * Kept to the minimum that reads as football: a jersey silhouette, the squad
 * number, the surname beneath. Home play in white, away in black, and the ball
 * is an amber disc at the shirt's shoulder.
 *
 * Presentation only. It is handed a `Player` and draws it — the number and name
 * are flavour the engine has never heard of.
 */
function Jersey({ player, hasBall }: { player: Player; hasBall: boolean }) {
  const kit = SQUADS[player.team][player.role];
  const isHome = player.team === "home";

  const shirt = isHome ? "bg-white text-emerald-950" : "bg-zinc-900 text-white";

  return (
    <span aria-hidden className="flex h-full w-full flex-col items-center justify-center">
      <span
        className={cx(
          "relative flex w-[54%] items-center justify-center rounded-[26%]",
          "py-[16%] text-[min(3.1vw,1rem)] leading-none font-bold tabular-nums",
          "ring-1",
          shirt,
          isHome ? "ring-emerald-950/25" : "ring-white/25",
        )}
      >
        {/* Sleeves — two stubs at the shoulders make the block read as a shirt. */}
        <span
          className={cx("absolute top-[6%] -left-[30%] h-[42%] w-[30%] rounded-l-[45%]", shirt)}
        />
        <span
          className={cx("absolute top-[6%] -right-[30%] h-[42%] w-[30%] rounded-r-[45%]", shirt)}
        />
        {/* Collar. */}
        <span
          className={cx(
            "absolute top-0 h-[16%] w-[38%] rounded-b-full",
            isHome ? "bg-emerald-950/20" : "bg-white/25",
          )}
        />

        <span className="relative">{kit.number}</span>

        {hasBall && (
          <span className="absolute -top-[16%] -right-[34%] h-[46%] w-[46%] rounded-full bg-amber-300 ring-2 ring-amber-800" />
        )}
      </span>

      <span className="mt-[6%] max-w-full truncate px-[4%] text-[min(1.6vw,0.55rem)] leading-none font-medium text-white/85">
        {kit.name}
      </span>
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
              ? `Column ${x}, row ${y}: ${player.team} ${ROLE_NAME[player.role]}, number ${
                  SQUADS[player.team][player.role].number
                } ${SQUADS[player.team][player.role].name}${hasBall ? ", with the ball" : ""}`
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
                {player && <Jersey player={player} hasBall={hasBall} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
