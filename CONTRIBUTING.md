# Contributing to Gaffer

## Setup

```bash
pnpm install
pnpm check     # confirm a clean checkout is green before changing anything
```

Node is pinned in `.node-version`; [fnm](https://github.com/Schniz/fnm) switches to it
automatically when you enter the repo. Use **pnpm** — never npm or yarn, which would
produce a competing lockfile.

## The loop

1. Branch off `main`.
2. Make a small change.
3. `pnpm check` locally.
4. If the change affects a package's behaviour, run `pnpm changeset` to describe it.
5. Commit with a [Conventional Commit](#commit-messages) message.
6. Open a PR. CI must be green to merge.

Small and reversible beats large and clever. `main` always works.

## What runs automatically

**When you commit,** two hooks fire (installed by Husky, so they work as soon as you
`pnpm install`):

- `pre-commit` runs lint-staged over your **staged files only** — Prettier formats
  them and ESLint fixes what it can. Anything ESLint cannot fix aborts the commit,
  and your working tree is restored exactly as it was.
- `commit-msg` runs commitlint against your message.

**When you push to `main`,** the `pre-push` hook runs the whole suite — `pnpm check`
plus `pnpm run docs` — and refuses the push if anything fails. Pushing to any other
branch skips this, so branches stay cheap to use.

**When you push or open a PR,** GitHub Actions runs typecheck → lint → test → build →
doc coverage.

In a genuine emergency, `--no-verify` skips hooks on `git commit` or `git push` — but
CI will still catch it, so this buys time rather than an exemption.

## Changesets

Versions and `CHANGELOG.md` are generated, never hand-edited.

When you change how a package behaves, run `pnpm changeset`, pick the package, choose
patch/minor/major, and write one sentence a _user_ of the package would care about.
That produces a small Markdown file in `.changeset/` which you commit alongside your
code. Later, `pnpm changeset:version` consumes those files, bumps versions and writes
the changelog.

Tooling-only changes — CI config, editor settings, dependency bumps that change no
behaviour — do not need a changeset.

## Commit messages

Conventional Commits, enforced by commitlint (from Phase 4):

```
feat: add pass resolution to the engine
fix: prevent two pieces occupying one cell
test: cover the tackle outcome table
docs: write the GDD turn-order section
chore: bump turbo to 2.10.8
refactor: extract the outcome table from resolveAction
```

The prefix is not decoration — Changesets uses it to generate the changelog.

## What "done" means

A change is finished when it has:

- **Tests.** Engine work is test-first, written from `docs/GDD.md`.
- **Docs.** Every exported function, type, and module has a TSDoc comment covering
  what it is and why it exists. `pnpm run docs` fails if one is missing, so this is
  checkable rather than a matter of opinion.
- **A green `pnpm check`.**

Code without a test or a doc-comment is unfinished code, not a follow-up ticket.

## Rules that are not negotiable

- **The engine stays pure.** No DOM, React, Node built-ins, networking, clock, or
  `Math.random()` in `packages/engine`. ESLint enforces this; do not disable the
  rules to get around it.
- **The determinism test never weakens.** A seed plus move log must always replay to
  an identical final state.
- **Validate at every boundary** with Zod schemas from `@gaffer/shared`.
- **No secrets in the repo.** `.env` is gitignored; the Supabase service-role key is
  server-side only.

## Architectural decisions

If you are making a real architectural choice, write an ADR in `docs/adr/` —
context, decision, consequences. Number it sequentially. Accepted ADRs are never
edited; supersede them with a new one instead.
