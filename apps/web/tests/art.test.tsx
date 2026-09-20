import { createInitialState } from "@gaffer/engine";
import { DEFAULT_BOARD, FORMATS, ROLES, TEAMS, type Role } from "@gaffer/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Crest } from "../src/art/Crest";
import { Footballer } from "../src/art/Footballer";
import { GoalNet, PitchMarkings } from "../src/art/PitchMarkings";
import { Pieces } from "../src/board/Pieces";
import { Pitch } from "../src/board/Pitch";
import { kitFor as colourFor, KITS } from "../src/board/kits";
import { kitFor } from "../src/board/squads";
import { NO_TARGETS } from "../src/board/targets";
import { Button } from "../src/ui/Button";

const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/** Every `cx` on an ellipse, which is where the eyes are. */
const eyeCentres = (container: HTMLElement) =>
  [...container.querySelectorAll("ellipse")].map((node) => node.getAttribute("cx"));

describe("the kits", () => {
  it("gives each side a colour that is neither the other side nor the grass", () => {
    const shirts = TEAMS.map((team) => KITS[team].outfield.shirt);
    expect(new Set(shirts).size).toBe(TEAMS.length);
  });

  it("puts every keeper in something its own outfielders are not wearing", () => {
    // The keeper is the only player who does a different job — on this pitch, the
    // only one allowed to stand in a goal. It should be obvious which one it is.
    for (const team of TEAMS) {
      expect(KITS[team].keeper.shirt).not.toBe(KITS[team].outfield.shirt);
    }
    expect(KITS.home.keeper.shirt).not.toBe(KITS.away.keeper.shirt);
  });

  it("dresses outfielders in the outfield kit and keepers in the keeper's", () => {
    for (const team of TEAMS) {
      for (const role of ROLES) {
        const expected = role === "goalkeeper" ? KITS[team].keeper : KITS[team].outfield;
        expect(colourFor(team, role)).toBe(expected);
      }
    }
  });
});

