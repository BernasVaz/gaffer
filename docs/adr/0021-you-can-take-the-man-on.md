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

## Consequences

Taking the man on is **half** of the change. On its own it costs the match goals, and
the second half — a won dribble carrying on one more cell (ADR 0023) — is what pays them
back. The two shipped together, and the table below is the progression across both.

600 self-play matches per arm at 5-a-side, each against a freshly rebuilt engine:

|                                  | baseline | take the man on | **+ carry on** |
| -------------------------------- | -------- | --------------- | -------------- |
| **goals per match**              | **1.45** | 1.32            | **1.43**       |
| shots per match                  | 2.68     | 2.39            | 2.44           |
| shot conversion                  | 54.1%    | 55.4%           | 58.8%          |
| **dribbles per match**           | **0.71** | 1.78            | **2.05**       |
| through-the-man per match        | 0.00     | 1.01            | **1.35**       |
| …won                             | —        | 60.6%           | 61.0%          |
| progression by a pass            | 6.95     | 6.33            | 6.25           |
| **dribble share of progression** | **5.1%** | 13.8%           | **15.0%**      |

**Taking the man on alone costs about a tenth of the goals.** Mechanically: dribbling
becomes attractive, so more are taken, about 40% are lost, and each loss is a turnover —
possessions end sooner and shots fall with them. Two levers were tried against it and
neither recovered anything (the covering rate is within noise; restricting it to the
attacking direction changes nothing at all). What recovers it is giving a won dribble
something to be worth.

**A correction worth recording.** The first report of this put the baseline at **1.51**
and the drop at 13%. That baseline was a 200-match estimate running high; measured over
600 it is **1.45**, so the drop was nearer 9%. The middle column did not move — only
what it was being compared against did. Two hundred matches is not enough to argue about
a tenth of a goal, and this ADR would otherwise have recorded a sharper regression than
ever existed.

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
