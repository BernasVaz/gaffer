# 0012 — Game types are data, and the numbers scale with the pitch

- **Status:** Accepted
- **Date:** 2026-09-21
- **Supersedes:** nothing (delivers what GDD §5 and §12 promised)
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

GDD §5 has said since v1.0 that "pitch and squad size are config, so 7-a-side and
11-a-side become **game modes** later," and §12 lists them as engine-ready. An alpha
session wants all three on offer.

The claim was load-bearing and had never been tested. Two things had to be true for it
to hold: that no rule anywhere reads the number seven or the number five, and that the
numbers which _do_ depend on the size of the pitch could be made per-match rather than
per-build.

The first turned out to be true. `legalActions`, the duel resolver and the win condition
were already written against a board and a squad. **No rule changed to add two formats.**

The second was not. `TURN_CAP`, `EXTRA_TIME_TURNS`, `ACTIONS_PER_TURN` and `SHOT_RANGE`
were module constants, and a constant cannot be two values at once — which is what a page
holding a 5-a-side and an 11-a-side needs.

## Decision

**A format is a row of data** in `@gaffer/shared`: a board, a line-up, and the numbers
that scale with them. `createInitialState({ format })` is the only thing that reads it.

**The scale-sensitive numbers move onto the match state**, as `state.rules`, alongside
the board that was already there. The turn helpers take them as an argument; the engine
reads them off the state it was handed.

This follows the reasoning already used for player stats: they are _copied onto the
player_ at kickoff rather than looked up from the role table, so a saved or transmitted
match replays identically even if the table is later retuned. A match now carries its own
rules for the same reason, and `afterGoal` preserves them when it rebuilds the pitch.

|                      | 5v5     | 7v7   | 11v11  |
| -------------------- | ------- | ----- | ------ |
| Pitch                | 7 × 5   | 9 × 7 | 13 × 9 |
| Shape                | 1-1-2-1 | 2-3-1 | 4-4-2  |
| **Actions per turn** | **2**   | **3** | **4**  |
| Turn cap             | 24      | 32    | 44     |
| Extra time           | 8       | 10    | 14     |
| Shot range           | 2       | 2     | 3      |
| Status               | stable  | alpha | alpha  |

**The goal does not scale.** `GOAL_MOUTH_HEIGHT` stays 3 at every format. A goal in
football is a fixed physical size and the pitch grows around it — and here that is also
what keeps the keeper coherent, since 3 is exactly what a keeper on its line covers with
a move range of 1. Widening it would either hand the attacker a goal the keeper cannot
defend, or require a faster keeper and a different game.

**Player ids gain an index**: `home-defender-3`. A back four is impossible without it.
5-a-side ids change too, rather than being indexed only when a role repeats — an id whose
shape depends on the format is an id nothing can parse.

## Rationale

- **Actions per turn is the number that matters, and it was not obvious.** The brief
  expected the turn cap to be the critical one. It is necessary but nowhere near
  sufficient: at two actions a turn, 7-a-side produced **0.65 goals a match with 40%
  goalless**, and 11-a-side **0.63 with 50% goalless** — both worse than 5-a-side before
  any of its tuning. An attack needs a certain number of actions to cross a pitch, and
  that number grows with the pitch while the turn cap only buys more _turns_ of the same
  inadequate length. Three and four respectively took them to 1.63 and 1.33 at a stroke.
- **`rules` on the state, not threaded through every call.** The engine's own precedent,
  and the only version that lets two matches at different formats coexist in one page.
- **Keeping a format's identity on the state as well as its numbers.** `afterGoal`
  rebuilds the pitch from scratch and has to know which pitch to rebuild. Rebuilding an
  11-a-side match onto a 7 × 5 board is the kind of bug that is funny once.
- **The 5-a-side profile holds the numbers that were there before.** Its balance was
  settled over ADRs 0007 and 0011 and must not move because two other formats arrived.

## Consequences

**Positive**

- Three game types, and a fourth is a row of data and a formation — the tests that
  validate a line-up are written against the whole catalogue, not against a list of three.
- The engine is now _demonstrably_ size-agnostic rather than asserted to be: a suite plays
  a full match to a decided result at every format, and the opponent does the same.
- A hand-written formation is checked by machine — squad size, one keeper, no shared
  cells, nobody on the centre spot, no cell whose mirror is a team-mate, keeper on the
  mouth, nobody else in a mouth, both touchlines used, and the kickoff outside shooting
  range. The 11-a-side shape failed two of those on the way in.

**Negative / accepted costs**

- **Existing 5-a-side links replay differently.** Nothing about the rules changed, but
  player ids did, and the opponent breaks ties and seeds its variety on them. Same seed,
  same match — but not the same match as yesterday. Acceptable while the only links in
  the world are a few days old; it would not be after a ladder exists.
- **`turnsRemaining`, `isRegulationOver` and `isExtraTime` take a second argument now.**
  Mechanical, and the tests that used them now run across every format instead of one.
- **Two of the three formats are provisional**, and the interface says so — see ADR 0013.

**Revisit if**

- A format wants a rule of its own rather than a different number. That is the line this
  ADR draws, and crossing it means the engine stops being one rulebook.
- Squad-building arrives, at which point a line-up stops being a constant per format.
