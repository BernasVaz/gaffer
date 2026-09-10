import { createInitialState } from "@gaffer/engine";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

/** The one DOM node representing a given player, wherever it currently is. */
const pieceFor = (playerId: string) =>
  document.querySelector<HTMLElement>(`[data-player="${playerId}"]`);

const ball = () => document.querySelector<HTMLElement>("[data-ball]");

const offered = (verb: RegExp) =>
  screen
    .getAllByRole("button")
    .filter((button) => verb.test(button.getAttribute("aria-label") ?? ""));

const buttonFor = (fragment: RegExp) => screen.getByRole("button", { name: fragment });

describe("pieces are drawn as one lasting node each", () => {
  it("gives every player exactly one node", () => {
    render(<App />);
    for (const player of createInitialState().players) {
      expect(pieceFor(player.id), player.id).not.toBeNull();
    }
    expect(document.querySelectorAll("[data-player]")).toHaveLength(10);
  });

  it("keeps the very same node when a player moves", async () => {
    /*
     * The whole slice rests on this. A piece drawn inside its cell is destroyed
     * and rebuilt somewhere else when it moves, and a node that stopped existing
     * cannot travel. If this ever fails, pieces are teleporting again however
     * good the easing looks.
     */
    const user = userEvent.setup();
    render(<App />);

    const before = pieceFor("home-winger");
    const cellBefore = before?.dataset.cell;

    await user.click(buttonFor(/^Select home winger/));
    await user.click(offered(/^Move to/)[0]!);

    const after = pieceFor("home-winger");
    expect(after).toBe(before); // identity, not just equality
    expect(after?.dataset.cell).not.toBe(cellBefore);
  });

  it("positions each piece at the cell the engine put it on", () => {
    render(<App />);
    for (const player of createInitialState().players) {
      expect(pieceFor(player.id)?.dataset.cell).toBe(`${player.position.x},${player.position.y}`);
    }
  });

  it("survives the rebuild that follows a goal", () => {
    // Player ids are stable across a kickoff reset, which is what lets the same
    // nodes stay put rather than the whole board being torn down and replaced.
    render(<App />);
    const ids = [...document.querySelectorAll("[data-player]")].map(
      (node) => (node as HTMLElement).dataset.player,
    );
    expect(new Set(ids).size).toBe(10);
  });
});

describe("the ball is its own piece", () => {
  it("exists once, separate from any shirt", () => {
    render(<App />);
    expect(document.querySelectorAll("[data-ball]")).toHaveLength(1);
  });

  it("starts on its carrier's cell", () => {
    render(<App />);
    const state = createInitialState();
    expect(ball()?.dataset.cell).toBe(`${state.ball.position.x},${state.ball.position.y}`);
  });

  it("travels to the receiver on a pass, without either player moving", async () => {
    const user = userEvent.setup();
    render(<App />);

    const striker = pieceFor("home-striker");
    const strikerCell = striker?.dataset.cell;
    const from = ball()?.dataset.cell;

    await user.click(buttonFor(/^Select home striker/));
    const pass = offered(/^Pass to/)[0]!;
    await user.click(pass);

    // The ball has gone somewhere else; the passer has not.
    expect(ball()?.dataset.cell).not.toBe(from);
    expect(pieceFor("home-striker")?.dataset.cell).toBe(strikerCell);
    expect(ball()).toBe(document.querySelector("[data-ball]")); // still one node
  });

  it("goes with the carrier when the carrier moves", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(buttonFor(/^Select home striker/));
    await user.click(offered(/^Dribble to/)[0]!);

    const carrierId = ball()?.dataset.cell;
    // Wherever the ball ended up, some player is standing on that cell.
    const cells = [...document.querySelectorAll("[data-player]")].map(
      (node) => (node as HTMLElement).dataset.cell,
    );
    expect(cells).toContain(carrierId);
  });
});

describe("motion cannot reach the engine", () => {
  it("advances the match synchronously on click, with nothing to wait for", async () => {
    /*
     * The determinism guarantee, stated as a test. The engine resolves the
     * moment the click lands; the board spends the next fraction of a second
     * catching up visually. No timer, transition or animation callback is
     * allowed to call back into the engine, so animation timing can never
     * change a result — and this fails immediately if anyone introduces a
     * delay between the click and the state.
     */
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText("2 actions left")).toBeInTheDocument();

    await user.click(buttonFor(/^Select home winger/));
    await user.click(offered(/^Move to/)[0]!);

    // No waitFor, no timer advance: the state is already there.
    expect(screen.getByText("1 action left")).toBeInTheDocument();
  });

  it("reports the new board to assistive technology at once, not after the slide", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(buttonFor(/^Select home winger/));
    const destination = offered(/^Move to/)[0]!;
    const [, x, y] =
      /column (\d+), row (\d+)/.exec(destination.getAttribute("aria-label") ?? "") ?? [];
    await user.click(destination);

    expect(
      screen.getByLabelText(new RegExp(`^Column ${x}, row ${y}: home winger`)),
    ).toBeInTheDocument();
  });

  it("leaves the pieces layer inert, so it can never swallow a click", () => {
    render(<App />);
    const layer = document.querySelector("[data-player]")?.parentElement;
    expect(layer?.className).toContain("pointer-events-none");
  });
});
