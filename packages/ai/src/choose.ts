import { legalActions } from "@gaffer/engine";
import {
  DIFFICULTIES,
  mirrorPosition,
  type Difficulty,
  type MatchCommand,
  type MatchState,
  type Team,
} from "@gaffer/shared";

import { outcomesOf } from "./branches.js";
import { evaluateState } from "./evaluate.js";

/** What a difficulty actually changes about the search. */
export interface OpponentProfile {
  /** How many of its own actions the opponent plans ahead. A turn is two. */
  lookahead: number;
  /** How many candidate actions survive pruning at the first ply. */
  breadth: number;
  /** Whether it looks at the reply its turn invites before choosing. */
  anticipate: boolean;
  /**
   * Whether it is blind to the danger it leaves behind.
   *
   * A blind opponent still wants the ball and still wants to score; it simply
   * cannot see that walking its keeper out or leaving a shot on has a cost. That
   * is what an inexperienced player actually looks like, and it is a far better
   * easy mode than one that plays well and then throws a move away at random.
   */
  reckless: boolean;
}

/**
 * The three settings, and what each is meant to feel like across a match.
 *
 * `pro` is the default because it is the one tuned to be worth beating: it plans
 * a whole turn, values the danger it creates, and will punish a keeper left off
 * its line — but it does not read your reply, so it can be set up.
 */
export const PROFILES: Readonly<Record<Difficulty, OpponentProfile>> = {
  casual: { lookahead: 1, breadth: 6, anticipate: false, reckless: true },
  pro: { lookahead: 2, breadth: 10, anticipate: false, reckless: false },
  elite: { lookahead: 2, breadth: 6, anticipate: true, reckless: false },
};

/* A profile for every difficulty the contract allows, checked at build time. */
const _everyDifficultyHasAProfile: readonly Difficulty[] = DIFFICULTIES;
void _everyDifficultyHasAProfile;

/** How many replies the opponent weighs when it is looking one turn further. */
const REPLY_BREADTH = 6;

/**
 * The board the search's breadth numbers were chosen against.
 *
 * 5-a-side: 35 cells, ten players, about thirty legal actions a turn. Every
 * profile below is tuned for that, and {@link breadthFor} scales away from it.
 */
const TUNED_CELLS = 35;

/**
 * How wide to search on this board, given a profile tuned for 5-a-side.
 *
 * Branching grows fast with the pitch — about 30 legal actions a turn at
 * 5-a-side, 60 at 7-a-side and 110 at 11-a-side — and the search cost grows
 * with the *square* of that, because every candidate kept at the first ply is
 * re-expanded against the whole list at the second. Left alone, `elite` on an
 * 11-a-side board took 360ms for a single decision, which is long enough to
 * drop frames on the board it is playing on.
 *
 * Scaling the breadth by the square root of the area keeps the amount of work
 * roughly level across formats. The honest cost is that the opponent searches
 * *less widely* on a bigger pitch, so it plays a little worse there — which is
 * the right trade of the two available, since the alternative is an opponent
 * that plays well and stutters while it does it.
 */
function breadthFor(profile: OpponentProfile, state: MatchState): number {
  const cells = state.board.width * state.board.height;
  if (cells <= TUNED_CELLS) return profile.breadth;
  return Math.max(3, Math.round(profile.breadth * Math.sqrt(TUNED_CELLS / cells)));
}

/**
 * How far variety is allowed to move a command's value.
 *
 * Small on purpose. The evaluation separates genuinely different options by tens
 * or hundreds of points, so a jitter of under one point can only ever reorder
 * options the search considered equal — it can never talk the opponent out of a
 * better move. What it does do is stop a deterministic chooser from playing the
 * identical opening in every match, which matters twice over: it is what makes a
 * solo match feel like an opponent rather than a script, and it is what makes a
 * self-play balance run a sample of the game rather than eighty copies of one
 * line through it.
 */
const VARIETY_RANGE = 0.75;

/**
 * A cheap, stable hash of a string — FNV-1a, folded to a unit interval.
 *
 * Not cryptographic and not trying to be. It only has to scatter equal-valued
 * commands consistently: the same command on the same board under the same
 * variety seed must always land in the same place, or the match stops replaying.
 */
function jitter(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 8) / 0x01000000;
}

