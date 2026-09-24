# 0024 — 11-a-side movement is retired by measurement

- **Status:** Accepted
- **Date:** 2026-09-24
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

The alpha proposals (§3b) carried a change to 11-a-side movement — **5 off the ball, 3
on it**, against the shipped 2/3/3 by role — with a measurement attached: it took goals
per match from 1.12 to 1.50 and goalless matches from 13.3% to 5.0%, and it took the
solo opponent from **6.2 seconds a match to 184.6**. A 30× slowdown.

That figure set the work. The plan was to cut search breadth until the opponent was
usable again, then ship the movement change on top.

The cut was never made, because the measurement was repeated first.

## The measurement

60 matches an arm at 11-a-side, matched seeds, an engine rebuilt for each arm, after
ADR 0018, ADR 0021 and ADR 0023 had landed:

|                       | shipped    | off 5 / on role | off 5 / on 3 |
| --------------------- | ---------- | --------------- | ------------ |
| goals per match       | **1.55**   | 1.97            | 1.75         |
| goalless matches      | 10.0%      | 6.7%            | **3.3%**     |
| **AI time per match** | **6.14 s** | 8.75 s          | **8.67 s**   |
| AI time per decision  | 33 ms      | 48 ms           | 47 ms        |
| legal actions offered | 109.3      | 132.2           | 129.8        |

Two separate findings, and both contradict the proposal.

**The slowdown is 1.41×, not 30×.** The shipped arm lands on 6.14 s against the 6.2 s
originally recorded, so the instrument is measuring the same thing the original did. The
most likely explanation is that the original patch let a player reach _every cell_ within
range rather than along the **eight rays** the rule actually uses — a different rule, not
a slower one. The patch was not kept, so this is recorded rather than proved.

**The football it was for is already fixed.** 11-a-side's complaint was 1.12 goals and
one match in seven goalless. It now plays at **1.55 and 10%** with no movement change at
all, which is the target ADR 0007 settled on (1.50 / 9%).

Dribbling did that, and the reason was in the original dribbling measurement: the man in
front is there for 28% of carrier moments at 5-a-side and **36% at 11**. The format that
suffered most from being unable to beat him gained most from being able to. A separate
cross-format run confirms it, and its pre-change arm reproduces the 1.12 and 13.3%
recorded independently weeks earlier — which is the best evidence available that the
instrument measures what it claims to.

## Decision

**The 11-a-side movement change is retired.** Not deferred, not blocked on the opponent —
**retired on the numbers.**

And with it, **the search-breadth cut is not done.** At 33 ms a decision there is no
performance problem to solve, and cutting breadth would make the opponent play worse for
nothing. 11-a-side's opponent is already the weakest of the three.

The deciding argument is not the cost. It is that 11-a-side is **on target today**, and
every arm of the change moves it _away_ from ~1.50 — the target ADR 0007 is centred on,
which the envelope of 1–3 exists around rather than replaces.

## Consequences

**A problem statement expired before its solution shipped.** §3b was right when written
and wrong three rules later, because it measured a symptom of dribbling being ornamental
and attributed it to the pitch. This is an argument for re-measuring a proposal before
building it, not for measuring less.

**The 184.6 s figure should not be cited again.** It is in the record with this
correction beside it.

**Nothing changes in the engine, the opponent or the client.** This ADR exists so the
change is not proposed a third time without new evidence.

### The one thread this cannot close

Whether an 11-a-side pitch **feels** too static to move around is a question about
playing the game, and self-play cannot answer it. The opponent does not get bored
walking a defender four turns up the pitch; a person might. Goals per match says the
football works — it does not say the format is enjoyable to push around.

**That is a playtest question, for humans.** If it comes back from playtest that the big
pitch feels like wading, this decision was made on the wrong evidence and should be
reopened with the right kind — and `off 5 / on 3` is the arm to reopen it with, since it
had both the fewest goalless matches and the least overshoot, which says the on-ball
reduction is doing real work rather than acting as a tax.

## Watch-item — 7-a-side at 2.13 goals a match

Recorded here because it comes from the same run and needs the same discipline.

The dribble rules took 7-a-side from 1.73 goals a match to **2.13**. That is inside ADR
0007's 1–3 envelope and well above the ~1.50 it is centred on, and 7-a-side was already
the highest-scoring format before the change. It takes 4.4 shots a match against
5-a-side's 2.5 — three actions a turn on a 9×7 board is a lot of pitch per action.

**Left alone deliberately.** 7-a-side is marked alpha (ADR 0013), the cheapest levers —
`actionsPerTurn` and `turnCap`, both already per-format data (ADR 0012) — are one-line
edits available whenever they are wanted, and neither should be pulled on 100 matches of
self-play against nobody. **Real players decide this one.**
