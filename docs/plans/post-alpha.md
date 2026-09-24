# After the alpha freeze

Things deliberately **not** done before the freeze, each with the reasoning that deferred
it. Nothing here is a bug to be fixed quietly; each was a decision, and each has a named
trigger for picking it back up.

The freeze itself is the point: the alpha exists to put the game in front of people, and
every further change before that is a change nobody asked for based on an opponent
playing itself.

---

## 1 · The 7-a-side lever — tighten interception, if playtest says so

**Trigger:** playtest reports that 7-a-side feels goal-happy.

7-a-side plays at **1.99 goals a match** and line-of-sight passing (ADR 0025) took it to
**2.11** — inside ADR 0007's 1–3 envelope, the furthest of the three formats from the
~1.50 it is centred on, and about 1.7σ over 1,000 matches an arm, which is suggestive
rather than settled.

**Reach for interception first, and not for anything else.** The duel fires on **9%** of
passes at 7-a-side and **0.3%** at 5-a-side, so tightening it bites almost only on the
format that moved and barely touches the one that did not. `actionsPerTurn` and `turnCap`
hit everything; a pass nerf changes what a pass is.

Full reasoning in ADR 0025 ("The pre-identified 7-a-side lever") and ADR 0024's
watch-item.

**Why not now:** tuning a core duel mechanic to chase a tenth of a goal that self-play
cannot resolve is the over-fit this project has twice decided against. Fifteen to thirty
people will answer this better than another thousand matches will.

---

## 2 · The off-ray goal mouth that no body can cover

**Trigger:** whenever the shot is next opened up. Not urgent; it is a seam, not a leak.

`shotLaneCells` measures a shot down the **eight rays** only, so a shot aimed at a mouth
cell that lies off every ray from the shooter **cannot be covered by a defender standing
directly in front of it**. There is no lane for that defender to be in.

That is genuinely odd, and the obvious fix — point it at the same `laneBetween` a pass
now uses — is one line, makes the code more coherent, and **makes the game worse**:

|                      | rays (kept) | true flight |
| -------------------- | ----------- | ----------- |
| goals per match      | **1.44**    | 1.37        |
| shot conversion      | **58.6%**   | 54.8%       |
| **goalless matches** | **3.8%**    | **6.5%**    |

_(600 matches an arm at 5-a-side.)_ More defenders end up in front of more shots, and the
shot is the verb with the least slack in it. Goalless nearly doubling settled it.

So the coherent change is the wrong change **as a drop-in**. Closing the seam properly
means rebalancing the shot at the same time — a bigger piece of work than passing was,
and not one to start in the same breath.

---

## 3 · Penalty aiming and a dive mini-game

**Trigger:** only if playtest says the shootout is flat once people have taken a few.

ADR 0026 made the kicks played rather than tallied, and stopped there on purpose. Aiming
(the taker picks a corner, the keeper picks a dive) would add a decision to a mechanic
whose appeal right now is that it is the game's existing duel at its most naked — and it
would be a **new balance surface**, which is the one thing a freeze is for not having.

It is also the change that would break the current design's best property: the engine
resolves the whole shootout up front, so it replays from a seed with no client attached.
Real aiming needs a command per kick, and every one of those guarantees would then need
defending separately. Worth it only if the shootout turns out to need it.

---

## 4 · Asynchronous multiplayer

Planned in [`async-multiplayer.md`](async-multiplayer.md), and unblocked now that the
engine is versioned (ADR 0022, rules edition 3). Still after playtest: stored matches
multiply the cost of every rules change, and the alpha exists to produce rules changes.

---

## 5 · Cards and discipline

Deferred by decision. If it ever happens, a sin-bin is the preferred shape — it is a
tempo mechanic rather than a punishment, which is the only version that fits a match this
short.

---

## Standing method notes

Two mistakes were made twice each during the alpha lane, and both are cheap to avoid:

- **A tenth of a goal needs four figures of matches, not three.** A 100-match run put
  7-a-side at 2.13 when it is 1.99; a 200-match run put 5-a-side's baseline at 1.51 when
  it was 1.45. Both were quoted as measurements and both were wrong in a way that changed
  a decision.
- **Measure against a rebuilt engine, and treat "identical to baseline" as a suspected
  no-op.** `tools/play` imports the built `dist`. Every A/B in this lane carries an
  explicit build guard for this reason, and it caught three genuine no-ops.
- **`.gitignore` covers binaries; stage explicit paths; never blind `git add -A`.** A
  137 MB installer sitting in `FeedbackLogs/` was swept into a commit by a blind
  `git add -A`, GitHub rejected the push at its 100 MB limit, and the commit had to be
  unpicked. The ignore rules now cover binaries, and the lesson generalises past size:
  `add -A` commits whatever happens to be in the tree, which is not the same thing as
  what the change is.
