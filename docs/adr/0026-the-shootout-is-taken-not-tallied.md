# 0026 — The shootout is taken, not tallied

- **Status:** Accepted
- **Date:** 2026-09-24
- **Supersedes:** the one-step shootout of ADR 0003 and GDD §10. The duel it resolves each
  kick with is unchanged.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

A match that is level after extra time goes to penalties, and the penalties were **real**:
taker ATK against keeper DEF, an opposed die, a tie to the keeper — the same shot duel the
rest of the engine uses. Every kick was rolled, recorded and carried in the result.

Nobody ever saw one.

The whole shootout resolved in a single step the instant the last turn ended, and the
client printed the aggregate: _decided by shootout · penalties 3–2_. Roughly a match in
four ends this way (ADR 0011). So the most dramatic thing the game can do arrived as a
line of small text, already over.

That is the complaint. It is not that the shootout was fake — it was never fake — it is
that it was **not played**.

## Decision

**The human takes each kick: press, see the odds, see the dice, see the result.** A
running shootout scoreboard beside it, and a line of commentary for each kick.

**Nothing about how a penalty resolves changes.** Taker ATK plus a die against keeper DEF
plus a die, higher wins, a tie is a save, and the percentage is shown before the press.
No new balance surface: a penalty is priced by the same two stats and the same die as
every other shot in the game.

### Presentation lags the engine, and that is the whole design

**The engine still resolves the entire shootout in one step, deterministically, from the
match's own seed.** The list of kicks it produces is complete before a single one is
shown. What the client does is walk that list.

So pressing does **not** roll a die. The die is already rolled, and what the press buys is
the right to look at it.

This is not a compromise, it is the point:

- A shootout **replays byte-identically from seed and command log** with no UI attached.
- **Self-play runs the same penalties** a person's match does — the balance harness and
  the AI-versus-AI runs take the identical kicks in the identical order.
- There is **no new command**, so the command log does not grow a per-kick entry and
  nothing can desynchronise between what was played and what was shown.

The alternative — a `takePenalty` command resolved per press — would have put the dice
behind a user action, and every one of those three properties would have needed defending
separately. This way they are free.

Each kick carries **the odds it was resolved at**, so the number shown before the press is
provably the number the dice were compared against rather than a second, parallel
calculation that could drift from it.

### Structure

- **Best of five a side**, alternating, the side that did not kick off going first.
- **It stops the moment one side cannot be caught.** Best of five means best of five;
  nobody presses through a penalty that cannot change the result. Every kick used to be
  taken regardless, which nobody noticed because nobody watched.
- **Then sudden death**, bounded at ten rounds as before, with the statistical backstop
  behind it.
- **Takers are the squad in ATK order, a different player each kick.** At 5-a-side that is
  exactly five players, so the goalkeeper takes one — which is correct, and good. Sudden
  death **rotates**: everyone takes one before anyone takes two.

Five rather than three is the one number that moved. Three was chosen when the shootout
was a tiebreaker to be got through quickly; now that a person takes them one at a time,
the familiar shape is worth more than two saved rolls.

### Not now

**No aiming, and no dive mini-game.** Logged as post-alpha stretch. Both would add a
decision to a mechanic whose appeal right now is that it is the game's existing duel at
its most naked — and both would be a new balance surface a fortnight before people play it.

## Consequences

**The rules edition steps to 4** (ADR 0022). Five kicks instead of three, early
termination, and rotation all change how many dice a level match draws and in what order —
so an edition-3 log replays to a **different shootout and possibly a different winner**.
This is precisely the silent failure the field exists to catch.

**No effect on any match that is not level after extra time**, which is about three in
four.

**One thing folded in: the default difficulty is now `casual`.** A first-time solo player
got `pro`, because that is what the balance was tuned against — a good reason for a
balance run and a poor one for somebody's first game. `pro` plans a whole turn ahead and
punishes a keeper left off its line; it is meant to be worth beating, not to be met cold.
Every level stays selectable on the setup screen and in the link. This changes only what
you get when you ask for nothing.

**Tests.** Unit and property cover what matters about a shootout rather than what it
happened to produce: that it always terminates and always names a winner across 400 seeds;
that it replays byte-identically; that no kick is taken after the result is settled; that
takers go in ATK order, each once, rotating in sudden death; and that the outcome of every
kick is exactly its two totals compared. Component tests cover the odds being on screen
before the press and the dice only after. An end-to-end test plays a real match to a real
shootout in a browser and takes every kick.
