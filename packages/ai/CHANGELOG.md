# @gaffer/ai

## 0.1.2

### Patch Changes

- Updated dependencies [53d087e]
- Updated dependencies [d608d9d]
  - @gaffer/engine@0.3.0
  - @gaffer/shared@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [479988d]
- Updated dependencies [c1b0921]
  - @gaffer/shared@0.2.0
  - @gaffer/engine@0.2.0

## 0.1.0

### Minor Changes

- 59ee756: Add `@gaffer/ai`, the solo opponent, and retune the match on what it measured.

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

- ba2d540: Add 7-a-side and 11-a-side as selectable game types, marked alpha.

  A game type is now a row of data in `@gaffer/shared` — a board, a line-up and the four
  numbers that scale with them — and `createInitialState({ format })` is the only thing
  that reads it. **No rule in the engine changed**: it was already written against a board
  and a squad rather than against seven columns and five players.

  The scale-sensitive numbers moved onto the match as `state.rules`, because a constant
  cannot be two values at once and a page may hold a 5-a-side and an 11-a-side at once.
  The one that decides whether a format works turned out to be **actions per turn** — 2, 3
  and 4 — not the turn cap: at 2 everywhere, the bigger formats produced 0.65 goals a match
  with 40–50% goalless.

  The game type travels in the link as `mode=`, so a shared match is the same game as well
  as the same dice. Links written before game types existed still work.

  See ADR 0012 and ADR 0013.

### Patch Changes

- Updated dependencies [db140d2]
- Updated dependencies [a18cac8]
- Updated dependencies [9c7c69c]
- Updated dependencies [a18cac8]
- Updated dependencies [a912f85]
- Updated dependencies [6b48c46]
- Updated dependencies [bdeac03]
- Updated dependencies [06ec612]
- Updated dependencies [59ee756]
- Updated dependencies [a18cac8]
- Updated dependencies [9109a31]
- Updated dependencies [1719c46]
- Updated dependencies [ba2d540]
  - @gaffer/shared@0.1.0
  - @gaffer/engine@0.1.0
