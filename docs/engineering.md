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
│   ├── ai/           the solo opponent          (added M3)
│   ├── engine/       pure deterministic rules   ← the game
│   └── shared/       Zod schemas, types, constants
└── docs/
    ├── GDD.md        the rules, in plain language
    ├── adr/          architecture decision records
    └── engineering.md
```

Dependencies flow one way only: `shared` ← `engine` ← `{ apps, ai, tools }`. Nothing in
`packages/` may ever import from `apps/`. `ai` is a _consumer_ of the engine, the same as
the client is — it sits in `packages/` only because self-play needs Node rather than a
browser, and because the balance numbers in ADR 0007 came out of running it a few hundred
times.

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
- Engine coverage floor is **90%+ lines**, enforced by `@vitest/coverage-v8` — see
  `packages/engine/vitest.config.ts`. Dropping below it fails `pnpm test`, and so CI.
  UI stays lighter.
- **Property tests** (`fast-check`) drive random command sequences through
  `applyAction` and assert the invariants that hold for every board, whatever route
  it took. They are the layer that finds what example tests do not: they caught
  `legalActions` offering moves on a match that had already been decided.
- The **determinism replay test is mandatory** and must never be weakened: a saved
  seed plus move log always replays to an identical final state. That single test
  protects the entire engine.
- Tests live in `tests/` alongside each package's `src/`.

**End-to-end** (`apps/web/e2e/`, `pnpm --filter @gaffer/web test:e2e`) drives a real
browser against the **built** app, not the dev server — the thing a person with a link
opens is the build, and the build is where the differences are. It is its own CI job
rather than part of `pnpm check`, because it needs a browser download and because a
failure there should read as "the app is broken" rather than hide among unit tests.

Two conventions hold it together:

- **Every locator is a role and an accessible name**, never a class or a test id. That
  is not purity — it means the suite exercises the same surface a screen-reader user
  has, so a change that leaves the board looking fine while making it unusable fails
  here instead of in somebody's lap.
- **Do not assert on something transient.** The opponent's pause is a few hundred
  milliseconds wide; a browser test that tries to catch it mid-thought is a flake
  waiting to happen. Assert what it _did_. The pause itself is pinned in the vitest
  suite, where the clock is under the test's control.

The headline test plays a whole match a click at a time and asserts the engine never
refuses a command the board offered — the two disagreeing about the same position is
precisely the bug this layer exists to catch.

## Documentation

Three layers, each doing a different job.

### 1. Code-level — TSDoc comments, rendered by TypeDoc

Every exported function, type, and module carries a TSDoc `/** ... */` comment saying
_what_ it is and _why_ it exists. If someone would ask "why does this exist?", the
answer belongs in the comment.

```bash
pnpm run docs                    # generates docs/api/
open docs/api/index.html
```

Note the explicit `run`: pnpm reserves the bare `pnpm docs` for a built-in command, so
`pnpm docs` will not work. Every other script is fine either way.

This is **enforced, not encouraged**. `typedoc.base.json` sets `notDocumented`,
`notExported` and `invalidLink` validation with `treatWarningsAsErrors`, so an
exported symbol without a comment fails the command outright. Those settings live in
`typedoc.base.json` (which each package extends) rather than the root `typedoc.json`,
because in TypeDoc's monorepo mode the root config only governs the final merge — the
per-package configs are what actually read your source.

The generated site is **not committed** (`docs/api/` is gitignored). It is a build
artifact; the source of truth is the comments.

### 2. Repo-level — the `docs/` folder

- **`GDD.md`** — the rules of the game in plain language. The engine is built and
  tested against it; when they disagree, one of them is a bug.
- **`adr/NNNN-title.md`** — one short file per real architectural decision, with
  context, the decision, and its consequences. An accepted ADR is **never edited** —
  if the decision changes, write a new ADR that supersedes it. The history of why
  matters as much as the current answer.
- **`engineering.md`** — this file.
- **`MASTER_PLAN.md`** — the roadmap and its reasoning.

### 3. Project-level — README, CONTRIBUTING, CHANGELOG

`README.md` explains what Gaffer is and how to run it; `CONTRIBUTING.md` covers the
branch/commit/PR rules. `CHANGELOG.md` is generated by Changesets from Phase 4 —
never hand-written.

## Git

- **Conventional Commits:** `feat:` `fix:` `test:` `chore:` `docs:` `refactor:`
  This is what allows Changesets to generate the changelog automatically.
- Work on a branch. `main` always works.
- Small, reversible commits over large ones.
- Never commit secrets. `.env` is gitignored; the Supabase service-role key is
  server-side only.

## The opponent holds no rules either

`@gaffer/ai` is subject to the same rule as the client: it draws conclusions from the
engine and never duplicates it. It reads boards with `legalActions`, prices duels with
`previewDuel`, and produces boards with `applyAction` — the same three doors a person uses.

The part worth understanding is how it sees both sides of a duel without rolling the
match's dice. `Rng` is an interface, so the search hands the engine a **rigged scratch
generator**: the attacker's die forced high and the defender's low gives the "attacker
wins" board, and the reverse gives "attacker loses". A duel is decided purely by which
total is larger, so those two branches are exhaustive, and their probabilities come from
`previewDuel`. Nothing the opponent considers touches the generator the match is being
played from — which is why a solo match still replays from its seed.

It is deterministic, and takes an optional `variety` seed that leans _near-equal_ options
one way. The jitter is smaller than any meaningful evaluation difference, so it can only
reorder options the search already rated equal. Two regression tests are worth knowing
about, because both bugs were invisible to unit tests and obvious in self-play:

- **It must have no directional prejudice.** Ties broken on a raw cell coordinate mean
  "forward" to one side and "back" to the other; that alone won away 88% of matches.
  Keys are written in the mover's own frame, and mirroring a board must mirror the choice.
- **It must leave its keeper in its goal.** An evaluation that counts the keeper as a
  passing outlet walks it up the pitch, and a keeper cannot get home in the one action a
  turnover gives it.

## The URL is the match

`apps/web` has two screens and no router, because there is nothing to route: the
query string describes the _match_, not the page. `parseSetup` and `setupToQuery` in
`@gaffer/shared` are the two halves of that contract, and they round-trip.

Two consequences worth knowing:

- **A link with a seed starts the match; a bare visit shows the setup screen.** Being
  sent a match and arriving to play are different intentions, and the URL is the only
  thing that distinguishes them.
- **`parseSetup` never throws and never gives up on a whole link.** Each field falls
  back on its own. Links get typed, pasted, truncated by chat clients and edited out of
  curiosity, and the useful response to `?seed=banana` is a playable match rather than a
  blank page. That is a deliberate exception to "parse at the edge, then reject" — the
  parsing is still total, it just has a default for every field.

## Presentation lags the engine

Feel is part of v1 (GDD §14, ADR 0005) and animation is time, so there has to be a rule
about where time is allowed to live. It is this one:

> **The engine resolves immediately. The view is allowed to be briefly out of date. The
> engine is never allowed to wait.**

A goal is the clearest case. `applyAction` scores it, rebuilds the pitch into the kickoff
formation and passes the turn, all synchronously — so by the time React renders, the
moment worth celebrating has already been erased from the state. The client therefore
keeps its own copy of the outgoing board and shows _that_ for a beat, then drops it and
lets the pieces slide to where the engine already put them.

How to build one of these without putting a timer in the rules:

- **React to a settled result, never produce one.** `play()` returns what the engine
  decided, so a click handler can start a presentation knowing the outcome is already
  final. There is deliberately no "when the animation finishes, apply the result" path —
  that path is how presentation becomes a rule.
- **Hold the view, not the state.** Keep a stale `MatchState` for drawing. Everything
  read rather than looked at — the score, the turn, the status line, every cell's
  accessible name — stays live throughout. A screen-reader user must never be made to
  wait for an effect they cannot perceive.
- **Suspend input, not the engine.** While a beat is running the board offers no actions,
  because it is displaying a position that is no longer true. That is a property of the
  view; the engine has already moved on and would accept a command perfectly well.
- **Give the presentation no way to reach the engine.** `useGoalMoment` is handed a board
  and a team and returns a board and a team. It cannot see `applyAction`, a command, or
  the seeded generator, so no amount of timing can change a result. Prefer that shape to
  a comment promising the same thing.
- **One number, one source.** A duration that drives both a timer and an animation lives
  in TypeScript and is passed to CSS as a custom property, so the two cannot drift.
- **A pause is presentation too.** The solo opponent waits half a second before each
  action, and that is the same rule seen from the other side: a decision costs about four
  milliseconds, and the delay exists so two actions landing at once read as an opponent
  playing rather than as the board rearranging itself. `chooseCommand` is handed a board
  and returns a command; it has no clock, so _when_ it is asked cannot change _what_ it
  answers.

## The look is data

Everything visual is a value somewhere, not a decision spread through components:

- **`src/board/kits.ts`** — every colour a player is drawn in, plus skin and hair per role.
- **`src/index.css` `@theme`** — the turf, the stadium, the panels, the one gold accent.
- **`src/feel.ts`** — every number that decides rhythm (ADR 0005).
- **`src/art/`** — the drawings themselves: `Footballer`, `Football`, `Crest`,
  `PitchMarkings`.

Restyling the game is therefore a small diff rather than an asset pipeline, which matters
because this is the layer most likely to be argued with. Two rules hold it together:

- **The art is a pure function of the board.** No randomness, no state, no clock — the
  same player in the same position always draws identically. The eyes following the ball
  are the clearest case: the ball's position is an input, not an animation.
- **Every instance needs a unique id.** SVG gradient ids are document-global, so two
  players sharing one would bleed into each other. `Footballer` takes an `id` for exactly
  this, and a test asserts the ids are distinct.

See ADR 0008 for why the look is drawn rather than sourced, and where the seam is if that
changes.

## Quality gates

Each layer catches what the previous one is too early or too slow to see.

**On commit** (Husky, `.husky/`) — `pre-commit` runs lint-staged across your staged
files: Prettier formats, ESLint fixes what it can, and anything unfixable aborts the
commit with the working tree restored untouched. `commit-msg` runs commitlint.

Staged-files-only is a deliberate choice: it keeps commits fast as the repo grows, and
means a pre-existing problem elsewhere never blocks unrelated work. Whole-repo
checking is CI's job.

**On push to `main`** (Husky, `.husky/pre-push`) — runs `pnpm check` and
`pnpm run docs` and refuses the push if either fails. Pushes to other branches skip
this entirely; branches are meant to be cheap. It is fast and local, and catches a red
commit before it is pushed rather than after CI reports.

**On merge to `main`** (GitHub branch protection) — both CI jobs must be green, the
branch must be up to date with `main`, history must stay linear, and `main` cannot be
force-pushed or deleted. This is the authoritative gate; the hook above is the fast one,
and the overlap is deliberate. Enabled the day the repository went public, exactly as
ADR 0002 said it should be — see
[ADR 0010](adr/0010-real-branch-protection-now-the-repo-is-public.md) for what is and is
not enforced, and why admins are exempt.

**On push and PR** (`.github/workflows/ci.yml`) — typecheck → lint → test → build →
doc coverage, each as a named step so a failure identifies itself in the GitHub UI
rather than hiding in one long log. `pnpm install --frozen-lockfile` guarantees CI
installs exactly what the lockfile pins.

**On merge to `main`** (`.github/workflows/deploy.yml`) — builds the client and publishes
it to GitHub Pages. There is no manual publish step, because a link that lags `main` by a
deploy somebody forgot to run is a link that misrepresents the game. See
[ADR 0009](adr/0009-ship-on-github-pages-and-keep-vercel-one-import-away.md) for why Pages
rather than Vercel, and how little stands between the two.

The client builds with a **relative base** (`base: "./"` in `vite.config.ts`), which is
what lets one artifact serve correctly from a project subpath _and_ from a domain root.
The consequence worth remembering: anything referenced with an absolute `/…` path works at
a root and silently 404s under a subpath, so assets belong in `src/` where the bundler
rewrites them, not in `public/` where it does not.

**On release** (Changesets, `.changeset/`) — `pnpm changeset` records an intent to
version; `pnpm changeset:version` consumes those records into version bumps and
`CHANGELOG.md`. Because our packages are `private`, `privatePackages.version` is
enabled in `.changeset/config.json` — without it Changesets would skip them entirely.

`git commit --no-verify` bypasses the hooks. It is for emergencies, not for a hook you
find inconvenient; CI runs regardless.

## Commands

All run from the repo root:

| Command                      | Does                                     |
| ---------------------------- | ---------------------------------------- |
| `pnpm install`               | install everything                       |
| `pnpm build`                 | build all packages (cached by Turborepo) |
| `pnpm test`                  | run all tests                            |
| `pnpm lint`                  | lint                                     |
| `pnpm typecheck`             | typecheck                                |
| `pnpm check`                 | all four — what CI runs                  |
| `pnpm format`                | format with Prettier                     |
| `pnpm play`                  | watch one match in the terminal          |
| `pnpm play -- --matches 150` | a balance run: aggregate only            |

Use pnpm, never npm or yarn. Node is pinned in `.node-version`; fnm picks it up
automatically when you `cd` into the repo.
