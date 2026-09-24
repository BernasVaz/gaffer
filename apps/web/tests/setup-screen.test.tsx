import {
  DEFAULT_SETUP,
  FORMAT_PROFILES,
  FORMATS,
  MAX_ACTIONS_PER_TURN,
  MIN_ACTIONS_PER_TURN,
  parseSetup,
} from "@gaffer/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { SetupScreen } from "../src/setup/SetupScreen";
import { openMore } from "./kickoff";

/** Point the address bar somewhere, the way a shared link would. */
const visit = (search: string) => window.history.replaceState(null, "", search || "/");

afterEach(() => visit("/"));

describe("the setup screen", () => {
  it("offers both modes, both sides and all three opponents", async () => {
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);

    for (const label of ["Solo", "Hotseat", "Home", "Away", "Casual", "Pro", "Elite"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("says out loud that home kicks off", () => {
    // ADR 0007 puts the kickoff at about 62% of matches. A game built on visible
    // odds should not hide its largest one behind a side-picker.
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);
    expect(screen.getByRole("button", { name: /Home/ })).toHaveTextContent(/Kicks off/i);
  });

  it("hides the opponent controls in hotseat — there is no opponent", async () => {
    const user = userEvent.setup();
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);

    expect(screen.getByRole("button", { name: /Pro/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Hotseat/ }));

    expect(screen.queryByRole("button", { name: /Pro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Casual/ })).not.toBeInTheDocument();
  });

  it("hands back exactly what was chosen", async () => {
    const user = userEvent.setup();
    let chosen = null as unknown;
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={(setup) => (chosen = setup)} />);

    await user.click(screen.getByRole("button", { name: /Away/ }));
    await user.click(screen.getByRole("button", { name: /Elite/ }));
    await user.click(screen.getByRole("button", { name: /Kick off/ }));

    expect(chosen).toEqual({
      /* Untouched from the default, which is 11-a-side since ADR 0027 — the
         point of the test is that what you did not change comes back as it was. */
      mode: "11v11",
      play: "solo",
      side: "away",
      difficulty: "elite",
      actions: 4,
      seed: 1,
    });
  });

  it("starts from whatever the link said", () => {
    render(
      <SetupScreen
        initial={{
          mode: "7v7",
          play: "solo",
          side: "away",
          difficulty: "casual",
          actions: 3,
          seed: 4242,
        }}
        onStart={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /7v7/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Away/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Casual/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Match seed")).toHaveValue(4242);
  });

  it("shuffles to a seed the engine will accept", async () => {
    const user = userEvent.setup();
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await user.click(screen.getByRole("button", { name: /Shuffle/ }));
      const seed = Number((screen.getByLabelText("Match seed") as HTMLInputElement).value);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe("which screen you land on", () => {
  it("asks how you want to play when you just turn up", () => {
    visit("/");
    render(<App />);

    expect(screen.getByRole("button", { name: /Kick off/ })).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("starts the match straight away when a link named one", () => {
    // The whole point of sharing a link is that it is a match, not a form.
    visit("?seed=99&mode=hotseat");
    render(<App />);

    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kick off/ })).not.toBeInTheDocument();
  });

  it("puts the match in the address bar, so the link is always what is on screen", async () => {
    const user = userEvent.setup();
    visit("/");
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Away/ }));
    await user.click(screen.getByRole("button", { name: /Kick off/ }));

    /* Everything but the seed, which is now freshly drawn for every visit
       (ADR 0019) — so what is asserted is that it is *in* the link, not what
       it happens to be. */
    const published = parseSetup(window.location.search);

    expect(published).toMatchObject({
      /* What a bare link opens on, pinned rather than read off DEFAULT_SETUP:
         the game type a newcomer sees (ADR 0027) and the level they meet
         (ADR 0026) are decisions, and should not be able to drift silently. */
      mode: "11v11",
      play: "solo",
      side: "away",
      difficulty: "casual",
    });
    expect(window.location.search).toContain("seed=");
  });

  it("comes back to the setup screen on New match", async () => {
    const user = userEvent.setup();
    visit("?seed=3&mode=hotseat");
    render(<App />);

    await openMore(user);
    await user.click(screen.getByRole("button", { name: /New match/ }));
    expect(screen.getByRole("button", { name: /Kick off/ })).toBeInTheDocument();
  });

  it("plays a mangled link rather than showing nothing", () => {
    visit("?seed=banana&mode=chess");
    render(<App />);

    // A link is typed, pasted and truncated. It should still be a match.
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});

describe("choosing a game type", () => {
  it("offers all three", () => {
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);
    for (const format of FORMATS) {
      expect(screen.getByRole("button", { name: new RegExp(format) })).toBeInTheDocument();
    }
  });

  it("starts on the game type a bare link opens", () => {
    /* 11-a-side since ADR 0027 — the game people picture when they picture
       football. Not `DEFAULT_FORMAT`, which is the engine's default and stays
       5-a-side for the tests and helpers that pin rules against it. */
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);
    expect(screen.getByRole("button", { name: /^11v11/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("flags every game type as alpha, in the name a screen reader hears", () => {
    /* The badge is about the build, not about which numbers have been measured:
       a tester picking 5-a-side is in the same alpha as one picking 11. Which
       formats have provisional *numbers* is the note under the buttons. */
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);

    for (const format of FORMATS) {
      const tile = screen.getByRole("button", { name: new RegExp(`^${format}`) });
      expect(/alpha/i.test(tile.textContent ?? ""), `${format} shows the badge`).toBe(true);
      expect(
        /alpha/i.test(tile.getAttribute("aria-label") ?? ""),
        `${format} says it in its name`,
      ).toBe(true);
    }
  });

  it("says what a game type actually is, rather than only naming it", () => {
    render(<SetupScreen initial={{ ...DEFAULT_SETUP, mode: "11v11" }} onStart={() => {}} />);
    const profile = FORMAT_PROFILES["11v11"];

    expect(
      screen.getByText(new RegExp(`${profile.board.width}.${profile.board.height} pitch`)),
    ).toBeInTheDocument();
    expect(screen.getByText(/provisional/)).toBeInTheDocument();
  });

  it("hands the chosen game type back", async () => {
    const user = userEvent.setup();
    let chosen: unknown = null;
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={(setup) => (chosen = setup)} />);

    await user.click(screen.getByRole("button", { name: /11v11/ }));
    await user.click(screen.getByRole("button", { name: /Kick off/ }));

    expect(chosen).toMatchObject({ mode: "11v11" });
  });

  it("carries it into the link, so a shared match is the same game", async () => {
    const user = userEvent.setup();
    visit("/");
    render(<App />);

    await user.click(screen.getByRole("button", { name: /7v7/ }));
    await user.click(screen.getByRole("button", { name: /Kick off/ }));

    expect(parseSetup(window.location.search).mode).toBe("7v7");
  });
});

describe("a match at another game type", () => {
  it("draws the bigger pitch the link asked for", () => {
    visit("?seed=3&mode=11v11&play=hotseat");
    render(<App />);

    const profile = FORMAT_PROFILES["11v11"];
    expect(screen.getAllByRole("gridcell")).toHaveLength(
      profile.board.width * profile.board.height,
    );
  });

  it("fields both full squads", () => {
    visit("?seed=3&mode=7v7&play=hotseat");
    render(<App />);

    const named = screen
      .getAllByRole("gridcell")
      .map((cell) => cell.getAttribute("aria-label") ?? "")
      .filter((label) => /home |away /.test(label));

    expect(named).toHaveLength(14);
  });

  it("marks a provisional game type in the match itself, not just on the way in", () => {
    visit("?seed=3&mode=11v11&play=hotseat");
    render(<App />);
    expect(screen.getAllByText(/^Alpha$/).length).toBeGreaterThan(0);
  });

  it("leaves the settled game type unmarked", () => {
    visit("?seed=3&mode=5v5&play=hotseat");
    render(<App />);
    expect(screen.queryByText(/^Alpha$/)).not.toBeInTheDocument();
  });
});

describe("choosing an action economy", () => {
  const actionTile = (count: number) =>
    within(screen.getByLabelText("Actions per turn")).getByRole("button", {
      name: new RegExp(`^${count}`),
    });

  it("offers the whole range a turn can hold", () => {
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);
    for (let count = MIN_ACTIONS_PER_TURN; count <= MAX_ACTIONS_PER_TURN; count += 1) {
      expect(actionTile(count)).toBeInTheDocument();
    }
    expect(
      within(screen.getByLabelText("Actions per turn")).queryByRole("button", { name: /^5/ }),
    ).not.toBeInTheDocument();
  });

  it("starts on the game type's own number and marks it as the default", () => {
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);
    const theirs = FORMAT_PROFILES[DEFAULT_SETUP.mode].rules.actionsPerTurn;

    expect(actionTile(theirs)).toHaveAttribute("aria-pressed", "true");
    expect(actionTile(theirs)).toHaveTextContent("default");
  });

  it("follows the game type when that changes", async () => {
    /*
     * The action economy decides whether a game type works at all (ADR 0012) —
     * 11-a-side on 5-a-side's two actions produces no goals whatsoever. So a
     * game type brings its own number rather than inheriting the last one.
     */
    const user = userEvent.setup();
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);

    // Starting on 11-a-side's four, switching down to 5-a-side's two.
    expect(actionTile(4)).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /^5v5/ }));
    expect(actionTile(2)).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a deliberate choice once it is made", async () => {
    const user = userEvent.setup();
    let chosen: unknown = null;
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={(setup) => (chosen = setup)} />);

    await user.click(actionTile(1));
    await user.click(screen.getByRole("button", { name: /Kick off/ }));

    expect(chosen).toMatchObject({ mode: "11v11", actions: 1 });
  });

  it("carries it into the link", async () => {
    const user = userEvent.setup();
    visit("/");
    render(<App />);

    await user.click(actionTile(3));
    await user.click(screen.getByRole("button", { name: /Kick off/ }));

    expect(parseSetup(window.location.search).actions).toBe(3);
  });
});

describe("a match played under a chosen economy", () => {
  it("grants the turn what the link asked for, not what the game type says", () => {
    visit("?seed=3&mode=5v5&play=hotseat&actions=4");
    render(<App />);

    expect(screen.getByLabelText("Scoreboard")).toHaveTextContent("4 actions left");
  });

  it("still grants the game type's own number when the link is silent", () => {
    visit("?seed=3&mode=11v11&play=hotseat");
    render(<App />);

    expect(screen.getByLabelText("Scoreboard")).toHaveTextContent("4 actions left");
  });
});
