# @gaffer/engine

## 0.3.0

### Minor Changes

- 53d087e: Asynchronous multiplayer, Phase 1: two people can start a match, send a link, join, take
  turns and be told when it is their turn. Behind `ASYNC_MULTIPLAYER`, absent from the alpha
  bundle.

  The engine gains `stateHash`, a canonical fingerprint of a board. Phase 1 does not run the
  engine on the server, so it cannot tell a legal command from an illegal one — what it can
  do is notice that the two players are no longer looking at the same match and say which
  command it diverged at.

  A match on another rules edition is sealed and view-only rather than silently replayed
  into a different game. Realtime carries "your turn", and a read on subscribe covers what
  Realtime misses.

### Patch Changes

- Updated dependencies [d608d9d]
  - @gaffer/shared@0.3.0

## 0.2.0

### Minor Changes

- c1b0921: The penalty shootout is taken rather than tallied. The player presses for each kick and
  sees the odds, then the dice, then the result, with a running scoreboard and commentary.
  Nothing about how a penalty resolves changed — the same taker ATK against keeper DEF, the
  same die, the same tie to the keeper — and the engine still resolves the whole shootout in
  one deterministic step, so it replays byte-identically from a seed with no UI attached and
  self-play takes the same kicks. Best of five a side rather than three, stopping once one
  side cannot be caught, with takers in ATK order rotating through sudden death. The rules
  edition steps to 4. A first-time solo player now meets `casual` rather than `pro`; every
  level stays selectable. See ADR 0026.

### Patch Changes

- Updated dependencies [479988d]
- Updated dependencies [c1b0921]
  - @gaffer/shared@0.2.0

## 0.1.0

### Minor Changes

- db140d2: Let a match choose its action economy before kickoff.

  Actions per turn is the number that decides whether a game type works at all (ADR 0012),
  so it is now a setup choice in the range 1–4, carried in the link as `actions=`. A link
  that says nothing gets the game type's own number rather than 5-a-side's — otherwise a
  bare `?mode=11v11` would be a different and much worse game than the selector produces.

  `createInitialState` gains a `rules` option: numbers to play a format under, merged over
  its own and validated, so an impossible set is refused at construction rather than
  producing a quietly unfair match. `pnpm play`'s override flags now go through it instead
  of patching the state afterwards.

- a18cac8: A won dribble carries the carrier one cell further in the direction of travel, when that
  cell is free. Taking the man on gave one dribble an upside; every other was still paying
  a duel for ground a move covers for nothing. Composed, beating the man in front puts you
  past him and on. Goals per match return to baseline (1.45 → 1.43 over 600 matches a side)
  while dribbles go 0.71 → 2.05. See ADR 0023.
- 9c7c69c: Say where a won dribble finishes. The engine gains `dribbleFinish`, which answers ahead
  of a die what a won dribble's destination would be, and the board uses it: a dribble that
  carries on is labelled "on to column X, row Y if you win" and draws a second, fainter
  ring on that cell. The odds were always honest; the prize was not, and §9 promises both
  are knowable before committing. The rule stays in the engine — the client asks rather
  than works it out.
- a18cac8: You can take the man on: a carrier may dribble through an adjacent opponent onto the cell
  beyond them, which is the one destination a plain move can never reach. The duel is with
  the man being gone through; covering defenders charge half rate; goalkeepers may not.
  Dribbles per match at 5-a-side go 0.79 → 1.78 and goals 1.51 → 1.32. See ADR 0021.
- bdeac03: A kickoff is now a pass. The side restarting — at the opening whistle and after every
  goal — may only Pass with its first action. Before this a match opened with whatever the
  kicking side fancied, and because the formations put the two strikers adjacent that was a
  dribble straight into the nearest opponent. Goals per match are unchanged across all
  three formats. See ADR 0018.
- 06ec612: A pass finds any team-mate with a clear lane, rather than only one standing on a ray.

  The ball flies straight between two cells and is stopped by the first body whose square
  it crosses, whichever side that body is on. A team-mate two forward and one across — the
  commonest shape in football — was not a hard pass or a risky pass before this, but not a
  pass at all. Every lane that was legal under the ray rule is still legal with the same
  blockers, so nothing that worked stopped working.

  Enumeration and interception read one shared `laneBetween`, so what blocks a pass and
  what contests it can never disagree. The board draws that same flight when a pass is
  hovered or focused. Shots stay on rays deliberately — measured, because the coherent
  change made the game worse. The rules edition steps to 3. See ADR 0025.

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
