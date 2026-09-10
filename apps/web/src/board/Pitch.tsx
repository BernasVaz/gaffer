import {
  attackingGoalMouth,
  type Action,
  type MatchState,
  type Player,
  type Role,
  type Team,
} from "@gaffer/shared";

import { GoalBurst } from "./GoalBurst";
import { Pieces } from "./Pieces";
import { SQUADS } from "./squads";
import { cellKey, isCommandable, type Target, type Targets } from "./targets";

/** Spoken form of a role, for accessible names. */
const ROLE_NAME: Record<Role, string> = {
  goalkeeper: "goalkeeper",
  defender: "defender",
  midfielder: "midfielder",
  winger: "winger",
  striker: "striker",
};

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");
const pct = (chance: number) => `${Math.round(chance * 100)}%`;

/** How a player is described in a sentence: "number 9 Pike". */
const describe = (player: Player) => {
  const kit = SQUADS[player.team][player.role];
  return `number ${kit.number} ${kit.name}`;
};

/**
 * The odds on a contested target.
 *
 * Always the acting player's own chance of success — including on a tackle,
 * where it reads as "you win the ball", not "they keep it". Deliberately light:
 * every contested target keeps its number, so the weight is dialled down rather
 * than the count.
 */
function Badge({ chance, tone }: { chance: number; tone: "attack" | "defend" }) {
  return (
    <span
      className={cx(
        "pointer-events-none absolute -top-px -right-px rounded-sm px-[3px]",
        "text-[min(1.75vw,0.58rem)] leading-[1.4] font-semibold tabular-nums",
        tone === "attack" ? "bg-amber-200/90 text-amber-950" : "bg-rose-200/90 text-rose-950",
      )}
    >
      {pct(chance)}
    </span>
  );
}

/**
 * A cell's inner layer: a real button when there is something to do, a plain
 * span when there is not.
 *
 * Only actionable cells become buttons. Making all thirty-five focusable would
 * bury the four or five that matter under a wall of empty tab stops, and would
 * give a screen reader thirty-five controls that mostly do nothing.
 */
