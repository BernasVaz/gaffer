# @gaffer/shared

## 0.3.0

### Minor Changes

- d608d9d: Ready multiplayer for invited testers: a display name is checked before it is shown to an
  opponent, match creation is capped in the database, and the invite has a one-tap share with
  the turn state readable across a room. Realtime is now a true enhancement — the client also
  re-reads when the tab comes back and on a slow timer, so a dropped socket on a phone
  unsticks itself rather than leaving somebody waiting forever.

  See ADR 0031 (display names), ADR 0032 (match cap) and ADR 0033 (invited exposure, and
  batching engine-edition bumps to wave boundaries).

## 0.2.0

### Minor Changes

- 479988d: A link with no parameters opens on 11-a-side, solo, casual, and every game type carries an
  Alpha badge in both the pill and the accessible name. Football is eleven a side, and all of
  this is alpha — badging two formats of three implied the third was finished.

  Only the no-parameter default moved: a link that names a game type still gets it, and a
  link written before game types existed still resolves to 5-a-side, which is what it meant
  when it was written. The engine's own `DEFAULT_FORMAT` stays 5-a-side. No engine change, so
  the rules edition and determinism are untouched. See ADR 0027.

- c1b0921: The penalty shootout is taken rather than tallied. The player presses for each kick and
  sees the odds, then the dice, then the result, with a running scoreboard and commentary.
  Nothing about how a penalty resolves changed — the same taker ATK against keeper DEF, the
  same die, the same tie to the keeper — and the engine still resolves the whole shootout in
  one deterministic step, so it replays byte-identically from a seed with no UI attached and
  self-play takes the same kicks. Best of five a side rather than three, stopping once one
  side cannot be caught, with takers in ATK order rotating through sudden death. The rules
  edition steps to 4. A first-time solo player now meets `casual` rather than `pro`; every
  level stays selectable. See ADR 0026.

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

- a18cac8: You can take the man on: a carrier may dribble through an adjacent opponent onto the cell
  beyond them, which is the one destination a plain move can never reach. The duel is with
  the man being gone through; covering defenders charge half rate; goalkeepers may not.
  Dribbles per match at 5-a-side go 0.79 → 1.78 and goals 1.51 → 1.32. See ADR 0021.
- a912f85: Double extra time, 4 turns to 8, and correct the v1.6 balance record.

  Re-measuring v1.6 for a final report showed two of its figures had been taken part-way
  through the branch and were wrong: matches decided on penalties went 38.7% → 35.3%, not
  44% → 20%. The goals were real — 0.99 → 1.50 — but they did not reduce draws, because
  killing _goalless_ matches turns 0–0 into 1–1.

  GDD §10 set extra time at 4 turns because "goals are scarce, so a longer extra time
  mostly delays the shootout". True at 0.6 goals a match; false at 1.5. At 8 turns golden
  goal decides one match in six rather than one in twenty, penalties fall to 24%, and the
  average match grows by about one turn. See ADR 0011.

- 6b48c46: Capture feedback in the moment, and hand the whole match over as one file.

  A "Flag moment" control — button or the `F` key — opens a short note with a category,
  and attaches the board automatically: the turn, the score, the side to move, the index
  into the move log, and the last eight events in plain English. The board is snapshotted
  when the box opens rather than when it is saved, and the match holds still while it is
  open, so a note describes the moment somebody reached for the button.

  The match now keeps a log of everything played. That makes two things possible: a
  refresh comes back as the _same_ match rather than a fresh one — replayed from the seed
  and the log, which the engine gives for nothing — and a note can say "action 13 of this
  match" and mean something to somebody who was not there.

  At the end, a downloadable Markdown report: a header naming the match, each note with
  its category, words, a recap of the run-up and a repro line, and the whole move log. A
  `?replayTo=` link winds a match back to a flagged action; it reads this browser's saved
  log, so cross-machine replay still needs the log from the report — noted as a follow-up.

  The engine is untouched. Flagging a moment reads a board and writes text.

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

- a18cac8: Step the rules edition to 2. Taking the man on (ADR 0021) and a won dribble carrying on
  (ADR 0023) both change what a dribble produces, so a command log written under edition 1
  replays silently to a board that never happened — which is the failure the field exists
  to catch. Matches saved under edition 1 still load, and now say they are older.
- 9109a31: A stored match records which edition of the rules it was played under. A seed and a
  command log only reproduce a match against the rules that produced them, and the
  dangerous failure is silent — a log written before a resolution change replays end to end
  to a match that never happened. Matches saved before this existed keep loading and are
  marked as unplaceable rather than discarded. See ADR 0022.
- 1719c46: Add a setup screen and a playable solo match.

  The client now opens on a setup screen — hotseat or solo, which side, how hard the
  opponent tries, and the seed — and the whole setup is carried in the URL, so a link
  _is_ a match. A link with a seed starts it straight away; a bare visit asks how you
  want to play.

  `@gaffer/shared` gains the contract for that boundary: `MatchSetupSchema`, `parseSetup`
  and `setupToQuery`. Parsing is total and falls back field by field, because a link that
  has been truncated or edited should still produce a playable match rather than a blank
  page.

  In a solo match the board offers only your own players, and `@gaffer/ai` plays the other
  side with a deliberate pause before each action — presentation, not rules: the decision
  itself costs about four milliseconds.

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
