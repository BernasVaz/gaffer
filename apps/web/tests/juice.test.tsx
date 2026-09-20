import { createInitialState } from "@gaffer/engine";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Pitch } from "../src/board/Pitch";
import { NO_TARGETS } from "../src/board/targets";
import {
  BALL_ARC,
  BALL_SPRING,
  GOAL,
  IDLE,
  PIECE_SPRING,
  POP_SPRING,
  SQUASH,
  TURN_FLOURISH,
} from "../src/feel";

const noop = () => {};

/** The stylesheet, read as text — jsdom has no cascade to ask instead. */
const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

const board = (extra: Partial<React.ComponentProps<typeof Pitch>> = {}) => (
  <Pitch
    seat="both"
    state={createInitialState()}
    selectedId={null}
    targets={NO_TARGETS}
    onSelect={noop}
    onCommit={noop}
    onFocusTarget={noop}
    {...extra}
  />
);

describe("the rhythm is tunable in one place", () => {
  it("keeps every spring inside sane physical bounds", () => {
    // A spring with no damping never settles; one with too little mass jitters.
    for (const spring of [PIECE_SPRING, BALL_SPRING, POP_SPRING]) {
      expect(spring.type).toBe("spring");
      expect(spring.damping).toBeGreaterThan(0);
      expect(spring.stiffness).toBeGreaterThan(0);
    }
  });

  it("squashes and stretches around 1, never away from it", () => {
    // Stretch grows, squash shrinks. Getting these the wrong way round is the
    // classic way to make something look broken rather than heavy.
    expect(SQUASH.stretch).toBeGreaterThan(1);
    expect(SQUASH.bulge).toBeGreaterThan(1);
    expect(SQUASH.thin).toBeLessThan(1);
    expect(SQUASH.squash).toBeLessThan(1);
    // Past roughly a fifth it stops reading as weight and starts reading as jelly.
    expect(SQUASH.stretch).toBeLessThan(1.3);
  });

  it("keeps the idle breath below the threshold of distraction", () => {
    expect(IDLE.rise).toBeLessThan(0.06);
    expect(IDLE.period).toBeGreaterThan(2);
    // Pieces must not breathe in unison, or the board pulses like one object.
    expect(IDLE.stagger).toBeGreaterThan(0);
  });

  it("holds the goal long enough to land and not so long that it nags", () => {
    expect(GOAL.hold).toBeGreaterThanOrEqual(1000);
    expect(GOAL.hold).toBeLessThanOrEqual(2000);
    expect(GOAL.particles).toBeGreaterThan(0);
    // A shake you cannot stop is a fault, not a flourish.
    expect(GOAL.shake).toBeLessThan(1);
  });

  it("passes the turn faster than it celebrates a goal", () => {
    // Rhythm: the flourish is punctuation, the goal is the sentence.
    expect(TURN_FLOURISH.duration * 1000).toBeLessThan(GOAL.hold);
  });

  it("sends the ball quicker than the players", () => {
    expect(BALL_SPRING.stiffness!).toBeGreaterThan(PIECE_SPRING.stiffness!);
    expect(BALL_ARC.lift).toBeGreaterThan(0);
  });
});

describe("pieces that can be commanded read as ready", () => {
  it("marks the side to move, and only that side", () => {
    render(board());
    const state = createInitialState();

    for (const player of state.players) {
      const node = document.querySelector(`[data-player="${player.id}"]`);
      const isReady = node?.querySelector(".pitch-ready") !== null;
      expect(isReady, `${player.id} ready?`).toBe(player.team === state.activeTeam);
    }
  });

  it("marks nobody while the board is frozen for a celebration", () => {
    render(board({ frozen: true }));
    expect(document.querySelectorAll(".pitch-ready")).toHaveLength(0);
  });
});

describe("a reader who asked for less motion gets it", () => {
  /*
   * The ambient loops are stopped by CSS, not by JavaScript, which is the
   * stronger guarantee: it holds whether or not any script ran, and it cannot be
   * defeated by a component forgetting to ask. jsdom has no cascade, so these
   * read the stylesheet — a weaker test than a browser would give, but it does
   * catch the thing that actually goes wrong, which is somebody adding an
   * animation and forgetting to exempt it.
   */
  it("silences every ambient animation", () => {
    const guard = stylesheet.slice(stylesheet.indexOf("@media (prefers-reduced-motion"));

    for (const loop of ["pitch-breathe", "pitch-ready"]) {
      expect(stylesheet, `${loop} must exist to be silenced`).toContain(`.${loop}`);
      expect(guard, `${loop} must be exempted`).toContain(loop);
    }
    expect(guard).toContain("animation: none");
  });

  it("keeps the goal readable rather than silencing it", () => {
    // A goal is information. Under reduced motion it stops moving; it does not
    // stop happening.
    const guard = stylesheet.slice(stylesheet.indexOf("@media (prefers-reduced-motion"));
    expect(guard).toContain("goal-burst");
    expect(guard).toContain("opacity: 1");
  });

  it("still shows every player, and still describes the board", () => {
    // Less motion must never mean less information.
    render(board());
    expect(document.querySelectorAll("[data-player]")).toHaveLength(10);
    expect(screen.getAllByRole("gridcell")).toHaveLength(35);
    expect(screen.getByLabelText(/home striker.*with the ball/)).toBeInTheDocument();
  });
});

describe("motion never gets between a player and the board", () => {
  it("leaves the pieces layer inert", () => {
    render(board());
    expect(document.querySelector("[data-player]")?.parentElement?.className).toContain(
      "pointer-events-none",
    );
  });

  it("keeps every target clickable through all the ornament", () => {
    render(board());
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
