# Proposals — the alpha's open rules questions

**Status:** proposals. **Nothing here is built.** Each carries options, a
recommendation, and whatever the instrument could actually measure.

Measurements are 40 self-play matches per format at `pro` unless stated. Where a
number is arithmetic rather than observation, it says so.

---

## 1. Dribbling feels dead — and the reason is not the one we assumed

### What is actually happening

|                                         | 5v5              | 7v7       | 11v11     |
| --------------------------------------- | ---------------- | --------- | --------- |
| carrier moments                         | 692              | 1,693     | 3,938     |
| dribbles **offered** per carrier moment | **4.18**         | **6.53**  | **9.45**  |
| dribbles **played** per match           | **0.70**         | **1.65**  | **0.57**  |
| …won when played                        | 64.3%            | 78.8%     | 65.2%     |
| offered dribbles that gain ground       | 40.6%            | 46.9%     | **33.5%** |
| offered dribbles sideways or backwards  | **59.4%**        | **53.1%** | **66.5%** |
| an opponent standing directly ahead     | 28.2% of moments | 15.7%     | **36.0%** |

Dribbling is not short of options — four to nine are on offer every time somebody
has the ball, and it is _worst_ where there are most: 11-a-side offers 9.45 per
moment and plays 0.57 per match. It is that **nobody takes them**, and the reason is structural:

> A dribble is not a thing you _choose_. It is what a **move** becomes when it is
> contested. `pressedAtOrigin` makes _every_ carrier move a dribble the moment an
> opponent is adjacent, and a dribble has no upside a move does not have — same
> geometry, same destination, plus a duel you can lose.

So a dribble is pure downside, taken only when there is nothing free left. And the
one dribble anybody actually wants — **through** the defender in front — does not
exist at all, because `reachableCells` stops at the first occupied cell. That
situation is 28% of carrier moments at 5-a-side and **36% at 11-a-side** — and at
11-a-side only a third of the dribbles on offer gain any ground at all.

### Options

**A · Beat the man: winning a dribble lets you pass through him.**
When the destination is the cell _occupied by_ an adjacent opponent, the dribble is
legal and resolves as ATK v DEF. Win, and the carrier lands on **the cell beyond**;
lose, and it is a turnover as today. Range is 1 step past the defender — this is a
body swerve, not a run.

_For:_ gives dribbling the upside it has never had, directly addresses the 28%, and
reads exactly like football. _Against:_ a new geometry (a destination that is not in
`reachableCells`), and it wants a rule for "what if the cell beyond is occupied too"
— simplest answer: then it is not offered.

**B · Reward the dribble instead: winning pushes the defender back.**
Keep the geometry; on a win the beaten defender is moved one cell away from goal.
_For:_ no new destinations, and it makes a won dribble worth something. _Against:_
moving a piece that is not yours on your action is a new kind of effect, and it is
hard to read on a board.

**C · Make dribbling cheaper rather than better.** Drop `pressedAtOrigin`, so only
the _destination_ being contested makes it a duel. _For:_ one line, and it removes
the "everything costs a duel when closed down" tax. _Against:_ it makes escaping a
press free, which is the one thing pressing should prevent — and it does nothing
about the man in front.

### Recommendation

**A, with C as a separate question.** A is the one that changes how the game feels:
it turns a dribble from a tax into a decision. C is worth measuring on its own
afterwards, because the two interact and shipping both at once would make the
balance unreadable.

**Wants measuring before locking:** at 64–79% win rates, a "beat the man" dribble at
those odds may be _too_ good — a striker (ATK 5) against a winger (DEF 2) would be
near-automatic. Expect to want a covering-defender term, or a penalty for the
through-route specifically.

---

## 2. Bent passes (the knight-position problem)

### What is actually happening

|                                           | 5v5       | 7v7       | 11v11     |
| ----------------------------------------- | --------- | --------- | --------- |
| team-mate sightings from a carrier        | 2,076     | 8,465     | 35,442    |
| on one of the 8 rays                      | 75.9%     | **51.5%** | **44.2%** |
| at a bent offset, within a sensible range | **24.0%** | **45.6%** | **48.8%** |
| …of which at least one dog-leg is clear   | **89.6%** | **93.4%** | **90.8%** |