function ActiveOrPlain({
  actionable,
  label,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  className,
  children,
}: {
  actionable: boolean;
  label: string | undefined;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  className: string;
  children: React.ReactNode;
}) {
  if (!actionable) {
    return (
      <span aria-hidden className={className}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={className}
    >
      {children}
    </button>
  );
}

/** What clicking a given cell should do. */
type CellIntent =
  | { kind: "commit"; target: Target; label: string }
  | { kind: "select"; playerId: string; label: string }
  | { kind: "clear" };

export interface PitchProps {
  /** The board to draw. */
  state: MatchState;
  /** The player currently selected, if any. */
  selectedId: string | null;
  /** What that player can do. */
  targets: Targets;
  /** Called when the selection should change. */
  onSelect: (playerId: string | null) => void;
  /** Called when a target is chosen — commits straight through, no confirm step. */
  onCommit: (action: Action) => void;
  /** Called as targets are hovered or focused, so a breakdown can be shown. */
  onFocusTarget: (target: Target | null) => void;
  /**
   * Suspend every interaction while something is being shown.
   *
   * Presentation only: the engine has already resolved whatever is being
   * celebrated. This stops the board offering moves against a position it is no
   * longer displaying, and is why nothing needs to gate the engine itself.
   */
  frozen?: boolean;
  /** The side whose goal is being celebrated over the pitch, if any. */
  goalFor?: Team | null;
}

/**
 * The pitch: a real CSS grid of real DOM elements, and the only way to play.
 *
 * Selecting one of your players lights every legal destination at once —
 * perfect information is a locked pillar, so there is nothing to reveal by
 * degrees. Contested targets carry the odds; free ones are simply lit. Clicking
 * a lit target commits it immediately, because the odds were on screen when the
 * choice was made and a confirm step would only ask the same question twice
 * (GDD §9).
 *
 * Three kinds of target are drawn three ways, because they point at three
 * different things: a move or dribble at an empty cell, a pass or tackle at a
 * player's shirt, a shot at the goal mouth itself.
 *
 * It still holds no rules. Everything it offers came from `legalActions`, and
 * everything it commits goes back through `applyAction`.
 */
export function Pitch({
  state,
  selectedId,
  targets,
  onSelect,
  onCommit,
  onFocusTarget,
  frozen = false,
  goalFor = null,
}: PitchProps) {
  const { width, height } = state.board;

  const byCell = new Map(state.players.map((player) => [cellKey(player.position), player]));
  const selected = state.players.find((player) => player.id === selectedId);

  /*
   * Both goals are always drawn. They are part of the pitch, not a highlight —
   * an earlier version only tinted them when a shot happened to be available,
   * which left the board with no visible goal to aim at most of the time.
   */
  const goalCells = new Set(
    [...attackingGoalMouth("home", state.board), ...attackingGoalMouth("away", state.board)].map(
      cellKey,
    ),
  );

  /** The mouth being shot at right now, lit as a target on top of the goal. */
  const mouthCells = new Set(
    targets.shot && selected ? attackingGoalMouth(selected.team, state.board).map(cellKey) : [],
  );
  const mouthCentre = height >> 1;

  return (
    <div className="relative">
      <div
        role="grid"
        aria-label={`Pitch, ${width} columns by ${height} rows`}
        aria-rowcount={height}
        aria-colcount={width}
        className="grid w-full gap-px overflow-hidden rounded-xl bg-emerald-950/50 p-px shadow-2xl ring-1 ring-emerald-950/40"
        style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: height }, (_unused, y) => (
          <div role="row" aria-rowindex={y + 1} key={y} className="contents">
            {Array.from({ length: width }, (_unusedCell, x) => {
              const key = cellKey({ x, y });
              const player = byCell.get(key);
              const hasBall = player !== undefined && state.ball.carrierId === player.id;

              const cellTarget = targets.cells.get(key);
              const playerTarget = player ? targets.players.get(player.id) : undefined;
              const isMouth = mouthCells.has(key);
              const isSelected = player !== undefined && player.id === selectedId;
              const selectable = player !== undefined && isCommandable(state, player.id);

              /*
               * A lit target always wins over selecting whoever is standing there.
               * Clicking a ringed team-mate passes to them rather than switching
               * to them — to command that player instead, clear the selection
               * first by clicking them again or clicking open grass.
               */
              const intent: CellIntent = frozen
                ? { kind: "clear" }
                : cellTarget
                  ? {
                      kind: "commit",
                      target: cellTarget,
                      label: `${cellTarget.action.type === "dribble" ? "Dribble" : "Move"} to column ${x}, row ${y}${
                        cellTarget.duel ? `, ${pct(cellTarget.duel.winChance)} chance` : ""
                      }`,
                    }
                  : playerTarget && player
                    ? {
                        kind: "commit",
                        target: playerTarget,
                        label: `${playerTarget.action.type === "tackle" ? "Tackle" : "Pass to"} ${describe(player)}${
                          playerTarget.duel ? `, ${pct(playerTarget.duel.winChance)} chance` : ""
                        }`,
                      }
                    : isMouth && targets.shot
                      ? {
                          kind: "commit",
                          target: targets.shot,
                          label: `Shoot${targets.shot.duel ? `, ${pct(targets.shot.duel.winChance)} chance` : ""}`,
                        }
                      : selectable && player
                        ? {
                            kind: "select",
                            playerId: player.id,
                            label: isSelected
                              ? `Deselect ${describe(player)}`
                              : `Select ${player.team} ${ROLE_NAME[player.role]}, ${describe(player)}`,
                          }
                        : { kind: "clear" };

              const actionable = intent.kind !== "clear";

              const cellName = player
                ? `Column ${x}, row ${y}: ${player.team} ${ROLE_NAME[player.role]}, ${describe(player)}${
                    hasBall ? ", with the ball" : ""
                  }`
                : `Column ${x}, row ${y}: empty`;

              const handleActivate = () => {
                if (intent.kind === "commit") onCommit(intent.target.action);
                else if (intent.kind === "select")
                  onSelect(intent.playerId === selectedId ? null : intent.playerId);
                else onSelect(null);
              };

              const focusTarget = intent.kind === "commit" ? intent.target : null;

              return (
                <div
                  key={key}
                  role="gridcell"
                  aria-colindex={x + 1}
                  aria-label={cellName}
                  aria-selected={isSelected || undefined}
                  className={cx(
                    "relative aspect-square",
                    isMouth
                      ? "bg-sky-500/30"
                      : goalCells.has(key)
                        ? "bg-(--color-mouth)"
                        : x % 2 === 0
                          ? "bg-(--color-turf)"
                          : "bg-(--color-turf-alt)",
                  )}
                >
                  <ActiveOrPlain
                    actionable={actionable}
                    label={actionable ? intent.label : undefined}
                    onClick={handleActivate}
                    onMouseEnter={() => onFocusTarget(focusTarget)}
                    onMouseLeave={() => onFocusTarget(null)}
                    onFocus={() => onFocusTarget(focusTarget)}
                    onBlur={() => onFocusTarget(null)}
                    className={cx(
                      "absolute inset-0 flex items-center justify-center",
                      "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset focus-visible:outline-none",
                      actionable && "cursor-pointer",
                    )}
                  >
                    {/* An empty destination. */}
                    {cellTarget && (
                      <span
                        aria-hidden
                        className={cx(
                          "absolute inset-[16%] rounded-full border-2",
                          cellTarget.duel
                            ? "border-amber-300/80 bg-amber-300/15"
                            : "border-white/60 bg-white/10",
                        )}
                      />
                    )}

                    {/* The goal mouth, lit as one target across its three cells. */}
                    {isMouth && (
                      <span
                        aria-hidden
                        className="absolute inset-0 ring-2 ring-sky-300 ring-inset"
                      />
                    )}

                    {/* Who is selected. */}
                    {isSelected && (
                      <span
                        aria-hidden
                        className="absolute inset-[5%] rounded-lg ring-2 ring-emerald-200 ring-offset-1 ring-offset-emerald-900"
                      />
                    )}

                    {/* A player you can act on: the ring goes round the shirt. */}
                    {playerTarget && (
                      <span
                        aria-hidden
                        className={cx(
                          "absolute inset-[8%] rounded-full ring-[3px]",
                          playerTarget.action.type === "tackle" ? "ring-rose-300" : "ring-sky-200",
                        )}
                      />
                    )}

                    {cellTarget?.duel && <Badge chance={cellTarget.duel.winChance} tone="attack" />}
                    {playerTarget?.duel && (
                      <Badge
                        chance={playerTarget.duel.winChance}
                        tone={playerTarget.action.type === "tackle" ? "defend" : "attack"}
                      />
                    )}
                    {isMouth && y === mouthCentre && targets.shot?.duel && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute rounded-sm bg-sky-200/95 px-[3px] text-[min(2vw,0.65rem)] leading-tight font-bold text-sky-950 tabular-nums"
                      >
                        {pct(targets.shot.duel.winChance)}
                      </span>
                    )}
                  </ActiveOrPlain>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <Pieces state={state} />

      {goalFor && <GoalBurst team={goalFor} />}
    </div>
  );
}
