# 0006 — The solo opponent is a package that reads the engine, not a second rulebook

- **Status:** Accepted
- **Date:** 2026-09-20
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

M3 needs a single-player opponent. Until now the only one was a forty-line greedy
chooser living inside `tools/play`, written so that `pnpm play` would produce a match
with football in it rather than a random walk. It was never meant to be played
against: it ranked actions by how far up the pitch they moved the ball, discounted by
the odds, and looked exactly one action ahead.

Two things had to be decided: **where** a real opponent lives, and **how** it works
out what an action would do.

The second question is the sharp one. To compare two actions the opponent has to know
what board each would produce, and the rules for that live in the engine — behind
`applyAction`, which needs a generator and consumes dice from it. The obvious
shortcuts are both bad:

- **Re-implement the consequences in the AI** ("a won dribble moves the carrier, a lost
  one gives the ball to the defender"). This is a second copy of the rules, which is the
  one thing the architecture exists to prevent. It would drift, and the drift would be
  invisible until the opponent started proposing moves the referee rejected.
- **Let the opponent roll the match's own dice while thinking.** Every option it
  considered and declined would consume randomness, so the match would no longer replay
  from its seed — and replay is what shareable links and a future authoritative server
  are built on.

Where it lives was the easier question, but not free: putting it in `apps/web` would
have made it unreachable from `tools/play`, and so untestable at the only scale that
tells you anything about an opponent — hundreds of matches.

## Decision

**A new workspace package, `@gaffer/ai`**, sitting alongside the client as a consumer of
the engine. Dependency direction is unchanged: `shared ← engine ← { apps, ai, tools }`.
It contains no rules. It reads boards through `legalActions`, prices duels through
`previewDuel`, and produces boards through `applyAction` — the same three doors a person
at the keyboard uses.

**It explores outcomes by handing the engine a rigged scratch generator.** `Rng` is an
interface, so the search passes one whose dice are decided in advance rather than rolled:
the attacker's die forced to its maximum and the defender's to its minimum produces the
"attacker wins" board, and reversing it produces the "attacker loses" board. A duel is
decided purely by which total is larger, so those two branches are exhaustive. Their
probabilities come from `previewDuel`, which is the same number shown to a human before
they commit.

**It is deterministic**, with ties broken on a stable key, and takes an optional
`variety` seed that leans near-equal options one way or the other. A solo match therefore
replays from its seed exactly as a hotseat one does: the seed fixes the dice, and the
opponent fixes itself.

**Three settings** — `casual`, `pro` (the default), `elite` — differing in how far ahead
they plan, how wide they search, and whether they can see danger at all.

## Rationale

- **The rigged generator is the whole trick.** It gets both sides of a duel out of the
  real rules without copying them and without spending the match's randomness. The
  alternative ways to answer "what would this do?" all end in a second rulebook or a
  broken replay.
- **A package, not a client concern.** Self-play is the only honest way to test an
  opponent or to judge balance, and self-play needs Node, not a browser. Putting it in
  `packages/` made `pnpm play --matches 150` possible, and that command is what produced
  every number in ADR 0007 — including two bugs no unit test would have found.
- **Deterministic, with variety layered on top.** Reproducibility is not negotiable, but
  a chooser that is _only_ deterministic opens every match with the same three moves,
  which reads as a script. A jitter smaller than any meaningful evaluation difference can
  reorder options the search rated equal and can never overrule a better move.
- **Easy mode is blind, not clumsy.** `casual` runs the same search over a smaller idea of
  what matters: it cannot see the danger it leaves behind. That plays like someone who has
  not been punished yet, which is a far better opponent than one that plays well and then
  throws a move away at random.

## Consequences

**Positive**

- The opponent cannot propose an illegal move, because it never forms an opinion about
  legality — a property asserted by playing whole matches in the test suite rather than
  argued for in a comment.
- `pnpm play --matches N` is now a balance instrument, and the same opponent a player
  meets is the one the balance was measured against.
- The difficulty ladder is measurable: over 80 matches against `pro`, `casual` wins 14%,
  `pro` 50%, `elite` 56%.
- A decision costs roughly 4 ms at `pro`, so the client needs no thinking indicator for
  the opponent's sake — any pause it shows is for the player's benefit.

**Negative / accepted costs**

- **The evaluation is an opinion, and opinions can be wrong in expensive ways.** Two of
  its first mistakes cost a day: it priced _having_ a shot nearly as highly as taking one
  and camped in the box, and it counted the keeper as a passing outlet and walked it out of
  goal — after which nine goals in ten went into an empty net. Both are now regression
  tests, but the class of bug is permanent and only self-play finds it.
- **A fourth package to build, lint, typecheck and document.** Modest, and it buys the
  ability to test the opponent at all.
- **No search means no strength ceiling.** `elite` is roughly one ply better than `pro`
  and that is where it stops. A real search — alpha-beta over the opponent's turn, or a
  learned evaluation — is a much larger piece of work and is not what M3 needs.

**Revisit if**

- The opponent needs to be strong rather than competent, at which point the evaluation
  should be fitted to self-play results rather than hand-tuned.
- Multiplayer arrives (M4) and the server wants to drop an opponent into an abandoned
  match. The package is already framework-free, so this should be an import.
- Branch exploration ever needs a third outcome. It does not today — a duel has exactly
  two — but a rule that made an action resolve three ways would silently halve the
  opponent's accuracy rather than failing.
