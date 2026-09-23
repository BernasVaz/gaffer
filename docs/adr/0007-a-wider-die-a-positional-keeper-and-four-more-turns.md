# 0007 — A wider die, a keeper defined by position, and four more turns

- **Status:** Accepted
- **Date:** 2026-09-20
- **Supersedes:** nothing (revises numbers locked in GDD v1.5 §6, §9, §10, §13; completes
  the direction set by ADR 0004)
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

GDD §13 carried a balance watch-list: things the engine had surfaced that we deliberately
were not tuning until we could watch real play. ADR 0006 produced the instrument —
`@gaffer/ai` plays both sides, so `pnpm play --matches 150` is a sample of the game rather
than a sample of random noise. This is what it found.

**Goals were far too rare.** Across 150 self-play matches at the locked v1.5 numbers:
**0.60 goals per match**, **42% of matches goalless**, and **44% settled by the penalty
shootout** rather than by football. The GDD's own §13 note — "almost every scripted match
reaches penalties… the fix is goal-scoring, not the shootout" — turned out to be right,
and still true after the ADR 0004 shot model.

Instrumenting where it broke down was decisive, because the obvious diagnosis was wrong.
The ball reached shooting range often enough — it was within `SHOT_RANGE` on 22% of
actions, and a shot was legally on the table 157 times across 80 matches. The problem was
what those shots were worth:

- **Mean odds on an available shot: 34%.** Taking one was usually bad play, because a
  saved shot is a total turnover.
- **The winger took 123 of 152 shots; the striker took 18.** The winger has the mobility
  (Move 3, PAS 3) and so arrives with the ball, but ATK 4 against a keeper on DEF 4 is a
  level duel. The player who could actually beat a keeper was rarely the one who got there.
- **The odds histogram had a hole in the middle.** Of 152 shots, 122 were shown 33% and 17
  were shown 67%, and **not one fell between**. An opposed d3 can only express 0, 11%, 33%,
  67%, 89% and 100%, so the number on the board was effectively a three-valued enum. This
  is exactly the "d3 saturation" item on the watch-list, and it is a Pillar 2 problem: a
  game that promises you always understand your own risk should be able to tell you a
  chance is 45%.

Two further findings came out of the same runs and are recorded here because they shaped
what was _not_ changed:

- **Widening the die does not create goals.** Every step of an attack is a duel the
  attacker is usually favoured in, so a wider die shaves the favourite's edge several
  times over per attack. Measured at keeper DEF 3, d3 and d4 are within noise of each
  other (1.07 vs 1.05 goals per match).
- **Raising the covering bonus _increases_ goals** — +3 gave 1.24 against +2's 1.05,
  because easier tackling produces more turnovers in dangerous areas. It was rejected
  anyway: it worsens the saturation this ADR exists to fix.

## Decision

Three numbers change. Nothing structural does.

| Parameter        | Was | Now    |
| ---------------- | --- | ------ |
| `DUEL_DIE_SIDES` | 3   | **4**  |
| Goalkeeper DEF   | 4   | **3**  |
| `TURN_CAP`       | 20  | **24** |

`COVERING_DEFENDER_BONUS` (+2), `SHOOT_COVERING_BONUS` (+1), `SHOT_RANGE` (2),
`ACTIONS_PER_TURN` (2), `EXTRA_TIME_TURNS` (4) and every other role's stat line are
**unchanged**.

Resulting odds, for the duels that decide matches:

| Duel                              | d3 · keeper 4 | d4 · keeper 3 |
| --------------------------------- | ------------- | ------------- |
| Striker (ATK 5), clean shot       | 67%           | **81%**       |
| Winger (ATK 4), clean shot        | 33%           | **62.5%**     |
| Midfielder (ATK 3), clean shot    | 11%           | **37.5%**     |
| Striker, one defender in the lane | 33%           | **62.5%**     |
| Striker dribbling a lone Defender | 67%           | **62.5%**     |
| …with one covering defender       | 11%           | **19%**       |
| Penalty (Striker v keeper)        | 33%           | **81%**       |

And the match, over 150 self-play matches at `pro`:

