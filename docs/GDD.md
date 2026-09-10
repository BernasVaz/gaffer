# Gaffer — Game Design Document (v1.4 — LOCKED, v1 baseline)

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
| Goalkeeper | 1   | 4   | 2   | 1            | The only player allowed in the goal     |
| Defender   | 2   | 4   | 3   | 2            | Wall; strong in the tackle              |
| Midfielder | 3   | 3   | 4   | 3            | Engine; links play, covers ground       |
| Winger     | 4   | 2   | 3   | 3            | Threat; beats defenders wide            |
| Striker    | 5   | 1   | 2   | 2            | Finisher; deadly, little defensive help |

No per-player hidden variation — a Striker is a Striker. Collection identity comes later via the **squad you build**, not stat rolls. (Starting formation on the 7×5 pitch to be set at the top of M2 and tuned.)

## 7. The ball & actions (LOCKED)

- One **ball**; one carrier; possession is central.
- The action menu (each costs one of your 2 actions per turn):
  - **Move** — relocate a player in a straight line along one of the 8 directions, up to its role's Move range, onto an empty cell. **Automatic** (no duel). The first occupied cell in a direction blocks it: you may not move onto or through an occupied cell.
  - **Pass** — send the ball the same way: a straight lane in one of the 8 directions, up to the passer's **PAS** range, to the first player in that direction — legal only if that player is a teammate. **Automatic** if no opponent is beside the lane; a **duel** (passer **PAS** vs interceptor **DEF**) if one is. Either way the pass is offered, and the odds are shown before you commit.
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

> **Attacker total = relevant stat + attack die (d3). Defender total = relevant stat + defence die (d3). Higher wins; a tie goes to the defender.**

- **Stats used:** dribble/shot = attacker **ATK** vs defender **DEF**; keeper defends a shot with **DEF**; a pass into a covered lane = **PAS** vs interceptor **DEF**.
- **The die is a d3 so stats dominate** _(tunable):_ a +1 edge ≈ 67%, a +2 edge ≈ 89%. The favourite usually wins; the die decides only close calls.
- **Modifiers shift the odds before the roll** _(tunable):_ each **covering defender adjacent to the duel = +2 DEF** in open play, but only **+1 on a shot**. A shot already faces a keeper; charging the field rate on top drove any covered effort to near zero and made bodies in the box worth more than the goalkeeper.
- **A shot is defended by whoever is actually guarding the goal.** The keeper contributes its DEF only while it stands in its own mouth. Off the line it is just another player: the shot is led by the best defender in the lane, and with the lane clear there is **no duel at all** — an open goal is a certainty, not a gamble.
- **Three safeguards (LOCKED as principles):**
  1. **Stats dominate, dice tip.** Big edges near-certain; roll decides close calls.
  2. **Odds always shown before commit.** A loss on a chance you took is "I gambled and it didn't land," not hidden RNG.
  3. **Skill stacks the deck.** Support and position shift the shown odds — a covering defender turns a 78% dribble into ~40%.
- **Worked odds:** Striker (ATK 5) dribbles a lone Defender (DEF 4), d3 each → ~67%. Add a covering Midfielder (+2 DEF → effective DEF 6) → the Striker is now the underdog, ~11%. Shown, then you choose.

**Design rule:** if a player couldn't have anticipated the _odds_ from the visible board, the rule is wrong.

## 10. Win condition (LOCKED)

- A match runs to a **turn cap of 20 turns (10 per side)** _(tunable to a ~3–5 min match)_. Highest score at the cap wins.
- **Sudden-death:** level at the cap → **golden goal in extra time** — the first goal wins immediately.
- **Extra time is bounded: 4 turns, 2 per side** _(tunable)_. It has to be: goals are scarce, so "play until someone scores" has no upper bound and an engine cannot be asked to run it.
- After every goal (regulation or extra time), **positions reset for a kickoff** to the conceding side.
- **No flat draws.** Level after extra time goes to a decision cascade, tried in order:

  1. **Penalty shootout** — 3 kicks a side, then sudden death capped at **10 rounds**. Each penalty is the ordinary shot duel (taker **ATK** vs keeper **DEF**, opposed d3, tie to the keeper) with no covering defenders. Nothing is chosen by the players, so the engine resolves the whole shootout in one step from the match's own seed and hands back the kicks for the client to play out. _(Auto-resolved in v1; interactive penalties are a possible later feature.)_
  2. **Most shots attempted** across the match.
  3. **Most duels won** across the match.
  4. **The side that did not take the opening kickoff.** The kickoff is the game's only structural asymmetry — one side moves first with the ball — so the other takes a tie nothing else could settle. That side also kicks first in the shootout, for the same reason.

  Rung 4 cannot tie, which is what guarantees every match ends. A shootout **cannot** provide that guarantee on its own: two evenly matched sides settle a sudden-death round at most half the time, so the tail never closes — the cap only makes reaching rung 2 rare (roughly one shootout in a thousand).

## 11. Match-length target

**~3–5 minutes.** Grid, squad, action count, turn cap, and timer all tuned to hit this.

## 12. Game modes

- **v1 (shipped & balanced):** 5-a-side flagship.
- **Later (engine-ready):** 7-a-side, 11-a-side, and possibly a shorter "Blitz". Same rules, bigger board/squad via config.

