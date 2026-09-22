import {
  applyAction,
  createInitialState,
  createRng,
  legalActions,
  previewDuel,
} from "@gaffer/engine";
import { attackingGoalMouth, areAdjacent, chebyshevDistance, parseSeed } from "@gaffer/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { kitFor } from "../src/board/squads";
import {
  GUIDE_ACTIONS,
  GUIDE_CARRIER,
  GUIDE_COMMANDS,
  GUIDE_FORMAT,
  GUIDE_RECEIVER,
  GUIDE_SEED,
  guidePosition,
} from "../src/guide/position";
import {
  AUTORUN_ON_FIRST_VISIT,
  hasSeenGuide,
  markGuideSeen,
  shouldAutorun,
} from "../src/guide/seen";
import { guideSteps } from "../src/guide/steps";
import { openMore } from "./kickoff";

/** Pretend the viewport is upright — the shape that matters most. */
function holdPhoneUpright(upright = true) {
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

/** The exact "Pass to…" button the guide is asking for — there is more than one. */
function safePassLabel(): RegExp {
  const { state } = guidePosition();
  const receiver = state.players.find((p) => p.id === GUIDE_RECEIVER)!;
  return new RegExp(`^Pass to number ${kitFor(receiver, state).number} `);
}

beforeEach(() => {
  window.localStorage.clear();
  /* Finishing the guide puts the chosen match in the address bar, which is the
     whole point of the link — but jsdom keeps one URL for the whole file, so
     the next `App` would boot straight into that match instead of the setup
     screen. Test pollution, not a product bug, and this is the cure. */
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("the practice position", () => {
  it("is content, not a gamble: replaying it rolls no dice", () => {
    /* Every command is a move or an uncontested pass. That is what makes the
       position fixed rather than something that might come out differently —
       and the moment it stops being true, this fails. */
    const rng = createRng(parseSeed(GUIDE_SEED));
    let state = createInitialState({
      format: GUIDE_FORMAT,
      rules: { actionsPerTurn: GUIDE_ACTIONS },
    });

    for (const command of GUIDE_COMMANDS) {
      const result = applyAction(state, command, rng);
      expect(result.ok, `the engine refused ${JSON.stringify(command)}`).toBe(true);
      if (!result.ok) return;

      expect(result.duel, "a die was rolled, so the position is not fixed").toBeNull();
      state = result.state;
    }

    expect(state.result).toBeNull();
  });

  it("reaches the same board from any seed, because no die decides it", () => {
    const fromPinned = JSON.stringify(guidePosition().state);

    for (const seed of [1, 7, 99999]) {
      const rng = createRng(parseSeed(seed));
      let state = createInitialState({
        format: GUIDE_FORMAT,
        rules: { actionsPerTurn: GUIDE_ACTIONS },
      });
      for (const command of GUIDE_COMMANDS) {
        const result = applyAction(state, command, rng);
        if (!result.ok) throw new Error("refused");
        state = result.state;
      }
      expect(JSON.stringify(state)).toBe(fromPinned);
    }
  });

  it("hands over with the named player on the ball and a turn to spend", () => {
    const { state } = guidePosition();

    expect(state.ball.carrierId).toBe(GUIDE_CARRIER);
    expect(state.activeTeam).toBe("home");
    expect(state.actionsRemaining).toBe(GUIDE_ACTIONS);
  });

  it("has the carrier pressed, so its options carry odds worth reading", () => {
    const { state } = guidePosition();
    const carrier = state.players.find((p) => p.id === GUIDE_CARRIER)!;

    const pressing = state.players.filter(
      (p) =>
        p.team === "away" && p.role !== "goalkeeper" && areAdjacent(p.position, carrier.position),
    );
    expect(pressing.length).toBeGreaterThan(0);

    const priced = legalActions(state)
      .filter((a) => a.playerId === GUIDE_CARRIER)
      .map((a) => previewDuel(state, a));

    expect(priced.some((duel) => duel !== null)).toBe(true);
    expect(priced.some((duel) => duel === null)).toBe(true);
  });

  it("offers the pass the guide asks for, and it cannot be intercepted", () => {
    const { state } = guidePosition();

    const pass = legalActions(state).find(
      (a) => a.type === "pass" && a.playerId === GUIDE_CARRIER && a.target === GUIDE_RECEIVER,
    );

    expect(pass, "the pass the guide teaches is not on the board").toBeDefined();
    expect(previewDuel(state, pass!)).toBeNull();
  });

  it("makes the lesson true: the pass improves the shot", () => {
    /* The whole point of the position. If retuning ever makes the receiver's
       shot no better than the carrier's, the guide would be teaching something
       the game no longer does — so this fails rather than shipping it. */
    const { state } = guidePosition();

    const carrierShot = previewDuel(state, {
      type: "shoot",
      playerId: GUIDE_CARRIER,
      target: null,
    });
    expect(carrierShot).not.toBeNull();

    const pass = legalActions(state).find(
      (a) => a.type === "pass" && a.playerId === GUIDE_CARRIER && a.target === GUIDE_RECEIVER,
    )!;
    const after = applyAction(state, pass, createRng(parseSeed(GUIDE_SEED)));
    expect(after.ok).toBe(true);
    if (!after.ok) return;

    const receiverShot = legalActions(after.state).find(
      (a) => a.type === "shoot" && a.playerId === GUIDE_RECEIVER,
    );
    expect(receiverShot, "the receiver cannot shoot").toBeDefined();

    const odds = previewDuel(after.state, receiverShot!)!;
    expect(odds.winChance).toBeGreaterThan(carrierShot!.winChance);
  });

  it("keeps both keepers on their lines", () => {
    const { state } = guidePosition();

    for (const team of ["home", "away"] as const) {
      const keeper = state.players.find((p) => p.team === team && p.role === "goalkeeper")!;
      const mouth = attackingGoalMouth(team === "home" ? "away" : "home", state.board);
      expect(
        mouth.some((c) => chebyshevDistance(c, keeper.position) === 0),
        `the ${team} keeper has wandered off`,
      ).toBe(true);
    }
  });
});

describe("running unasked", () => {
  it("is off", () => {
    // The thing that was explicitly asked for: on demand only, for now.
    expect(AUTORUN_ON_FIRST_VISIT).toBe(false);
    expect(shouldAutorun()).toBe(false);
  });

  it("stays off even on a device that has never seen it", () => {
    expect(hasSeenGuide()).toBe(false);
    expect(shouldAutorun()).toBe(false);
  });

  it("remembers having been run, so turning the switch on later cannot re-teach", () => {
    expect(hasSeenGuide()).toBe(false);
    markGuideSeen();
    expect(hasSeenGuide()).toBe(true);
  });

  it("does not open by itself on a first visit", () => {
    holdPhoneUpright();
    render(<App />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How to play" })).toBeInTheDocument();
  });
});

describe("every step points at something that is really there", () => {
  /* The anti-drift test. A renamed section or a moved control makes a step
     light up nothing, and a guide pointing at empty space is worse than none —
     so it fails here instead of in somebody's hands. */
  it("resolves the setup steps against the real setup screen", async () => {
    holdPhoneUpright();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "How to play" }));

    const setupSteps = guideSteps(guidePosition().state).filter((s) => s.phase === "setup");
    expect(setupSteps).toHaveLength(3);

    for (const step of setupSteps) {
      const found = step.anchors.some((selector) => document.querySelector(selector) !== null);
      expect(found, `step "${step.id}" points at nothing: ${step.anchors.join(", ")}`).toBe(true);
    }
  });

  it("names every board anchor in the engine's own coordinates", () => {
    // Which is what makes them land correctly in portrait and landscape alike.
    const boardSteps = guideSteps(guidePosition().state).filter((s) => s.phase === "board");
    expect(boardSteps).toHaveLength(4);

    for (const step of boardSteps) {
      expect(step.anchors.length, `step "${step.id}" has no anchors`).toBeGreaterThan(0);
      for (const anchor of step.anchors) {
        expect(anchor).toMatch(/^\[role="gridcell"\]\[aria-label\^="Column \d+, row \d+:"\]$/);
      }
    }
  });
});

describe("walking through it, upright", () => {
  const openGuide = async () => {
    holdPhoneUpright();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "How to play" }));
    return user;
  };

  const card = () => screen.getByRole("dialog");
  const heading = () => within(card()).getByRole("heading").textContent;

  it("opens on the real setup screen rather than a picture of one", async () => {
    await openGuide();

    expect(heading()).toMatch(/Pick a game type/);
    // The genuine controls are still underneath and still work.
    expect(screen.getByRole("button", { name: /^5v5/ })).toBeInTheDocument();
  });

  it("walks the setup, then waits to be kicked off", async () => {
    const user = await openGuide();

    await user.click(within(card()).getByRole("button", { name: "Next" }));
    expect(heading()).toMatch(/Actions are your turn/);

    await user.click(within(card()).getByRole("button", { name: "Next" }));
    expect(heading()).toMatch(/whole setup/);

    // Nothing moves it on but the button it is pointing at.
    expect(within(card()).queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kick off" }));
    expect(heading()).toMatch(/Tap one of your players/);
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("ignores the wrong player, and takes the right one", async () => {
    const user = await openGuide();
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Kick off" }));

    const wrong = screen.queryByRole("button", { name: /^Select home striker/ });
    if (wrong) {
      await user.click(wrong);
      expect(heading()).toMatch(/Tap one of your players/);
    }

    await user.click(screen.getByRole("button", { name: /^Select home winger/ }));
    expect(heading()).toMatch(/lights up at once/);
  });

  it("refuses a contested action and takes only the safe pass", async () => {
    const user = await openGuide();
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Kick off" }));
    await user.click(screen.getByRole("button", { name: /^Select home winger/ }));
    await user.click(within(card()).getByRole("button", { name: "Next" }));

    expect(heading()).toMatch(/Take the safe one/);

    // A shot is on, and is exactly the kind of thing a step must not accept.
    // The mouth is three cells, so it is three buttons; any of them will do.
    const shots = screen.queryAllByRole("button", { name: /^Shoot/ });
    expect(shots.length, "the position should be offering a shot to refuse").toBeGreaterThan(0);

    await user.click(shots[0]!);
    expect(heading()).toMatch(/Take the safe one/);

    await user.click(screen.getByRole("button", { name: safePassLabel() }));
    expect(heading()).toMatch(/whole game/);
  });

  it("quotes the odds the engine is actually showing", async () => {
    const user = await openGuide();
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Kick off" }));
    await user.click(screen.getByRole("button", { name: /^Select home winger/ }));
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: safePassLabel() }));

    const { state } = guidePosition();
    const pass = legalActions(state).find(
      (a) => a.type === "pass" && a.playerId === GUIDE_CARRIER && a.target === GUIDE_RECEIVER,
    )!;
    const after = applyAction(state, pass, createRng(parseSeed(GUIDE_SEED)));
    if (!after.ok) throw new Error("refused");

    const shot = legalActions(after.state).find(
      (a) => a.type === "shoot" && a.playerId === GUIDE_RECEIVER,
    )!;
    const odds = Math.round(previewDuel(after.state, shot)!.winChance * 100);

    expect(card().textContent).toContain(`${odds}%`);
  });

  it("ends by dropping you into a real match", async () => {
    const user = await openGuide();
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Kick off" }));
    await user.click(screen.getByRole("button", { name: /^Select home winger/ }));
    await user.click(within(card()).getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: safePassLabel() }));
    await user.click(within(card()).getByRole("button", { name: "Play for real" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Scoreboard")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End turn" })).toBeInTheDocument();
    expect(hasSeenGuide()).toBe(true);
  });

  it("can be left at any point, without starting anything", async () => {
    const user = await openGuide();
    await user.click(within(card()).getByRole("button", { name: "Skip" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kick off/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Scoreboard")).not.toBeInTheDocument();
  });
});

describe("reaching it from a match", () => {
  it("is offered in the match button row too", async () => {
    holdPhoneUpright();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Kick off/ }));
    expect(screen.getByLabelText("Scoreboard")).toBeInTheDocument();

    await openMore(user);
    await user.click(screen.getByRole("button", { name: "How to play" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
