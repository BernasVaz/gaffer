import { applyAction, createInitialState, createRng, legalActions } from "@gaffer/engine";
import {
  DEFAULT_SETUP,
  parseSeed,
  type MatchCommand,
  type MatchSetup,
  type MatchState,
} from "@gaffer/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Match } from "../src/match/Match";
import type { RecordedEvent } from "../src/match/useMatch";
import {
  loadFeedback,
  saveFeedback,
  storageKey,
  type FeedbackNote,
  type StoredFeedback,
} from "../src/feedback/notes";
import { buildReport, replayLink, reportFilename } from "../src/feedback/report";
import { openMore } from "./kickoff";

const setup: MatchSetup = { ...DEFAULT_SETUP, play: "hotseat", seed: 42, actions: 2 };

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

/** Play `count` commands from the kickoff, always taking the first legal one. */
function playOut(count: number, from: MatchSetup = setup) {
  const rng = createRng(parseSeed(from.seed));
  let state: MatchState = createInitialState({
    format: from.mode,
    rules: { actionsPerTurn: from.actions },
  });
  const commands: MatchCommand[] = [];
  const log: RecordedEvent[] = [];

  for (let index = 0; index < count; index += 1) {
    const command =
      legalActions(state)[0] ?? ({ type: "endTurn", team: state.activeTeam } as const);
    const before = state;
    const result = applyAction(state, command, rng);
    if (!result.ok) break;

    commands.push(command);
    log.push({
      index,
      command,
      duel: result.duel,
      scored: false,
      turn: before.turn,
      team: before.activeTeam,
      score: result.state.score,
    });
    state = result.state;
  }

  return { state, commands, log };
}

/** What the board is showing, as the set of occupied-cell descriptions. */
const occupied = () =>
  screen
    .getAllByRole("gridcell")
    .map((cell) => cell.getAttribute("aria-label") ?? "")
    .filter((label) => /home |away /.test(label))
    .sort();

describe("where feedback is kept", () => {
  it("keys a match by everything that changes what is played", () => {
    const keys = new Set(
      [
        setup,
        { ...setup, seed: 43 },
        { ...setup, mode: "7v7" as const },
        { ...setup, actions: 3 },
        { ...setup, play: "solo" as const },
        { ...setup, difficulty: "elite" as const },
      ].map(storageKey),
    );

    // Two matches that differ in any of those are different matches, and must
    // not be able to overwrite each other's notes.
    expect(keys.size).toBe(6);
  });

  it("round-trips what it stored", () => {
    const stored: StoredFeedback = { version: 1, setup, log: playOut(4).log, notes: [] };
    saveFeedback(stored);

    expect(loadFeedback(setup)?.log).toHaveLength(4);
  });

  it("returns nothing for a match it has never seen", () => {
    expect(loadFeedback(setup)).toBeNull();
  });

  it("refuses anything it does not recognise, rather than throwing", () => {
    /*
     * Local storage is untrusted input like any other: it can be hand-edited,
     * written by an older version of this code, or simply unavailable. None of
     * those is worth losing a match over.
     */
    for (const junk of ["{", "null", "[]", '{"version":99}', '{"version":1}']) {
      window.localStorage.setItem(storageKey(setup), junk);
      expect(loadFeedback(setup)).toBeNull();
    }
  });
});