So at 7- and 11-a-side **nearly half** of all team-mates a carrier can see are at an
offset the game will not pass to — and at 11-a-side, fewer than half are on a ray at
all — and nine times in ten there is an unobstructed bent route
to them. This is the single largest gap between what a player sees and what the game
offers, and it grows with the pitch.

(This agrees with the earlier line-of-sight diagnosis, which measured the 8-ray rule
as explaining 34% / 54.5% / 58.4% of missing pass options.)

### Options

**A · True line of sight.** Any team-mate with an unobstructed straight line —
Bresenham, not just the 8 rays. Interception is by opponents adjacent to the cells
the line crosses. _For:_ one rule, no new concepts, and it subsumes most bent cases.
_Against:_ the lane becomes a computed set rather than an obvious one, and "why can I
not pass there" gets harder to answer from the board.

**B · The bent pass as its own verb.** A pass to a team-mate at an L offset
(`|dx|,|dy|` differing, both ≤ PAS), routed through the two dog-legs; legal if
**either** bend is clear. Interception rolls against opponents adjacent to the chosen
route, with a penalty for the bend — say +1 to the defence, exactly as the keeper's
launch is priced.
_For:_ keeps the 8 rays as the mental model and adds a named, priced exception.
_Against:_ a sixth pass geometry to explain, and the "which bend" choice is either
automatic (opaque) or another decision (heavy).

**C · Leave it, and move players instead.** Treat the offset as a positioning problem
the player should solve.
_For:_ free. _Against:_ the numbers say it is not an edge case at 7 and 11 a side;
it is the normal case.

### Recommendation

**A, measured at 5-a-side first.** It is the smaller rule and it fixes the larger
share. The risk is that it makes passing _too_ easy and collapses the pressing game —
so the thing to measure is not "are there more options" (there will be) but **goals
per match and turnovers per match**, at 5-a-side where the balance is settled.

If A proves too loose, B is the fallback: it is strictly narrower and it already has a
pricing precedent.

---

## 3. Match completion — the premise is wrong, and the display is the bug

### What is actually happening

|                               | 5v5      | 7v7      | 11v11    |
| ----------------------------- | -------- | -------- | -------- |
| turn cap                      | 24       | 32       | 44       |
| "of N" shown in the interface | 32       | 42       | 58       |
| average finishing turn        | 26.5     | 35.4     | 47.0     |
| ended **exactly at the cap**  | 60.0%    | 60.0%    | 72.5%    |
| ended **in extra time**       | 40.0%    | 40.0%    | 27.5%    |
| ended **before the cap**      | **0.0%** | **0.0%** | **0.0%** |

**No match ends early.** Not one in a hundred and twenty. What happens is that the scoreboard
shows `Turn 26 of 32`, where 32 is `totalTurns` — regulation _plus_ extra time —
and extra time only exists if the sides are level. A match ending 2–1 at turn 24 of a
24-turn regulation looks like it stopped eight turns short.

So the reported problem is a **labelling** bug, and the fix is a line of copy:
`Turn 24 of 24` during regulation, and `Extra time · turn 3 of 8` once it starts.

### The real questions underneath it

The brief's instinct — _when a result is effectively decided, do not cut it short_ —
is still right, and two features serve it:

**Resign.** A control that ends the match with the other side as winner, with a
confirm step. Needs a `decidedBy: "resignation"` in `MatchResult`, which is a schema
change and therefore an ADR. Cheap and obviously correct.

**A live win-probability bar.** The chess.com bar. It needs an evaluation function
that maps a board to P(home wins), and we have most of one: `@gaffer/ai`'s
`evaluate` already scores a position. Turning a score into a probability needs
calibration — play N self-play matches, bucket positions by score and turns
remaining, and record how often each bucket actually won. That is a measurement job
of a few hours and it produces a lookup table.

