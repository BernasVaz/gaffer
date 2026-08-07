# Gaffer — Game Design Document (v0.3)

_Codename Gaffer · Studio WACAIDO · M1 deliverable. **LOCKED** = decided; **PROPOSED** = my recommendation awaiting your yes/no; **OPEN** = collected in §14. Once §14 is settled, this becomes `docs/GDD.md` and unblocks the engine (M2)._

> **Decision log**
>
> - **v0.1 → v0.2:** resolution moved to bounded, transparent dice in duels only; variance removed elsewhere.
> - **v0.2 → v0.3:** **dropped the tactic-card command system in favour of free direct movement** (pick a player, move/act directly), the way the Tactikick prototype played. A **fixed action economy** and **role-based movement range** now provide the per-turn skill tension the cards used to. The long-term collection hook moves from a card _deck_ to the **squad itself** (build your XI). Everything about stats, duels, information, and the win condition is unchanged.

---

## 1. Vision & pillars

Gaffer is a 1v1 football game with the mind of a board game. A match should feel **quick, deep, and fair** — you finish it and immediately want another, and win or lose you understand exactly why.

- **Pillar 1 — "One more game."** Short, moreish matches; you leave hungry to requeue. _(Clash Royale's magic.)_
- **Pillar 2 — Earned outcomes.** Every result is legible — traceable to decisions and to risks you could see, never to hidden luck. _(Chess's magic.)_

## 2. The concept, in one line

> A turn-based, perfect-information football duel where you directly command your squad — pick a player and move or act within a fixed pool of actions each turn — and contested actions resolve on stats plus a roll whose odds you see before you commit.

## 3. Design spine (LOCKED)

- **Turn-based**, alternating deliberate turns; urgency from short matches + a per-turn timer.
- **Perfect information** — both players see the entire board. No fog.
- **Free direct control** — pick any of your players and act with them (drag to a destination / choose the action). No command cards.
- **Fixed action economy** — a set number of actions per turn (PROPOSED **2**), spent across your players.
- **Movement ranged by role** — each role moves up to its own distance; a Winger covers more ground than a Defender.
- **Variance in duels only** — contested actions resolve as **stat + attack die vs stat + defence die**, odds always shown. Everything else is deterministic.
- **Full squad starts on the pitch.**
- **Win by hybrid turn-cap + sudden-death** (§11).
- **v1 = nail the match.** Ladder, squad-collection, progression come _after_.

## 4. What we take from each touchstone

| Game                             | What we take                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Chess / checkers**             | Direct control of pieces already on the board; perfect information; skill-attributable results |
| **Tactikick (your prototype)**   | The validated feel: pick a player, drag, choose the action; an actions-per-turn economy        |
| **Blood Bowl / tabletop sports** | The duel: **stat + roll**, favourite usually wins, the upset is the drama of sport             |
| **FIFA Ultimate Team**           | _(later)_ the meta hook: collect players and build your XI as your identity                    |
| **Clash Royale**                 | _(later)_ short sessions and the ladder-climb loop                                             |

Synthesis: **the direct honesty of chess, the drama of a sporting duel, the pull of building your own squad — as football.**

## 5. The pitch (PROPOSED)

- A discrete **grid**; one piece per cell; perfect information.
- **Flagship for v1: 5-a-side**, PROPOSED **~7 columns × 5 rows** — readable, room for real positioning. Exact size OPEN, tuned in playtest.
- A **goal** at each end.
- **Data-driven dimensions:** pitch and squad size are config, so 7-a-side and 11-a-side become **game modes** later. Only 5-a-side is balanced and shipped for v1.

## 6. The squad, roles & stats (PROPOSED)

**5 players per side:** PROPOSED **1 Goalkeeper + 4 outfield**. Three legible duel stats (1–5) plus a movement range:

- **ATK** — attacking duels (dribble, shot).
- **DEF** — defensive duels (tackle, block, save).
- **PAS** — passing distance _and_, for v1, mobility/movement range. _(OPEN: split a separate PACE stat if movement identity needs to differ from passing.)_

PROPOSED starting lines (to be balanced in playtest):

| Role       | ATK | DEF | PAS | Move (cells) | Feel                                    |
| ---------- | --- | --- | --- | ------------ | --------------------------------------- |
| Goalkeeper | 1   | 5   | 2   | 1            | Anchor; wins saves, can't roam          |
| Defender   | 2   | 4   | 3   | 2            | Wall; strong in the tackle              |
| Midfielder | 3   | 3   | 4   | 3            | Engine; links play, covers ground       |
| Winger     | 4   | 2   | 3   | 3            | Threat; beats defenders wide            |
| Striker    | 5   | 1   | 2   | 2            | Finisher; deadly, little defensive help |

No per-player hidden variation — a Striker is a Striker. Collection identity comes later via the **squad you build**, not stat rolls.

## 7. The ball & actions (PROPOSED)

- One **ball**; one carrier; possession is central.
- The action menu (each costs one action): **Move** (up to the player's range), **Pass** (send the ball up to PAS range along a lane), **Dribble** (carry past an opponent), **Tackle/Press** (challenge the carrier), **Shoot** (if in range of goal).
- **Uncontested actions are automatic** (an open pass just completes). **Contested actions are duels** (§10) — and the win % is shown before you commit.
- On a turnover, possession flips — a key swing moment.

## 8. The turn & action economy (PROPOSED — where the skill lives)

With no cards, the per-turn tension comes from **scarcity of actions**:

1. **Start of turn:** the whole board is visible; you have your action pool (PROPOSED **2 actions**).
2. **Act:** pick a player, choose an action; the board previews the exact result, and any duel shows its **win %** before you commit. You may use both actions on one player or split them across two.
3. **Resolve** each action (§10 for duels).
4. **Pass** to opponent when your actions are spent (or end early). A per-turn **timer** (PROPOSED ~20–30s; OPEN) keeps matches brisk.

The core decision every turn: with only two actions, _what is the highest-value thing I can do_ — advance, create a duel at good odds, deny my opponent's next move, or set up a better position for next turn? Because information is perfect, your opponent sees your setup and can respond — so it's a readable back-and-forth of position and tempo.

**Worked example:** You have 2 actions. Ball's with your Midfielder. **Action 1 — dribble** him past a Defender (shown 65%); it lands, he advances. **Action 2** — your Striker is now near the box: shoot (shown 45% vs the keeper) _or_ pass wide to your Winger in space (uncontested, automatic) to set up a cleaner shot next turn. You pass. Turn passes. Your opponent sees the Winger's threat and moves a Defender to cover — visibly dropping your next-turn shot odds. Now you re-plan.

## 9. Duel resolution — "stat + roll, always shown" (PROPOSED)

Every contested action is a duel:

> **Attacker total = relevant stat + attack die. Defender total = relevant stat + defence die. Higher wins; a tie goes to the defender.**

- **Stats used:** dribble/shot = attacker **ATK** vs defender **DEF**; keeper defends a shot with **DEF**; a pass into a covered lane = **PAS** vs interceptor **DEF**.
- **Small die so stats dominate:** PROPOSED an **opposed d3–d4**, tuned so a **+2 stat edge is ~85%+** and only near-even duels are coin-flips. The favourite usually wins; the die is the upset, not the decider. (Die size OPEN.)
- **Three safeguards (LOCKED as principles):**
  1. **Stats dominate, dice tip.** Big edges near-certain; roll decides close calls.
  2. **Odds always shown before commit.** A loss on a chance you took is "I gambled and it didn't land," not hidden RNG.
  3. **Skill stacks the deck.** Support and position shift the odds live — a covering defender turns a 78% dribble into 40%, shown.
- **Worked odds:** Striker (ATK 5) dribbles a lone Defender (DEF 4) → ~60%. Add a covering Midfielder (+2 DEF) → ~32%. Shown, then you choose.

**Design rule:** if a player couldn't have anticipated the _odds_ from the visible board, the rule is wrong.

## 10. Win condition (LOCKED — hybrid turn-cap + sudden-death)

- A match runs to a **turn cap** (tuned to ~3–5 min; OPEN).
- **Sudden-death:** level at the cap → **first-goal-wins extra time** (or a lead settles it). No flat draws.

## 11. Match-length target (PROPOSED)

**~3–5 minutes.** Grid, squad, action count, turn cap, and timer all tuned to hit this.

## 12. Game modes (PROPOSED)

- **v1 (shipped & balanced):** 5-a-side flagship.
- **Later (engine-ready):** 7-a-side, 11-a-side, and possibly a shorter "Blitz". Same rules, bigger board/squad via config.

## 13. Open decisions register (resolve together → LOCK)

1. **Actions per turn** — 2? _Rec: 2, as your prototype._
2. **Exact 5-a-side grid size.** _Rec: ~7×5, tune._
3. **Final stat values, role lines & movement ranges** (§6). _Rec: start from the table, balance in playtest._
4. **PAS as mobility vs a separate PACE stat.** _Rec: PAS doubles as mobility for v1; split only if needed._
5. **Duel die size** (d3? d4?) and **support/position modifier values.** _Rec: smallest die keeping a +2 edge ~85%+._
6. **Turn cap, regulation goal dynamics, sudden-death specifics.** _Rec: tune to 3–5 min._
7. **Per-turn timer length.** _Rec: ~20–30s._
8. **Shots:** single duel vs shooter-then-keeper; and whether _degrees of success_ exist. _Rec: one duel for v1._
9. **Movement/dribble rules:** can you move through/around opponents, and what exactly triggers a duel vs an automatic move? _Rec: define precisely from the prototype's lessons._

## 14. Explicitly OUT of v1 scope

No accounts/ladder/trophies, no squad collection or squad-building (both players use the same fixed 5), no cosmetics, no mobile build, no medium/full modes shipped, no AI beyond a basic solo-test opponent. All planned — none in v1.

## 15. How this maps to the engine (for M2)

- **Perfect information + free movement + rule-based duels** = the engine stays a pure `state + action → state` function — exactly the `@gaffer/engine` we scaffolded, protected by the determinism lint rule. An "action" is `{ playerId, type, target }`.
- **Dice run through the seeded-RNG seam** (`mulberry32`) already built. "Deterministic engine" means _reproducible from a seed_ — so matches with dice replay byte-for-byte from seed + action log, and the replay test holds. Randomness is in the _game_, not the _code_.
- **Roles, stats, movement ranges, pitch/squad size, die size, modifiers** are all **data** in `@gaffer/shared` (Zod-validated) — formats and balance are content, not code.
- The engine **computes and exposes each duel's win %** so the UI can show it before commit — a first-class output.

## 16. Future direction (post-v1, for aim only)

The "one more game" meta: **collect players and build your XI**, then climb a ladder with the squad that's yours. This replaces the earlier card-deck identity and is a natural, very-football hook — but it is explicitly _after_ we prove the core match is fun.

---

_Next: lock the §13 register (mostly quick calls + playtest tuning), and this GDD is done — M2, building the engine, begins. The first engine work is the state model and the action resolvers, straight from §7–§9._
