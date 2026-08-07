import { createInitialState } from "@gaffer/engine";
import { DEFAULT_BOARD, ROLES, TOTAL_TURNS } from "@gaffer/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";
import { SQUADS } from "../src/board/squads";

/** The accessible name of every cell, in row-major order. */
const cellNames = () =>
  screen.getAllByRole("gridcell").map((cell) => cell.getAttribute("aria-label") ?? "");

describe("the pitch", () => {
  it("draws a cell for every square of the board", () => {
    render(<App />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(
      DEFAULT_BOARD.width * DEFAULT_BOARD.height,
    );
  });

  it("has a row for each row of the board", () => {
    render(<App />);
    expect(screen.getAllByRole("row")).toHaveLength(DEFAULT_BOARD.height);
  });

  it("shows exactly the ten players the engine placed", () => {
    render(<App />);
    const occupied = cellNames().filter((name) => /home |away /.test(name));
    expect(occupied).toHaveLength(createInitialState().players.length);
    expect(occupied).toHaveLength(10);
  });

  it("puts every player on the cell the engine says, by role and side", () => {
    // Reads the engine rather than a copied layout, so the board cannot drift
    // away from the formation without this failing.
    render(<App />);
    for (const player of createInitialState().players) {
      const { x, y } = player.position;
      expect(
        screen.getByLabelText(new RegExp(`^Column ${x}, row ${y}: ${player.team} ${player.role}`)),
      ).toBeInTheDocument();
    }
  });

  it("marks the ball on the kicking-off striker", () => {
    render(<App />);
    const withBall = cellNames().filter((name) => name.includes("with the ball"));
    expect(withBall).toHaveLength(1);
    expect(withBall[0]).toMatch(/home striker.*with the ball/);
  });

  it("labels both goal mouths, three cells apiece", () => {
    render(<App />);
    const mouths = cellNames().filter((name) => name.includes("goal mouth"));
    // The keepers stand on the centre of each mouth, so four of the six cells
    // are empty and carry the label.
    expect(mouths.length).toBeGreaterThanOrEqual(4);
  });
});

describe("the scoreboard", () => {
  it("opens goalless on turn one", () => {
    render(<App />);
    expect(screen.getByText("0–0")).toBeInTheDocument();
    expect(screen.getByText(`1/${TOTAL_TURNS}`)).toBeInTheDocument();
  });

  it("says who is to play and how many actions they have", () => {
    render(<App />);
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("the jerseys", () => {
  it("shows a squad number and a name for every player", () => {
    render(<App />);
    for (const team of ["home", "away"] as const) {
      for (const role of ROLES) {
        const kit = SQUADS[team][role];
        expect(screen.getAllByText(kit.name).length).toBeGreaterThan(0);
        expect(screen.getAllByText(String(kit.number)).length).toBeGreaterThan(0);
      }
    }
  });

  it("names the shirt in the cell's accessible label, so it is not colour-only", () => {
    render(<App />);
    const striker = SQUADS.home.striker;
    expect(
      screen.getByLabelText(
        new RegExp(`home striker, number ${striker.number} ${striker.name}, with the ball`),
      ),
    ).toBeInTheDocument();
  });
});

describe("the team sheet", () => {
  it("lists every role", () => {
    render(<App />);
    for (const role of ROLES) {
      expect(screen.getByText(role)).toBeInTheDocument();
    }
  });

  it("pairs the home and away names for each role", () => {
    render(<App />);
    for (const role of ROLES) {
      expect(
        screen.getByText(`${SQUADS.home[role].name} / ${SQUADS.away[role].name}`),
      ).toBeInTheDocument();
    }
  });
});
