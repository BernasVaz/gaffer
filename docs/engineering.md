# Engineering conventions

How we build Gaffer. This is the human-readable companion to
[`CLAUDE.md`](../CLAUDE.md) — same rules, aimed at a person rather than an AI pair.
If you change one, change the other.

## Repository layout

```
gaffer/
├── apps/
│   ├── web/          Vite + React client        (added in M3)
│   └── server/       Colyseus server            (added in M4)
├── packages/
│   ├── engine/       pure deterministic rules   ← the game
│   └── shared/       Zod schemas, types, constants
└── docs/
    ├── GDD.md        the rules, in plain language
    ├── adr/          architecture decision records
    └── engineering.md
```

Dependencies flow one way only: `shared` ← `engine` ← `apps`. Nothing in `packages/`
may ever import from `apps/`.

## The engine is sacred

`packages/engine` contains the rules and nothing else. It may not import React, the
DOM, Node built-ins, or any networking code. It may not call `Math.random()` or read
the clock — randomness arrives as an injected seeded RNG, and time arrives as an
explicit input.

This is enforced by ESLint (see `eslint.config.js`), so a violation fails CI rather
than quietly shipping. The payoff is that a match can be replayed exactly from a seed
and a move log, which in turn is what makes cheat-resistant multiplayer possible.

## TypeScript

Every package extends `tsconfig.base.json`. Do not weaken its strictness locally.

Each package has two configs, which is worth understanding:

- `tsconfig.json` — covers `src/` **and** `tests/`, emits nothing. This is what your
  editor and `pnpm typecheck` use.
- `tsconfig.build.json` — covers `src/` only, emits to `dist/`. This is what
  `pnpm build` uses, so tests never end up in the published output.

Because module resolution is `NodeNext`, **relative imports need a `.js` extension**
even though the file on disk is `.ts`:

```ts
import { createRng } from "./rng.js"; // ← yes, .js, pointing at rng.ts
```

This looks wrong the first time you see it. It is correct: TypeScript is describing
the file that will exist after compiling, and it is what lets the same build run
under plain Node for the multiplayer server.

## Validation

Zod schemas live in `@gaffer/shared` and guard every boundary where data we did not
create enters the system: network messages, database rows, URL parameters, saved
matches. Parse at the edge; trust the type inside. Derive types with `z.infer` rather
than writing them twice.

## Testing

Four layers, per Master Plan §7: unit (Vitest), property-based (fast-check),
component (Testing Library), end-to-end (Playwright).

- Engine work is **test-first** — write the test from the GDD, then the code.
- Engine coverage floor is **90%+ lines**. UI is lighter.
- The **determinism replay test is mandatory** and must never be weakened: a saved
  seed plus move log always replays to an identical final state. That single test
  protects the entire engine.
- Tests live in `tests/` alongside each package's `src/`.

## Documentation

Every exported function, type, and module carries a TSDoc `/** ... */` comment saying
_what_ it is and _why_ it exists. TypeDoc generates the API reference from these.

Real architectural decisions become numbered ADRs in `docs/adr/`. An accepted ADR is
never edited — if the decision changes, write a new ADR that supersedes it. The
history of why matters as much as the current answer.

## Git

- **Conventional Commits:** `feat:` `fix:` `test:` `chore:` `docs:` `refactor:`
  This is what allows Changesets to generate the changelog automatically.
- Work on a branch. `main` always works.
- Small, reversible commits over large ones.
- Never commit secrets. `.env` is gitignored; the Supabase service-role key is
  server-side only.

## Commands

All run from the repo root:

| Command          | Does                                     |
| ---------------- | ---------------------------------------- |
| `pnpm install`   | install everything                       |
| `pnpm build`     | build all packages (cached by Turborepo) |
| `pnpm test`      | run all tests                            |
| `pnpm lint`      | lint                                     |
| `pnpm typecheck` | typecheck                                |
| `pnpm check`     | all four — what CI runs                  |
| `pnpm format`    | format with Prettier                     |

Use pnpm, never npm or yarn. Node is pinned in `.node-version`; fnm picks it up
automatically when you `cd` into the repo.
