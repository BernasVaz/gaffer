# 0029 — A match is one row, with an optimistic log and a trigger that guards it

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** the two-table `matches` + `moves` sketch in the first draft of
  `docs/plans/async-multiplayer.md`.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

A Gaffer match reduces to `{ setup, log: MatchCommand[] }` — which is already what the
feedback archive stores and what a report carries. Storing it for two players needs three
things: somewhere to put the log, a rule for who may append, and a way to stop two
appends racing.

## Decision

### One row, with the log as `jsonb`

`public.matches` holds the log inline rather than in a `moves` table. A match is one read,
which is what the client's replay wants anyway; and the row is the `{ setup, log }` shape
the rest of the codebase already speaks.

The honest cost: a 14 KB `jsonb` is rewritten on every append at 11-a-side. At this size
that is nothing, and a `moves` table remains the way out if it ever stops being nothing.

### `log_version` as an optimistic lock

Every write bumps it by exactly one. A client appends with
`where log_version = <what I last saw>`; zero rows updated means somebody moved first, and
the client refetches. A double-tap or a second tab is a no-op rather than a double move.

It guards **any** change to the row, not only appends — claiming the away seat, sealing at
an edition bump, recording a resignation. The `(match_id, index)` primary key it replaces
only ever guarded moves.

### RLS decides _who_; a trigger decides _what_

Row-level security cannot compare a new row against the old one, so on its own it permits
the side to move to rewrite the whole log, change the seed, or move the match to a
different rules edition. None of those are "an illegal command", so **no amount of Phase 2
validation would catch them** — Phase 2 validates commands, not rows.

A `before update` trigger therefore enforces what a write may do:

- `id`, `seed`, `setup`, `engine_edition`, `home_user`, `created_at` are fixed at creation.
- The away seat is claimed once and never traded.
- A `complete` or `sealed` match is read-only.
- `log_version` advances by exactly one.
- The command log may grow but never shrink and never be rewritten.

### Derived columns are a cache, and are labelled one

`turn_number`, `result` and `winner` are recoverable by replaying the log. They are stored
so a lobby can list matches without replaying each one, and they are **never read back into
gameplay**. The log is the truth; the state hash is what catches them drifting from it.

### `seed` is duplicated on purpose

It already lives inside `setup`. It is lifted into its own column so a human can read it in
the dashboard — the client takes its value from `setup`, so there is one source of truth
and the column is a convenience.

### The state hash is the honesty rung

Each append carries a hash of the board the appending client believed it had produced. The
opponent recomputes and compares. Phase 1 cannot tell a legal command from an illegal one,
so a forged-but-legal-looking command gets through — what it **can** do is notice, and say
which command it diverged at.

That is why `buildMatch` no longer stops quietly on a refused command: it now reports the
index and the reason. Locally a refusal is a stale archive; shared, it is the desync, and
"the board just looks wrong" is the least useful thing we could say about one.

## Consequences

**Phase 1 is defensible rather than hopeful.** The system is not trusting and hoping; it is
trusting and checking. A cheat cannot manufacture a win, only break a match — and breaking
one now produces a report naming the command.

**A read is one round trip**, which makes reconnect close to free: the client already
rebuilds a board from `{ seed, format, actionsPerTurn, replay }`.

**The trigger is the piece most likely to be wrong**, because it is the only place in the
system written in a language the rest of the codebase does not use and the type checker
cannot see. It needs policy tests before anybody plays a real match through it.
