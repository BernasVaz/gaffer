# CLAUDE.md — working contract for Gaffer

Gaffer is a turn-based, web-first football game. `gaffer` is a codename; the real
name is not chosen yet, so avoid baking product naming into identifiers.

The full contract is [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md). This file is the
distilled, enforceable version. Where the two disagree, the Master Plan wins — and
that disagreement is a bug in this file, so fix it here.

## The five principles

Every decision serves these. When a choice is unclear, pick the option that best
honours them.

1. **The game rules are a pure, deterministic engine.** All game logic lives in
   `@gaffer/engine`, framework-free. Same input → same output, always.
2. **Engine, rendering, and networking stay separate.** The web client draws the
   engine; the server runs the _same_ engine as referee. Never mix them.
3. **Docs and tests are part of "done."** Code without a test or a doc-comment is
   unfinished.
4. **Small, reversible steps.** Small commits on a branch, CI-reviewed, merged green.
   `main` always works.
5. **Decisions get written down** as ADRs and GDD entries, so they are not
   re-litigated later.

## Architecture boundaries (the rules that matter most)

- `packages/engine` — pure deterministic rules. **May not import** React, DOM APIs,
  Node built-ins, network code, or anything from `apps/`. No `Math.random()`, no
  `Date.now()`, no I/O. Randomness comes only from an injected seeded RNG; time comes
  only from explicit inputs. This is what makes replays and cheat-proof multiplayer
  possible.
- `packages/shared` — Zod schemas, shared types and constants. Imported by everything;
  imports nothing from `engine` or `apps/`. Also holds `FORMAT_PROFILES`: the game types
  (5v5, 7v7, 11v11) as data — a board, a line-up, and the numbers that scale with them.
  **No rule reads a format**; `createInitialState({ format })` is the only thing that
  does, and the scale-sensitive numbers travel on `state.rules` (ADR 0012).
- `packages/ai` — the solo opponent. A **consumer** of the engine, not part of it: it may
  read `legalActions`/`previewDuel` and advance boards through `applyAction`, and may not
  contain a rule of its own. It explores outcomes with a rigged scratch `Rng` so it never
  spends the match's dice, and it is deterministic so a solo match replays from its seed.
- `apps/web` — Vite + React + Tailwind. Renders engine state via DOM + CSS-grid, not
  canvas. Holds no game rules. Unlike every other package it uses **Bundler** module
  resolution, so relative imports there carry no `.js` extension.
- **No `apps/server`.** Multiplayer is **asynchronous on Supabase**, not a Colyseus
  server (ADR 0028). Phase 1 stores a command log per match and lets row-level security
  decide who may append; Phase 2 runs the engine as referee in an edge function. Neither
  is a service of ours, and neither holds a game rule.

Dependency direction is one-way: `shared` ← `engine` ← `{ apps, ai, tools }`. Never the
reverse.

## Language and style

- **TypeScript strict everywhere.** All packages extend `tsconfig.base.json`
  (`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`).
  Do not weaken these per-package. Do not use `any`; prefer `unknown` plus narrowing.
  `@ts-expect-error` needs a comment explaining why, and never appears in `engine`.
- **ESM only.** Every package is `"type": "module"`.
- **Module resolution is `NodeNext`**, so relative imports carry a `.js` extension
  even though the source is `.ts` — `import { x } from "./thing.js"`. This looks odd
  but is required; it lets the same build run under plain Node for the server.
- **Type-only imports are explicit:** `import type { Foo } from "..."`.
- Formatting and linting are machine-enforced — run `pnpm format` and `pnpm lint`
  rather than hand-adjusting style.

## Validation

Zod schemas in `@gaffer/shared` guard **every** boundary: network messages, database
rows, URL/seed params, persisted saves. Parse at the edge, then trust the type inside.
Derive TypeScript types from schemas (`z.infer`) rather than declaring them twice.

## Testing

Four layers, per the Master Plan §7:

1. **Unit (Vitest)** — the bulk. Every engine rule: given this state and action,
   assert the next state.
2. **Property-based (fast-check)** — engine invariants across random command
   sequences through `applyAction`: one piece per cell, the ball on its carrier,
   score never decreasing, `turn` never past the cap, a decided match always
   naming a winner, and everything `legalActions` offers being accepted. See
   `packages/engine/tests/properties.test.ts`.
3. **Component (Testing Library)** — React UI, from M3.
4. **E2E (Playwright)** — a real browser against the **built** app (`apps/web/e2e/`,
   `pnpm --filter @gaffer/web test:e2e`). Its own CI job. Locate by role and accessible
   name only, and never assert on a transient state — assert what it did.

