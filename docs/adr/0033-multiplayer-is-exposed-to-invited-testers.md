# 0033 — Multiplayer is exposed to invited testers, and rules changes wait for a wave boundary

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** the "parked until the rules settle" sequencing in
  `docs/plans/async-multiplayer.md`.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

The plan said async multiplayer should wait until the rules stopped moving, for a reason
that has not gone away: **a rules change ends every match in flight.** A stored command log
reproduces a match only against the rules that produced it (ADR 0022), and a match caught
by an edition bump is sealed rather than migrated (ADR 0029) — because the alternative is
silently replaying somebody's game into a different one.

That argued for building multiplayer after the alpha. It has been built during it, behind a
flag, because it is **rules-independent**: it stores a command log and decides who may
append to it, and touches no rule. The thing the plan was protecting against was never the
code — it was the exposure.

Wave 1 is the moment to decide whether to expose it, and the answer changes the sequencing
rather than the risk.

## Decision

**Phase 1 multiplayer is exposed to invited testers from Wave 1.** Trust-based, with
row-level security, the append-only trigger and per-turn state hashes (ADR 0029). **No
Phase 2 gate**; public matchmaking and anything ranked stay shut.

**And the rule that makes that safe: engine-edition bumps are batched to wave boundaries.**

A rules change lands on `main` whenever it is ready and waits there. It reaches testers
only when a freeze is cut between waves — which is already how the deploy works, since the
live site is pinned to an `alpha-freeze-*` tag rather than to `main`. What this ADR adds is
that **the seal a bump causes is now somebody's actual match**, so the timing is a product
decision rather than a release detail.

Concretely:

- **Never mid-wave.** A bump while people are playing seals matches in flight, and a tester
  whose game died overnight for reasons nobody explained is a tester who stops playing.
- **Batched.** Several rules changes ride one bump. The cost of a bump is the matches it
  ends, and that cost is per bump rather than per change — so four changes in one edition
  cost a quarter of what four editions cost.
- **The seal must read as a decision, not a fault.** The message says the match was played
  under an older edition, that it can be read but not continued, and why: a rules change
  ends a match in flight rather than quietly turning it into a different one.

## Consequences

**Wave 1 plays multiplayer, which is the point.** Two people, a link, turns taken over a
couple of days on a phone — the thing the game is for, and the thing no amount of self-play
could evaluate.

**Rules work does not stop; it queues.** Everything in `post-alpha.md` still lands on
`main` when it is ready. What changes is that shipping it to testers now has a scheduled
moment instead of being the same event as merging it.

**The freeze tag carries more weight than it did.** It was "the build testers play"; it is
now also "the rules edition their matches are pinned to". Cutting one ends every match
still open from the previous wave — so a wave boundary means telling people to finish, not
just tagging.

**The exposure is invited, and the controls are sized for that.** Names are checked in the
client (ADR 0031); match creation is capped in the database (ADR 0032); CAPTCHA and
per-invite tokens are documented, ready, and gated on public linkability rather than on a
date. The honest summary: an invited alpha's real access control is the invitation, and
every technical control here is sized to bound accidents and casual mischief rather than
to stop an adversary.

**If an edition bump becomes urgent mid-wave** — a rule that makes matches unplayable — the
policy loses to the bug. Say so to testers, cut the freeze, and accept the seals. That is a
judgement, and writing the default down is what makes the exception visible as one.