**Important:** it must live in `apps/web` or `@gaffer/ai`, never in the engine, and it
must not be allowed to _end_ a match. A bar that reads 98% is information; a bar that
stops the game is a new win condition.

### A ~10s per-decision timer

**What a timeout should do is the whole question**, and there are only three sane
answers:

1. **Pass the turn.** Simplest, and brutal on a big board where a turn is four
   actions.
2. **Spend the action on the best available move**, chosen by `@gaffer/ai`. Keeps the
   match flowing and never wastes a turn. Deterministic, so it stays replayable.
3. **Spend the action on a _no-op_** — the player stands still, one action gone.

**Recommendation: 2**, with the AI's choice recorded in the log as an ordinary
command so the replay is unaffected. And the timer must be **presentation only** —
the engine cannot take the clock as an input without giving up determinism, so the
client decides a timeout has happened and then sends a normal command.

**Strong caveat:** a 10s timer and an async multiplayer plan are contradictory. This
is a same-screen/live feature, and it should be scoped as one.

---

## 3b. Movement at 11-a-side — 5 without the ball, 3 with

### What it would change

Today move range is a property of the **role** and does not care about the ball:
goalkeeper 1, defender 2, midfielder 3, winger 3, striker 2. The proposal makes it a
property of the **format and the ball** at 11-a-side only: 5 off the ball, 3 on it.

That is a large change at the top end — a defender would go from 2 to 5 — and it
does two things at once: it makes the big pitch traversable, and it introduces the
first rule in the game where carrying the ball _costs_ you something continuously
rather than at a duel.

### Measured

40 self-play matches at 11-a-side, against the same 40 on the shipped rules:

|                       | shipped (2/3/3 by role) | **5 off-ball / 3 on-ball** |
| --------------------- | ----------------------- | -------------------------- |
| goals per match       | 1.12                    | **1.50**                   |
| goalless matches      | 13.3%                   | **5.0%**                   |
| shot conversion       | 54.0%                   | 46.9%                      |
| duels per match       | 52.3                    | 50.1                       |
| actions per match     | 188.7                   | 185.8                      |
| turns per match       | 47.5 of 58              | 47.0 of 58                 |
| home win rate         | 38.3%                   | 35.0%                      |
| **AI time per match** | **6.2 s**               | **184.6 s**                |

The first run of this measured nothing: `tools/play` imports the engine's built
`dist`, and the patch had only been made to the source. The numbers above are from a
rebuilt engine and differ from the baseline, which is how the mistake was caught.

### Reading it

**The football gets better.** Goals per match go up by a third and goalless matches
fall from one in seven to one in twenty — which is the complaint about 11-a-side, and
this fixes it. Conversion drops because more shots are taken from worse places, which
is what you would expect when everyone can get forward.

**The solo opponent becomes unusable.** 6.2 seconds a match to **184.6** — a **30×**
slowdown, and that is the _whole match_, so a single decision goes from about 30 ms to
roughly a second on this machine, on a phone considerably worse. Move range is the
branching factor: raising a defender from 2 to 5 multiplies its destinations from 16 to
40, and the search is over combinations of those.

This is the same wall ADR 0012 hit when 11-a-side first shipped, and it was solved
then by scaling search breadth by √area. That lever still exists and would have to be
pulled again — but pulling it makes the opponent _worse_, and 11-a-side's opponent is
already the weakest of the three.

### Recommendation

**The movement change is right and cannot ship as-is.** Take it in two steps:

1. **Ship the off-ball part only — 5 without the ball, roles unchanged with it.**
   Most of the goal improvement comes from players being able to get into positions;
   the on-ball reduction is the part that mainly costs the carrier. Measure it on its
   own, and measure the AI cost on its own.
2. **Re-tune search breadth for 11-a-side before, not after.** The budget test in
   `packages/ai/tests/formats.test.ts` pins a ratio between formats precisely so this
   cannot regress silently — it will fail, and it should.

