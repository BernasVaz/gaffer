import { legalActions, previewDuel } from "@gaffer/engine";
import type { Action, MatchState } from "@gaffer/shared";

import { kitFor } from "../board/squads";
import { targetsFor } from "../board/targets";
import { GUIDE_CARRIER, GUIDE_RECEIVER } from "./position";

/** Which half of the guide a step belongs to. */
export type GuidePhase = "setup" | "board";

/** What a step is waiting for the player to actually do, if anything. */
export type GuideExpect =
  | { kind: "none" }
  /** Press "Kick off" on the real setup screen. */
  | { kind: "kickoff" }
  /** Select a particular player on the board. */
  | { kind: "select"; playerId: string }
  /** Commit one particular action. */
  | { kind: "commit"; matches: (action: Action) => boolean };

/** Everything needed to draw and drive one step. */
export interface GuideStep {
  /** Stable id, for tests and for the dots. */
  id: string;
  /** Which screen it happens on. */
  phase: GuidePhase;
  /** The label above the title. */
  chapter: string;
  /** What to light up. Selectors; missing ones are skipped. */
  anchors: readonly string[];
  /** The heading. */
  title: string;
  /**
   * The body, derived from the live board rather than written down.
   *
   * Odds and names come out of the engine and the squad at the moment the step
   * is shown, so the guide cannot end up describing numbers the game no longer
   * produces — the failure that makes most tutorials worse than nothing.
   */
  body: (state: MatchState) => string;
  /** What the player has to do to move on, if anything. */
  expect: GuideExpect;
  /** The nudge shown beside the pulsing dot when something is expected. */
  prompt?: (state: MatchState) => string;
}

/** A player's name as it is printed on the shirt. */
function nameOf(state: MatchState, playerId: string): string {
  const player = state.players.find((candidate) => candidate.id === playerId);
  return player ? kitFor(player, state).name : playerId;
}

/**
 * The odds on a player's shot, or null when it has not actually got one.
 *
 * Legality is checked first. `previewDuel` will happily price a shot from the
 * halfway line — it answers "what would this duel be", not "may you" — and a
 * guide that quoted that number would be describing a shot the board is not
 * offering.
 */
function shotOdds(state: MatchState, playerId: string): number | null {
  const legal = legalActions(state).some(
    (action) => action.type === "shoot" && action.playerId === playerId,
  );
  if (!legal) return null;

  const shot: Action = { type: "shoot", playerId, target: null };
  const duel = previewDuel(state, shot);
  return duel === null ? 100 : Math.round(duel.winChance * 100);
}

/** A cell, addressed the way the board names it — the same in either orientation. */
const cellAt = (x: number, y: number) => `[role="gridcell"][aria-label^="Column ${x}, row ${y}:"]`;

/** Where a player is standing, as a cell selector. */
function cellOf(state: MatchState, playerId: string): string {
  const player = state.players.find((candidate) => candidate.id === playerId);
  return player ? cellAt(player.position.x, player.position.y) : "";
}

/**
 * The guide, as seven steps.
 *
 * Three on the real setup screen, four on a practice position. Passive where
 * there is nothing to do but choose, and hands-on where doing it once is the
 * whole lesson — and the two hands-on board steps are a **selection** and an
 * **uncontested pass**, neither of which can fail. A step that waited on a
 * contested action would teach "and then you lose the ball" six times in ten.
 */
