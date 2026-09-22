import { createInitialState } from "@gaffer/engine";
import {
  attackingGoalMouth,
  DEFAULT_SETUP,
  FORMAT_PROFILES,
  FORMATS,
  type MatchFormat,
} from "@gaffer/shared";
import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { layoutFor } from "../src/board/orientation";
import { useBoardDrag } from "../src/board/useBoardDrag";
import { Match } from "../src/match/Match";

/** Pretend the viewport is upright, for as long as a test wants it to be. */
function holdPhoneUpright(upright: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    matches: upright && query.includes("(orientation: portrait)"),
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const match = (mode: MatchFormat) => (
  <Match setup={{ ...DEFAULT_SETUP, mode, play: "hotseat", seed: 7 }} onLeave={() => {}} />
);

/** Every cell's accessible name, in the order the DOM gives them. */
const cellNames = () =>
  screen.getAllByRole("gridcell").map((cell) => cell.getAttribute("aria-label") ?? "");

/** The `Column x, row y` a name opens with. */
function cellAt(index: number) {
  const found = /^Column (\d+), row (\d+):/.exec(cellNames()[index] ?? "");
  expect(found, `cell ${index} names its coordinates`).not.toBeNull();
  return { x: Number(found![1]), y: Number(found![2]) };
}

afterEach(() => vi.unstubAllGlobals());

describe.each(FORMATS)("a %s board on a phone held upright", (mode) => {
  const board = FORMAT_PROFILES[mode].board;

  beforeEach(() => holdPhoneUpright(true));

  it("lays the grid out a quarter turn round", () => {
    render(match(mode));
    const grid = screen.getByRole("grid");

    expect(grid).toHaveAttribute("aria-colcount", String(board.height));
    expect(grid).toHaveAttribute("aria-rowcount", String(board.width));
    expect(grid.style.gridTemplateColumns).toBe(`repeat(${board.height}, minmax(0, 1fr))`);
  });

  it("still draws every cell exactly once", () => {
    render(match(mode));
    const names = cellNames();

    expect(names).toHaveLength(board.width * board.height);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps every cell named in the engine's own coordinates", () => {
    /* The label is what a flagged moment quotes and what a screen reader
       reads. If it turned with the board, the same cell would have two names
       depending on which way somebody was holding their phone. */
    render(match(mode));
    const upright = [...cellNames()].sort();

    vi.unstubAllGlobals();
    holdPhoneUpright(false);
    render(match(mode));
    const sideways = [...cellNames()].slice(upright.length).sort();

    expect(sideways).toEqual(upright);
  });

  it("puts the home goal at the foot of the screen and the away goal at the head", () => {
    render(match(mode));

    const firstRow = Array.from({ length: board.height }, (_unused, i) => cellAt(i));
    const lastRowStart = (board.width - 1) * board.height;
    const lastRow = Array.from({ length: board.height }, (_unused, i) => cellAt(lastRowStart + i));

    // Away defends x = width − 1, home defends x = 0.
    expect(firstRow.every((cell) => cell.x === board.width - 1)).toBe(true);
    expect(lastRow.every((cell) => cell.x === 0)).toBe(true);

    // And the mouths themselves land in those rows.
    const homeMouth = attackingGoalMouth("away", board);
    expect(homeMouth.every((cell) => lastRow.some((drawn) => drawn.y === cell.y))).toBe(true);
  });

  it("reads left to right across the pitch, not down it", () => {
    render(match(mode));

    // Consecutive cells in the DOM are neighbouring touchline-to-touchline
    // positions: the drawn row is a slice across the pitch.
    for (let i = 1; i < board.height; i += 1) {
      expect(cellAt(i).y).toBe(cellAt(i - 1).y + 1);
      expect(cellAt(i).x).toBe(cellAt(i - 1).x);
    }
  });

  it("is playable: selecting a player still offers it moves", async () => {
    const user = userEvent.setup();
    render(match(mode));

    /* Whichever striker holds it — an 11-a-side side fields two. */
    const carrier = screen.getAllByRole("button", { name: /^Select home striker/ })[0]!;
    await user.click(carrier);

    const offered = screen
      .getAllByRole("button")
      .filter((button) => /^Move to|^Dribble to|^Pass to|^Shoot/.test(button.ariaLabel ?? ""));

    expect(offered.length).toBeGreaterThan(0);
  });
});

describe("the board turned round", () => {
  it("points the attack arrows up and down instead of left and right", () => {
    holdPhoneUpright(true);
    render(match("5v5"));
    expect(screen.getByText(/Home attacks/).textContent).toMatch(/↑/);
    expect(screen.getByText(/Home attacks/).textContent).toMatch(/↓/);
  });

  it("hangs the nets off the top and bottom of an upright pitch", () => {
    holdPhoneUpright(true);
    const { container } = render(match("5v5"));

    // A post lying across the mouth rather than standing beside it: the net's
    // solid bar is ten units wide and one thick, not the other way round.
    const posts = [...container.querySelectorAll('rect[fill="#f4fbf6"]')];
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.getAttribute("width")).toBe("10");
      expect(post.getAttribute("height")).toBe("1.1");
    }
  });

  it("leaves a wide screen exactly as it was", () => {
    holdPhoneUpright(false);
    render(match("5v5"));
    const board = FORMAT_PROFILES["5v5"].board;
    const grid = screen.getByRole("grid");

    expect(grid).toHaveAttribute("aria-colcount", String(board.width));
    expect(grid).toHaveAttribute("aria-rowcount", String(board.height));
    expect(cellAt(0)).toEqual({ x: 0, y: 0 });
  });
});