| Measure              | Before | After     |
| -------------------- | ------ | --------- |
| Goals per match      | 0.60   | **1.50**  |
| Shots per match      | 1.90   | **2.85**  |
| Shot conversion      | 32%    | **52.7%** |
| Goalless matches     | 42%    | **9.3%**  |
| Decided by football  | 56%    | **80%**   |
| Decided on penalties | 44%    | **20%**   |

## Rationale

- **The die is widened for legibility, not for goals**, and the measurements say that is
  exactly what it buys. A d4 gives 6%, 19%, 37.5%, 62.5%, 81%, 94% — a real spectrum, with
  the middle filled in. It keeps GDD §9's "stats dominate, dice tip" intact: a +1 edge is
  still a clear favourite at 62.5% and a +2 edge is 81%. And it answers the watch-list
  directly: a +3 gap is now 94% rather than certain, so a Winger tackling a Striker is a
  long shot instead of a mathematical impossibility.
- **Keeper DEF 3 finishes the move ADR 0004 started.** That ADR took the keeper's identity
  from a stat line ("best defender in the game") to a position ("the only player allowed in
  the goal, and only dangerous while in it") and went halfway on the number. Going the rest
  of the way is what makes three different players carry three different qualities of
  chance — 81%, 62.5%, 37.5% — which is what turns "get anyone into the box" into "get the
  _right_ player into the box". It is the bluntest lever on ADR 0004's own list and it was
  used last, after the die and after the opponent's own mistakes had been ruled out.
- **Four more turns, because attacks were running out of pitch.** Possession changes hands
  roughly every two and a half actions and an attack needs three or four to finish, so a
  meaningful share of matches simply ended mid-move. The extra four turns are worth about
  15% more goals, cut goalless matches from 12% to 7%, and touch no duel maths at all.
  Match length stays inside GDD §11's 3–5 minute target.
- **Penalty conversion resolves itself.** The second watch-list item — "penalties may want
  their own, higher conversion odds… they currently convert a third of the time" — needs no
  special rule now. The ordinary shot duel puts a penalty at **81%**, against real
  football's ~78%. A penalty is once again something you expect to be scored, and the
  shootout no longer needs 22 kicks to separate two sides.

## Consequences

**Positive**

- A match is decided by football 80% of the time, against 56% before. The shootout is back
  to being a rare tiebreaker rather than the usual result.
- The odds shown on the board are now informative across their whole range, which is what
  Pillar 2 promised and a three-valued number could not deliver.
- Both GDD §13 watch-list items are closed, with numbers rather than opinions.
- The game is measurably side-neutral: the same 150 seeds played from either end give
  identical goals, shots, conversion and goalless rates, with win rates exact mirrors.

**Negative / accepted costs**

- **The keeper is now a worse defender than the Defender.** Its distinctiveness is entirely
  positional. If keepers ever feel like a formality rather than an obstacle, this number is
  the first to look at, and raising it back to 4 costs roughly a third of the goals.
- **A clean striker's shot at 81% is close to a formality.** That is deliberate — the work
  is in getting the striker a clean look, not in the finish — but it does mean a defence
  that lets that happen is already beaten.
- **Kicking off is worth about 62% of matches.** This is unchanged by anything here and is
  a property of a low-scoring game where the first completed attack usually wins. GDD §10's
  final tiebreaker rung already compensates in the right direction. The client makes it
  explicit rather than hiding it: choosing a side is choosing whether you kick off.
- **Every odds number in the docs, tests and prose moved.** Nineteen tests encoded the old
  values; they now encode the new ones, which is the system working.

**Revisit if**

- Playtest against a human reads differently from self-play. The opponent is competent but
  it is not a person, and it never panics.
- The 62% kickoff advantage becomes something players notice and resent, in which case the
  lever is the kickoff position itself, not the duel maths.
- Squad-building arrives. Every number here assumes both sides field the identical five.

---

## Clarification — 2026-09-23

Added as a dated note rather than an edit, because an accepted ADR is not rewritten
(`docs/engineering.md`). It settles a reading that came up twice while tuning dribbling:

> **The goals-per-match health target is ~1.50.** The 1–3 range quoted elsewhere is the
> _acceptable envelope_, not the target. A change that lands at 1.3 is inside the
> envelope and is still a regression against the number this ADR settled on.
