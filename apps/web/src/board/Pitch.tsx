import {
  attackingGoalMouth,
  type Action,
  type MatchState,
  type Player,
  type Role,
  type Team,
} from "@gaffer/shared";

import { m, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

import { GoalNet, PitchMarkings } from "../art/PitchMarkings";
import { layoutFor, type Orientation } from "./orientation";
import { GOAL, POP_SPRING, TURN_FLOURISH } from "../feel";
import { GoalBurst } from "./GoalBurst";
import { Pieces } from "./Pieces";
import { kitFor } from "./squads";
import { cellKey, isCommandable, type Seat, type Target, type Targets } from "./targets";
import { useBoardDrag } from "./useBoardDrag";

/** Spoken form of a role, for accessible names. */
const ROLE_NAME: Record<Role, string> = {
  goalkeeper: "goalkeeper",
  defender: "defender",
  midfielder: "midfielder",
  winger: "winger",
  striker: "striker",
};

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/**
 * How a target standing on a player is announced.
 *
 * A launch is named rather than folded into "Pass to", because it is a
 * different thing with different odds — and the ring around the shirt is gold
 * rather than blue for the same reason.
 */
const PLAYER_TARGET_VERB: Partial<Record<Action["type"], string>> = {
  pass: "Pass to",
  launch: "Launch to",
  tackle: "Tackle",
};
const pct = (chance: number) => `${Math.round(chance * 100)}%`;

/** How a player is described in a sentence: "number 9 Pike". */
const describe = (player: Player, state: MatchState) => {
  const kit = kitFor(player, state);
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
        "odds-badge pointer-events-none absolute -top-px -right-px rounded-sm px-[3px]",
        "leading-[1.4] font-semibold tabular-nums",
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
    <m.button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={className}
      // The whole point of a click is that it feels like one. A target leans in
      // as you approach and gives under the press before the board answers.
      whileHover={{ scale: 1.09 }}
      whileTap={{ scale: 0.9 }}
      transition={POP_SPRING}
    >
      {children}
    </m.button>
  );
}

/**
 * A band sweeping the pitch as the turn changes hands.
 *
 * It travels the way the new side attacks, so the flourish carries information
 * rather than only energy: you can tell whose turn it is from the direction alone
 * before you have read anything.
 */
function TurnFlourish({
  team,
  still,
  orientation,
}: {
  team: Team;
  still: boolean;
  orientation: Orientation;
}) {
  const controls = useAnimationControls();
  const previous = useRef(team);
  const portrait = orientation === "portrait";

  useEffect(() => {
    const from = previous.current;
    previous.current = team;
    if (still || from === team) return;

    /* Home attacks up the numbers, which is rightwards on a wide board and
       upwards on a tall one. The band has to follow the drawing, or the one
       piece of information it carries becomes a lie in portrait. */
    const forward = team === "home";
    const sweep = forward ? ["-60%", "160%"] : ["160%", "-60%"];

    void controls.start({
      ...(portrait ? { y: [...sweep].reverse() } : { x: sweep }),
      opacity: [0, 0.55, 0],
      transition: { duration: TURN_FLOURISH.duration, ease: "easeInOut" },
    });
  }, [team, controls, still, portrait]);

  return (
    <m.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={controls}
      className={cx(
        "pointer-events-none absolute z-20 rounded-xl",
        portrait ? "inset-x-0 h-1/3 skew-y-12" : "inset-y-0 w-1/3 skew-x-12",
        portrait
          ? team === "home"
            ? "bg-gradient-to-b from-transparent via-white/35 to-transparent"
            : "bg-gradient-to-b from-transparent via-zinc-200/25 to-transparent"
          : team === "home"
            ? "bg-gradient-to-r from-transparent via-white/35 to-transparent"
            : "bg-gradient-to-r from-transparent via-zinc-200/25 to-transparent",
      )}
    />
  );
}

/** What clicking a given cell should do. */
type CellIntent =
  | { kind: "commit"; target: Target; label: string }
  | { kind: "select"; playerId: string; label: string }
  /* Somebody you cannot command and cannot act on — an opponent, or one of
     yours on a turn that is not yours. Tapping still tells you what they are,
     which is the only way to read an opposing shirt's numbers. */
  | { kind: "inspect"; playerId: string; label: string }
  | { kind: "clear" };

