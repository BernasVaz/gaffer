# 0004 — A shot is defended by whoever is guarding the goal, not by a stat line

- **Status:** Accepted
- **Date:** 2026-08-07
- **Supersedes:** nothing (revises numbers locked in GDD v1.0 §6, §9, §13)
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

The engine reached a playable state and the first thing it revealed was that the game
did not score. Across 300 simulated matches, **98.3% were settled by the penalty
shootout** rather than by football, and a hand-played match produced no goals at all.

The arithmetic explained it. A shot was `shooter ATK` against `keeper DEF`, and the
keeper's DEF of 5 equalled the highest ATK in the game. The best possible shooter
therefore faced a _level_ duel, which GDD §9 gives to the defender on a tie: **3/9, or
33%**. One defender in the lane, charged the standard covering rate of +2, took it to
**1/9**. Every other duel in the game can be improved by position and support; this one
could not, because there is no attacking equivalent of a covering defender.

Two further problems surfaced alongside it:

- The keeper defended a shot **from anywhere on the pitch**. It could stand on the
  halfway line and still save with DEF 5, so there was no way to play _around_ it — only
  through it.
- A goal mouth was three ordinary cells. An attacker could walk into the net and then
  take a shot at the goal it was standing inside, which is incoherent and was reachable
  in normal play.

## Decision

The shot stops being a fixed matchup and becomes a positional one.

1. **Keeper DEF 5 → 4.** A clean striker is now a +1 favourite at **6/9 (67%)**.
2. **The keeper defends only while it stands in its own goal mouth.** Off the line it is
   an ordinary player. The shot is then led by the best defender in the lane; with the
   lane clear there is **no duel at all** — an open goal is a certainty, not a gamble,
   and resolving it consumes no dice.
3. **Covering on a shot is +1**, against +2 in open play.
4. **Only the defending keeper may occupy a goal mouth.** Outfielders of both sides are
   barred from those three cells, which blocks movement into them exactly as a body does.

Resulting odds for a striker (ATK 5):

| Situation                    | Before | After    |
| ---------------------------- | ------ | -------- |
| Clean, keeper in goal        | 33%    | **67%**  |
| One covering defender        | 11%    | **33%**  |
| Two covering defenders       | 0%     | **11%**  |
| Keeper drawn out, lane clear | 33%    | **100%** |

## Rationale

- **The keeper's identity moves from a stat to a position.** "Best defender in the game"
  was doing all the work and could not be played around. "The only player allowed in the
  goal, and only dangerous while in it" gives the attacker something to attack and the
  keeper something to lose. It also makes the keeper's move range of 1 meaningful: one
  step off the line is a real decision with a real cost.
- **Softening covering only on shots, not everywhere.** The field rate of +2 is load-
  bearing for dribbles and tackles and was not the problem. A shot is the one duel that
  already has a specialist defender in it, so stacking the field rate on top double-
  counted the defence.
- **Barring the mouth removes an incoherence rather than adding a rule.** A goal is
  something you shoot into. Making the cells unenterable is the smallest change that
  makes that true, and it leaves the keeper's locked starting cell legal.
- **An open goal is not a duel.** Modelling it as a certainty rather than a 100% roll
  keeps the "no dice on uncontested actions" invariant intact, which is what lets a
  replay insert an uncontested action without rewriting the rolls after it.

## Consequences

**Positive**

- Scoring is a path a player can plan: work the ball in, or force the keeper to commit.
- The odds shown on the board now vary with the board, which is what "skill stacks the
  deck" (GDD §9) promised and shots did not deliver.
- The "attacker standing in the net" state is unrepresentable.

**Negative / accepted costs**

- **The keeper is no longer the outright best defender** — DEF 4 ties it with the
  Defender. Its distinctiveness is now positional, and §6's flavour text changed to say
  so.
- **Stepping off the line is severe.** With a clear lane it is an instant open goal, so a
  keeper that presses is making a large bet. That is deliberate, but it is the sharpest
  edge in the game and the first thing to look at if keepers feel unplayable.
- **Two covering bonuses now exist.** `COVERING_DEFENDER_BONUS` (+2) and
  `SHOOT_COVERING_BONUS` (+1). One more number to keep straight, and a future change to
  "covering" has to say which.
- Outfielders lose access to three cells at each end, which slightly shortens the
  east–west rays near goal.

**Revisit if**

- Playtest shows keepers never leave the line, which would mean the punishment is too
  large and the mechanic is dead rather than tense.
- Scoring swings too far the other way. The levers, in order of bluntness: the guarding
  zone (mouth only, versus mouth plus adjacent), `SHOOT_COVERING_BONUS`, `SHOT_RANGE`,
  then keeper DEF.
- The d3 saturation noted in GDD §13's watch-list is addressed, since a wider die would
  change every number here.
