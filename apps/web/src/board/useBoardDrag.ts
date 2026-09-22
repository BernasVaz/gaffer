import type { Action, MatchState } from "@gaffer/shared";
import { useCallback, useRef, useState } from "react";

import type { BoardLayout } from "./orientation";

import {
  cellKey,
  isCommandable,
  NO_TARGETS,
  targetAt,
  targetsFor,
  type Seat,
  type Targets,
} from "./targets";

/**
 * How far a pointer must travel before it counts as a drag rather than a tap.
 *
 * Small enough that a deliberate drag is recognised immediately, large enough
 * that a shaky click is still a click. Below this the gesture is left entirely
 * alone, which is what keeps the existing click-to-select path intact.
 */
const DRAG_THRESHOLD_PX = 6;

/** What {@link useBoardDrag} needs to do its job. */
export interface BoardDragOptions {
  /** The board being drawn. */
  state: MatchState;
  /** Where each cell is drawn, so a pointer can be turned back into a cell. */
  layout: BoardLayout;
  /** Which side or sides the person at the keyboard commands. */
  seat: Seat;
  /** The player currently selected, if any. */
  selectedId: string | null;
  /** Select a player — a drag selects the one it starts on. */
  onSelect: (playerId: string | null) => void;
  /** Commit an action. The same door a click goes through. */
  onCommit: (action: Action) => void;
  /** False while the board is showing something rather than offering moves. */
  enabled: boolean;
}

/** A drag in progress, and the handlers that drive one. */
export interface BoardDrag {
  /** True once the pointer has travelled far enough to mean it. */
  dragging: boolean;
  /** The cell under the pointer, keyed, or null. */
  over: string | null;
  /** Whether that cell would commit something if the pointer were released. */
  overIsTarget: boolean;
  /** Spread onto the grid element. */
  handlers: {
    /** Begin a possible drag. */
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    /** Track it. */
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    /** Finish it, committing if it landed on something. */
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
    /** Abandon it. */
    onPointerCancel: () => void;
  };
  /**
   * Whether the click that follows this gesture should be ignored.
   *
   * A drag that ends where it started still produces a click, and a drag that
   * committed must not then be re-read as a selection.
   */
  swallowNextClick: () => boolean;
}

/**
 * Which cell a point falls in, or null if it falls outside the grid.
 *
 * It measures the grid and then asks the layout, rather than dividing by the
 * board's own width and height — on a portrait board those are the wrong way
 * round, and a drag would land a quarter turn away from the finger holding it.
 */
function cellUnder(grid: HTMLElement, layout: BoardLayout, clientX: number, clientY: number) {
  const box = grid.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;

  const col = Math.floor(((clientX - box.left) / box.width) * layout.cols);
  const row = Math.floor(((clientY - box.top) / box.height) * layout.rows);

  if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) return null;
  return layout.toBoard(col, row);
}

/**
 * Drag a player onto what you want it to do.
 *
 * A second way in, not a second set of rules. It ends at the same `onCommit`
 * the click path ends at, and it asks {@link targetAt} the same question a
 * click asks, so the two cannot come to different conclusions about the same
 * cell — which is the failure mode a parallel input invites.
 *
 * It takes over only once the pointer has actually travelled. Below the
 * threshold nothing happens at all and the click handler runs as it always
 * did, so the existing flow is untouched rather than reimplemented. Pressing
 * down does select the player under the pointer, which is what makes a drag
 * show its options the moment it begins.
 *
 * Pointer events rather than HTML drag-and-drop: they cover mouse, touch and
 * pen with one path, and they do not drag a ghost image of half the board
 * around. Scrolling is suppressed only on the cells a drag can start from —
 * see `touch-action` in `Pitch` — so a phone can still scroll the page from
 * the empty parts of the pitch.
 */
