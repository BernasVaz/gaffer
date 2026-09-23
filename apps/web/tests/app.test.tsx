import {
  applyAction,
  createInitialState,
  createRng,
  legalActions,
  previewDuel,
} from "@gaffer/engine";
import { DEFAULT_BOARD, DEFAULT_SETUP, FORMAT_PROFILES } from "@gaffer/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Match } from "../src/match/Match";
import { targetAt, targetsFor } from "../src/board/targets";
import { selectCarrier, takeKickoff } from "./kickoff";

/**
 * A hotseat match, rendered directly.
 *
 * These are tests of the board, not of the routing: `App` decides which screen
 * to show and `Match` is the screen they are about. Rendering it straight avoids
 * standing up a URL and clicking through a setup screen before every assertion.
 */
const hotseat = (over: Partial<typeof DEFAULT_SETUP> = {}) => (
  <Match setup={{ ...DEFAULT_SETUP, play: "hotseat", seed: 1, ...over }} onLeave={() => {}} />
);

/** The accessible name of every cell, in row-major order. */
const cellNames = () =>
  screen.getAllByRole("gridcell").map((cell) => cell.getAttribute("aria-label") ?? "");

/** Every button whose label starts with `verb` — i.e. every offered target. */
const offered = (verb: RegExp) =>
  screen
    .getAllByRole("button")
    .filter((button) => verb.test(button.getAttribute("aria-label") ?? ""));

/** The clickable button sitting on a given player's cell. */
const buttonFor = (fragment: RegExp) => screen.getByRole("button", { name: fragment });

describe("the pitch", () => {
  it("draws a cell for every square of the board", () => {
    render(hotseat());
    expect(screen.getAllByRole("gridcell")).toHaveLength(
      DEFAULT_BOARD.width * DEFAULT_BOARD.height,
    );
  });

  it("shows exactly the ten players the engine placed", () => {
    render(hotseat());
    expect(cellNames().filter((name) => /home |away /.test(name))).toHaveLength(10);
  });

  it("puts every player on the cell the engine says", () => {
    render(hotseat());
    const named = new Set(cellNames());
    for (const player of createInitialState().players) {
      const { x, y } = player.position;
      const match = [...named].some((name) =>
        name.startsWith(`Column ${x}, row ${y}: ${player.team} ${player.role}`),
      );
      expect(match, `${player.id} at ${x},${y}`).toBe(true);
    }
  });

  it("marks the ball on the kicking-off striker", () => {
    render(hotseat());
    const withBall = cellNames().filter((name) => name.includes("with the ball"));
    expect(withBall).toHaveLength(1);
    expect(withBall[0]).toMatch(/home striker.*with the ball/);
  });
});

describe("selecting a player", () => {
  it("offers nothing until something is selected", () => {
    render(hotseat());
    expect(offered(/^Move to|^Dribble to|^Pass to|^Tackle |^Shoot/)).toHaveLength(0);
  });

  it("lights every legal destination at once", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    await user.click(buttonFor(/^Select home winger/));

    // The winger has no ball, so everything it can do is a free move.
    expect(offered(/^Move to/).length).toBeGreaterThan(0);
    expect(offered(/^Dribble to/)).toHaveLength(0);
  });

  it("deselects when the same player is clicked again", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    await user.click(buttonFor(/^Select home winger/));
    expect(offered(/^Move to/).length).toBeGreaterThan(0);

    await user.click(buttonFor(/^Deselect number 7 Reyes/));
    expect(offered(/^Move to/)).toHaveLength(0);
  });

  it("will not select a player from the side that is not to move", () => {
    render(hotseat());
    // Home kicks off, so no away player is offered for selection.
    expect(offered(/^Select away/)).toHaveLength(0);
    expect(offered(/^Select home/).length).toBeGreaterThan(0);
  });
});