/** Options for {@link chooseCommand}. */
export interface ChooseOptions {
  /** How hard to try. Defaults to `"pro"`. */
  difficulty?: Difficulty;
  /**
   * Which way to lean when two options are worth the same.
   *
   * Pass the match seed. Two boards that leave the opponent genuinely indifferent
   * will be resolved differently under different seeds, so the same opponent does
   * not open every match with the same three moves — while any given seed still
   * replays exactly. Omit it and ties fall to the stable key, which is what the
   * tests want.
   */
  variety?: number;
}

/**
 * A stable ordering key for a command, written in the acting side's own frame.
 *
 * Built field by field rather than by serialising, for the same reason the
 * engine's own `actionKey` is: two objects describing the same cell can differ
 * as JSON. Every tie in the search is broken on this, so an opponent handed the
 * same board twice always plays the same move — which is what keeps a match
 * reproducible from its seed alone.
 *
 * **Cells are mirrored for the away side, and that is the whole point.** The two
 * sides attack in opposite directions, so a raw `x` means "forward" to one of
 * them and "back" to the other. Sorting on it made ties break toward the far
 * touchline — which is progress for away and retreat for home — and the same
 * opponent, playing itself, then won 88% of matches from the away side. Ties are
 * common because an opposed d3 gives the evaluation only a handful of distinct
 * values to separate options with, so a biased tie-break is not a rounding error;
 * it is a thumb on the scale every few actions. Rotating the board into the
 * mover's own frame makes the key mean the same thing to both.
 *
 * Player ids are left alone: a side only ever ranks its own players, and within
 * one squad the ids share a prefix, so they already sort by role for both sides.
 */
function commandKey(command: MatchCommand, state: MatchState): string {
  const own = (position: { x: number; y: number }) =>
    state.activeTeam === "home" ? position : mirrorPosition(position, state.board);

  switch (command.type) {
    case "move":
    case "dribble": {
      const cell = own(command.target);
      return `${command.type}|${command.playerId}|${cell.x},${cell.y}`;
    }
    case "pass":
    case "tackle":
      return `${command.type}|${command.playerId}|${command.target}`;
    case "shoot":
      return `shoot|${command.playerId}|`;
    case "endTurn":
      /* The team is left out on purpose: only the side to move can end a turn,
         so naming it would make the key mean something different to each side
         and reintroduce the very bias this function exists to remove. */
      return "endTurn||";
  }
}

/**
 * A command key with the side filed off, for the variety hash.
 *
 * {@link commandKey} already writes cells in the mover's own frame, but it keeps
 * player ids intact — and those name a side. Hashing them would hand home and
 * away different leanings on mirror-image boards, which is the very asymmetry
 * the frame-relative key exists to remove. Within one squad the role alone is
 * unique, so dropping the prefix loses nothing.
 */
function neutralKey(command: MatchCommand, state: MatchState): string {
  return commandKey(command, state).replaceAll(/\b(?:home|away)-/g, "");
}

/** Every command worth considering from this board, ending the turn included. */
function candidates(state: MatchState): MatchCommand[] {
  const actions = legalActions(state);
  const commands: MatchCommand[] = [...actions, { type: "endTurn", team: state.activeTeam }];
  return commands.sort((a, b) => commandKey(a, state).localeCompare(commandKey(b, state)));
}

/** A command and what the search thinks it is worth. */
interface Rated {
  /** The command considered. */
  command: MatchCommand;
  /** Its expected value, from the searching side's point of view. */
  value: number;
}

/**
 * The worst the other side could make this position for us with one action.
 *
 * An approximation of a minimax ply, deliberately narrow: the reply is ranked by
 * *their* evaluation, because that is what they will actually choose by, and
 * then scored by *ours*. Only the strongest handful are looked at, which is the
 * difference between one extra ply and a search that takes long enough to be
 * felt.
 */
