# Gaffer — Game Design Document (v1.13 — LOCKED, v1 baseline)

_Codename Gaffer · Studio WACAIDO · M1 deliverable. This is the **implementable baseline**: the design is complete enough to build with no open questions. Values marked *(tunable)* are locked starting numbers we will refine in playtest — changing them is a data edit, not a redesign. This is the contract the engine (M2) is built and tested against._

> **Decision log**
>
> - **v0.1 → v0.2:** resolution moved to bounded, transparent dice in duels only.
> - **v0.2 → v0.3:** dropped the tactic-card system for free direct movement + a fixed action economy + role-based movement range; collection hook moved to squad-building.
> - **v0.3 → v1.0:** closed all nine open decisions (§13); fixed drifted section cross-references. Design is now implementable.
> - **v1.0 → v1.1:** pinned down what building legal-action generation exposed as under-specified — movement and passing geometry, the goal's shape, `SHOT_RANGE`, the Move/Dribble boundary, and Tackle as an atomic action that no longer bundles movement (§5, §7, §13). No change to stats, duels, information or the win condition.
> - **v1.1 → v1.2:** `SHOT_RANGE` cut from 3 to 2. At 3 the kickoff spot sat exactly in range, so a match could open with a strike at goal; 2 forces the ball into the attacking third first.
> - **v1.2 → v1.3:** bounded the win condition (§10, §13) — extra time is 4 turns, then a penalty shootout of 3 kicks plus 10 sudden-death rounds, then most shots, then most duels won, then the side that did not kick off. A tiebreaker cascade was needed because §10 forbids draws and no symmetric shootout terminates on its own.
> - **v1.3 → v1.4:** made scoring possible. Keeper DEF 5 → 4; the keeper defends a shot only while standing in its own mouth, so drawing it out opens the goal; covering on a shot softened to +1; and only the defending keeper may occupy a goal mouth, which closes the hole where an attacker could stand in the net and shoot at it (§5, §6, §7, §9, §13). See ADR 0004.
> - **v1.4 → v1.5:** brought feel into v1 scope (§14). Playtesting the first interactive build showed that an instant result reads as a state change rather than as football, which Pillar 1 depends on. Movement, the goal moment and the duel reveal are now in; animation stays presentation-only and may never affect the engine or its determinism. See ADR 0005.
> - **v1.12 → v1.13:** you can **take the man on** (§7). A carrier may dribble _through_ an adjacent opponent onto the cell beyond — the one destination a plain Move can never reach, and the reason dribbling was ornamental: before this every dribble ended somewhere a move could also have reached, so it was a duel with no upside. The duel is with the man being gone through, and the players either side cover at half rate (`THROUGH_COVERING_BONUS`). Never the goalkeeper. Measured at 5-a-side over 200 matches a side: dribbles per match **0.79 → 1.78**, passing still does 86% of progression — and goals per match **1.51 → 1.32**, which is inside the 1–3 target but below the 1.50 ADR 0007 settled on. See ADR 0021.
> - **v1.11 → v1.12:** the clock now counts the phase the match is in (§8, §10). Regulation counts to the **turn cap**; extra time is its own explicit state counting again from one. The scoreboard had been showing the cap _plus_ extra time as one denominator, so a match finishing on the cap read as though it had stopped short of an ending most matches never reach — measured over 120 self-play matches, **none ends before the cap**. Presentation only; no rule changed. See ADR 0020.
> - **v1.10 → v1.11:** presentation only, and no rule moved. The board is **upright by default everywhere** with a toggle (ADR 0019, superseding ADR 0014's media query), and it now fits the height it is given as well as the width, so the whole field is visible without scrolling at every screen size. Every new game draws a **fresh seed**; a shared link still carries its own. Duels show their **dice in full** — `D4 3+2 v 3+1` — and the win-chance badges can be hidden, which changes what is drawn and not what §9 guarantees is knowable. Four information panels — player attributes, match statistics, duel results and a commentary ticker — all derived from the state and the log.
> - **v1.9 → v1.10:** made a kickoff a **pass** (§7). Until now a match opened with whatever the kicking side fancied, and because the two strikers start adjacent that was a dribble straight into the opponent stood next to it — the one thing a kickoff is not. The side kicking off may now only Pass on its first action, at the opening whistle and after every goal; giving the turn away forfeits it rather than holding it over. Goals per match stay in their band across all three formats. See ADR 0018.
> - **v1.8 → v1.9:** gave the goalkeeper a **Launch** — a long ball upfield to a team-mate past its own passing range, out to a per-format `launchRange` of 4, 5 and 7 (§7, §13). It is a sixth verb rather than a longer pass so that the odds, the wording and the ring on the board can all say which one it is: a launch hands the defence **+1** on the interception duel, because a ball that long is a ball you can see coming. Measured over 60 self-play matches at each format, with the verb on and off, goals per match are unchanged to two decimal places and every win-rate move is one match in sixty — because it is **rare**, which is the finding worth recording: 71% of a keeper's long rays end in empty grass, so the limit is not the range and not the blocking, it is that there is nobody out there to aim at. See ADR 0015.
> - **v1.7 → v1.8:** shipped the game modes §12 always promised. 7-a-side (9×7, 2-3-1) and 11-a-side (13×9, 4-4-2) join 5-a-side as **alpha**, selectable before kickoff and carried in the link. **No rule changed** — the engine was already written against a board and a squad — but the numbers that scale with a pitch moved onto the match itself (§13). The one that mattered was not the turn cap: it was **actions per turn**, which is 2, 3 and 4. At 2 everywhere, the bigger formats produced 0.65 goals a match with 40–50% goalless. See ADR 0012 and ADR 0013.
> - **v1.6 → v1.7:** doubled extra time, 4 turns → **8**. Re-measuring v1.6 for the record showed its shootout figures had been taken mid-branch and were wrong: matches decided on penalties went 38.7% → 35.3%, not 44% → 20%. The goals were real (0.99 → 1.50) — what they did not do was reduce draws, because killing _goalless_ matches turns 0–0 into 1–1. §10's reason for a short extra time ("goals are scarce, so it mostly delays the shootout") was true at 0.6 goals a match and false at 1.5: golden goal now fires. Penalties fall to **24%**, golden goals rise to **17%**, at about one turn on the average match. See ADR 0011.
> - **v1.5 → v1.6:** tuned the match on evidence. A solo opponent (ADR 0006) made self-play possible, and 150 matches at the v1.5 numbers produced 0.60 goals a match with 42% goalless and 44% settled on penalties. Three numbers moved: the duel die d3 → **d4**, keeper DEF 4 → **3**, turn cap 20 → **24**. Both §13 watch-items are closed by the change — the d3 saturation directly, penalty conversion as a consequence (33% → 81%). Result: **1.50 goals a match, 9% goalless, 80% decided by football**. See ADR 0007. The solo opponent also moves from "out of scope" to shipped (§14).

---

## 1. Vision & pillars

Gaffer is a 1v1 football game with the mind of a board game. A match should feel **quick, deep, and fair** — you finish it and immediately want another, and win or lose you understand exactly why.

- **Pillar 1 — "One more game."** Short, moreish matches; you leave hungry to requeue. _(Clash Royale's magic.)_
- **Pillar 2 — Earned outcomes.** Every result is legible — traceable to decisions and to risks you could see, never to hidden luck. _(Chess's magic.)_

When a choice is unclear, pick the option that best serves these two.

## 2. The concept, in one line

> A turn-based, perfect-information football duel where you directly command your squad — pick a player and move or act within a fixed pool of actions each turn — and contested actions resolve on stats plus a roll whose odds you see before you commit.

## 3. Design spine (LOCKED)

- **Turn-based**, alternating deliberate turns; urgency from short matches + a per-turn timer.
- **Perfect information** — both players see the entire board. No fog.
- **Free direct control** — pick any of your players and act with them (drag to a destination / choose the action). No command cards.
- **Fixed action economy** — **2 actions per turn**, spent across your players.
- **Movement ranged by role** — each role moves up to its own distance (§6).
- **Variance in duels only** — contested actions resolve as **stat + attack die vs stat + defence die**, odds always shown (§9). Everything else is deterministic.
- **Full squad starts on the pitch.**
- **Win by hybrid turn-cap + sudden-death** (§10).
- **v1 = nail the match.** Ladder, squad-collection, progression come _after_.

## 4. What we take from each touchstone

| Game                             | What we take                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Chess / checkers**             | Direct control of pieces already on the board; perfect information; skill-attributable results |
| **Tactikick (your prototype)**   | The validated feel: pick a player, drag, choose the action; an actions-per-turn economy        |
| **Blood Bowl / tabletop sports** | The duel: **stat + roll**, favourite usually wins, the upset is the drama of sport             |
| **FIFA Ultimate Team**           | _(later)_ the meta hook: collect players and build your XI                                     |
| **Clash Royale**                 | _(later)_ short sessions and the ladder-climb loop                                             |

Synthesis: **the direct honesty of chess, the drama of a sporting duel, the pull of building your own squad — as football.**

## 5. The pitch (LOCKED)

- A discrete **grid**; one piece per cell; perfect information.
- **v1 flagship: 5-a-side on a 7 columns × 5 rows pitch** _(tunable)_ — readable at a glance, room for real positioning.
- One side attacks left→right, the other right→left.
- **The goal is a 3-cell mouth** at each end: the middle three cells of that end column (rows 1–3 on the 5-row pitch). Not the whole goal-line — scoring from the touchline should not be a thing. The mouth is exactly what a keeper on the goal-line centre can cover with its move range of 1, which is how the two numbers stay in step.
- **Only the defending keeper may stand in a goal mouth.** It is what a shot is aimed _into_, not somewhere a player stands — outfielders of both sides are barred, so nobody can walk into the net and then shoot at the goal they are standing inside. The goal-line cells either side of the mouth are ordinary pitch and anyone may use them.
- **Directions and distance:** movement and passing both travel in straight lines along any of the **8 compass directions**, and distance is counted in **steps**, so a diagonal step costs the same as an orthogonal one (Chebyshev distance).
- **Data-driven dimensions:** pitch and squad size are config, so 7-a-side and 11-a-side become **game modes** later. Only 5-a-side is balanced and shipped for v1.

## 6. The squad, roles & stats (LOCKED, values tunable)

**5 players per side: 1 Goalkeeper + 4 outfield.** Three duel stats (1–5) plus a movement range. **PAS governs both passing distance and movement/mobility** — there is no separate PACE stat in v1.

| Role       | ATK | DEF | PAS | Move (cells) | Feel                                    |
| ---------- | --- | --- | --- | ------------ | --------------------------------------- |
| Goalkeeper | 1   | 3   | 2   | 1            | The only player allowed in the goal     |
| Defender   | 2   | 4   | 3   | 2            | Wall; strong in the tackle              |
| Midfielder | 3   | 3   | 4   | 3            | Engine; links play, covers ground       |
| Winger     | 4   | 2   | 3   | 3            | Threat; beats defenders wide            |
| Striker    | 5   | 1   | 2   | 2            | Finisher; deadly, little defensive help |

The keeper's DEF of **3** is lower than the Defender's, and that is the point. ADR 0004 began moving the keeper's identity from a stat line to a position and ADR 0007 finished the move: what makes a goalkeeper is that it is the only player allowed to stand in a goal and the only one who defends a shot while it does. A big number was doing work that position should do, and it made the goal unplayable-around.

No per-player hidden variation — a Striker is a Striker. Collection identity comes later via the **squad you build**, not stat rolls. (Starting formation on the 7×5 pitch to be set at the top of M2 and tuned.)

## 7. The ball & actions (LOCKED)

- One **ball**; one carrier; possession is central.
- The action menu (each costs one of your 2 actions per turn; only the goalkeeper gets Launch):
  - **Move** — relocate a player in a straight line along one of the 8 directions, up to its role's Move range, onto an empty cell. **Automatic** (no duel). The first occupied cell in a direction blocks it: you may not move onto or through an occupied cell.
  - **Kickoff** — at the opening whistle and after every goal, the side restarting **may only Pass** with its first action. A kickoff is a pass in football, and the formations put the two strikers next to each other, so without this a match opened with a dribble into the nearest opponent. Ending the turn early forfeits the obligation instead of carrying it forward.
  - **Pass** — send the ball the same way: a straight lane in one of the 8 directions, up to the passer's **PAS** range, to the first player in that direction — legal only if that player is a teammate. **Automatic** if no opponent is beside the lane; a **duel** (passer **PAS** vs interceptor **DEF**) if one is. Either way the pass is offered, and the odds are shown before you commit.
  - **Launch** — a **goalkeeper** carrying the ball may kick it long: the same straight lane and the same first-player-blocks rule as a Pass, but out to the format's **`launchRange`** (§13) rather than to the kicker's PAS, and only to a team-mate **beyond** its own passing range — so a Pass and a Launch are never offered for the same team-mate. An outlet to relieve a press or start a counter. A clear lane is **automatic**, exactly like a Pass; a lane with an opponent beside it is the same interception duel (**PAS** vs **DEF**) **plus `LAUNCH_INTERCEPT_BONUS` to the defence**, because the ball is in the air long enough to be read. Lose it and the interceptor collects, the same as a Pass. `launchRange` is roughly half the board, so a keeper on its line can always reach the opposition half when the lane is clear.
  - **Dribble past your man** — a carrier may dribble **through** an adjacent opponent, ending on the cell directly beyond them, when that cell is on the board, empty and one it may occupy. A **duel** against _that_ opponent (**ATK** vs **DEF**), with anyone else adjacent covering at half the usual rate. Win and the carrier is past him with the ball; lose and it is a turnover, the carrier staying where it was. **Goalkeepers may not** — a keeper two cells off its line does not defend its goal (§7, ADR 0004). This is the only destination a Move can never reach.
  - **Dribble** — the contested version of a carrier's move: identical geometry, but a **duel** (**ATK** vs **DEF**). A carrier's move is a Dribble when the carrier is **adjacent to an opponent at its origin or at its destination**; otherwise it is a plain Move. Escaping a press and advancing into contact are therefore both contested, while a clean run through open space is free even if it passes near an opponent. Move and Dribble are mutually exclusive for a given destination — the carrier never gets to choose the free version of a contested move.
  - **Tackle / Press** — a defender **already adjacent to the carrier** challenges it. A **duel** (defender **DEF** vs carrier **ATK**). This is a single atomic action and does **not** bundle movement: getting a defender next to the carrier costs a separate Move first. A defender already in position may therefore press on consecutive turns.
  - **Shoot** — if the carrier is within **SHOT_RANGE** of the opponent's goal mouth (§5), a single **duel** (shooter **ATK** vs whoever is defending the goal). See §9. Shots are not aimed at a particular cell in v1, and defenders in the lane do not block the shot — they add to the defending total (§9).
    - **The keeper defends only while it is standing in its mouth.** Step off the line and the goal is unattended: the shot is then contested by whoever is in the lane, and if the lane is clear it is an **open goal** — no duel, no dice, a certain goal. Drawing a keeper out is meant to be a way to score, so it has to cost its side something real.
- **Adjacency** throughout means the 8 surrounding cells.
- On a turnover, possession flips — a key swing moment.
- **After a goal, positions reset for a kickoff.**

## 8. The turn & action economy (LOCKED)

With no cards, the per-turn tension comes from **scarcity of actions**:

1. **Start of turn:** the whole board is visible; you have **2 actions**.
2. **Act:** pick a player, choose an action; the board previews the exact result, and any duel shows its **win %** before you commit. You may use both actions on one player or split them across two.
3. **Resolve** each action (duels via §9).
4. **Pass** to opponent when your actions are spent (or end early). A per-turn **timer** _(≈25s, tunable — and client-side, so it doesn't affect the engine)_ keeps matches brisk.

The core decision each turn: with only two actions, _what is the highest-value thing I can do_ — advance, create a duel at good odds, deny my opponent's next move, or set up a better position? Because information is perfect, your opponent sees your setup and responds — a readable back-and-forth of position and tempo.

**Worked example:** 2 actions. Ball's with your Midfielder. **Action 1 — dribble** past a Defender (shown 65%); it lands. **Action 2** — your Striker is near the box: shoot (shown 45% vs the keeper) _or_ pass wide to your Winger in space (automatic) to set up a cleaner shot next turn. You pass. Turn passes; your opponent sees the threat and moves a Defender to cover — visibly dropping your next-turn odds.

## 9. Duel resolution — "stat + roll, always shown" (LOCKED, numbers tunable)

Every contested action is a duel:

> **Attacker total = relevant stat + attack die (d4). Defender total = relevant stat + defence die (d4). Higher wins; a tie goes to the defender.**

- **Stats used:** dribble/shot = attacker **ATK** vs defender **DEF**; keeper defends a shot with **DEF**; a pass into a covered lane = **PAS** vs interceptor **DEF**.
- **The die is a d4 so stats dominate** _(tunable):_ a +1 edge ≈ 63%, a +2 edge ≈ 81%. The favourite usually wins; the die decides only close calls. It was a d3 until v1.6, which could only ever express six odds — 0, 11%, 33%, 67%, 89%, 100% — so there was no such thing as a 45% chance and any gap of three or more removed the die from the game. A d4 fills the middle in (6%, 19%, 37.5%, 62.5%, 81%, 94%) and leaves a sliver at +3, which is what the §13 watch-list asked for. See ADR 0007.
- **Modifiers shift the odds before the roll** _(tunable):_ each **covering defender adjacent to the duel = +2 DEF** in open play, but only **+1 on a shot**. A shot already faces a keeper; charging the field rate on top drove any covered effort to near zero and made bodies in the box worth more than the goalkeeper.
- **A shot is defended by whoever is actually guarding the goal.** The keeper contributes its DEF only while it stands in its own mouth. Off the line it is just another player: the shot is led by the best defender in the lane, and with the lane clear there is **no duel at all** — an open goal is a certainty, not a gamble.
- **Three safeguards (LOCKED as principles):**
  1. **Stats dominate, dice tip.** Big edges near-certain; roll decides close calls.
  2. **Odds always shown before commit.** A loss on a chance you took is "I gambled and it didn't land," not hidden RNG.
  3. **Skill stacks the deck.** Support and position shift the shown odds — a covering defender turns a 63% dribble into ~19%.
- **Worked odds:** Striker (ATK 5) dribbles a lone Defender (DEF 4), d4 each → ~63%. Add a covering Midfielder (+2 DEF → effective DEF 6) → the Striker is now the underdog, ~19%. Shown, then you choose.
- **Worked odds at goal:** a clean Striker against a keeper on its line is **81%**; a Winger is **62.5%**; a Midfielder is **37.5%**. One defender in the lane takes the Striker to 62.5%. Who arrives in the box matters as much as whether they get a shot away.

**Design rule:** if a player couldn't have anticipated the _odds_ from the visible board, the rule is wrong.

## 10. Win condition (LOCKED)

- A match runs to a **turn cap of 24 turns (12 per side)** _(tunable to a ~3–5 min match)_. Highest score at the cap wins. Raised from 20 in v1.6: possession changes hands roughly every two and a half actions and an attack needs three or four to finish, so at 20 a real share of matches ended mid-move (ADR 0007).
- **Sudden-death:** level at the cap → **golden goal in extra time** — the first goal wins immediately.
- **Extra time is bounded: 8 turns, 4 per side** _(tunable)_. It has to be bounded at all because "play until someone scores" has no upper bound and an engine cannot be asked to run it. It was 4 until v1.7, on the reasoning that scarce goals made a longer extra time a delay rather than a reprieve — true at 0.6 goals a match, false at 1.5. At 8 turns golden goal decides one match in six, where it decided one in twenty (ADR 0011).
- After every goal (regulation or extra time), **positions reset for a kickoff** to the conceding side.
- **No flat draws.** Level after extra time goes to a decision cascade, tried in order:

  1. **Penalty shootout** — 3 kicks a side, then sudden death capped at **10 rounds**. Each penalty is the ordinary shot duel (taker **ATK** vs keeper **DEF**, opposed d4, tie to the keeper) with no covering defenders, which converts at **81%** — close to real football's ~78%, and no longer the 33% that made shootouts run for 22 kicks. Nothing is chosen by the players, so the engine resolves the whole shootout in one step from the match's own seed and hands back the kicks for the client to play out. _(Auto-resolved in v1; interactive penalties are a possible later feature.)_
  2. **Most shots attempted** across the match.
  3. **Most duels won** across the match.
  4. **The side that did not take the opening kickoff.** The kickoff is the game's only structural asymmetry — one side moves first with the ball — so the other takes a tie nothing else could settle. That side also kicks first in the shootout, for the same reason.

  Rung 4 cannot tie, which is what guarantees every match ends. A shootout **cannot** provide that guarantee on its own: two evenly matched sides settle a sudden-death round at most half the time, so the tail never closes — the cap only makes reaching rung 2 rare (roughly one shootout in a thousand).

## 11. Match-length target

**~3–5 minutes.** Grid, squad, action count, turn cap, and timer all tuned to hit this.

## 12. Game modes

All three are **playable now** and chosen before kickoff; the game type travels in the match link, so a shared link is the same game as well as the same dice.

|        | **5-a-side** | 7-a-side | 11-a-side |
| ------ | ------------ | -------- | --------- |
| Pitch  | 7 × 5        | 9 × 7    | 13 × 9    |
| Squad  | 1 GK + 4     | 1 GK + 6 | 1 GK + 10 |
| Shape  | 1-1-2-1      | 2-3-1    | 4-4-2     |
| Status | **balanced** | alpha    | alpha     |

**Same rules, every one of them.** Adding two formats changed no rule in the engine: it was already written against a board and a squad rather than against seven columns and five players, exactly as §5 promised. What differs is data — the pitch, the line-up, and the four numbers in §13 that scale with them.

**Alpha means playable and measured once, not broken.** 5-a-side took two rounds of tuning to settle (ADR 0007, ADR 0011); the other two have had one pass, aimed only at "is anything obviously wrong". Real players are how they get tuned. The interface marks them, so nobody mistakes a rough edge for a verdict (ADR 0013).

A shorter "Blitz" remains a later idea, and is now a row of data rather than a project.

## 13. Locked v1 parameters (tunable in playtest)

The numeric knobs, in one place — all live as Zod data in `@gaffer/shared`, so tuning is a data change, not code.

**Five of them scale with the pitch** and therefore live on the match rather than as one global value (ADR 0012). Everything else below is the same at every game type.

| Scales with the pitch | 5v5   | 7v7   | 11v11 |
| --------------------- | ----- | ----- | ----- |
| **Actions per turn**  | **2** | **3** | **4** |
| Turn cap              | 24    | 32    | 44    |
| Extra time            | 8     | 10    | 14    |
| SHOT_RANGE            | 2     | 2     | 3     |
| launchRange           | 4     | 5     | 7     |

Actions per turn is the one that decides whether a format works at all, and it was not the one we expected. An attack needs a certain number of actions to cross a pitch, and that number grows with the pitch — where a bigger turn cap only buys more turns of the same inadequate length. At 2 actions everywhere, 7-a-side produced **0.65 goals a match with 40% goalless** and 11-a-side **0.63 with 50%**; at 3 and 4 they produce **1.50** and **1.28**, against 5-a-side's 1.63.

`launchRange` is the keeper's long ball (§7), and it scales for the same reason
SHOT_RANGE does: what it is _for_ — clearing your own half — is a fraction of the pitch,
not a number of cells. Roughly half the board's length at each format, so a keeper on its
own line can always find somebody past halfway when the lane is clear.

The goal mouth deliberately does **not** scale. A goal in football is a fixed physical size and the pitch grows around it, and 3 cells is exactly what a keeper on its line covers with a move range of 1 — widening it on a bigger pitch would hand the attacker a goal no keeper could defend.

The 5-a-side column below is unchanged from v1.7:

| Parameter                   | v1 value                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| Actions per turn            | 2 at 5-a-side (§12 for the rest)                                 |
| Pitch (5-a-side)            | 7 × 5 cells (§12 for the rest)                                   |
| Squad                       | 1 GK + 4 outfield                                                |
| Stats / roles / move ranges | §6 table                                                         |
| Mobility stat               | PAS (no separate PACE)                                           |
| Movement & pass geometry    | straight lines, 8 directions, blocked by the first occupied cell |
| Distance metric             | steps (Chebyshev — a diagonal costs 1)                           |
| Adjacency                   | the 8 surrounding cells                                          |
| Goal mouth                  | 3 cells, rows 1–3 of each end column                             |
| **SHOT_RANGE**              | **2** cells from the goal mouth at 5-a-side                      |
| **launchRange**             | **4** cells at 5-a-side (§12 for the rest), goalkeeper only      |
| LAUNCH_INTERCEPT_BONUS      | **+1** to the defence on a launch's interception duel            |
| Keeper DEF                  | **3** (was 4, was 5)                                             |
| Keeper guards               | only while standing in its own mouth                             |
| Goal-mouth occupancy        | defending keeper only                                            |
| Undefended shot             | no duel — a certain goal                                         |
| Dribble trigger             | carrier adjacent to an opponent at origin **or** destination     |
| Tackle                      | atomic; the defender must already be adjacent                    |
| Duel die                    | opposed **d4** (was d3)                                          |
| Covering-defender modifier  | +2 DEF each in open play, **+1 on a shot**                       |
| Turn cap                    | **24** turns (12 per side) at 5-a-side                           |
| Extra time                  | **8** turns (4 per side) at 5-a-side, golden goal                |
| Shootout                    | 3 kicks each, then sudden death                                  |
| Shootout sudden-death cap   | 10 rounds                                                        |
| Tiebreaker cascade          | shootout -> shots -> duels won -> non-kickoff side               |
| Tie-breaker                 | golden-goal sudden death                                         |
| Per-turn timer              | ≈ 25s _(client-side)_                                            |
| Shot resolution             | single duel (ATK vs keeper DEF) — clean striker **81%**          |
| Degrees of success          | none in v1                                                       |

### Balance watch-list (observed, not yet changed)

Things the engine has surfaced that we are **deliberately not tuning until playtest**.
Recorded so they are not rediscovered from scratch later.

- ~~**A shot is capped at 33% and skill cannot raise it.**~~ **Acted on in v1.4.** Keeper
  DEF is now 4, so a clean striker is a +1 favourite at 6/9, and the keeper's position
  gives skill a lever it never had: draw it off its line and the goal opens.
- ~~**A stat gap of 3 or more removes the die entirely.**~~ **Closed in v1.6.** The die is
  now a **d4**, so a +3 edge is 15/16 rather than certain and a Winger can dispossess a
  Striker about one time in sixteen. Self-play showed the saturation was worse than a
  missing upset: of 152 shots taken across 80 matches, 122 were shown 33% and 17 were
  shown 67%, and **none fell between** — the odds on the board were a three-valued enum,
  which a game built on Pillar 2 cannot afford. See ADR 0007.
- **Almost every scripted match reaches penalties.** **Much reduced, not closed** — and
  the v1.6 claim that it was closed rested on a figure measured mid-branch. Honest
  numbers: 98% under random play, 38.7% under skilled play at the v1.5 balance, 35.3% at
  v1.6, and **24% at v1.7** once extra time doubled. The note's own diagnosis turned out
  to be half right: scoring more was the fix for _goalless_ matches, but it does not
  reduce _draws_ — 0–0 simply becomes 1–1. See ADR 0011, which also carries the corrected
  v1.6 table.
- ~~**Penalties may want their own, higher conversion odds.**~~ **Closed in v1.6**, and
  without a special rule. The ordinary shot duel now puts a penalty at **81%** — close to
  real football's ~78% — because the keeper is on DEF 3 and the die is a d4. Sudden death
  no longer runs to 22 kicks.
- ~~**Goals are rare under random play.**~~ **Superseded in v1.6.** Random play was never
  the right instrument. Under self-play with the solo opponent (ADR 0006) a match now
  produces **1.50 goals**, with 9% goalless.

**Still watched:**

- **One match in four is still settled on penalties.** The lever that moved it is extra
  time, and it has diminishing returns: 12 turns would take it to one in six, at the cost
  of a 36-turn ceiling against GDD §11's 3–5 minute target. Left where the curve bends.

- **Kicking off is worth about 62% of matches.** Measured over 150 self-play matches from
  each end. It is a property of a low-scoring game: the first completed attack usually
  wins, and one side gets first use of the ball. §10's final tiebreaker rung already
  compensates in the right direction, and the client is explicit that choosing a side is
  choosing whether you kick off. If players come to resent it, the lever is the kickoff
  position itself, not the duel maths.
- **A clean striker's shot is 81%**, which is close to a formality. Intended — the work is
  in getting the striker a clean look — but it means a defence that allows one is already
  beaten. First number to look at if finishing feels cheap.

## 14. Explicitly OUT of v1 scope

No accounts/ladder/trophies, no squad collection or squad-building (both sides field the same fixed squad), no mobile build. All planned — none in v1.

**The other game modes are IN, as alpha.** This line used to read "no medium/full modes shipped", on the assumption that 7-a-side and 11-a-side would each be a project. They were not: the engine was already written against a board and a squad, so they cost a table of data, two formations and one scaling pass — and an alpha session is worth far more with three game types in it than with one. They are marked provisional in the interface, and 5-a-side remains the polished default. See §12, ADR 0012 and ADR 0013.

**The solo opponent is IN.** It was listed here as "no AI beyond a basic solo-test opponent", on the assumption that a single-player mode was a nicety. Two things changed that. A shareable link is worthless without one — the first thing anyone does with a link is play it alone — and a competent opponent turned out to be the only honest way to _measure_ the game, which is how v1.6's balance was settled. It ships as three settings and lives in `@gaffer/ai`, holding no rules of its own. See ADR 0006.

**Feel is IN.** "No cosmetics" was in this list until the board became playable, at which point it was obvious that a match with no motion does not deliver Pillar 1: a result that appears instantly is information, and "one more game" needs it to be an _event_. Movement, the goal moment and the duel reveal are therefore v1 scope. See ADR 0005.

**The look is IN too, and drawn in code.** M3's exit gate is about strangers with a link, and a stranger decides in about a second whether they are looking at a game or at somebody's weekend project — a grid of lettered tokens answers that badly, and correct football underneath does not rescue the answer. So the client has a designed identity: cartoon SVG players with kits, roles you can tell apart without reading the number, and eyes that follow the ball; a pitch with markings and netting; crests, a broadcast scoreboard and buttons you can feel. All of it is code, all of it lives in `apps/web`, and none of it reaches the engine. **Sound is still out**, and so is illustrated or animated character art — that is a decision with a budget attached. See ADR 0008.

The line to hold is that feel is **presentation only**. Animation lives in `apps/web`, never in the engine, and no animation timing may influence a result — the engine resolves the instant a command is committed and the board catches up afterwards. Sound and the wider visual theme are still out of v1.

## 15. How this maps to the engine (for M2)

- **Perfect information + free movement + rule-based duels** = the engine stays a pure `state + action → state` function. An **action** is `{ playerId, type, target }`; `type` ∈ move | pass | dribble | tackle | shoot.
- **Dice run through the seeded-RNG seam** (`mulberry32`) already in `@gaffer/engine`. "Deterministic engine" means _reproducible from a seed_ — matches replay byte-for-byte from seed + action log, and the replay test holds. Randomness is in the _game_, not the _code_.
- **Roles, stats, ranges, pitch/squad size, die size, modifiers** are all **Zod data** in `@gaffer/shared` — formats and balance are content, not code changes.
- The engine **computes and exposes each duel's win %** as a first-class output, so the UI can show it before commit.
- **M2 build order:** state model (board, players, ball) → legal-action generation → the duel resolver (with win-% output) → turn/action economy → win condition. Test-first from §7–§10, with a replay-fixture test proving determinism.

## 16. Future direction (post-v1, for aim only)

The "one more game" meta: **collect players and build your XI**, then climb a ladder with the squad that's yours. A natural, very-football hook — but explicitly _after_ the core match is proven fun.
