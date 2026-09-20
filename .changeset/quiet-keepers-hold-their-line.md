---
"@gaffer/shared": minor
"@gaffer/engine": minor
"@gaffer/ai": minor
---

Add `@gaffer/ai`, the solo opponent, and retune the match on what it measured.

The opponent is a consumer of the engine with no rules of its own: it reads boards
through `legalActions`, prices duels through `previewDuel`, and explores outcomes by
handing `applyAction` a rigged scratch generator, so nothing it considers spends the
match's own dice. It is deterministic, with an optional `variety` seed that leans
near-equal options, and ships as three settings — `casual`, `pro`, `elite`.

Self-play through it settled GDD v1.6: the duel die is now an opposed **d4** (was d3),
the goalkeeper's DEF is **3** (was 4), and the turn cap is **24** (was 20). Over 150
matches that takes goals from 0.60 to **1.50** a match, goalless matches from 42% to
**9%**, and matches decided by football from 56% to **80%**. Both GDD §13 balance
watch-items are closed. See ADR 0006 and ADR 0007.