describe("flagging a moment", () => {
  it("offers a button and a hotkey", async () => {
    const user = userEvent.setup();
    render(<Match setup={setup} onLeave={() => {}} />);

    expect(screen.getByRole("button", { name: /Flag moment/ })).toBeInTheDocument();

    await user.keyboard("f");
    expect(screen.getByRole("dialog", { name: /Flag this moment/ })).toBeInTheDocument();
  });

  it("does not fire the hotkey while something is being typed", async () => {
    // Otherwise writing the word "off" in a note opens a second box.
    const user = userEvent.setup();
    render(<Match setup={setup} onLeave={() => {}} />);

    await user.keyboard("f");
    const box = screen.getByLabelText("What happened");
    await user.type(box, "a fumble");

    expect(box).toHaveValue("a fumble");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("closes on Escape without filing anything", async () => {
    const user = userEvent.setup();
    render(<Match setup={setup} onLeave={() => {}} />);

    await user.keyboard("f");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Flag moment/ })).not.toHaveTextContent("1");
  });

  it("files a note with the board attached, and counts it", async () => {
    const user = userEvent.setup();
    render(<Match setup={setup} onLeave={() => {}} />);

    await user.keyboard("f");
    await user.click(screen.getByRole("button", { name: "Bug" }));
    await user.type(screen.getByLabelText("What happened"), "the ring was on the wrong cell");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(screen.getByRole("button", { name: /Flag moment/ })).toHaveTextContent("1");

    const stored = loadFeedback(setup);
    expect(stored?.notes).toHaveLength(1);
    expect(stored?.notes[0]).toMatchObject({
      category: "bug",
      note: "the ring was on the wrong cell",
      actionIndex: 0,
      turn: 1,
      score: "0–0",
      activeTeam: "home",
    });
  });

  it("holds the match still while a note is being written", async () => {
    /*
     * The board a note describes has to be the board still on screen when it is
     * saved. In a solo match the opponent is on a timer, so without this the
     * position drifts out from under the person describing it.
     */
    const user = userEvent.setup();
    render(<Match setup={setup} onLeave={() => {}} />);

    await user.keyboard("f");
    expect(screen.getByRole("button", { name: "End turn" })).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "End turn" })).toBeEnabled();
  });

  it("keeps a flag with no words, because flagging is itself a signal", async () => {
    const user = userEvent.setup();
    render(<Match setup={setup} onLeave={() => {}} />);

    await user.keyboard("f");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(loadFeedback(setup)?.notes[0]?.note).toBe("");
  });
});

describe("a refresh in the middle of a match", () => {
  it("comes back as the same match, not a fresh one", async () => {
    /*
     * The whole reason the log is stored beside the notes. A note says "action
     * 13 of this match" — if a refresh started a new match, every note would
     * point at a board that never existed.
     */
    const played = playOut(6);
    saveFeedback({
      version: 1,
      setup,
      log: played.log,
      notes: [
        {
          id: "n1",
          category: "bug",
          note: "x",
          actionIndex: 6,
          turn: 1,
          score: "0–0",
          activeTeam: "home",
          recap: [],
        },
      ],
    });

    render(<Match setup={setup} onLeave={() => {}} />);

    // Same board, same clock, and the note came back with it.
    const shown = occupied();
    expect(shown).toHaveLength(played.state.players.length);

    for (const player of played.state.players) {
      const prefix = `Column ${player.position.x}, row ${player.position.y}: ${player.team} ${player.role}`;
      expect(
        shown.some((label) => label.startsWith(prefix)),
        `${player.id} should be at ${player.position.x},${player.position.y}`,
      ).toBe(true);
    }
    expect(screen.getByLabelText("Scoreboard")).toHaveTextContent(`Turn ${played.state.turn} of`);
    expect(screen.getByRole("button", { name: /Flag moment/ })).toHaveTextContent("1");
  });

  it("throws the log away when the match is restarted", async () => {
    const user = userEvent.setup();
    const played = playOut(6);
    saveFeedback({ version: 1, setup, log: played.log, notes: [] });

    render(<Match setup={setup} onLeave={() => {}} />);
    expect(screen.getByLabelText("Scoreboard")).not.toHaveTextContent("Turn 1 of");

    await openMore(user);
    await user.click(screen.getByRole("button", { name: "Replay this match" }));
    expect(screen.getByLabelText("Scoreboard")).toHaveTextContent("Turn 1 of");
  });
});

describe("winding back to a flagged moment", () => {
  it("opens the match at the action the link names", () => {
    const played = playOut(10);
    saveFeedback({ version: 1, setup, log: played.log, notes: [] });

    const atFour = playOut(4);
    render(<Match setup={setup} replayTo={4} onLeave={() => {}} />);

    expect(screen.getByLabelText("Scoreboard")).toHaveTextContent(`Turn ${atFour.state.turn} of`);
    expect(screen.getByText(/Wound back to action 4/)).toBeInTheDocument();
  });

  it("does not save over the notes that produced it", async () => {
    /*
     * A rewound match's log diverges the moment anything is played, so writing
     * it back would leave every note from the real session pointing at an
     * action that no longer exists. A rewind is a place to look, not a session.
     */
    const user = userEvent.setup();
    const played = playOut(10);
    const original: FeedbackNote[] = [
      {
        id: "n1",
        category: "ux",
        note: "original",
        actionIndex: 9,
        turn: 3,
        score: "0–0",
        activeTeam: "home",
        recap: [],
      },
    ];
    saveFeedback({ version: 1, setup, log: played.log, notes: original });

    render(<Match setup={setup} replayTo={3} onLeave={() => {}} />);

    await user.keyboard("f");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    const stored = loadFeedback(setup);
    expect(stored?.log).toHaveLength(10);
    expect(stored?.notes).toEqual(original);
  });
});

