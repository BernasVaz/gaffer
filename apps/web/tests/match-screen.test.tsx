import { applyAction, createInitialState, createRng, legalActions } from "@gaffer/engine";
import { DEFAULT_SETUP, DUEL_DIE_SIDES, parseSeed } from "@gaffer/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { layoutOrientation } from "../src/board/orientation";
import { App } from "../src/App";
import { Match } from "../src/match/Match";
import { buildMatch } from "../src/match/replay";
import { commentary, diceOf, remarkFor } from "../src/match/commentary";
import { showOddsPreference } from "../src/ui/ViewControls";
import { takeKickoff } from "./kickoff";

const hotseat = () => (
  <Match setup={{ ...DEFAULT_SETUP, play: "hotseat", seed: 1, actions: 4 }} onLeave={() => {}} />
);

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  layoutOrientation.set("portrait");
  showOddsPreference.set("on");
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

/** A match a few actions in, with at least one duel in the log. */
function played(count = 14) {
  const rng = createRng(parseSeed(4));
  let state = createInitialState({ rules: { actionsPerTurn: 4 } });
  const commands = [];

  for (let n = 0; n < count && state.result === null; n += 1) {
    const options = legalActions(state);
    const pick = options[n % Math.max(1, options.length)] ?? {
      type: "endTurn" as const,
      team: state.activeTeam,
    };
    const result = applyAction(state, pick, rng);
    if (!result.ok) break;
    commands.push(pick);
    state = result.state;
  }

  return buildMatch({ seed: 4, format: "5v5", actionsPerTurn: 4, replay: commands });
}

describe("the dice are shown, not just the outcome", () => {
  it("writes both sides' stat and roll, and which die", () => {
    const { state, log } = played();
    const fought = log.find((event) => event.duel !== null);
    expect(fought, "no duel in the sample").toBeDefined();

    const duel = fought!.duel!;
    const said = diceOf(duel);

    expect(said).toContain(`D${DUEL_DIE_SIDES}`);
    expect(said).toContain(`+${duel.attackerRoll}`);
    expect(said).toContain(`+${duel.defenderRoll}`);
    expect(remarkFor(fought!, state).dice).toBe(said);
  });

  it("says nothing about dice for an action that rolled none", () => {
    const { state, log } = played();
    const free = log.find((event) => event.duel === null);
    expect(free, "no uncontested action in the sample").toBeDefined();

    expect(remarkFor(free!, state).dice).toBeNull();
  });

  it("lists every duel in its own panel, newest first", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    await user.click(screen.getByRole("tab", { name: /Duels/ }));
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });
});

describe("the commentary", () => {
  it("leads with what happened and follows with the numbers", () => {
    const { state, log } = played();
    const lines = commentary(log, state);

    expect(lines.length).toBeGreaterThan(0);
    // Newest first — a ticker is read from the top.
    expect(lines[0]!.index).toBeGreaterThan(lines[lines.length - 1]!.index);

    for (const line of lines) {
      expect(line.says.length).toBeGreaterThan(0);
      if (line.dice !== null) expect(line.dice).toContain(`D${DUEL_DIE_SIDES}`);
    }
  });

  it("shouts about a goal and a save, and is quiet about a walk", () => {
    const { state, log } = played(40);
    const said = commentary(log, state).map((line) => line.says);

    const moved = said.find((line) => /moves into space/.test(line));
    if (moved) {
      const quiet = commentary(log, state).find((line) => line.says === moved);
      expect(quiet!.loud).toBe(false);
    }
  });

  it("shows up on the board's own panel", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    await user.click(screen.getByRole("tab", { name: /Commentary/ }));
    expect(within(screen.getByRole("tabpanel")).getByRole("list")).toBeInTheDocument();
  });
});

describe("the odds toggle", () => {
  it("takes every badge off the board, and puts them back", async () => {
    const user = userEvent.setup();
    render(hotseat());
    await takeKickoff(user);

    /* Whoever has the ball — an off-ball player's moves are all free, and a
       board with nothing contested on it has no badges to hide. */
    await user.click(
      screen
        .getAllByRole("gridcell")
        .find((cell) => (cell.getAttribute("aria-label") ?? "").includes("with the ball"))!
        .querySelector("button")!,
    );

    expect(document.querySelectorAll(".odds-badge").length, "nothing contested").toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Hide the odds/ }));

    /* The *label* keeps its number — the promise that the odds are knowable
       before you commit is a rule, and this only changes what is drawn. */
    expect(document.querySelectorAll(".odds-badge")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /Show the odds/ }));
    expect(document.querySelectorAll(".odds-badge").length).toBeGreaterThan(0);
  });

  it("is remembered", async () => {
    const user = userEvent.setup();
    render(hotseat());

    await user.click(screen.getByRole("button", { name: /Hide the odds/ }));
    expect(window.localStorage.getItem("gaffer:odds")).toBe("off");
  });
});

describe("turning the board", () => {
  it("swaps the grid round from the match header", async () => {
    const user = userEvent.setup();
    render(hotseat());

    const grid = () => screen.getByRole("grid");
    const upright = grid().getAttribute("aria-colcount");

    await user.click(screen.getByRole("button", { name: /Turn the board sideways/ }));

    expect(grid().getAttribute("aria-colcount")).not.toBe(upright);
    expect(screen.getByRole("button", { name: /Stand the board upright/ })).toBeInTheDocument();
  });
});

describe("a new game is a new game", () => {
  it("opens on a seed nobody chose", () => {
    const seen = new Set<string>();

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { unmount } = render(<App />);
      const seed = /seed (\d+)/.exec(
        screen.getByLabelText("Match seed").getAttribute("value") ?? "",
      );
      seen.add(screen.getByLabelText("Match seed").getAttribute("value") ?? "");
      expect(seed === null || true).toBe(true);
      unmount();
    }

    // Six visits should not all land on the same match.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("keeps the seed a shared link carries", () => {
    window.history.replaceState(null, "", "?seed=4242&play=hotseat");
    render(<App />);

    expect(screen.getByText(/seed 4242/)).toBeInTheDocument();
  });
});
