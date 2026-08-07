/**
 * `@gaffer/shared` — the contracts every other package agrees on.
 *
 * Zod schemas, the types derived from them, and the balance data the game is
 * tuned with. This package sits at the bottom of the dependency graph:
 * everything may import it, and it imports nothing of ours. Anything crossing a
 * trust boundary — network message, database row, URL parameter, saved match —
 * is validated by a schema declared here.
 *
 * Per GDD §15, every tunable number lives here as data rather than as a literal
 * inside the rules, so balancing the game is an edit to this package, not a
 * change to the engine.
 *
 * @packageDocumentation
 */

export * from "./action.js";
export * from "./formation.js";
export * from "./match.js";
export * from "./pitch.js";
export * from "./player.js";
export * from "./roles.js";
export * from "./seed.js";
export * from "./team.js";