export function useBoardDrag({
  state,
  layout,
  seat,
  selectedId,
  onSelect,
  onCommit,
  enabled,
}: BoardDragOptions): BoardDrag {
  const [dragging, setDragging] = useState(false);
  /* The hovered cell and whether dropping there would do anything, decided
     together when the pointer moves rather than derived during render — the
     answer depends on refs, and a ref read while rendering is a ref that can
     disagree with what is on screen. */
  const [over, setOver] = useState<{ key: string; isTarget: boolean } | null>(null);

  const startRef = useRef<{ x: number; y: number; playerId: string } | null>(null);
  const draggingRef = useRef(false);
  const swallowRef = useRef(false);

  /*
   * The dragged player's options, worked out once when the drag begins.
   *
   * Not read from the `targets` prop, which describes whatever was selected as
   * of the last render — a quick flick can finish before React has caught up,
   * and the drop would then find nothing on offer and quietly do nothing. The
   * board cannot change mid-drag (no command is played until the drop), so one
   * calculation covers the whole gesture, which is also cheaper than redoing it
   * on every pointer move at eleven a side.
   */
  const dragTargetsRef = useRef<Targets>(NO_TARGETS);

  const finish = useCallback(() => {
    startRef.current = null;
    draggingRef.current = false;
    dragTargetsRef.current = NO_TARGETS;
    setDragging(false);
    setOver(null);
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || event.button !== 0) return;

      const cell = cellUnder(event.currentTarget, layout, event.clientX, event.clientY);
      if (!cell) return;

      const player = state.players.find(
        (candidate) => candidate.position.x === cell.x && candidate.position.y === cell.y,
      );
      if (!player || !isCommandable(state, player.id, seat)) return;

      /*
       * Noted, but nothing is selected yet.
       *
       * Selecting here would be press-to-select, and the click that follows the
       * press would then read as a second press on an already-selected player
       * and *deselect* it — clicking a player would stop working. The selection
       * happens at the moment the gesture becomes a drag instead, which is also
       * the first moment its options are any use.
       */
      startRef.current = { x: event.clientX, y: event.clientY, playerId: player.id };
    },
    [enabled, state, layout, seat],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = startRef.current;
      if (!start) return;

      if (!draggingRef.current) {
        const travelled = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (travelled < DRAG_THRESHOLD_PX) return;

        draggingRef.current = true;
        dragTargetsRef.current = targetsFor(state, start.playerId);
        setDragging(true);
        if (start.playerId !== selectedId) onSelect(start.playerId);

        /*
         * Capture keeps the drag alive when the pointer leaves the board, which
         * is most of the useful drags. It is an optimisation rather than a
         * requirement though, and it throws if the pointer is no longer active
         * — so losing it must not lose the gesture with it.
         */
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* Carry on without it. */
        }
      }

      const cell = cellUnder(event.currentTarget, layout, event.clientX, event.clientY);
      const dragged = state.players.find((player) => player.id === start.playerId);

      setOver(
        cell === null
          ? null
          : {
              key: cellKey(cell),
              isTarget: targetAt(state, dragTargetsRef.current, dragged, cell) !== null,
            },
      );
    },
    [state, layout, selectedId, onSelect],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = startRef.current;
      if (!start) return;

      if (!draggingRef.current) {
        /* Never travelled: this was a click, and the click handler owns it. */
        finish();
        return;
      }

      const dragged = state.players.find((player) => player.id === start.playerId);
      const cell = cellUnder(event.currentTarget, layout, event.clientX, event.clientY);
      const landed = cell ? targetAt(state, dragTargetsRef.current, dragged, cell) : null;

      if (landed) onCommit(landed.action);

      /* Either way the gesture is over, and the click the browser is about to
         synthesise would be read as a fresh selection. */
      swallowRef.current = true;
      finish();
    },
    [state, layout, onCommit, finish],
  );

  const swallowNextClick = useCallback(() => {
    if (!swallowRef.current) return false;
    swallowRef.current = false;
    return true;
  }, []);

  return {
    dragging,
    over: over?.key ?? null,
    overIsTarget: over?.isTarget ?? false,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: finish },
    swallowNextClick,
  };
}