describe("the report", () => {
  const notes: FeedbackNote[] = [
    {
      id: "n1",
      category: "confusing",
      note: "no pass ring on a clear diagonal",
      actionIndex: 3,
      turn: 2,
      score: "0–0",
      activeTeam: "home",
      recap: [],
    },
  ];

  const report = (overrides: Partial<Parameters<typeof buildReport>[0]> = {}) => {
    const played = playOut(6);
    return buildReport({
      setup,
      state: played.state,
      log: played.log,
      notes,
      origin: "https://example.test/gaffer/",
      ...overrides,
    });
  };

  it("says what match it is, at the top", () => {
    const markdown = report();

    expect(markdown).toContain("# Gaffer feedback — 5-a-side, seed 42");
    expect(markdown).toContain("| Seed | `42` |");
    expect(markdown).toContain("| Actions per turn | 2 (the default) |");
    expect(markdown).toContain("Hotseat");
  });

  it("notes when the economy was changed from the game type's own", () => {
    expect(report({ setup: { ...setup, actions: 4 } })).toContain("4 (changed)");
  });

  it("carries the category, the words and where it happened", () => {
    const markdown = report();

    expect(markdown).toContain("## 1 · Confusing — turn 2, action 3");
    expect(markdown).toContain("> no pass ring on a clear diagonal");
    expect(markdown).toContain("Score 0–0, home to play.");
  });

  it("gives every note a repro that does not need the reporter present", () => {
    const markdown = report();

    expect(markdown).toContain("Seed `42`, 5v5, 2 actions a turn");
    expect(markdown).toContain("Replay to action `3` of 6");
    expect(markdown).toContain(replayLink(setup, "https://example.test/gaffer/", 3));
  });

  it("recaps what had just happened, in words rather than in ids", () => {
    const played = playOut(6);
    const markdown = report({
      notes: [{ ...notes[0]!, recap: played.log.slice(0, 3) }],
    });

    expect(markdown).toContain("**What had just happened**");
    // Names and numbers, not `home-defender-1`.
    expect(markdown).toMatch(/- turn \d+: \d+ \w+/);
    expect(markdown).not.toContain("home-defender-1 ");
  });

  it("says plainly when a moment was flagged without words", () => {
    expect(report({ notes: [{ ...notes[0]!, note: "   " }] })).toContain(
      "_Flagged without a note._",
    );
  });

  it("is still a useful record when nothing was flagged", () => {
    const markdown = report({ notes: [] });

    expect(markdown).toContain("No moments were flagged during this match.");
    expect(markdown).toContain("## The move log");
  });

  it("carries the whole move log, because a pointer into a history nobody has is not a pointer", () => {
    const played = playOut(6);
    const markdown = report();

    const block = markdown.slice(markdown.indexOf("```json") + 7, markdown.lastIndexOf("```"));
    const parsed = JSON.parse(block) as MatchCommand[];

    expect(parsed).toEqual(played.commands);
  });

  it("replays from its own log back to the state it describes", () => {
    // The strongest claim the report makes, checked end to end: what is in the
    // file, fed back to the engine, produces the board the file describes.
    const played = playOut(6);
    const markdown = report();
    const block = markdown.slice(markdown.indexOf("```json") + 7, markdown.lastIndexOf("```"));
    const commands = JSON.parse(block) as MatchCommand[];

    const rng = createRng(parseSeed(setup.seed));
    let state = createInitialState({
      format: setup.mode,
      rules: { actionsPerTurn: setup.actions },
    });
    for (const command of commands) {
      const result = applyAction(state, command, rng);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }

    expect(state).toEqual(played.state);
  });

  it("names the file after the match it describes", () => {
    expect(reportFilename(setup)).toBe("gaffer-feedback-5v5-seed42.md");
  });
});

describe("getting the report out", () => {
  it("offers the download once the match is over, and while notes exist", async () => {
    const user = userEvent.setup();
    render(<Match setup={setup} onLeave={() => {}} />);

    await openMore(user);
    expect(screen.queryByRole("button", { name: /Download feedback/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.keyboard("f");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    await openMore(user);
    expect(screen.getByRole("button", { name: /Download feedback \(1\)/ })).toBeInTheDocument();
  });
});

describe("the engine", () => {
  it("knows nothing about any of this", () => {
    // Flagging a moment reads a board and writes text. It cannot reach the
    // rules, and a match played with the feedback panel open is the same match.
    const a = playOut(8).state;
    const b = playOut(8).state;
    expect(a).toEqual(b);
  });
});
