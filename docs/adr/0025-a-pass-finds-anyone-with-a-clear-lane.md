# 0025 — A pass finds anyone with a clear lane

- **Status:** Accepted
- **Date:** 2026-09-24
- **Supersedes:** the eight-ray passing geometry of ADR 0003 and GDD §7. ADR 0015's
  launch geometry moves with it; that ADR's "launch as a through-ball" framing stays
  superseded as it already was.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

A pass went to the first team-mate standing on one of the carrier's **eight rays** —
straight, or diagonal at exactly 45°. Anybody else was not a hard pass or a risky pass.
They were **not a pass at all**.

The shape that suffers most is the commonest shape in football: a team-mate two forward
and one across. The ball every winger has ever been played into was unimaginable to the
engine, while the same player one step sideways was free.

This is also, in retrospect, what ADR 0015 measured and misread. That ADR found the
keeper's long ball almost never available — **71% of a keeper's rays end in empty
grass** — and concluded the verb was rare. The rays were not failing to find team-mates
because team-mates were marked or far away. They were failing because **there is rarely
anybody standing exactly on a ray**, and a census of eight lines out of 35 cells was
never going to find one.

The geometry was an artefact of the grid, not a decision about football.

## Decision

**A pass is legal to any team-mate within PAS range whose lane is clear.** A launch is
the same rule at `launchRange`. The lane is what the ball flies over, and the first body
under it stops the ball — whichever side that body is on. An opponent heads it away; a
team-mate receives it instead.

### The lane geometry, and why this one

Draw the straight line from the middle of one cell to the middle of the other. **A cell
is on the lane when the ball's flight crosses its square** — formally, when the cell's
centre lies less than half a cell from that line, and the cell sits between the two ends.
Clipping a corner does not count.

Three consequences, which are the whole of the rule:

- **A straight ball** (0,0)→(3,0) crosses (1,0) and (2,0). The cells above and below are
  a full cell away and do not block.
- **A diagonal** (0,0)→(2,2) crosses (1,1) **only**. The flight clips the corners of
  (1,0) and (0,1) and no more — so every lane that was legal under the ray rule is still
  legal, with the same blockers. **Nothing that worked before stopped working.**
- **The angled ball** (0,0)→(2,1) crosses **both** (1,0) and (1,1), because the flight is
  genuinely over one square and then the other. Either body stops it.

That last point is what keeps the new angles honest. The shapes this rule adds are the
ones with the _most_ cells under them, so they are the easiest to block — a knight's-move
ball needs two empty cells where a diagonal of the same length needs one.

Alternatives considered and rejected: **Bresenham**, which picks one cell per step and is
not symmetric — a pass could be legal one way and blocked the other, which is a rule
nobody can hold in their head. And a **corridor test** (any defender within some distance
of the segment blocks), which makes blocking a matter of a tuned radius rather than of
where the ball actually goes.

**Exact integer arithmetic, no floating point.** The half-cell test is `4·cross² < |AB|²`
and the betweenness test is `0 < (C−A)·(B−A) < |AB|²`; both are comparisons of whole
numbers. A lane decided by a rounding error would be a lane that differs between two
machines replaying the same seed, and determinism is the engine's whole contract.

### One geometry, read twice

`legalActions` and `duel.ts` call the **same** `laneBetween`. What blocks a pass and what
contests it are one fact about the board, so they cannot drift apart — which they could
have, when each held its own copy of the walk.

### What did not change

**Interception is untouched.** An opponent _beside_ the lane still contests the ball on a
DEF-against-PAS duel at the odds shown before committing. Since the new lanes are longer
in cells, there is strictly _more_ for a defender to stand beside, not less.

**Shots are still measured on rays**, and that is now a decision rather than an accident
— see the consequences below.

## Consequences

### Balance, 600 matches an arm at 5-a-side, matched seeds, an engine rebuilt per arm

|                             | baseline | **line of sight** |
| --------------------------- | -------- | ----------------- |
| goals per match             | 1.41     | **1.44**          |
| goalless matches            | 3.2%     | 3.8%              |
| shots per match             | 2.46     | 2.45              |
| shot conversion             | 57.5%    | 58.6%             |
| passes offered per decision | 0.71     | **0.85**          |
| passes played per match     | 9.06     | 8.92              |
| **pass completion**         | 99.7%    | 99.6%             |
| **interception rate**       | 0.3%     | 0.4%              |
| pass share of progression   | 85.9%    | 85.3%             |

