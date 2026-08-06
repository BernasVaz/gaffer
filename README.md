# Gaffer

A turn-based, web-first football game built on a pure, deterministic TypeScript engine.

> `gaffer` is a codename — a stable handle for the repo and packages until the real
> name is chosen. Renaming later is a short job, so it is not blocking anything.

**Status:** Phase 2 complete — the monorepo scaffold builds, lints, tests, and
typechecks. No game code yet. Next up is [M1: the Game Design Document](docs/GDD.md).

## What's here

| Package                              | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| [`packages/engine`](packages/engine) | The rules of the game. Pure, deterministic, framework-free. |
| [`packages/shared`](packages/shared) | Zod schemas, shared types and constants.                    |
| `apps/web`                           | Vite + React client — arrives in M3.                        |
| `apps/server`                        | Colyseus multiplayer server — arrives in M4.                |

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
| `pnpm format`    | Format with Prettier                     |

## Documentation

- **[Master Plan](docs/MASTER_PLAN.md)** — the full roadmap and its reasoning.
- **[GDD](docs/GDD.md)** — the rules of the game. The engine is tested against it.
- **[Engineering conventions](docs/engineering.md)** — how we build.
- **[ADRs](docs/adr)** — why the architecture is the way it is.
- **[CONTRIBUTING](CONTRIBUTING.md)** — branch, commit, and PR rules.
- **[CLAUDE.md](CLAUDE.md)** — the working contract for the AI pair.

## License

Private and unlicensed for now.