**If the AI cost cannot be brought back under control, do not ship it.** A format where
the solo opponent takes a second a move is a format nobody plays, and 11-a-side is
already the least-played of the three. Better a flatter game that responds instantly.

**Worth noting:** this is the strongest evidence yet that 11-a-side's real problem is
the pitch being too big for the movement, not the turn cap or the action economy. If
the search cost proves fatal, the cheaper alternative is to shrink the 11-a-side board
rather than lengthen everybody's legs.

### Re-measured, 2026-09-23 — both halves of the above are now wrong

Re-run after ADR 0018 (kickoff is a pass), ADR 0021 (take the man on) and ADR 0023 (a
won dribble carries on), at **60 matches an arm on matched seeds**, each against a
freshly built engine:

|                       | shipped    | off 5 / on role | off 5 / on 3 |
| --------------------- | ---------- | --------------- | ------------ |
| goals per match       | **1.55**   | 1.97            | 1.75         |
| goalless matches      | 10.0%      | 6.7%            | **3.3%**     |
| shots per match       | 2.77       | 3.63            | 3.52         |
| turns per match       | 46.9 of 58 | 45.8            | 46.9         |
| **AI time per match** | **6.14 s** | 8.75 s          | **8.67 s**   |
| AI time per decision  | 33 ms      | 48 ms           | 47 ms        |
| legal actions offered | 109.3      | 132.2           | 129.8        |

**The 30× slowdown does not reproduce.** The shipped arm lands on 6.14 s against the
6.2 s recorded above — the harness is measuring the same thing the original did — and
the treatment costs **1.41×**, not 30×. The most likely explanation is that the
original patch let a player reach _every_ cell within range rather than along the eight
rays the rule actually uses, which both explodes the search and is a different rule; it
is recorded here rather than resolved, because the patch was not kept.

**And the problem the change was for has already been solved.** 11-a-side's complaint
was 1.12 goals a match and one match in seven goalless. It now plays at **1.55 goals and
10% goalless** with no movement change at all — which is ADR 0007's target (1.50 / 9%)
to within the noise of this sample. Dribbling did it: a big pitch punished a carrier
who could not beat the man in front, and 11-a-side had that man there for 36% of carrier
moments against 5-a-side's 28%.

Applying the movement change now moves 11-a-side **away** from the goals target rather
than towards it. Of the two treatments, `off 5 / on 3` is the better: fewer goalless
matches than either, and less overshoot than off-ball alone — carrying the ball costing
you something is doing real work.

**Retired — see ADR 0024**, which records this decision and the playtest thread it cannot
close.

**Recommendation: do not ship it.** 11-a-side is on target, and the search cut this
section asked for is not needed at 33 ms a decision. Revisit only if a big pitch still
_feels_ untraversable in play, which is a judgement the numbers cannot make — and note
that 60 matches an arm separates 1.55 from 1.97 but not 1.75 from 1.97, so a lock-in
decision wants 200.

---

## 3c. Where the three formats stand after the dribble rules

The dribble change (ADR 0021, ADR 0023) was validated at 5-a-side and shipped to all
three, because no rule reads a format (ADR 0012). This is the check that it landed well
everywhere. Same harness, matched seeds, an engine built from each side of the change —
the **before** column is a worktree at `9109a31`, verified to contain neither rule
before it was measured.

| format        | before     | after          | change    |
| ------------- | ---------- | -------------- | --------- |
| 5-a-side      | 1.51 / 7%  | 1.38 / 2%      | −0.13     |
| **7-a-side**  | 1.73 / 7%  | **2.13** / 3%  | **+0.40** |
| **11-a-side** | 1.12 / 12% | **1.55** / 10% | **+0.43** |

_(goals per match / goalless matches. 100 matches at 5- and 7-a-side, 60 at 11.)_

The "before" column at 11-a-side reproduces the 1.12 and 13.3% recorded in §3b from a
different harness on a different day, which is the best evidence available that this
instrument measures what it claims to.

**The change helps most where the pitch is biggest**, and the reason is in the original
dribbling measurement: the man in front is there for 28% of carrier moments at 5-a-side
and **36% at 11-a-side**. The format that suffered most from being unable to beat him
gained most from being able to.