describe("the odds on the board", () => {
  it("shows a number on exactly the targets the engine says are contested", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await user.click(buttonFor(/^Select home striker/));

    // Ask the engine which of the striker's options are contested, then check
    // the board agrees — rather than guessing, which got this wrong once: the
    // kickoff pass back to the defender IS covered, by the opposing striker.
    const state = createInitialState();
    const mine = legalActions(state).filter((a) => a.playerId === "home-striker-1");
    const contested = mine.filter((a) => previewDuel(state, a) !== null).length;
    const free = mine.length - contested;

    expect(contested).toBeGreaterThan(0);
    expect(free).toBeGreaterThan(0);

    const labels = offered(/^Move to|^Dribble to|^Pass to|^Tackle |^Shoot/).map(
      (b) => b.getAttribute("aria-label") ?? "",
    );
    expect(labels.filter((l) => /% chance/.test(l))).toHaveLength(contested);
    expect(labels.filter((l) => !/% chance/.test(l))).toHaveLength(free);
  });

  it("keeps a free player's board free of numbers entirely", async () => {
    const user = userEvent.setup();
    render(hotseat());

    await user.click(buttonFor(/^Select home midfielder/));
    for (const move of offered(/^Move to/)) {
      expect(move.getAttribute("aria-label")).not.toMatch(/% chance/);
    }
  });

  it("explains the focused target in the status line", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    await selectCarrier(user);
    await user.hover(offered(/^Dribble to/)[0]!);

    const status = within(screen.getByLabelText("Match status"));
    expect(status.getByText("Dribble")).toBeInTheDocument();
    expect(status.getByText(/^\d+%$/)).toBeInTheDocument();
  });
});

describe("committing a move", () => {
  it("plays it straight through, with no confirm step", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    await user.click(buttonFor(/^Select home winger/));
    const destination = offered(/^Move to/)[0]!;
    const label = destination.getAttribute("aria-label") ?? "";
    const [, x, y] = /column (\d+), row (\d+)/.exec(label) ?? [];

    await user.click(destination);

    // The winger is now on the cell that was clicked.
    expect(
      screen.getByLabelText(new RegExp(`^Column ${x}, row ${y}: home winger`)),
    ).toBeInTheDocument();
  });

  it("spends an action and clears the selection", async () => {
    const user = userEvent.setup();
    render(hotseat({ actions: 4 }));
    await takeKickoff(user);

    expect(screen.getByText("3 actions left")).toBeInTheDocument();

    await user.click(buttonFor(/^Select home winger/));
    await user.click(offered(/^Move to/)[0]!);

    expect(screen.getByText("2 actions left")).toBeInTheDocument();
    expect(offered(/^Move to/)).toHaveLength(0);
  });

  it("reports what happened underneath the board", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    await selectCarrier(user);
    await user.click(offered(/^Dribble to/)[0]!);

    expect(screen.getByText(/rolled \d+–\d+/)).toBeInTheDocument();
  });
});

describe("hotseat", () => {
  it("hands the board to the other side once the pool is spent", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    expect(screen.getByText(/home to play/)).toBeInTheDocument();

    /* The kickoff pass spent one of the two, so a single move empties the
       pool — which is the thing being tested. */
    await user.click(buttonFor(/^Select home winger/));
    await user.click(offered(/^Move to/)[0]!);

    expect(screen.getByText(/away to play/)).toBeInTheDocument();
    expect(offered(/^Select away/).length).toBeGreaterThan(0);
    expect(offered(/^Select home/)).toHaveLength(0);
  });

  it("passes the turn early on demand", async () => {
    const user = userEvent.setup();
    render(hotseat());

    await user.click(screen.getByRole("button", { name: "End turn" }));

    expect(screen.getByText(/away to play/)).toBeInTheDocument();
    /* Regulation counts to the cap, not to the cap plus an extra time most
       matches never reach (ADR 0020). */
    expect(
      screen.getByText(`Turn 2 of ${FORMAT_PROFILES["5v5"].rules.turnCap}`),
    ).toBeInTheDocument();
  });
});

