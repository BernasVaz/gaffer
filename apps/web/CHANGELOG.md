# @gaffer/web

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

- 53d087e: Groundwork for asynchronous multiplayer, Phase 1 — behind `ASYNC_MULTIPLAYER = false`, a
  build-time constant so the online code is absent from the alpha bundle rather than merely
  hidden in it. No engine change, no rules edition bump: multiplayer changes no rule.

  Adds the checked-in Supabase schema — one row per match holding the command log as jsonb
  with an optimistic `log_version`, row-level security deciding who may append, and a trigger
  deciding what an append may change. `buildMatch` now reports where a replay stopped short
  instead of breaking quietly, which is what turns a desync into "diverged at command N".

  See ADR 0028 (Supabase rather than Colyseus) and ADR 0029 (the match row).

- 48c5fbf: A deployed release carries multiplayer and points at the Supabase project, and the setup
  screen offers a way in — a tester cannot be expected to type a query parameter. Both are
  gated on the build-time flag, so a build without it has neither the code nor the door, and
  the bundle-isolation gate now checks for the door as well.
- d608d9d: Ready multiplayer for invited testers: a display name is checked before it is shown to an
  opponent, match creation is capped in the database, and the invite has a one-tap share with
  the turn state readable across a room. Realtime is now a true enhancement — the client also
  re-reads when the tab comes back and on a slow timer, so a dropped socket on a phone
  unsticks itself rather than leaving somebody waiting forever.

  See ADR 0031 (display names), ADR 0032 (match cap) and ADR 0033 (invited exposure, and
  batching engine-edition bumps to wave boundaries).

### Patch Changes

- 53d087e: Make the multiplayer bundle isolation a CI gate. The flag-off build is grepped for the
  Supabase client, the environment variable names, the project ref, the keys, the online
  chunk and two strings only the online screen has — and CI fails if any appear.

  The leak this guards against type-checked and passed every test, because the code was
  correct and merely present: `import.meta.env["VITE_X"]` behaves identically to the dot
  form at runtime, but only the dot form is substituted at build time, so nothing behind it
  is ever tree-shaken. A bundle assertion is the only thing that catches it.

- 9324064: The live site is a pinned release tag rather than the tip of main. Main can now advance —
  multiplayer behind a flag, the next rules change — without moving the ground under a wave
  of testers. The deploy runs when an `alpha-freeze-*` tag is pushed, or by hand against a
  named tag.
- Updated dependencies [53d087e]
- Updated dependencies [d608d9d]
  - @gaffer/engine@0.3.0
  - @gaffer/shared@0.3.0
  - @gaffer/ai@0.1.2

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

### Patch Changes

- Updated dependencies [479988d]
- Updated dependencies [c1b0921]
  - @gaffer/shared@0.2.0
  - @gaffer/engine@0.2.0
  - @gaffer/ai@0.1.1

## 0.1.0

### Minor Changes

- e60d9d0: Give the client a designed look instead of a diagram.

  Players are parametric SVG cartoons with kits, builds and props you can tell apart
  without reading the number — and eyes that follow the ball, which is a pure function of
  the board rather than an animation. The pitch has mown stripes, a centre circle, penalty
  areas, corner arcs and real netting inside each goal. The chrome has crests, a broadcast
  scoreboard, one self-hosted typeface and buttons with a lit top edge that drop into their
  own shadow when pressed.

  All of it lives in `apps/web` and none of it reaches the engine, exactly as ADR 0005
  requires. See ADR 0008.

- db140d2: Let a match choose its action economy before kickoff.

  Actions per turn is the number that decides whether a game type works at all (ADR 0012),
  so it is now a setup choice in the range 1–4, carried in the link as `actions=`. A link
  that says nothing gets the game type's own number rather than 5-a-side's — otherwise a
  bare `?mode=11v11` would be a different and much worse game than the selector produces.

  `createInitialState` gains a `rules` option: numbers to play a format under, merged over
  its own and validated, so an impossible set is refused at construction rather than
  producing a quietly unfair match. `pnpm play`'s override flags now go through it instead
  of patching the state afterwards.

