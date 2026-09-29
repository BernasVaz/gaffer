# 0035 — One match screen

- **Status:** Accepted
- **Date:** 2026-09-29
- **Supersedes:** the separate online match view introduced with ADR 0028's Phase 1.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Online play shipped with its own view. It drew a board, a turn banner and an End-turn
button, and that was all it drew. It seemed proportionate at the time: a thin screen to
prove the round trip.

A real two-person match on `alpha-freeze-7` failed. Two symptoms, two causes, and both
trace to the same decision.

### Why nobody could pass at kickoff

The online view had no scoreboard, no status line, no action bar and no hint. The single
player screen says _"Click one of your players to see where it can go"_; the online one
said nothing at all. At an 11-a-side kickoff **one player of eleven has a legal action** —
the carrier, with a single pass — because a kickoff is pass-only (ADR 0018). Two people
tapping men that did nothing had no way to discover that.

Measured on production: `players that offer anything when tapped: 1 of 11`.

### Why the opponent was stuck

Worse, and invisible. The online view computed its board with a **fabricated generator**:

```ts
createRng(row.setup.seed + row.commandLog.length);
```

That is not the match's generator. A match's dice are **one** generator walked through its
commands in order — which is what `buildMatch` does and what the opponent does when they
read the row. A fresh generator is a different match.

Demonstrated on the same board and the same action:

|                           | roll  | outcome  |
| ------------------------- | ----- | -------- |
| the match's own generator | 4 v 1 | **won**  |
| what the client computed  | 4 v 4 | **lost** |

The player submits the board _their_ dice produced, along with its state hash. The
opponent replays the log honestly, gets a different board, the hashes disagree, and the
match is correctly stopped — on the opponent's phone, for a bug the first player caused
and never saw.

### Why the tests passed

The online end-to-end suite only ever pressed **End turn**. An `endTurn` spends no dice, so
the fabricated generator and the real one agreed, every time. The suite tested the
plumbing and never the game — which is the exact shape of a test that passes while the
product does not work.

## Decision

**There is one match screen.** `Match` takes an optional binding supplying a controller and
a few extras to draw above the pitch; `useRemoteMatch` supplies the shared-match version of
what `useMatch` supplies locally. The second view is deleted.

Online therefore gets the portrait pitch, the odds toggle, the duel breakdown, the
commentary, the statistics, flagging a moment and the full-time report **because it is the
same code**, not because each was built twice.

**`useRemoteMatch` replays rather than remembers.** The board including this turn's un-sent
actions is `buildMatch` over `[...serverLog, ...pending]` — the same replay the opponent
will perform. There is no carried generator to get out of step, because there is nothing
carried.

**Each player sees their own team at the bottom, attacking up.** A `flipped` layout, 180°
of the portrait one. Display only: engine coordinates and every cell's accessible name are
unchanged, so a match still replays identically however it was drawn (ADR 0014).

**A refused or undelivered turn is always shown.** A submit that fails says so; a command
the engine refuses says why. Failing silently is a bug in itself.

## Consequences

**The screen is the thing that gets better for both modes at once.** Every future
improvement to the match screen reaches online play for free, and cannot drift.

**One wasted board.** `Match` calls `useMatch` unconditionally, because hooks are
unconditional, and ignores it when a binding is supplied. That is one board built and left
alone — cheaper than two screens by an enormous margin.

**The test that mattered did not exist.** There is now a two-phone end-to-end that passes
at kickoff, ends the turn, checks the opponent can act, and plays ten turns both ways with
dice actually being spent. It was **red against `alpha-freeze-7`** before it was green.

**A guard threshold was wrong rather than the code.** The board-size assertion demanded
120px; on the narrowest phone with the invite panel still showing, a perfectly real board
is 119px. The number now says what the guard means — not collapsed — rather than policing a
size it was never measuring.
