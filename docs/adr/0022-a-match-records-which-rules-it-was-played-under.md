# 0022 — A match records which rules it was played under

- **Status:** Accepted
- **Date:** 2026-09-23
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

A seed and a command log reproduce a match exactly. That is the property everything
here is built on: the feedback archive stores `{ setup, log }` and rebuilds the board,
a report carries the same two things so somebody else can, and the async multiplayer
plan rests on the payload being nothing but those.

It holds **only against the rules that produced them**. Determinism guarantees the same
inputs give the same board; it guarantees nothing once the rules move.

Two ways that goes wrong, and the second is the dangerous one:

- **It stops replaying.** ADR 0018 made a kickoff a pass, so every log written before it
  opens with an action the engine now refuses. Loud, and `buildMatch` already stops at
  the first refusal.
- **It replays to a different board, silently.** ADR 0021 changed what a won dribble
  does. A log written before it still replays start to finish — to a match that never
  happened. A flagged moment then points at a board nobody ever saw, which is worse than
  an error, because nothing tells you.

The rules have changed three times in two sessions. Testers have matches saved on their
devices from across that.

## Decision

**`RULES_VERSION` in `@gaffer/shared`, and anything that stores a match stores it.**
A single integer naming the edition of the rules a match was played under.

**It is bumped in the same commit as any change to what `applyAction` accepts or what it
produces** — enumeration, resolution, duel odds, the turn economy, the formats' numbers.
If a replay could come out differently, it is a bump. Presentation, the opponent and
anything in `apps/` are not.

**Absent means "cannot be placed", not "older".** Entries saved before this existed keep
loading — the notes are the point, and discarding somebody's feedback to tidy a schema
would be the worst possible trade — and the archive says plainly that it cannot vouch for
replaying them. A match saved five minutes before the field shipped is not older than
the current rules, and guessing would be a lie told confidently.

**Four standings, not a boolean.** `current`, `older`, `newer`, `unknown`. Somebody
looking at their own feedback and wondering whether to trust it needs different words for
"this predates a rules change" and "we have no idea".

**The archive shows it, and never hides the match.** A row played under older rules
carries a line saying the notes hold but a replay will not reproduce the board they
describe. Report and export still work.

**The report carries the edition**, so a match handed to somebody else can be placed by
whoever receives it.

## Consequences

The version is stamped on **write**, so every match saved from now on is placed. The ones
already on testers' devices are `unknown` forever, which is the honest answer.

This is deliberately not a migration. There is nothing to migrate to — an old log cannot
be rewritten into a new-rules log, because the moves a player would have made under the
new rules are not recoverable from the ones they made under the old.

**On semver for the engine package.** Asked for alongside this, and it is a different
thing: package versions are about publishing and are owned by Changesets (CLAUDE.md
forbids hand-editing them), while every package here is `private: true` and never
published. A package version would say nothing about whether two matches are the same
game. `RULES_VERSION` is the thing that protects a replay, so that is what this builds.
Cutting a real semver release is a `pnpm changeset version` away whenever there is a
reason to publish, and nothing here blocks it.

**It unblocks async multiplayer**, which needs exactly this: a stored match that can be
refused, or flagged, when the server and the client disagree about what the rules are.

## Alternatives considered

**Refusing to load an old match outright.** The plan doc's original phrasing. Rejected:
the notes are the valuable part of a stored match and they are still true. Refusing would
throw away the feedback to protect a replay nobody had asked for yet.

**Versioning by hashing the rules.** Automatic, and unreadable — "your match was played
under `a3f9c1`" helps nobody, and the hash would churn on refactors that change no
behaviour.

**Putting the edition in the match link.** Considered and deferred. It would make every
shared link longer for a property that only matters once a link is _stored_, and the link
format is load-bearing for sharing. Worth revisiting when async multiplayer lands, since
that is when a link becomes a durable record rather than an invitation.