## 13. Locked v1 parameters (tunable in playtest)

The numeric knobs, in one place — all live as Zod data in `@gaffer/shared`, so tuning is a data change, not code:

| Parameter                   | v1 value                                                         |
| --------------------------- | ---------------------------------------------------------------- |
| Actions per turn            | 2                                                                |
| Pitch (5-a-side)            | 7 × 5 cells                                                      |
| Squad                       | 1 GK + 4 outfield                                                |
| Stats / roles / move ranges | §6 table                                                         |
| Mobility stat               | PAS (no separate PACE)                                           |
| Movement & pass geometry    | straight lines, 8 directions, blocked by the first occupied cell |
| Distance metric             | steps (Chebyshev — a diagonal costs 1)                           |
| Adjacency                   | the 8 surrounding cells                                          |
| Goal mouth                  | 3 cells, rows 1–3 of each end column                             |
| **SHOT_RANGE**              | **2** cells from the goal mouth                                  |
| Keeper DEF                  | **4** (was 5)                                                    |
| Keeper guards               | only while standing in its own mouth                             |
| Goal-mouth occupancy        | defending keeper only                                            |
| Undefended shot             | no duel — a certain goal                                         |
| Dribble trigger             | carrier adjacent to an opponent at origin **or** destination     |
| Tackle                      | atomic; the defender must already be adjacent                    |
| Duel die                    | opposed **d3**                                                   |
| Covering-defender modifier  | +2 DEF each in open play, **+1 on a shot**                       |
| Turn cap                    | ≈ 20 turns (10 per side)                                         |
| Extra time                  | 4 turns (2 per side), golden goal                                |
| Shootout                    | 3 kicks each, then sudden death                                  |
| Shootout sudden-death cap   | 10 rounds                                                        |
| Tiebreaker cascade          | shootout -> shots -> duels won -> non-kickoff side               |
| Tie-breaker                 | golden-goal sudden death                                         |
| Per-turn timer              | ≈ 25s _(client-side)_                                            |
| Shot resolution             | single duel (ATK vs keeper DEF)                                  |
| Degrees of success          | none in v1                                                       |

### Balance watch-list (observed, not yet changed)

Things the engine has surfaced that we are **deliberately not tuning until playtest**.
Recorded so they are not rediscovered from scratch later.

- ~~**A shot is capped at 33% and skill cannot raise it.**~~ **Acted on in v1.4.** Keeper
  DEF is now 4, so a clean striker is a +1 favourite at 6/9, and the keeper's position
  gives skill a lever it never had: draw it off its line and the goal opens.
- **A stat gap of 3 or more removes the die entirely.** With an opposed d3, a +3 edge is
  9/9 and a −3 edge is 0/9 — a Winger (DEF 2) can never dispossess a Striker (ATK 5).
  Stats span 1–5 and a covering defender adds another 2, so certainty is reachable in
  ordinary play. This is consistent with "stats dominate, dice tip" (§9), but it does
  mean some matchups have no upset available at all. A d4 would restore a sliver.
- **Almost every scripted match reaches penalties.** Under random play 98% of matches
  are settled by the shootout rather than by football. If playtest shows the same, the
  fix is **goal-scoring, not the shootout** — a tiebreaker that fires constantly is a
  symptom, not the disease.
- **Penalties may want their own, higher conversion odds.** They currently reuse the
  ordinary shot duel, which at ATK 5 vs DEF 5 converts a third of the time — low for a
  penalty, and the reason sudden death runs long (22 kicks observed against a cap of 26).
- **Goals are rare under random play** — roughly one per eighty scripted matches. Skilled
  play should score far more often, so this is context for the two items above rather
  than a finding in itself.

## 14. Explicitly OUT of v1 scope

No accounts/ladder/trophies, no squad collection or squad-building (both players use the same fixed 5), no cosmetics, no mobile build, no medium/full modes shipped, no AI beyond a basic solo-test opponent. All planned — none in v1.

## 15. How this maps to the engine (for M2)

- **Perfect information + free movement + rule-based duels** = the engine stays a pure `state + action → state` function. An **action** is `{ playerId, type, target }`; `type` ∈ move | pass | dribble | tackle | shoot.
- **Dice run through the seeded-RNG seam** (`mulberry32`) already in `@gaffer/engine`. "Deterministic engine" means _reproducible from a seed_ — matches replay byte-for-byte from seed + action log, and the replay test holds. Randomness is in the _game_, not the _code_.
- **Roles, stats, ranges, pitch/squad size, die size, modifiers** are all **Zod data** in `@gaffer/shared` — formats and balance are content, not code changes.
- The engine **computes and exposes each duel's win %** as a first-class output, so the UI can show it before commit.
- **M2 build order:** state model (board, players, ball) → legal-action generation → the duel resolver (with win-% output) → turn/action economy → win condition. Test-first from §7–§10, with a replay-fixture test proving determinism.

## 16. Future direction (post-v1, for aim only)

The "one more game" meta: **collect players and build your XI**, then climb a ladder with the squad that's yours. A natural, very-football hook — but explicitly _after_ the core match is proven fun.
