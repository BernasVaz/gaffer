import { createInitialState } from "@gaffer/engine";
import { DEFAULT_BOARD, ROLES, TEAMS, type Role } from "@gaffer/shared";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Crest } from "../src/art/Crest";
import { Footballer } from "../src/art/Footballer";
import { GoalNet, PitchMarkings } from "../src/art/PitchMarkings";
import { Pieces } from "../src/board/Pieces";
import { kitFor, KITS } from "../src/board/kits";
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
        expect(kitFor(team, role)).toBe(expected);
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
    const other = container.querySelector('[data-player="home-winger"]');

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
