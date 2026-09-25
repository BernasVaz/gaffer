# 0028 — Asynchronous multiplayer is Supabase, not Colyseus

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** the M4 direction in `CLAUDE.md`, `README.md`, `docs/engineering.md`, and
  the aside in ADR 0009 — all of which describe `apps/server` as a Colyseus server running
  the engine as authoritative referee.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

The plan of record since M1 was a **Colyseus** server: a real-time, connected, authoritative
referee running the same engine. Four documents still say so.

That was designed for a game played in one sitting by two people with the page open. It is
the wrong shape for the game we have. Gaffer is turn-based with perfect information, a
match is 50–190 actions, and the thing people actually want is to play a friend over a
couple of days on a phone — which is **asynchronous**, not real-time.

Colyseus would give us a persistent connection, room state and presence, and we would use
none of it. It also asks for a server we run, scale and keep up, when the payload is a
~4 KB JSON array that changes one element at a time.

## Decision

**Asynchronous multiplayer on Supabase, climbing a trust ladder** (see
`docs/plans/async-multiplayer.md`):

- **Phase 1** — trust-based. Postgres holds one row per match; row-level security enforces
  who may append and when; a per-turn state hash detects divergence. **The server does not
  run the engine.**
- **Phase 2** — authoritative. An edge function runs `applyAction` before accepting an
  append.

**`apps/server` is not created.** There is no server of ours in Phase 1, and Phase 2's
referee is an edge function deployed beside the database, not a service.

**Colyseus is dropped**, not deferred. If real-time play is ever wanted it is a separate
decision with separate evidence, and it does not follow from this one.

## Consequences

**The tester-facing build does not change.** All of this sits behind
`ASYNC_MULTIPLAYER = false`, a build-time constant so the bundler drops it entirely —
the online code is absent from the alpha bundle, not merely hidden in it.
`alpha-freeze-2` stays what testers hit.

**No engine change, and no rules edition bump.** Multiplayer changes no rule. That is the
whole reason this layer can be built during a freeze: it is rules-independent, so it
cannot move a number a tester is reporting on.

**Phase 2 is cheap because of a rule we already keep.** `@gaffer/engine` is pure,
framework-free, ESM, with no DOM, no Node built-ins, no clock and no unseeded randomness.
That constraint was written for determinism and replay; it happens to be exactly the shape
a Deno edge function wants. The referee will be the same build the client runs.

**Four documents are now wrong and are corrected in this change.** Leaving them would mean
the next person reads `CLAUDE.md` and builds a Colyseus server.

**What is given up.** Live play — two people watching the same board move in real time — is
off the table until somebody asks for it with evidence. For a turn-based game with perfect
information and no clock, that is a feature, not a loss: there is nothing to watch between
turns.