function replyValue(state: MatchState, team: Team): number {
  const them = state.activeTeam;

  const ranked = candidates(state)
    .map((command) => {
      const outcomes = outcomesOf(state, command);
      if (outcomes.length === 0) return null;
      const theirs = outcomes.reduce(
        (total, o) => total + o.probability * evaluateState(o.state, them),
        0,
      );
      const ours = outcomes.reduce(
        (total, o) => total + o.probability * evaluateState(o.state, team),
        0,
      );
      return { theirs, ours };
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => b.theirs - a.theirs)
    .slice(0, REPLY_BREADTH);

  if (ranked.length === 0) return evaluateState(state, team);
  return Math.min(...ranked.map((entry) => entry.ours));
}

/**
 * What a board is worth once our turn has finished on it.
 *
 * Either the match is over and the evaluation is final, or the ball is with the
 * other side and — at the settings that ask for it — what they can do about it
 * is worth knowing before we get here.
 */
function leafValue(
  state: MatchState,
  team: Team,
  profile: OpponentProfile,
  anticipate: boolean,
): number {
  if (state.result !== null) return evaluateState(state, team);
  if (!anticipate || state.activeTeam === team) {
    return evaluateState(state, team, { reckless: profile.reckless });
  }
  return replyValue(state, team);
}

/**
 * Rate every candidate on this board and return them best first.
 *
 * `depth` counts our own remaining actions to plan, not plies: a turn is two
 * actions, so depth 2 is "plan the whole turn" and depth 1 is "take the best
 * thing available now".
 */
function rateAll(
  state: MatchState,
  team: Team,
  depth: number,
  breadth: number,
  profile: OpponentProfile,
  variety: number | undefined,
): Rated[] {
  const shallow: Rated[] = [];

  for (const command of candidates(state)) {
    const outcomes = outcomesOf(state, command);
    if (outcomes.length === 0) continue;

    const value = outcomes.reduce(
      (total, outcome) =>
        total + outcome.probability * leafValue(outcome.state, team, profile, false),
      0,
    );
    const lean =
      variety === undefined
        ? 0
        : (jitter(`${variety}|${state.turn}|${neutralKey(command, state)}`) - 0.5) * VARIETY_RANGE;
    shallow.push({ command, value: value + lean });
  }

  // Stable best-first: value, then the key, so equal options never flip.
  const order = (a: Rated, b: Rated) =>
    b.value - a.value || commandKey(a.command, state).localeCompare(commandKey(b.command, state));
  shallow.sort(order);

  if (depth <= 1 && !profile.anticipate) return shallow;

  const deep = shallow.slice(0, breadth).map(({ command }): Rated => {
    const outcomes = outcomesOf(state, command);
    const value = outcomes.reduce((total, outcome) => {
      const next = outcome.state;

      // Our turn continues, and we still have plan left to spend on it.
      if (next.result === null && next.activeTeam === team && depth > 1) {
        const [best] = rateAll(next, team, depth - 1, Math.max(2, breadth >> 1), profile, variety);
        return total + outcome.probability * (best?.value ?? evaluateState(next, team));
      }

      return total + outcome.probability * leafValue(next, team, profile, profile.anticipate);
    }, 0);

    return { command, value };
  });

  deep.sort(order);
  return [...deep, ...shallow.slice(breadth)];
}

/**
 * Choose what the solo opponent does with one action.
 *
 * The promoted, grown-up version of the greedy chooser `pnpm play` used to carry
 * inline. It still picks one action at a time — the engine's unit of play is an
 * action, not a turn — but it now looks at what its *next* action could be
 * before committing to this one, which is what turns "shuffle the ball forward"
 * into "walk a defender across and then tackle".
 *
 * **It holds no rules.** Every option comes from `legalActions`, every outcome
 * from `applyAction`, and every duel's odds from `previewDuel` — the same three
 * doors a human player uses. What it adds is an opinion about which resulting
 * board it would rather be looking at.
 *
 * **It is deterministic.** No randomness, and every tie broken on a stable key,
 * so the same board always produces the same move. That is what lets a solo
 * match be reproduced from its seed the same way a hotseat one is: the seed
 * fixes the dice, and this fixes the opponent.
 *
 * @param state - The board to act on. Not modified.
 * @param options - How hard to try. See {@link PROFILES}.
 * @returns A command the engine will accept, or an end-turn when nothing is left.
 *
 * @example
 * ```ts
 * const command = chooseCommand(state, { difficulty: "pro" });
 * const result = applyAction(state, command, rng);
 * ```
 */
export function chooseCommand(state: MatchState, options: ChooseOptions = {}): MatchCommand {
  const profile = PROFILES[options.difficulty ?? "pro"];
  const team = state.activeTeam;

  const rated = rateAll(
    state,
    team,
    profile.lookahead,
    breadthFor(profile, state),
    profile,
    options.variety,
  );
  const best = rated[0];

  return best?.command ?? { type: "endTurn", team };
}