describe("tapping a player", () => {
  /* The standing team sheet is gone: a panel about *the player you tapped*
     says the same things and answers the question you actually had, which is
     "what is this one" rather than "what is a winger in general". */
  it("says what they are, including one of theirs", async () => {
    const user = userEvent.setup();
    render(hotseat());

    await user.click(screen.getByRole("tab", { name: /Player/ }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(/Tap anybody on the pitch/);

    await user.click(buttonFor(/^Select home winger/));

    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByText(/home winger/)).toBeInTheDocument();
    expect(panel.getByText("ATK")).toBeInTheDocument();
    expect(panel.getByText("PAS")).toBeInTheDocument();
  });

  it("reads an opposing shirt, which cannot be selected", async () => {
    const user = userEvent.setup();
    render(hotseat());

    await user.click(screen.getByRole("tab", { name: /Player/ }));
    await user.click(screen.getAllByRole("button", { name: /^Inspect away/ })[0]!);

    expect(within(screen.getByRole("tabpanel")).getByText(/away /)).toBeInTheDocument();
  });
});

describe("the shared target lookup", () => {
  /*
   * Click and drag ask this same question about a cell. If they asked it in two
   * places they would eventually answer it differently, which is the failure a
   * second input method invites.
   */
  /** Whoever the kickoff pass left the ball with. */
  const carrierAfterKickoff = () => {
    const start = createInitialState();
    const kickoff = legalActions(start).find((action) => action.type === "pass")!;
    const taken = applyAction(start, kickoff, createRng(1));
    if (!taken.ok) throw new Error("refused");
    return taken.state.ball.carrierId!;
  };

  const boardFor = (playerId: string) => {
    /* Past the kickoff: a kickoff offers only passes (ADR 0018), so a board
       taken straight from `createInitialState` has no cell targets at all. */
    const start = createInitialState();
    const kickoff = legalActions(start).find((action) => action.type === "pass")!;
    const taken = applyAction(start, kickoff, createRng(1));
    if (!taken.ok) throw new Error("the kickoff pass was refused");

    const state = taken.state;
    return { state, targets: targetsFor(state, playerId) };
  };

  it("offers the destination when a cell is empty", () => {
    const { state, targets } = boardFor(carrierAfterKickoff());
    const destination = [...targets.cells.values()][0]!;
    const cell = (destination.action as { target: { x: number; y: number } }).target;

    const found = targetAt(state, targets, undefined, cell);
    expect(found?.action).toEqual(destination.action);
  });

  it("offers the pass when a team-mate is standing there", () => {
    const { state, targets } = boardFor(carrierAfterKickoff());
    const [mateId, mateTarget] = [...targets.players.entries()][0]!;
    const mate = state.players.find((player) => player.id === mateId)!;

    expect(targetAt(state, targets, undefined, mate.position)?.action).toEqual(mateTarget.action);
  });

  it("prefers a lit destination over the player standing on it", () => {
    // Clicking a ringed team-mate passes to them rather than switching to them.
    const { state, targets } = boardFor(carrierAfterKickoff());
    const [mateId] = [...targets.players.entries()][0]!;
    const mate = state.players.find((player) => player.id === mateId)!;

    const withCell = {
      ...targets,
      cells: new Map(targets.cells).set(`${mate.position.x},${mate.position.y}`, {
        action: { type: "move", playerId: "home-striker-1", target: mate.position },
        duel: null,
      } as never),
    };

    expect(targetAt(state, withCell, undefined, mate.position)?.action.type).toBe("move");
  });

  it("offers nothing on a cell the rules say nothing about", () => {
    const { state, targets } = boardFor(carrierAfterKickoff());
    const keeper = state.players.find((player) => player.id === "home-goalkeeper-1")!;

    expect(targetAt(state, targets, undefined, keeper.position)).toBeNull();
  });
});

describe("what a dribble is worth", () => {
  it("names the cell a win carries on to, not just the one it is aimed at", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    /* Walk turns until somebody is offered a dribble that carries on. The
       geometry is ordinary — most dribbles do — but which turn it lands on is
       a seed detail. */
    let label: string | null = null;

    for (let attempt = 0; attempt < 12 && label === null; attempt += 1) {
      await selectCarrier(user);

      for (const button of offered(/^Dribble to/)) {
        const name = button.getAttribute("aria-label") ?? "";
        if (/on to column \d+, row \d+ if you win/.test(name)) label = name;
      }

      if (label === null) {
        const move = offered(/^Move to/)[0];
        if (move === undefined) break;
        await user.click(move);
      }
    }

    expect(label, "no dribble carried on within twelve tries").not.toBeNull();

    /* The two cells are adjacent and in line: the carry-on is one step further
       along the direction the dribble was already going. */
    const cells = [...(label ?? "").matchAll(/column (\d+), row (\d+)/g)].map((found) => ({
      x: Number(found[1]),
      y: Number(found[2]),
    }));
    expect(cells).toHaveLength(2);

    const [aimed, carried] = cells as [{ x: number; y: number }, { x: number; y: number }];
    expect(Math.abs(carried.x - aimed.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(carried.y - aimed.y)).toBeLessThanOrEqual(1);
    expect(aimed).not.toEqual(carried);
  });

  it("says nothing about carrying on when there is nowhere to carry on to", () => {
    /* The engine is the one that decides, so the label must be silent exactly
       when `dribbleFinish` is — never "on to" the cell it is already naming. */
    const state = createInitialState({ format: "5v5" });
    for (const target of targetsFor(state, state.ball.carrierId ?? "").cells.values()) {
      if (target.carriesTo === null) continue;
      expect(target.action.type).toBe("dribble");
      if (target.action.type !== "dribble") continue;
      expect(target.carriesTo).not.toEqual(target.action.target);
    }
  });
});