export interface PitchProps {
  /** The board to draw. */
  state: MatchState;
  /** Which side or sides the person at the keyboard commands. */
  seat: Seat;
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
  /** Called when a player is tapped, so a panel can show what they are. */
  onInspect?: (player: Player) => void;
  /** False to hide every win-chance badge. Presentation only. */
  showOdds?: boolean;
  /**
   * Which way round to draw the board.
   *
   * Presentation and nothing else: the state handed in is numbered the way the
   * engine numbers it whichever value this takes, and the same match replays to
   * the same board either way round.
   */
  orientation?: Orientation;
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
  seat,
  selectedId,
  targets,
  onSelect,
  onCommit,
  onFocusTarget,
  frozen = false,
  goalFor = null,
  orientation = "landscape",
  onInspect,
  showOdds = true,
}: PitchProps) {
  const { width, height } = state.board;

  /*
   * Where each cell is drawn. Everything below iterates the *grid* and asks
   * this which cell it is looking at, rather than iterating cells and working
   * out where they go — so the DOM comes out in reading order at either
   * orientation, which is what a screen reader and a keyboard both need.
   */
  const layout = useMemo(() => layoutFor(state.board, orientation), [state.board, orientation]);

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

  const still = useReducedMotion() ?? false;
  const shake = useAnimationControls();

  /*
   * A second way in, ending at the same `onCommit`. Drag was always the
   * intended companion to click — Tactikick's validated feel is "pick a player,
   * drag, choose the action" (GDD §4) — and it only takes over once the pointer
   * has actually travelled, so the click path below is untouched.
   */
  const drag = useBoardDrag({
    state,
    layout,
    seat,
    selectedId,
    onSelect,
    onCommit,
    enabled: !frozen,
  });

  /*
   * A jolt when the ball goes in. Applied to the pitch rather than the page —
   * shaking the whole document reads as a fault, shaking the thing that was hit
   * reads as impact. Presentation only: it starts from a goal the engine has
   * already resolved and reports nothing back.
   */
  useEffect(() => {
    if (goalFor === null || still) return;
    const a = GOAL.shakeAmount;
    void shake.start({
      x: [0, -a, a * 0.8, -a * 0.5, a * 0.28, 0],
      y: [0, a * 0.5, -a * 0.36, a * 0.2, 0, 0],
      transition: { duration: GOAL.shake, ease: "easeOut" },
    });
  }, [goalFor, shake, still]);

  /** Which players are yours to command, so the board can show them as ready. */
  const readyIds = new Set(
    frozen ? [] : state.players.filter((p) => isCommandable(state, p.id, seat)).map((p) => p.id),
  );

  return (
    <m.div
      /*
       * A container, so everything drawn on the board can be sized in terms of a
       * cell rather than in terms of the viewport. A shirt number that is 3% of
       * the screen is fine on a 7-wide pitch and unreadable on a 13-wide one;
       * one that is a third of a cell is right on both, at any window size.
       */
      className="pitch-board relative rounded-2xl bg-gradient-to-b from-(--color-edge) to-(--color-night) p-[3px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)]"
      style={{ ["--cols" as string]: layout.cols, ["--rows" as string]: layout.rows }}
      animate={shake}
    >
      {/* Full height, or the grid's `h-full` resolves against nothing and the
          board draws as an empty rectangle. */}
      <div className="relative h-full">
        <div
          role="grid"
          aria-label={`Pitch, ${width} columns by ${height} rows`}
          aria-rowcount={layout.rows}
          aria-colcount={layout.cols}
          className="relative grid h-full w-full touch-pan-y overflow-hidden rounded-xl select-none"
          /* Rows as well as columns, so the grid fills the board it is given
             rather than deriving its height from square cells. The board's own
             aspect ratio is what keeps those cells square. */
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
          }}
          {...drag.handlers}
        >
          {Array.from({ length: layout.rows }, (_unused, row) => (
            <div role="row" aria-rowindex={row + 1} key={row} className="contents">
              {Array.from({ length: layout.cols }, (_unusedCell, col) => {
                const { x, y } = layout.toBoard(col, row);
                const key = cellKey({ x, y });
                const player = byCell.get(key);
                const hasBall = player !== undefined && state.ball.carrierId === player.id;

                const cellTarget = targets.cells.get(key);
                const playerTarget = player ? targets.players.get(player.id) : undefined;
                const isMouth = mouthCells.has(key);
                const isSelected = player !== undefined && player.id === selectedId;
                const selectable = player !== undefined && isCommandable(state, player.id, seat);

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
                          label: `${PLAYER_TARGET_VERB[playerTarget.action.type] ?? "Pass to"} ${describe(player, state)}${
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
                                ? `Deselect ${describe(player, state)}`
                                : `Select ${player.team} ${ROLE_NAME[player.role]}, ${describe(player, state)}`,
                            }
                          : player
                            ? {
                                kind: "inspect",
                                playerId: player.id,
                                label: `Inspect ${player.team} ${ROLE_NAME[player.role]}, ${describe(player, state)}`,
                              }
                            : { kind: "clear" };

                const actionable = intent.kind !== "clear";

                const cellName = player
                  ? `Column ${x}, row ${y}: ${player.team} ${ROLE_NAME[player.role]}, ${describe(player, state)}${
                      hasBall ? ", with the ball" : ""
                    }`
                  : `Column ${x}, row ${y}: empty`;

                const handleActivate = () => {
                  /* A drag that has just committed still produces a click, and
                     that click would be read as selecting whoever it landed on. */
                  if (drag.swallowNextClick()) return;

                  /* Tapping anybody reports them, whatever else the tap does.
                     Choosing one of yours is also the commonest way of asking
                     "what is this player", so the two go together. */
                  if (player && intent.kind !== "commit") onInspect?.(player);

                  if (intent.kind === "commit") onCommit(intent.target.action);
                  else if (intent.kind === "select")
                    onSelect(intent.playerId === selectedId ? null : intent.playerId);
                  else if (intent.kind === "clear") onSelect(null);
                };

                const focusTarget = intent.kind === "commit" ? intent.target : null;

                return (
                  <div
                    key={key}
                    role="gridcell"
                    aria-colindex={col + 1}
                    aria-label={cellName}
                    aria-selected={isSelected || undefined}
                    /* Only the cells a drag can start from refuse to scroll the
                       page, so a phone can still scroll from open grass. */
                    style={selectable ? { touchAction: "none" } : undefined}
                    className={cx(
                      "relative",
                      drag.dragging &&
                        drag.over === key &&
                        (drag.overIsTarget
                          ? "ring-2 ring-(--color-gold) ring-inset"
                          : "ring-2 ring-white/25 ring-inset"),
                      goalCells.has(key)
                        ? "bg-(--color-mouth)"
                        : x % 2 === 0
                          ? "bg-(--color-turf)"
                          : "bg-(--color-turf-alt)",
                    )}
                  >
                    {/* Netting, drawn per cell because a mouth is three cells. */}
                    {goalCells.has(key) && (
                      <GoalNet
                        side={
                          orientation === "portrait"
                            ? x === 0
                              ? "bottom"
                              : "top"
                            : x === 0
                              ? "left"
                              : "right"
                        }
                      />
                    )}
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
                        <m.span
                          aria-hidden
                          initial={{ scale: 0.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={POP_SPRING}
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
                        <>
                          <span
                            aria-hidden
                            className="mouth-glow absolute inset-0 bg-(--color-gold)/35"
                          />
                          <span
                            aria-hidden
                            className="absolute inset-0 ring-2 ring-(--color-gold) ring-inset"
                          />
                        </>
                      )}

                      {/* Who is selected. */}
                      {isSelected && (
                        <m.span
                          aria-hidden
                          initial={{ scale: 0.55, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={POP_SPRING}
                          className="absolute inset-[5%] rounded-lg ring-2 ring-emerald-200 ring-offset-1 ring-offset-emerald-900"
                        />
                      )}

                      {/* A player you can act on: the ring goes round the shirt. */}
                      {playerTarget && (
                        <m.span
                          aria-hidden
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={POP_SPRING}
                          className={cx(
                            "absolute inset-[8%] rounded-full ring-[3px]",
                            playerTarget.action.type === "tackle"
                              ? "ring-rose-300"
                              : playerTarget.action.type === "launch"
                                ? "ring-(--color-gold)"
                                : "ring-sky-200",
                          )}
                        />
                      )}

                      {showOdds && cellTarget?.duel && (
                        <Badge chance={cellTarget.duel.winChance} tone="attack" />
                      )}
                      {showOdds && playerTarget?.duel && (
                        <Badge
                          chance={playerTarget.duel.winChance}
                          tone={playerTarget.action.type === "tackle" ? "defend" : "attack"}
                        />
                      )}
                      {showOdds && isMouth && y === mouthCentre && targets.shot?.duel && (
                        <span
                          aria-hidden
                          className="odds-badge pointer-events-none absolute rounded-md bg-(--color-gold) px-[4px] leading-tight font-extrabold text-amber-950 tabular-nums shadow"
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

        <PitchMarkings board={state.board} orientation={orientation} />

        <Pieces state={state} readyIds={readyIds} layout={layout} />
      </div>

      <TurnFlourish team={state.activeTeam} still={still} orientation={orientation} />

      {goalFor && <GoalBurst team={goalFor} />}
    </m.div>
  );
}