- c2f9a44: Add drag-to-commit as a second way into the same move.

  Press a player, drag, release on what you want it to do. It ends at the same `onCommit`
  the click path ends at and asks the same `targetAt` question about the cell, so the two
  cannot come to different conclusions — the failure a parallel input invites.

  It takes over only once the pointer has travelled six pixels. Below that nothing happens
  at all and the click handler runs exactly as it did, so the existing flow is untouched
  rather than reimplemented. Pointer events cover mouse, touch and pen with one path, and
  `touch-action` is suppressed only on the cells a drag can start from, so a phone can
  still scroll the page from open grass.

- 4a1c124: Add "My feedback": every note saved on this device, reachable at any time from the setup
  screen and from inside a match. Flagged moments were always saved, but only the match that
  wrote them could open them — leave a match and the notes were on disk with no door. Each
  saved match can now be exported on its own, everything can be exported as one Markdown
  file with every repro link intact, and the untouched JSON is one click away as an escape
  hatch. Notes remain on the device; nothing is sent anywhere.
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

- f79b284: Add "How to play": a seven-step guided introduction, on demand from the setup screen and
  the match button row. Three steps walk the real setup screen and four play a couple of
  moves on a fixed practice position, ending in a real match. It teaches the real interface
  rather than a drawing of one, quotes odds asked of the engine as the step is shown, and
  waits only on actions that cannot fail. It never starts by itself — the switch for that
  exists and is off.
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

- 0805452: The match screen fits the screen. The board is upright by default everywhere with a
  toggle, and sizes itself to the space it has in both directions, so the full field is
  visible without scrolling at every phone size. Adds four information panels — player
  attributes, match statistics, duel results and a commentary ticker — a show/hide toggle
  for the win-chance badges, full dice values on every duel, tap-a-player-to-inspect
  (including opponents), and a fresh seed for every new game. See ADR 0019.
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

### Patch Changes

- 1d2e365: Add the end-to-end layer: a real browser playing a real match.

  Eleven Playwright tests against the **built** app, not the dev server — including one
  that plays a whole match a click at a time and asserts the engine never refuses a
  command the board offered, which is exactly the bug the layer exists to catch. Two more
  check the promise a shared link makes: the same seed plays out the same way twice.

  It runs as its own CI job. Every locator is a role and an accessible name, so the suite
  exercises the same surface a screen-reader user has.

- 9c7c69c: Say where a won dribble finishes. The engine gains `dribbleFinish`, which answers ahead
  of a die what a won dribble's destination would be, and the board uses it: a dribble that
  carries on is labelled "on to column X, row Y if you win" and draws a second, fainter
  ring on that cell. The odds were always honest; the prize was not, and §9 promises both
  are knowable before committing. The rule stays in the engine — the client asks rather
  than works it out.
- bdeac03: A kickoff is now a pass. The side restarting — at the opening whistle and after every
  goal — may only Pass with its first action. Before this a match opened with whatever the
  kicking side fancied, and because the formations put the two strikers adjacent that was a
  dribble straight into the nearest opponent. Goals per match are unchanged across all
  three formats. See ADR 0018.
- 64a86ea: The scoreboard counts the phase the match is in: regulation to the turn cap, and extra
  time as its own explicit state counting again from one. It had been showing the two caps
  added together, so a match finishing on the cap looked as though it had stopped short.
  See ADR 0020.
- 9855107: Ship it: every push to `main` now publishes the client, and the build is portable.

  The client builds with a relative base and bundles its font, so one artifact serves
  correctly from a project subpath or a domain root. `LazyMotion` trims the bundle from
  134 KB to 121 KB gzipped, with `strict` on so the full build cannot be reintroduced by
  importing the obvious thing.

  Deploys go to GitHub Pages, which needs no credential CI does not already have.
  `vercel.json` is committed and correct, so importing the repo on Vercel later is a
  two-minute job with no code change. See ADR 0009.

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
  - @gaffer/ai@0.1.0