describe("a footballer", () => {
  it("wears its number", () => {
    const { container } = render(<Footballer id="a" team="home" role="striker" number={9} />);
    expect(container.querySelector("text")?.textContent).toBe("9");
  });

  it.each([...ROLES])("draws a %s without falling over", (role: Role) => {
    const { container } = render(<Footballer id={role} team="away" role={role} number={4} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("looks where it is told", () => {
    const left = render(
      <Footballer id="l" team="home" role="striker" number={9} gaze={{ x: -1, y: 0 }} />,
    );
    const right = render(
      <Footballer id="r" team="home" role="striker" number={9} gaze={{ x: 1, y: 0 }} />,
    );

    expect(eyeCentres(left.container)).not.toEqual(eyeCentres(right.container));
  });

  it("cannot be made to look further than its eyes go", () => {
    // A gaze is a fraction, but nothing stops a caller handing over a big one —
    // the ball can be six cells away. Clamping is what keeps the pupils inside
    // the eyes rather than somewhere out on the ear.
    const far = render(
      <Footballer id="f" team="home" role="striker" number={9} gaze={{ x: 40, y: 40 }} />,
    );
    const edge = render(
      <Footballer id="e" team="home" role="striker" number={9} gaze={{ x: 1, y: 1 }} />,
    );

    expect(eyeCentres(far.container)).toEqual(eyeCentres(edge.container));
  });

  it("gives two players different gradient ids, so they cannot bleed into each other", () => {
    const { container } = render(
      <>
        <Footballer id="one" team="home" role="striker" number={9} />
        <Footballer id="two" team="away" role="striker" number={9} />
      </>,
    );

    const ids = [...container.querySelectorAll("linearGradient")].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("a crest", () => {
  it("names the side it stands for, for anyone not looking at it", () => {
    render(<Crest team="away" />);
    expect(screen.getByRole("img", { name: "away crest" })).toBeInTheDocument();
  });
});

describe("the pitch markings", () => {
  it("are drawn in the board's own units, so they line up with the cells", () => {
    const { container } = render(<PitchMarkings board={DEFAULT_BOARD} />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      `0 0 ${DEFAULT_BOARD.width} ${DEFAULT_BOARD.height}`,
    );
  });

  it("are invisible to the mouse — the grid underneath owns every click", () => {
    const { container } = render(<PitchMarkings board={DEFAULT_BOARD} />);
    expect(container.querySelector("svg")).toHaveClass("pointer-events-none");
  });

  it("put the post on the goal-line end of each net", () => {
    const left = render(<GoalNet side="left" />);
    const right = render(<GoalNet side="right" />);

    const postX = (r: ReturnType<typeof render>) =>
      [...r.container.querySelectorAll("rect")].at(-1)?.getAttribute("x");

    expect(postX(left)).not.toBe(postX(right));
  });
});

describe("the pieces on the board", () => {
  it("has everyone watching the ball, and the carrier watching the pitch", () => {
    // Ten heads turned the same way is the direction of play, readable before
    // anything has been read. Someone staring at a ball in their own hands is
    // just cross-eyed, so the carrier looks where it is going instead.
    const state = createInitialState();
    const { container } = render(<Pieces state={state} />);

    const carrier = container.querySelector(`[data-player="${state.ball.carrierId}"]`);
    const other = container.querySelector('[data-player="home-winger-1"]');

    expect(eyeCentres(carrier as HTMLElement)).not.toEqual(eyeCentres(other as HTMLElement));
  });
});

describe("a chunky button", () => {
  it("carries the treatment that makes it look pressable", () => {
    render(<Button>Kick off</Button>);
    expect(screen.getByRole("button", { name: "Kick off" })).toHaveClass("chunky");
  });

  it("stops moving under the press for readers who asked for less motion", () => {
    // Held in CSS rather than in a component, so it holds whether or not any
    // script ran — the stronger of the two guarantees.
    const reduced = stylesheet.slice(stylesheet.indexOf("@media (prefers-reduced-motion"));
    expect(reduced).toContain(".chunky:active:not(:disabled)");
    expect(reduced).toContain("transform: none");
  });

  it("silences the goal-mouth glow too", () => {
    expect(stylesheet).toContain(".mouth-glow");
    const reduced = stylesheet.slice(stylesheet.lastIndexOf("@media (prefers-reduced-motion"));
    expect(reduced).toContain("mouth-glow");
  });
});

describe("a board that has to fit a phone", () => {
  it("sizes a cell from the board, so a wide pitch shrinks its own contents", () => {
    // Not from the viewport: the same `3vw` is a third of a 5-a-side cell and
    // most of an 11-a-side one.
    expect(stylesheet).toMatch(/\.pitch-board\s*\{[^}]*container-type:\s*inline-size/);
    expect(stylesheet).toMatch(/--cell:\s*calc\(100cqw\s*\/\s*var\(--cols\)\)/);
  });

  it("makes each piece its own one-cell container", () => {
    // Which is what lets a name be sized against a *cell* without any component
    // knowing how many columns the pitch has.
    expect(stylesheet).toMatch(/\.piece\s*\{[^}]*container-type:\s*inline-size/);
    expect(stylesheet).toMatch(/\.piece\s+\.piece-name\s*\{[^}]*font-size:\s*19cqw/);
  });

  it("drops the surname once a cell is too small to read one", () => {
    const rule = stylesheet.slice(stylesheet.indexOf("@container (max-width: 46px)"));
    expect(rule).toContain(".piece-name");
    expect(rule).toContain("display: none");
  });

  it("tells the board how many columns it has, at every format", () => {
    for (const format of FORMATS) {
      const state = createInitialState({ format });
      const { container } = render(
        <Pitch
          state={state}
          seat="both"
          selectedId={null}
          targets={NO_TARGETS}
          onSelect={() => {}}
          onCommit={() => {}}
          onFocusTarget={() => {}}
        />,
      );

      const board = container.querySelector(".pitch-board") as HTMLElement;
      expect(board.style.getPropertyValue("--cols")).toBe(String(state.board.width));
      expect(board.style.getPropertyValue("--rows")).toBe(String(state.board.height));
      cleanup();
    }
  });

  it("draws a cell for every square, whatever the format", () => {
    for (const format of FORMATS) {
      const state = createInitialState({ format });
      render(
        <Pitch
          state={state}
          seat="both"
          selectedId={null}
          targets={NO_TARGETS}
          onSelect={() => {}}
          onCommit={() => {}}
          onFocusTarget={() => {}}
        />,
      );
      expect(screen.getAllByRole("gridcell")).toHaveLength(state.board.width * state.board.height);
      cleanup();
    }
  });
});

describe("kits when a role repeats", () => {
  it("gives an 11-a-side back four four different names and numbers", () => {
    const state = createInitialState({ format: "11v11" });
    const defenders = state.players
      .filter((player) => player.team === "home" && player.role === "defender")
      .map((player) => kitFor(player, state));

    expect(defenders).toHaveLength(4);
    expect(new Set(defenders.map((kit) => kit.name)).size).toBe(4);
    expect(new Set(defenders.map((kit) => kit.number)).size).toBe(4);
  });

  it("numbers the keeper 1 and a striker 9, at every format", () => {
    for (const format of FORMATS) {
      const state = createInitialState({ format });
      const keeper = state.players.find(
        (player) => player.team === "home" && player.role === "goalkeeper",
      )!;
      const striker = state.players.find(
        (player) => player.team === "home" && player.role === "striker",
      )!;

      expect(kitFor(keeper, state).number).toBe(1);
      expect(kitFor(striker, state).number).toBe(9);
    }
  });

  it("gives every player on the pitch a distinct shirt", () => {
    const state = createInitialState({ format: "11v11" });
    for (const team of ["home", "away"] as const) {
      const kits = state.players
        .filter((player) => player.team === team)
        .map((player) => `${kitFor(player, state).number} ${kitFor(player, state).name}`);
      expect(new Set(kits).size).toBe(kits.length);
    }
  });
});
