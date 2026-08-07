# Gaffer

[![CI](https://github.com/BernasVaz/gaffer/actions/workflows/ci.yml/badge.svg)](https://github.com/BernasVaz/gaffer/actions/workflows/ci.yml)

A turn-based, web-first football game built on a pure, deterministic TypeScript engine.

> `gaffer` is a codename — a stable handle for the repo and packages until the real
> name is chosen. Renaming later is a short job, so it is not blocking anything.

**Status:** **M2 complete** — the engine plays a full match, from the kickoff formation
through legal actions, duels, the turn economy and the win condition, to a decided
result. Watch one with `pnpm play`. Next up is **M3**, the shareable web prototype.

## What's here

| Package                              | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| [`packages/engine`](packages/engine) | The rules of the game. Pure, deterministic, framework-free. |
| [`packages/shared`](packages/shared) | Zod schemas, shared types and constants.                    |
| `apps/web`                           | Vite + React client — arrives in M3.                        |
| `apps/server`                        | Colyseus multiplayer server — arrives in M4.                |
| [`tools/play`](tools/play)           | Dev-only match viewer. Never shipped.                       |

The engine knows nothing about rendering or networking. The web client draws its
state; the multiplayer server runs the same engine as an authoritative referee. One
rulebook, two consumers, no drift.

## Getting started

Requires [Node](https://nodejs.org) 24+ (via [fnm](https://github.com/Schniz/fnm),
pinned in `.node-version`) and [pnpm](https://pnpm.io) via corepack.

```bash
pnpm install
pnpm check      # build + lint + test + typecheck
```

## Scripts

| Command          | Does                                     |
| ---------------- | ---------------------------------------- |
| `pnpm build`     | Build all packages (cached by Turborepo) |
| `pnpm test`      | Run all tests                            |
| `pnpm lint`      | Lint the monorepo                        |
| `pnpm typecheck` | Typecheck without emitting               |
| `pnpm check`     | All of the above — what CI runs          |
| `pnpm run docs`  | Generate the API site into `docs/api`    |
| `pnpm format`    | Format with Prettier                     |
| `pnpm changeset` | Describe a change for the changelog      |
| `pnpm play`      | Watch a full match play out (dev only)   |

### Watching a match

`pnpm play` runs a whole match through the engine and prints it turn by turn — the
board, every action, every duel with the odds that were shown before the dice, and the
final result. It exists so a design question can be _seen_ rather than inferred from
test names.

```bash
pnpm play                                # seed 1, keepers as designed
pnpm play -- --seed 42                   # a different match
pnpm play -- --seed 42 --keeper-def 4    # the same match with weaker keepers
pnpm play -- --seed 42 --quiet           # result only
```

`--keeper-def` overrides the keepers' DEF **for that run only**. It edits the state the
engine is handed and never the locked role table, so it is a way to eyeball a balance
question — see the watch-list in [GDD §13](docs/GDD.md) — without pre-empting the answer.

The tool lives in `tools/play` and is never shipped.

> `docs` needs the explicit `run` — pnpm reserves the bare `pnpm docs` for its own
> built-in command. Every other script works with or without it.

## Quality gates

Three layers, so mistakes are caught as early as possible:

1. **On commit** — Husky runs [lint-staged](https://github.com/lint-staged/lint-staged),
   which formats and lints only the files you staged. Unfixable lint errors abort the
   commit. commitlint then checks the message against Conventional Commits.
2. **On push to `main`** — a `pre-push` hook runs the full suite and refuses the push
   if anything is red. Feature branches push freely.
3. **On push and PR** — GitHub Actions runs typecheck → lint → test → build → doc
   coverage. `main` is only ever green.
4. **On release** — [Changesets](https://github.com/changesets/changesets) turns the
   changes you describe into version bumps and `CHANGELOG.md`.

To bypass a hook in a genuine emergency: `--no-verify` on `git commit` or `git push`.
CI still runs, so this defers a check rather than skipping it.

> The `pre-push` hook substitutes for GitHub branch protection, which needs GitHub Pro
> on a private repo. See
> [ADR 0002](docs/adr/0002-local-pre-push-gate-instead-of-branch-protection.md).

## Documentation

Three layers, each with a different job:

**Generated from the code** — every exported symbol carries a TSDoc comment, and
[TypeDoc](https://typedoc.org) turns those into a browsable API site:

```bash
pnpm run docs && open docs/api/index.html
```

The site is generated, not committed. An exported symbol with no doc-comment, or a
broken `{@link}`, fails the command — documentation coverage is enforced, not hoped for.

**Written by hand:**

- **[Master Plan](docs/MASTER_PLAN.md)** — the full roadmap and its reasoning.
- **[GDD](docs/GDD.md)** — the rules of the game. The engine is tested against it.
- **[Engineering conventions](docs/engineering.md)** — how we build.
- **[ADRs](docs/adr)** — why the architecture is the way it is, decision by decision.
- **[CONTRIBUTING](CONTRIBUTING.md)** — branch, commit, and PR rules.
- **[CLAUDE.md](CLAUDE.md)** — the working contract for the AI pair.

**Generated by tooling:** `CHANGELOG.md`, once Changesets lands in Phase 4. Never
hand-written.

## License

Private and unlicensed for now.
