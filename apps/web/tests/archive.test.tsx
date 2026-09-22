import { applyAction, createInitialState, createRng, legalActions } from "@gaffer/engine";
import { DEFAULT_SETUP, parseSeed, type MatchCommand, type MatchSetup } from "@gaffer/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  forgetSavedMatch,
  listSavedMatches,
  rawArchive,
  readSavedMatch,
  replaySavedMatch,
} from "../src/feedback/archive";
import { FeedbackArchive } from "../src/feedback/FeedbackArchive";
import { saveFeedback, storageKey, type FeedbackNote } from "../src/feedback/notes";
import { buildArchiveReport, buildReport } from "../src/feedback/report";
import { Match } from "../src/match/Match";
import { buildMatch } from "../src/match/replay";

const note = (overrides: Partial<FeedbackNote> = {}): FeedbackNote => ({
  id: "note-1",
  category: "bug",
  note: "the keeper walked out of its own goal",
  actionIndex: 0,
  turn: 1,
  score: "0–0",
  activeTeam: "home",
  recap: [],
  ...overrides,
});

/** A handful of real commands, so a stored log is a stored log. */
function playSome(setup: MatchSetup, count: number): MatchCommand[] {
  const rng = createRng(parseSeed(setup.seed));
  let state = createInitialState({ format: setup.mode, rules: { actionsPerTurn: setup.actions } });
  const commands: MatchCommand[] = [];

  for (let taken = 0; taken < count && state.result === null; taken += 1) {
    const options = legalActions(state);
    const command: MatchCommand = options[0] ?? { type: "endTurn", team: state.activeTeam };
    const result = applyAction(state, command, rng);
    if (!result.ok) break;

    commands.push(command);
    state = result.state;
  }

  return commands;
}

/** Put a match's feedback in storage the same way the game does. */
function store(setup: MatchSetup, notes: FeedbackNote[]) {
  saveFeedback({ version: 1, setup, log: [], notes });
}