**Goals hold at target.** 1.41 → 1.44, against the ~1.50 ADR 0007 is centred on.

**A carrier has 18% more balls on.** 0.71 legal passes per decision to 0.85 — and that is
averaged over every player's turn, most of which belong to somebody without the ball.

**Passing did not trivialise anything.** Its share of progression is _flat_ — 85.9% to
85.3% — because the rule adds options rather than making the ball travel further. And
goals did not run away, which was the risk worth measuring.

### The finding that surprised us: interception is already near-zero

**Pass completion is 99.7% before this change and 99.6% after.** The opponent almost
never plays a contested pass — it has a safe ball available and takes it. So the
interception duel is not doing much work at 5-a-side in _self-play_, and it was not doing
much before this either.

This matters for how the numbers above should be read. "Interception stays meaningful"
cannot be shown by a completion rate that never moves, because the opponent is
sidestepping the mechanic rather than beating it. What can be said is narrower and true:
the lanes this rule adds have **more** cells under them than the ray lanes they join, so
there is more for a defender to stand beside, not less. Whether a _human_ plays riskier
balls than the opponent does is a playtest question.

**At 7-a-side the duel is exercised properly**: 24–26% of passes contested, **9%
intercepted**, and both essentially unchanged by this rule. That is the format where the
invariant can actually be observed holding.

#### The pre-identified 7-a-side lever

7-a-side is the one format this rule moves the wrong way — 1.99 goals a match to **2.11**,
about 1.7σ over 1,000 matches an arm, inside the envelope and under the ceiling but away
from target rather than towards it. It was **not** tuned, because tuning a core duel
mechanic to chase a tenth of a goal that self-play cannot resolve is the over-fit this
project has twice decided against, and because ADR 0024 has just said 7-a-side belongs to
real players. Fifteen to thirty humans will judge whether it feels goal-happy better than
any self-play run can.

But the remedy is known, and writing it down now is the point of this section.
**Tightening interception is a lever that acts almost only on 7-a-side**: it fires on 9%
of passes there and 0.3% at 5-a-side, so a change to the interception duel would bite the
format that regressed and barely touch the one that did not. Nothing else available has
that shape.

**So: if playtest reports that 7-a-side feels goal-happy, tighten interception first.**
Not `actionsPerTurn`, not `turnCap`, and not a pass nerf — those hit every format or
change what a pass _is_. This is the first thing to reach for, and it is recorded here so
the reasoning does not have to be rediscovered under time pressure.

### Shots stay on rays, deliberately

Pointing `shotLaneCells` at the new geometry is a one-line change that makes the code
more coherent and the game worse. Measured the same way:

|                      | rays (kept) | true flight |
| -------------------- | ----------- | ----------- |
| goals per match      | **1.44**    | 1.37        |
| shot conversion      | **58.6%**   | 54.8%       |
| **goalless matches** | **3.8%**    | **6.5%**    |

More defenders end up in front of more shots, and the shot is the verb with the least
slack in it. Goalless matches nearly doubling is the number that settled it.

So the restriction stays, written down in the code as a decision. **The honest cost:** a
shot at a mouth cell that lies off every ray cannot be covered by a body standing
directly in front of it. That is a real oddity and a question for after the alpha — not
something to change in the same breath as passing, which is exactly the mistake that
would have hidden it.

### Elsewhere

**The rules edition steps to 3** (ADR 0022). This one changes what is _legal_, not only
what an action produces, so an edition-2 log can contain a command the engine now refuses
— a stricter break than the dribble change, and the reason the field exists.

**The board draws the flight.** Hovering or focusing a pass lights the cells the ball
would cross, using the same `laneBetween` the rules use. "You see the odds before you
commit" (GDD §9) is easier to believe when you can also see _why_ they are what they are:
the defender lit beside the line is the defender in the number.

**Two test fixtures were quietly wrong and are now fixed.** One built a keeper whose
"only outlet" was a distant striker by parking everyone off the rays — which stopped
being out of reach the moment reach meant a clear lane. The other asserted a pass to your
own keeper was meaningless. Both were testing the ray rule while believing they were
testing something else.
