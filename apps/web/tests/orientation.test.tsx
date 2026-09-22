import { FORMAT_PROFILES, FORMATS, type Board } from "@gaffer/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { layoutFor, svgTransform, useOrientation } from "../src/board/orientation";

const BOARDS = FORMATS.map((format) => [format, FORMAT_PROFILES[format].board] as const);

/** Every cell of a board, in engine coordinates. */
function everyCell(board: Board) {
  return Array.from({ length: board.width }, (_unused, x) =>
    Array.from({ length: board.height }, (_unusedCell, y) => ({ x, y })),
  ).flat();
}

describe.each(BOARDS)("%s board layout", (_format, board) => {
  it("draws landscape exactly as the engine numbers it", () => {
    const layout = layoutFor(board, "landscape");

    expect(layout.cols).toBe(board.width);
    expect(layout.rows).toBe(board.height);
    expect(layout.toScreen({ x: 3, y: 1 })).toEqual({ col: 3, row: 1 });
    expect(layout.rotate({ x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it("turns the grid on its side in portrait", () => {
    const layout = layoutFor(board, "portrait");

    expect(layout.cols).toBe(board.height);
    expect(layout.rows).toBe(board.width);
  });

  it.each(["landscape", "portrait"] as const)("maps %s cells one to one", (orientation) => {
    const layout = layoutFor(board, orientation);
    const drawn = new Set<string>();

    for (const cell of everyCell(board)) {
      const { col, row } = layout.toScreen(cell);

      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThan(layout.cols);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(layout.rows);

      // The inverse has to agree, or a drag lands on a different cell from the
      // one it was dropped on.
      expect(layout.toBoard(col, row)).toEqual(cell);
      drawn.add(`${col},${row}`);
    }

    // Nothing drawn twice, and nothing left undrawn.
    expect(drawn.size).toBe(layout.cols * layout.rows);
    expect(drawn.size).toBe(board.width * board.height);
  });

  it("puts the home goal at the bottom and the away goal at the top in portrait", () => {
    const layout = layoutFor(board, "portrait");
    const midfield = board.height >> 1;

    expect(layout.toScreen({ x: 0, y: midfield }).row).toBe(layout.rows - 1);
    expect(layout.toScreen({ x: board.width - 1, y: midfield }).row).toBe(0);
  });

  it("sends home's attack up the screen in portrait", () => {
    const layout = layoutFor(board, "portrait");

    // Upfield for home is +x, which has to become "towards the top": −y.
    expect(layout.rotate({ x: 1, y: 0 })).toEqual({ x: 0, y: -1 });
    expect(layout.rotate({ x: -1, y: 0 })).toEqual({ x: 0, y: 1 });
  });

  it("keeps the drawn board the same shape as its cells", () => {
    for (const orientation of ["landscape", "portrait"] as const) {
      const layout = layoutFor(board, orientation);
      expect(layout.cols * layout.rows).toBe(board.width * board.height);
    }
  });
});

describe("markings transform", () => {
  it("leaves landscape drawing alone", () => {
    expect(svgTransform(FORMAT_PROFILES["5v5"].board, "landscape")).toBeUndefined();
  });

  it("turns a board corner into the screen corner the layout expects", () => {
    const board = FORMAT_PROFILES["7v7"].board;
    const layout = layoutFor(board, "portrait");
    const transform = svgTransform(board, "portrait");

    expect(transform).toBe(`matrix(0 -1 1 0 0 ${board.width})`);

    /* Apply it by hand to the top-left corner of cell (0, 0) and check it lands
       on the top-left corner of the cell the layout draws it in. matrix(a b c d
       e f) maps (x, y) to (ax + cy + e, bx + dy + f). */
    const apply = (x: number, y: number) => ({ x: y, y: board.width - x });
    const { col, row } = layout.toScreen({ x: 0, y: 0 });

    expect(apply(0, 0)).toEqual({ x: col, y: row + 1 }); // bottom-left of the cell
    expect(apply(1, 1)).toEqual({ x: col + 1, y: row }); // top-right of it
  });
});

describe("useOrientation", () => {
  const listeners = new Set<() => void>();
  let portrait = false;

  const stub = () =>
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("portrait") && portrait,
      addEventListener: (_event: string, handler: () => void) => listeners.add(handler),
      removeEventListener: (_event: string, handler: () => void) => listeners.delete(handler),
    }));

  afterEach(() => {
    listeners.clear();
    portrait = false;
    vi.unstubAllGlobals();
  });

  it("reads the viewport's shape", () => {
    portrait = true;
    stub();

    expect(renderHook(() => useOrientation()).result.current).toBe("portrait");
  });

  it("follows the device being turned", () => {
    stub();
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe("landscape");

    act(() => {
      portrait = true;
      for (const listener of [...listeners]) listener();
    });

    expect(result.current).toBe("portrait");
  });

  it("unsubscribes when it goes away", () => {
    stub();
    const { unmount } = renderHook(() => useOrientation());
    expect(listeners.size).toBeGreaterThan(0);

    unmount();
    expect(listeners.size).toBe(0);
  });

  it("assumes landscape where there is no viewport to ask", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(renderHook(() => useOrientation()).result.current).toBe("landscape");
  });
});
