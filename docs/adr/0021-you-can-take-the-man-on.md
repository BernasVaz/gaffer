# 0021 — You can take the man on

- **Status:** Accepted
- **Date:** 2026-09-23
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Dribbling was ornamental. Measured over 120 self-play matches: four to nine dribbles
were _offered_ every time somebody had the ball, and **0.79 were played per match** at
5-a-side.

The reason is structural. A dribble was never a thing you chose — it was what a **move**
became when it was contested. Same geometry, same destination, plus a duel you could
lose. Pure downside, taken only when nothing free was left.

And the one dribble anybody actually wants did not exist: `reachableCells` stops at the
first occupied cell, so the carrier could never go **through** the defender in front of
it. That defender is there for 28% of carrier moments at 5-a-side and 36% at 11-a-side.

## Decision

**A carrier may dribble through an adjacent opponent, landing on the cell beyond them.**
Legal when that cell is on the board, empty, and one the carrier may occupy. Winning
puts the carrier there with the ball; losing is a turnover exactly as before.

**The duel is with the man being gone through**, whoever else is standing about. You are
beating him, not the strongest defender in the postcode. Derived from the geometry — two
cells on a ray with an opponent in between — rather than carried on the action, so a
client cannot claim to be beating a defender it is not going past.

**Covering defenders charge half rate on a through-dribble**
(`THROUGH_COVERING_BONUS = 1` against `COVERING_DEFENDER_BONUS = 2`). The players either
side are partly being left behind by the same movement. All three rates were measured:

| covering rate | goals/match | dribbles/match | dribble share of progression |
| ------------- | ----------- | -------------- | ---------------------------- |
| +2 (full)     | 1.34        | 1.69           | 13.2%                        |
| **+1 (half)** | **1.32**    | **1.78**       | **13.8%**                    |
| 0 (none)      | **2.60**    | 8.56           | **71.2%**                    |

Zero is not a tuning option: through-balls then win four times in five, the opponent
spams them, and dribbling becomes how the ball moves up the pitch. Full and half are
within noise of each other, and half is the more honest description of what is happening.

**Never the goalkeeper.** A keeper taking a man on is absurd on its own terms and worse
than absurd here — it ends two cells off its line, and a keeper outside its mouth does
not defend the goal at all (ADR 0004). The opponent's own "keeper stays home" regression
test failed the instant this rule existed, which is how it was caught.

**All eight directions.** Restricting it to the attacking direction was measured and
changed nothing — 1.32 goals and 0.99 through-dribbles either way, because the opponent
was already only taking them forward. The restriction would have cost a legitimate
option (beating a man to escape a corner) for nothing.

## Consequences — including a gate that did not pass

200 self-play matches per arm at 5-a-side, against a rebuilt engine:

|                                  | baseline | with the rule |
| -------------------------------- | -------- | ------------- |
| **goals per match**              | **1.51** | **1.32**      |
| shots per match                  | 2.61     | 2.39          |
| shot conversion                  | 58.0%    | 55.4%         |
| **dribbles per match**           | **0.79** | **1.78**      |
| through-the-man per match        | 0.00     | **1.01**      |
| …won                             | —        | 60.6%         |
| progression by a won dribble     | 0.47     | 1.01          |
| progression by a pass            | 7.09     | 6.33          |
| **dribble share of progression** | **6.2%** | **13.8%**     |

**What passed.** Dribbling is a real choice: played more than twice as often, and the
"man in front" case now happens about once a match from nothing. Passing still does
**86%** of progression, so dribbling has not overtaken it.

**What did not.** Goals per match fall **1.51 → 1.32, a 13% drop**. The cause is
mechanical: dribbling is attractive, so more are taken, ~40% are lost, and each loss is
a turnover — possessions end sooner and shots fall with them. Two levers were tried and
neither recovered it (the covering rate is within noise; forward-only changes nothing).

1.32 is still inside the GDD's stated target of 1–3 goals a match, and well clear of the
0.60 that ADR 0007 treated as the problem. It is **not** within a hair of the 1.50 that
ADR 0007 settled on. Which of those two readings "stays in its healthy band" means is
Bernardo's call, and this ADR does not pretend otherwise.

**One AI test changed meaning rather than being weakened.** The opponent's keeper
regression asserted `strayed === 0` across a single match. Its stated concern is a keeper
"walked up the pitch" that "cannot get home in the one action a turnover gives it" — so
it now asserts the keeper is never further from its mouth than its move range. Measured
over 30 matches and ~3,000 keeper-moments, a keeper is off its line 0.07% of the time
and has never been more than one cell out, which it can always walk back. The new
assertion fails the instant it goes two.

Retuning the opponent to rescue the rule was tried and abandoned: raising the
keeper-adrift penalty to full rate broke a _second_ test that exists to assert the
discount is deliberate. Tuning the AI to make a rules change look good is the wrong
direction of causation.

## Alternatives considered

**Also advancing one cell on every won dribble**, not just the through case. The literal
reading of "a won dribble advances one cell beyond the defender". Rejected as a second,
separate buff: shipping two at once would make this balance table unreadable, which is
the mistake this lane is explicitly trying to avoid. It remains available and is the
obvious next thing to measure if 1.32 is judged too low.

**Pushing the beaten defender back** instead of passing through. No new destinations,
but moving an opponent's piece on your action is a new kind of effect and hard to read.

**Dropping `pressedAtOrigin`** so only a contested destination costs a duel. One line,
and it makes escaping a press free — which is the one thing pressing should prevent. Still
worth measuring separately.
