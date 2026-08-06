/**
 * `@gaffer/shared` — the contracts every other package agrees on.
 *
 * Zod schemas, the types derived from them, and shared constants. This package
 * sits at the bottom of the dependency graph: everything may import it, and it
 * imports nothing of ours. Anything crossing a trust boundary — network message,
 * database row, URL parameter, saved match — is validated by a schema declared here.
 *
 * @packageDocumentation
 */

export { SeedSchema, parseSeed, type Seed } from "./seed.js";