const setupFor = (over: Partial<MatchSetup>): MatchSetup => ({ ...DEFAULT_SETUP, ...over });

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("finding what is on the device", () => {
  it("finds a match saved under any setup, without being told which", () => {
    /* The bug this closes: notes are keyed by the whole setup, so nothing could
       reach them but the match that wrote them. */
    store(setupFor({ seed: 11, mode: "5v5" }), [note()]);
    store(setupFor({ seed: 99, mode: "11v11" }), [note({ id: "note-2" }), note({ id: "note-3" })]);

    const found = listSavedMatches();

    expect(found).toHaveLength(2);
    expect(found.flatMap((match) => match.notes)).toHaveLength(3);
    expect(new Set(found.map((match) => match.setup.seed))).toEqual(new Set([11, 99]));
  });

  it("ignores anything that is not ours", () => {
    store(setupFor({ seed: 5 }), [note()]);
    window.localStorage.setItem("something-else", JSON.stringify({ notes: [note()] }));

    expect(listSavedMatches()).toHaveLength(1);
  });

  it("lists the most recent first", () => {
    vi.setSystemTime(new Date("2026-09-01T10:00:00Z"));
    store(setupFor({ seed: 1 }), [note()]);
    vi.setSystemTime(new Date("2026-09-02T10:00:00Z"));
    store(setupFor({ seed: 2 }), [note()]);
    vi.useRealTimers();

    expect(listSavedMatches().map((match) => match.setup.seed)).toEqual([2, 1]);
  });

  it("keeps an entry saved before timestamps existed", () => {
    // Somebody's existing notes must not vanish because the schema grew a field.
    const setup = setupFor({ seed: 7 });
    window.localStorage.setItem(
      storageKey(setup),
      JSON.stringify({ version: 1, setup, log: [], notes: [note()] }),
    );

    const [found] = listSavedMatches();
    expect(found?.notes).toHaveLength(1);
    expect(found?.savedAt).toBeUndefined();
  });

  it("survives storage being unavailable", () => {
    /* A private window, or site data blocked outright. Restored by hand rather
       than with a global stub, so a throwing `localStorage` cannot escape this
       test and take the rest of the file down with it. */
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });

    try {
      expect(listSavedMatches()).toEqual([]);
      expect(() => rawArchive()).not.toThrow();
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});

describe("reading an entry that has been damaged", () => {
  const setup = setupFor({ seed: 3 });

  it("keeps the good notes and drops only the bad ones", () => {
    /* All-or-nothing validation would throw away nine good notes to punish one
       malformed one, which is the opposite of what this feature is for. */
    const raw = JSON.stringify({
      version: 1,
      setup,
      log: [],
      notes: [note(), { id: "broken", category: "not-a-category" }, note({ id: "note-9" })],
    });

    const read = readSavedMatch(storageKey(setup), raw);

    expect(read?.notes.map((kept) => kept.id)).toEqual(["note-1", "note-9"]);
    expect(read?.dropped).toBe(1);
  });

  it("refuses an entry whose setup will not parse, because nothing else can be trusted", () => {
    const raw = JSON.stringify({ version: 1, setup: { seed: "banana" }, log: [], notes: [note()] });
    expect(readSavedMatch("gaffer:feedback:x", raw)).toBeNull();
  });

  it("refuses something that is not JSON at all", () => {
    expect(readSavedMatch("gaffer:feedback:x", "{oh dear")).toBeNull();
  });
});

describe("rebuilding a saved match", () => {
  it("replays to the board the notes were taken against", () => {
    const setup = setupFor({ seed: 21, mode: "5v5" });
    store(setup, [note()]);

    const [saved] = listSavedMatches();
    const rebuilt = replaySavedMatch(saved!);

    // Deterministic, so the same saved match rebuilds identically every time.
    expect(JSON.stringify(rebuilt.state)).toBe(JSON.stringify(replaySavedMatch(saved!).state));
    expect(rebuilt.state.format).toBe("5v5");
  });

  it("rebuilds a real match, not just an empty one", () => {
    /* The path that matters: a stored log of actual commands, replayed back
       into the board those notes were taken against. An empty log exercises
       none of it. */
    const setup = setupFor({ seed: 8, mode: "5v5" });
    const played = buildMatch({
      seed: setup.seed,
      format: setup.mode,
      actionsPerTurn: setup.actions,
      replay: playSome(setup, 12),
    });

    expect(played.log.length).toBeGreaterThan(0);
    saveFeedback({ version: 1, setup, log: played.log, notes: [note({ actionIndex: 5 })] });

    const [saved] = listSavedMatches();
    expect(saved!.log).toHaveLength(played.log.length);
    expect(saved!.dropped).toBe(0);

    // Deterministic, so the archive's board is the board the notes were on.
    const rebuilt = replaySavedMatch(saved!);
    expect(JSON.stringify(rebuilt.state)).toBe(JSON.stringify(played.state));

    const report = buildReport({
      setup,
      state: rebuilt.state,
      log: rebuilt.log,
      notes: saved!.notes,
      origin: "https://example.test/gaffer/",
    });

    expect(report).toContain("## The move log");
    expect(report).toContain("replayTo=5");
  });

  it("writes one file covering every match, with every repro link intact", () => {
    store(setupFor({ seed: 11, mode: "5v5" }), [note()]);
    store(setupFor({ seed: 99, mode: "7v7" }), [note({ id: "note-2" })]);

    const report = buildArchiveReport(
      listSavedMatches().map((saved) => ({
        setup: saved.setup,
        state: replaySavedMatch(saved).state,
        log: saved.log,
        notes: saved.notes,
      })),
      "https://example.test/gaffer/",
    );

    expect(report).toContain("2 matches, 2 flagged moments");
    expect(report).toContain("seed 11");
    expect(report).toContain("seed 99");
    expect(report).toContain("replayTo=0");
  });
});

describe("the panel", () => {
  it("is on the setup screen, and opens onto everything saved", async () => {
    const user = userEvent.setup();
    store(setupFor({ seed: 11, mode: "5v5" }), [note({ note: "offside never called" })]);

    render(<FeedbackArchive />);
    await user.click(screen.getByRole("button", { name: "My feedback" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/1 flagged moment across 1 match/)).toBeInTheDocument();
    expect(within(dialog).getByText(/offside never called/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Download everything" })).toBeInTheDocument();
  });

  it("says where the notes live when there are none, rather than looking broken", async () => {
    const user = userEvent.setup();
    render(<FeedbackArchive />);
    await user.click(screen.getByRole("button", { name: "My feedback" }));

    expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(screen.getByText(/different browser/)).toBeInTheDocument();
  });

  it("reopens a saved match", async () => {
    const user = userEvent.setup();
    const setup = setupFor({ seed: 42, mode: "7v7" });
    store(setup, [note()]);

    const onOpen = vi.fn();
    render(<FeedbackArchive onOpen={onOpen} />);
    await user.click(screen.getByRole("button", { name: "My feedback" }));
    await user.click(screen.getByRole("button", { name: "Open match" }));

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ seed: 42, mode: "7v7" }));
  });

  it("asks before deleting, and only then forgets it", async () => {
    const user = userEvent.setup();
    store(setupFor({ seed: 11 }), [note()]);

    render(<FeedbackArchive />);
    await user.click(screen.getByRole("button", { name: "My feedback" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // Still there while the question is on screen.
    expect(listSavedMatches()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(listSavedMatches()).toHaveLength(0);
  });

  it("can be reached from inside a match too", async () => {
    const user = userEvent.setup();
    render(<Match setup={setupFor({ play: "hotseat", seed: 4 })} onLeave={() => {}} />);

    await user.click(screen.getByRole("button", { name: "My feedback" }));
    expect(screen.getByRole("dialog", { name: "My feedback" })).toBeInTheDocument();
  });
});

describe("forgetting", () => {
  it("removes one match and leaves the others", () => {
    store(setupFor({ seed: 1 }), [note()]);
    store(setupFor({ seed: 2 }), [note()]);

    forgetSavedMatch(storageKey(setupFor({ seed: 1 })));

    expect(listSavedMatches().map((match) => match.setup.seed)).toEqual([2]);
  });
});