**7-a-side is now the format furthest from target.** At **2.13** it is inside ADR 0007's
1–3 envelope but well above the ~1.50 the envelope is centred on, and it was already the
highest-scoring format before the change. It takes 4.4 shots a match against 5-a-side's
2.5 — three actions a turn on a 9×7 board is a lot of pitch per action.

**Logged as a watch-item in ADR 0024.** Nothing is proposed here. 7-a-side is marked alpha, one number outside its target on a
format nobody has played much is not an emergency, and the cheapest levers if it is
wanted — `actionsPerTurn` or `turnCap`, both already per-format data (ADR 0012) — should
not be pulled on 100 matches of self-play alone.

---

## 4. New actions

Ranked by value against cost, given everything above.

|                                                       | verdict                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Through-ball** — a long forward pass to a team-mate | **Already built, and mis-scoped.** ADR 0015's keeper `launch` _is_ this mechanic. The honest move is to let outfield players use it at reduced range rather than add a third pass verb. Cheap, and it reuses a priced, tested duel.                                                                                                     |
| **Keeper distribution**                               | **Shipped** (ADR 0015). Measured at 0.03–0.08 per match because 71% of a keeper's long rays end in empty grass — see that ADR. The open question is the loose-ball model, which is still parked.                                                                                                                                        |
| **Long shot from any player**                         | **Worth doing, and needs care.** Today `shotRange` is a hard cutoff. A long shot is the same duel at a distance penalty — a natural extension, and it gives wingers and midfielders a reason to exist in the final third. The risk is that it devalues getting into the box. Measure conversion by distance before setting the penalty. |
| **Feints**                                            | **Defer.** There is no feint mechanic to make "more or easier" — it would be a new action whose whole content is manipulating a duel modifier, and the duel model is already the part players find hardest to read.                                                                                                                     |
| **Counter-attack**                                    | **Defer, and reframe.** As a distinct verb it is unclear what it _is_. As a _consequence_ — a turnover granting the winning side an immediate bonus action — it is a one-line rule with a big effect, and it is the cheapest way to make winning the ball back feel like something. Worth measuring on its own.                         |

**Recommendation:** extend `launch` to outfield players (through-ball), then measure
the long shot. Both reuse existing machinery. Feints and counter-attack are new
concepts and should wait until dribbling and passing are settled, since all four
interact.

---

## 5. Cards

Yellow, red, red removes the player, persisting through goals.

### The design questions that have to be answered first

1. **What earns one?** There is no foul in Gaffer. A tackle is a duel you win or
   lose; nothing is illegal. So a card needs a _trigger_ invented for it — losing a
   tackle badly (by 3+?), or a second tackle on the same carrier in a turn, or a
   tackle from behind (which needs a facing concept that does not exist).
2. **What does a red cost?** Removing a player from a 5-a-side side is removing 25%
   of the outfield. That is close to match-ending, which may be right for football and
   wrong for a 24-turn game.
3. **Where does it live?** A card is match state, so `MatchState` gains something like
   `cards: { playerId, colour }[]`, and `players` gains a way to be absent. Every
   consumer that assumes a fixed squad — formations, the AI's evaluation, the team
   sheet, the win condition's penalty takers — has to cope.

### Options

**A · Full cards.** Trigger, yellow, red, removal, persistence.
_Cost:_ a schema change, an engine rule, AI changes, and a balance pass per format.
This is the largest single item in the propose-first lane.

**B · Sin-bin instead of sending off.** A lost tackle by a margin puts the tackler out
for two turns, then back. _For:_ all the drama, none of the "match over at turn 6",
and no absent-player concept — the player is on the board, greyed and uncommandable.
_Against:_ not football.

**C · Defer.**

### Recommendation

**B, if anything, and not now.** Cards need a foul to exist first, and inventing one
is a bigger design decision than the cards themselves. The sin-bin gets the
risk-and-consequence that cards are really for, at a fraction of the cost, and it does
not require a player to stop existing.

