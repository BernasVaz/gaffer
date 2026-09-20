/**
 * `@gaffer/ai` — the solo opponent.
 *
 * A consumer of the engine, never part of it. It reads a board through
 * `legalActions`, asks `previewDuel` what a duel would cost, explores outcomes
 * through `applyAction`, and returns a command — the same three doors a person
 * at the keyboard uses. It contains no rules of its own, so it cannot drift out
 * of step with the referee.
 *
 * It is also **deterministic**: no randomness, and every tie broken on a stable
 * key. A solo match therefore replays from its seed exactly as a hotseat one
 * does, because the seed fixes the dice and the opponent fixes itself.
 *
 * The search runs on a scratch generator of its own (see `branches.ts`), so
 * nothing it considers can disturb the dice of the match being played.
 *
 * The settings it offers — `casual`, `pro`, `elite` — are declared in
 * `@gaffer/shared` rather than here, because a difficulty arrives from outside
 * in a shared match link and so has to be validated like anything else that
 * crosses a boundary. What each one *does* is this package's business.
 *
 * @packageDocumentation
 */

export { outcomesOf, type Outcome } from "./branches.js";
export { evaluateState, shotThreat, WEIGHTS, type EvaluateOptions } from "./evaluate.js";
export { chooseCommand, PROFILES, type ChooseOptions, type OpponentProfile } from "./choose.js";