Rules:

- Engine coverage floor is **90%+ lines**, enforced by `@vitest/coverage-v8` in
  `packages/engine/vitest.config.ts`. `pnpm test` fails below it, so CI does too.
  UI stays lighter.
- The **determinism replay test is mandatory**: a saved seed + move log must always
  replay to a byte-identical final state. Never skip or weaken it.
- Engine work is **test-first** — write the test from the GDD, then the code.
- Tests live in `tests/` beside the package `src/`.

## Documentation

- **Every exported** function, type, and module gets a TSDoc `/** ... */` comment
  covering _what_ and _why_. If someone would ask "why does this exist?", the answer
  belongs in the comment. TypeDoc generates the API site from these, and
  `pnpm run docs` **fails** on an undocumented export or a broken `{@link}` — so this
  is enforced, not optional. Do not silence it by deleting the export from the
  barrel; write the comment.
- **`docs/GDD.md`** is the source of truth for game rules. The engine is built and
  tested against it; when the two disagree, one of them is a bug — decide which and
  fix it, don't paper over it.
- **`docs/adr/NNNN-title.md`** records each real architectural decision (context,
  decision, consequences). Numbered and dated. **Never edit an accepted ADR** —
  supersede it with a new one.
- **`docs/engineering.md`** holds conventions; `CHANGELOG.md` is generated by
  Changesets, never hand-written.

## Git workflow

- **Conventional Commits**, enforced by commitlint on the `commit-msg` hook:
  `feat:` `fix:` `test:` `chore:` `docs:` `refactor:` (also `ci:` `build:` `perf:`
  `style:` `revert:`). A malformed message is rejected, not warned about.
- Work on a branch; `main` stays green. CI runs typecheck → lint → test → build →
  doc coverage on every push and PR, and must pass before merge.
- Husky + lint-staged format and lint **staged files only** on the `pre-commit` hook.
- A `pre-push` hook runs the full suite before any push to `main` and blocks it if red;
  other branches are not gated. **Branch protection on `main` is also live** now the repo
  is public: both CI jobs must be green, the branch must be up to date, history stays
  linear, and `main` cannot be force-pushed or deleted (ADR 0010, superseding ADR 0002).
- **Do not use `--no-verify`** to get around a failing hook. Fix the cause. The one
  exception is a genuine emergency, and CI will catch it anyway.
- Behaviour changes need a changeset (`pnpm changeset`). Tooling-only changes do not.
  Never hand-edit `CHANGELOG.md` or a package `version` — Changesets owns both.
- Do not commit secrets. `.env` files are gitignored; the Supabase service-role key is
  server-only and never reaches the client bundle.

## Commands

Run from the repo root:

| Command          | What it does                            |
| ---------------- | --------------------------------------- |
| `pnpm install`   | install all workspace dependencies      |
| `pnpm build`     | build every package (Turborepo, cached) |
| `pnpm test`      | run all tests                           |
| `pnpm lint`      | ESLint across the monorepo              |
| `pnpm typecheck` | TypeScript with no emit                 |
| `pnpm run docs`  | generate the TypeDoc API site           |
| `pnpm format`    | Prettier write                          |

`docs` requires the explicit `run` — pnpm reserves the bare `pnpm docs` for a
built-in command of its own.

Use **pnpm** — never `npm` or `yarn`. Node comes from fnm; the version is pinned in
`.node-version`.

## Working with me

- Explain in plain language: Bernardo is new to this stack and is building competence,
  not just collecting output.
- Ask one focused question rather than guessing when genuinely unsure — but make
  routine calls independently.
- Prefer small, reviewable changes over large sweeping ones.
- Current status: **M2 complete, M3 in progress.** The engine plays a full match and the
  client is playable hotseat with motion and a goal moment. `@gaffer/ai` provides the solo
  opponent, and the v1.6 balance (ADR 0007) was settled by self-play through it.
  The client has a setup screen and plays both hotseat and solo, with the whole
  setup carried in the URL so a link _is_ a match. `pnpm dev` serves the client;
  `pnpm play` watches one match; `pnpm play -- --matches 150` is the balance run.
  M3 is complete, and a multi-format alpha ships on top of it: three game types, chosen
  before kickoff and carried in the link, with 7v7 and 11v11 marked alpha (ADR 0013).
  `pnpm play -- --format 11v11 --matches 50` is the balance run for one.
  Next is M4: **asynchronous multiplayer on Supabase** (ADR 0028), built behind
  `ASYNC_MULTIPLAYER = false` so the alpha build is untouched.
