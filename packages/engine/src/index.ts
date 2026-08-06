/**
 * `@gaffer/engine` — the pure, deterministic rules of Gaffer.
 *
 * This package is the heart of the game and the referee for online play. It is
 * framework-free by construction: no DOM, no React, no Node built-ins, no network,
 * no filesystem, no clock, and no unseeded randomness. Given the same state and the
 * same action it always produces the same next state.
 *
 * That constraint is enforced by ESLint, not just convention — see `eslint.config.js`.
 * It is what makes the engine fully testable without a browser, lets a match replay
 * exactly from a seed and move log, and allows the server to re-verify every move a
 * client claims to have made.
 *
 * Currently a scaffold: only the seeded RNG exists. The rules themselves arrive in
 * M2, written test-first against `docs/GDD.md`.
 *
 * @packageDocumentation
 */

export { createRng, type Rng } from "./rng.js";
