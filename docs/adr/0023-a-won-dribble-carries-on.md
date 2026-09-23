# 0023 — A won dribble carries on

- **Status:** Accepted
- **Date:** 2026-09-23
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

ADR 0021 gave a dribble a destination a move could never reach — the cell beyond the man
in front. It worked: dribbles went from 0.71 a match to 1.78, and the "man in front"
case existed for the first time.

It also cost about a tenth of the goals, and for a reason that says something about the
rest of the verb. Dribbling was now _chosen_, so more were taken; about 40% were lost;
each loss is a turnover; possessions ended sooner and shots fell with them. Two levers
were tried against that — the covering rate, and restricting the through-route to the
attacking direction — and neither moved it at all.

Which left the thing ADR 0021 had only half fixed. Taking the man on gave _one_ dribble
an upside. Every **other** dribble was still paying a duel for ground that a plain move
would have covered for nothing.

## Decision

**A won dribble carries the carrier one cell further than it was aimed, in the direction
of travel** — when that cell is on the board, empty, and one the carrier may stand on.
Otherwise the run simply ends where it was aimed. A lost dribble is unchanged: a
turnover, with the carrier staying put.

**It composes with taking the man on.** Beating the defender in front carries the carrier
past him _and_ on — three cells from a standing start, which is the one run in the game a
move could never make.

**The odds do not change.** `previewDuel` is untouched: the same ATK against DEF, the
same number on the board before you commit. What changed is what winning is worth, which
is the half of a decision that was missing.

## Consequences

600 self-play matches per arm at 5-a-side, each against a freshly rebuilt engine:

|                                  | baseline | take the man on | **+ carry on** |
| -------------------------------- | -------- | --------------- | -------------- |
| **goals per match**              | **1.45** | 1.32            | **1.43**       |
| shots per match                  | 2.68     | 2.39            | 2.44           |
| shot conversion                  | 54.1%    | 55.4%           | **58.8%**      |
| **dribbles per match**           | **0.71** | 1.78            | **2.05**       |
| through-the-man per match        | 0.00     | 1.01            | **1.35**       |
| progression by a pass            | 6.95     | 6.33            | 6.25           |
| **dribble share of progression** | **5.1%** | 13.8%           | **15.0%**      |

**Goals come back to where they were.** 1.45 against 1.43 — a difference of about one
goal in every seventy matches, which at this sample is no difference at all.

**Dribbling is three times the thing it was**, and the ball still moves up the pitch by
passing: 85% of forward progression, nowhere near the 71%-dribble failure mode the
covering-rate experiment produced.

**Conversion goes up rather than down** (54.1% → 58.8%) even though shots fall slightly.
A dribble that buys ground finishes closer to goal, so the shots that do happen are
better ones. That was not designed and is the most interesting number in the table.

**The board does not yet say this.** A target still reads "Dribble to column 4, row 2"
while a win may finish on column 5. Perfect information is a locked pillar (GDD §9) and
this is a gap in it — the _odds_ are honest, but the _reward_ is not shown. It is a
label change in `apps/web` and it is the next thing owed on this rule.

## Alternatives considered

**Leaving it at taking the man on** and accepting ~1.32 goals. Rejected on measurement:
the goals target is ~1.50 (ADR 0007, clarified), and a tenth of the match's scoring is
too much to pay for one new option.

**Making the through-route easier to win** instead, by dropping covering to zero. Tried
and firmly rejected: through-balls then win four in five, the opponent spams them, and
dribbling takes over as how the ball moves — 71% of progression, which is a different
game and not a better one.

**Advancing two cells on a win.** Not tried. One cell already returns scoring to
baseline, and the honest reason not to reach further is that there is nothing left to
buy.