---

## 6. The goalkeeper's penalty area

Confining the keeper, and reconciling it with "the keeper defends only while it is
standing in its mouth, and can be drawn out" (GDD §7, ADR 0004).

### The tension

These two rules pull in opposite directions. Drawing the keeper out is _meant_ to be a
way to score — it is the reason the keeper's DEF is survivable. Confining it to a box
removes the top half of that: it can still leave the mouth, but not far, so the open
net is a smaller prize.

That may be exactly right. A keeper wandering to the halfway line is the thing the
confinement rule is for, and ADR 0015's data showed the AI had to be explicitly taught
not to do it (`keeperAdrift`).

### Proposed zone, per format

Derived from the existing penalty-box markings so the drawn box and the rule agree —
`GOAL_MOUTH_HEIGHT` rows, plus one either side, and a depth that scales:

|       | board  | box depth | box rows    |
| ----- | ------ | --------- | ----------- |
| 5v5   | 7 × 5  | x ≤ 1     | y 0–4 (all) |
| 7v7   | 9 × 7  | x ≤ 2     | y 1–5       |
| 11v11 | 13 × 9 | x ≤ 3     | y 2–6       |

At 5-a-side the box is so large relative to the pitch that the rule barely binds,
which is an argument for making it a per-format rule rather than a universal one.

### Recommendation

**Ship the zone, keep the draw-out.** The keeper may not leave its box; inside the box
it still only defends a shot while actually standing in the mouth. That keeps the
"pull the keeper off its line" play — which is a real skill — and removes the absurd
one, and it needs no change to the shot model at all. It is a change to
`mayOccupy` and nothing else.

**Measure:** goals per match, and specifically open-net goals, before and after. The
draw-out play is worth a real share of scoring and this will reduce it.

---

## Sequencing

Everything above interacts, so the order matters more than the list:

1. **Fix the turn label** (a line of copy, no rule change).
2. **Resign** (small schema change, obviously correct).
3. **Passing: line of sight**, measured at 5-a-side. Largest gap, smallest rule.
4. **Dribbling: beat the man**, measured against 3's result — they change the same
   decision, so measuring them together would tell us nothing about either.
5. **Keeper's box**, which is nearly free and independent of both.
6. **Through-ball** (extend `launch` outfield), then **long shot**.
7. **Win-probability bar** once the rules above have stopped moving — calibration is
   worthless against a model that is still changing.
8. **Cards / sin-bin**, **counter-attack**, **feints** — last, and only if the earlier
   changes have not already made the midfield interesting.

**11-a-side movement sits outside this order** — and, on the 2026-09-23 re-measurement
(§3b), off it. Its blocker was never the search cost, which is 1.4× rather than 30×, and
the football it was meant to fix now plays on target without it.

---

## What was measured, and what was not

Honest accounting, because half of this is arithmetic and half is observation.

| section                 | basis                                                                           |
| ----------------------- | ------------------------------------------------------------------------------- |
| 1 · Dribbling           | **measured** — 120 self-play matches, 6,323 carrier moments                     |
| 2 · Bent passes         | **measured** — 45,983 team-mate sightings                                       |
| 3 · Match completion    | **measured** — 120 matches, no early finish in any of them                      |
| 3b · 11-a-side movement | **measured twice** — 40 matches an arm, then 60 an arm after the dribble rules  |
| 4 · New actions         | **design only**, except keeper distribution which shipped with data in ADR 0015 |
| 5 · Cards               | **design only** — there is nothing to measure until a foul exists               |
| 6 · Keeper's area       | **design only** — the zone table is arithmetic from `GOAL_MOUTH_HEIGHT`         |

Timer, resign and the win-probability bar are design only and are scoped above.

The instrument for all of the above is `tools/play`, and the one-off probe that
produced §§1–3 was thrown away deliberately — it measured the shipped rules and would
be wrong the moment any of these proposals lands. `tools/play/src/find-guide-position.ts`
is the pattern to follow if any of them needs a standing measurement.
