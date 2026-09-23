# 0020 — The clock counts the phase the match is in

- **Status:** Accepted
- **Date:** 2026-09-23
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

The scoreboard read `Turn 26 of 32` at 5-a-side. 32 is `totalTurns` — the turn cap
**plus** extra time. Extra time only happens when the sides are level at the end of
regulation, so for most matches those last eight turns are a phase they never enter.

A 5-a-side match finishing 2–1 on turn 24 of a 24-turn regulation therefore looked as
though it had stopped eight turns short, and was reported as "matches sometimes end
before the turn cap".

Measured over 120 self-play matches across the three formats: **no match ends before
the cap. Not one.** 60–72% end exactly on it and the rest go to extra time. The rules
were right; the label was describing a different match from the one being played.

## Decision

**Regulation counts to the turn cap and nothing else.** `Turn 7 of 24`.

**Extra time is its own explicit state with its own count, starting again at one.**
`extra time · Turn 1 of 8`, not `Turn 25 of 32`. It appears only once a match has
actually gone past regulation.

**The two caps are never added together in anything a player reads.** A test asserts
the scoreboard never shows `of 32`.

**The logic is one pure function, `matchClock(turn, rules)`**, in `apps/web` where
presentation belongs. It reads `rules` off the state rather than the format table, so
a saved or replayed match's clock reads the way it did when it was played.

## Consequences

`totalTurns` is still correct and still used — by `matchResultAfterTurn`, which needs
to know when extra time has run out. It simply stops being a thing shown to a player.

This is presentation only. No rule, no schema and no engine file changed, and the
determinism replay test is untouched by it.

**What it does not do** is address the instinct underneath the original report — _when
a result is effectively decided, do not cut it short_. Resign and a live
win-probability bar are the features for that, and they remain proposals.

## Alternatives considered

**Showing both** — `Turn 24 of 24 (32 with extra time)`. Honest and unreadable, and it
puts a number on screen that is only relevant to a minority of matches.

**Extending every match to `totalTurns`.** The literal reading of the original report,
and wrong: it would mean playing eight turns of a decided match, which is the opposite
of not cutting things short.