export function guideSteps(state: MatchState): GuideStep[] {
  const steps: GuideStep[] = [
    {
      id: "game-type",
      phase: "setup",
      chapter: "Setting up",
      anchors: ['section[aria-labelledby="format-heading"]'],
      title: "Pick a game type",
      body: () =>
        "Five, seven or eleven a side — a different pitch and a different squad each. " +
        "5-a-side is the settled one; the bigger two are playable but still being tuned.",
      expect: { kind: "none" },
    },
    {
      id: "actions",
      phase: "setup",
      chapter: "Setting up",
      anchors: ['section[aria-labelledby="actions-heading"]'],
      title: "Actions are your turn",
      body: () =>
        "Every move, pass or shot spends one action. Spend them all and the turn passes to " +
        "the other side. Each game type comes with the number that suits its pitch.",
      expect: { kind: "none" },
    },
    {
      id: "kick-off",
      phase: "setup",
      chapter: "Setting up",
      anchors: ['[data-guide="kick-off"]'],
      title: "That's the whole setup",
      body: () =>
        "Solo or two-of-you, which side you take, how good the opponent is — all here, and all " +
        "carried in the link, so sending it gives somebody the same match, dice and all.",
      expect: { kind: "kickoff" },
      prompt: () => "Press Kick off to try a couple of moves",
    },
    {
      id: "select",
      phase: "board",
      chapter: "Playing",
      anchors: [], // filled in below, from where the carrier actually is
      title: "Tap one of your players",
      body: (board) =>
        `The ones you can command have a soft ring round them. ${nameOf(board, GUIDE_CARRIER)} ` +
        "has the ball, up near their goal.",
      expect: { kind: "select", playerId: GUIDE_CARRIER },
      prompt: (board) => `Tap ${nameOf(board, GUIDE_CARRIER)}`,
    },
    {
      id: "targets",
      phase: "board",
      chapter: "Playing",
      anchors: [],
      title: "Everything it can do lights up at once",
      body: (board) => {
        const shot = shotOdds(board, GUIDE_CARRIER);
        return (
          "A ring on grass is somewhere to run, a ring round a shirt is a pass, and the goal " +
          `lights up when you are close enough to shoot${shot === null ? "" : ` — ${shot}% from here`}. ` +
          "A number means it is contested and that is your chance of it coming off. No number " +
          "means nothing can go wrong."
        );
      },
      expect: { kind: "none" },
    },
    {
      id: "commit",
      phase: "board",
      chapter: "Playing",
      anchors: [],
      title: "Take the safe one",
      body: (board) =>
        `${nameOf(board, GUIDE_RECEIVER)} has no number on them, so that pass cannot be ` +
        "intercepted. Tapping a target plays it straight away — the odds were already on " +
        "screen, so there is nothing to confirm.",
      expect: {
        kind: "commit",
        matches: (action) => action.type === "pass" && action.target === GUIDE_RECEIVER,
      },
      prompt: (board) => `Pass to ${nameOf(board, GUIDE_RECEIVER)}`,
    },
    {
      id: "score",
      phase: "board",
      chapter: "Playing",
      anchors: [],
      title: "That is the whole game",
      body: (board) => {
        const shot = shotOdds(board, GUIDE_RECEIVER);
        return (
          `Same ball, better position: ${nameOf(board, GUIDE_RECEIVER)} is shooting at ` +
          `${shot === null ? "a better angle" : `${shot}%`} instead. Moving the ball to where the ` +
          "number is better is the whole of it — beat the keeper and you have scored."
        );
      },
      expect: { kind: "none" },
    },
  ];

  // Board anchors are resolved against the live position rather than written
  // down, so they stay right if the pinned position is ever regenerated.
  return steps.map((step) => ({
    ...step,
    anchors: step.anchors.length > 0 ? step.anchors : anchorsFor(step.id, state),
  }));
}

/** Where each board step points, given the position on screen. */
function anchorsFor(id: string, state: MatchState): readonly string[] {
  switch (id) {
    case "select":
      return [cellOf(state, GUIDE_CARRIER)];

    case "targets": {
      /* The carrier and exactly what the board is offering it — asked of the
         same `targetsFor` the pitch itself asks, so the spotlight cannot circle
         something that is not lit. Lighting the whole board would dim nothing
         and say nothing. */
      const targets = targetsFor(state, GUIDE_CARRIER);

      const cells = [...targets.cells.keys()].map((key) => {
        const [x, y] = key.split(",");
        return cellAt(Number(x), Number(y));
      });

      const players = [...targets.players.keys()].map((id) => cellOf(state, id));

      const mouth = targets.shot
        ? state.players
            .filter((player) => player.team === "away" && player.role === "goalkeeper")
            .map((keeper) => cellAt(keeper.position.x, keeper.position.y))
        : [];

      return [cellOf(state, GUIDE_CARRIER), ...cells, ...players, ...mouth].filter(Boolean);
    }

    case "commit":
      return [cellOf(state, GUIDE_RECEIVER)];

    case "score": {
      const keeper = state.players.find(
        (player) => player.team === "away" && player.role === "goalkeeper",
      );
      return [
        cellOf(state, GUIDE_RECEIVER),
        ...(keeper ? [cellAt(keeper.position.x, keeper.position.y)] : []),
      ];
    }

    default:
      return [];
  }
}