describe("dragging on an upright board", () => {
  /**
   * A grid of a known size at a known place.
   *
   * jsdom lays nothing out, so a drag test has to say where the board is or
   * every pointer lands at the origin — which is exactly how the rotation bug
   * this guards against would slip through unnoticed.
   */
  function fakeGrid(width: number, height: number) {
    const element = document.createElement("div");
    element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width, height, right: width, bottom: height }) as DOMRect;
    return element;
  }

  const pointerAt = (grid: HTMLElement, clientX: number, clientY: number) =>
    ({
      button: 0,
      pointerId: 1,
      clientX,
      clientY,
      currentTarget: grid,
    }) as unknown as React.PointerEvent<HTMLDivElement>;

  it("picks up the player the finger is actually on", () => {
    const state = createInitialState();
    const layout = layoutFor(state.board, "portrait");
    const cell = 40;
    const grid = fakeGrid(layout.cols * cell, layout.rows * cell);

    const selected: Array<string | null> = [];
    const { result } = renderHook(() =>
      useBoardDrag({
        state,
        layout,
        seat: "both",
        selectedId: null,
        onSelect: (id) => selected.push(id),
        onCommit: () => {},
        enabled: true,
      }),
    );

    // The home striker, wherever the engine put it, drawn where the layout says.
    const striker = state.players.find((player) => player.id === state.ball.carrierId)!;
    const { col, row } = layout.toScreen(striker.position);
    const centre = { x: col * cell + cell / 2, y: row * cell + cell / 2 };

    result.current.handlers.onPointerDown(pointerAt(grid, centre.x, centre.y));
    result.current.handlers.onPointerMove(pointerAt(grid, centre.x, centre.y + cell));

    expect(selected).toEqual([striker.id]);
  });

  it("finds nothing where the unrotated board would have put that player", () => {
    /* The bug this replaces: dividing the pointer by the board's own width and
       height instead of the drawn grid's, which lands a quarter turn away. */
    const state = createInitialState();
    const layout = layoutFor(state.board, "portrait");
    const cell = 40;
    const grid = fakeGrid(layout.cols * cell, layout.rows * cell);

    const selected: Array<string | null> = [];
    const { result } = renderHook(() =>
      useBoardDrag({
        state,
        layout,
        seat: "both",
        selectedId: null,
        onSelect: (id) => selected.push(id),
        onCommit: () => {},
        enabled: true,
      }),
    );

    const striker = state.players.find((player) => player.id === state.ball.carrierId)!;
    const wrong = {
      x: striker.position.x * cell + cell / 2,
      y: striker.position.y * cell + cell / 2,
    };

    result.current.handlers.onPointerDown(pointerAt(grid, wrong.x, wrong.y));
    result.current.handlers.onPointerMove(pointerAt(grid, wrong.x, wrong.y + cell));

    expect(selected).toEqual([]);
  });
});
