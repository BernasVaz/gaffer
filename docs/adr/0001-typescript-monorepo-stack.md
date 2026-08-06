# 0001 — TypeScript monorepo with a pure engine, not a native game engine

- **Status:** Accepted
- **Date:** 2026-08-07
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Gaffer is a turn-based football game intended to be web-first, shareable by URL, and
eventually online-multiplayer and mobile. It is the first serious software project on
a fresh machine, built largely in partnership with an AI pair.

The board is a grid and the game is turn-based, so the rendering demands are modest.
The hard problems are elsewhere: the rules must be trustworthy, matches must be
reproducible, and an online opponent must not be able to cheat.

Two broad options were considered:

1. A native game engine (Godot or Unity) for the client, with a separate backend.
2. A TypeScript monorepo, with the game rules isolated in one framework-free package
   used by both the client and the server.

## Decision

We build a **pnpm + Turborepo monorepo in strict TypeScript**, structured around a
**pure, deterministic rules engine** (`@gaffer/engine`) that has no knowledge of
rendering, networking, or storage.

The stack is:

| Layer        | Choice                                                     |
| ------------ | ---------------------------------------------------------- |
| Language     | TypeScript (strict)                                        |
| Monorepo     | pnpm workspaces + Turborepo                                |
| Rules engine | Pure TypeScript, seeded RNG, no I/O                        |
| Contracts    | Zod at every trust boundary                                |
| Web client   | Vite + React, DOM + CSS-grid (not canvas)                  |
| Styling      | Tailwind CSS                                               |
| Multiplayer  | Colyseus, running the same engine as authoritative referee |
| Backend      | Supabase (Postgres, Auth, Storage)                         |
| Mobile       | Capacitor, wrapping the web build                          |
| Testing      | Vitest, Testing Library, fast-check, Playwright            |
| CI/CD        | GitHub Actions → Vercel                                    |

## Rationale

- **One language, one engine, two consumers.** The client draws the engine's state;
  the server runs the identical engine as referee. There is no second implementation
  of the rules to drift out of sync, and no rewrite required to add multiplayer.
- **Determinism is the foundation.** A seeded, side-effect-free engine gives us
  replays, shareable match URLs, and server-side verification of client moves for
  free. This is the property everything else is built on.
- **DOM beats canvas here.** For a turn-based grid, plain DOM with CSS-grid is
  simpler, lighter, and far more accessible than Phaser or a canvas renderer.
- **A native engine would cost more than it gives.** Godot or Unity would mean a
  second language, no code-sharing between client and server, a full rewrite to add
  authoritative multiplayer, and a much heavier path to "playable from a link."

## Consequences

**Positive**

- Game rules are testable in milliseconds with no browser and no server.
- Client and server provably share one rulebook.
- Sharing a build is a URL, which makes early feedback cheap.

**Negative / accepted costs**

- Rich animation is harder than in a purpose-built game engine. Accepted: this game
  is turn-based and grid-shaped.
- Monorepo tooling has real setup cost up front, paid once.
- The engine's purity constraints (no clock, no `Math.random`, no I/O) are a
  discipline that must be actively maintained. Mitigated by enforcing them in
  ESLint rather than relying on memory.

**Revisit if**

- The art direction becomes genuinely animation-heavy, in which case Pixi.js can be
  added _inside_ the existing web client without touching the engine.
- We hit a rendering ceiling the web genuinely cannot clear — a high bar, and not
  one a turn-based grid game is likely to reach.
