# 0008 — The look is drawn in code, not sourced

- **Status:** Accepted
- **Date:** 2026-09-20
- **Supersedes:** nothing (extends the scope boundary set by ADR 0005)
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

ADR 0005 brought _feel_ into v1 — movement, the goal moment, the duel reveal — and was
explicit that "sound and the wider visual theme are still out." That held while the
board was a proving ground for the rules. It stopped holding the moment M3's exit gate
became "anyone with the link plays a full match," because the first thing anyone with a
link does is decide, in about a second, whether this is a game or somebody's weekend
project. A grid of lettered tokens on two shades of green answers that question badly,
and no amount of correct football underneath rescues the answer.

The obvious route to a look is an artist, and that route is closed for now: sourcing
character art is a decision with a budget and a taste attached to it, and it belongs to
Bernardo rather than to a build session. The question was therefore not "illustrated or
not" but **"how far can the look get on code alone, and is that far enough to ship."**

Three options:

1. **Ship the tokens**, and treat the look as post-MVP.
2. **Bring in real art** — sourced or commissioned character sprites.
3. **Draw everything in code** — SVG characters, CSS pitch, a typeface.

## Decision

Option 3, and not as a placeholder. The client gets a designed visual identity built
entirely from code:

- **Characters are parametric SVG.** One `Footballer` component takes a team, a role and
  a gaze and returns a chunky cartoon player: heavy outlines, saturated kit, slightly
  exaggerated proportions. Roles are distinguishable without reading the number — the
  keeper has its own kit, a cap and gloves; the defender is broader; the midfielder wears
  the armband; the winger has a headband; the striker has gold boots.
- **The eyes follow the ball**, as a function of the board. The carrier looks up the
  pitch instead.
- **The pitch is a pitch** — mown stripes, centre circle, halfway line, penalty areas,
  corner arcs, and real netting inside each goal mouth.
- **Kits are blue and red**, with amber and violet keepers, chosen to separate from each
  other and from grass.
- **One typeface**, Baloo 2, self-hosted.
- **Chrome is "chunky"**: crests, a broadcast scoreboard, and buttons with a lit top edge
  and a hard bottom edge that drop into their own shadow when pressed.

**ADR 0005's boundary is unchanged and unweakened.** All of it lives in `apps/web`, none
of it reaches the engine, and none of it is stateful or random.

## Rationale

- **Option 1 fails the exit gate.** The gate is about strangers, and strangers judge fast.
  A prototype that looks like a prototype gets feedback about how it looks, which is the
  least useful feedback available at this stage — the questions worth asking are about the
  football.
- **Option 2 is not a decision an AI pair should make.** It spends money and it fixes the
  game's taste. What _can_ be done without that call is find out how much of the gap code
  closes on its own, which turns out to be most of it. If illustrated characters are still
  the right next step afterwards, that decision is now made against something real rather
  than against a grid of letters.
- **Parametric SVG beats a sprite sheet here** even setting cost aside. Ten pieces, five
  roles, two sides and a gaze that has to track a moving ball would be a large sheet of
  images or a small amount of arithmetic. It also keeps the client's rule intact: the
  board is a pure function of the state, including where everyone is looking.
- **The eyes are the cheapest personality in the project.** A dozen lines, no animation,
  no state — and they are most of what makes the board feel inhabited rather than
  occupied. Ten heads turning together also carries information: the direction of play is
  readable before anything has been read.
- **Self-hosting the font** is one request fewer, cannot be blocked by a network that
  dislikes third parties, and means no third party learns who opened the page. 33 KB for
  the weight range, under the SIL Open Font License, with the licence shipped beside it.

## Consequences

**Positive**

- The client reads as a game at a glance, which is what the M3 gate actually tests.
- Everything is themeable from data: `kits.ts` and a handful of CSS custom properties
  restyle the whole product, so iterating on look is a small diff rather than an asset
  pipeline.
- The art has no loading state, no missing-image case and no aspect-ratio problems, and it
  is sharp at every size including a phone.

**Negative / accepted costs**

- **It is a _style_, and style is taste.** These are decisions made by a build session:
  the colours, the proportions, the font. They are meant to be argued with, and they are
  cheap to argue with, which is the point of keeping them as data.
- **Code-drawn characters have a ceiling.** They cannot act, celebrate, or have a run
  cycle. If the game wants a striker who wheels away after scoring, that is illustrated or
  rigged art and a decision with a budget attached — noted as a follow-up rather than
  attempted here.
- **The bundle grew** from 131 KB to 134 KB gzipped, plus a 33 KB font. Modest for what it
  buys, and the font is cached separately from the app.
- **Ten inline SVGs re-render on every board change.** Fine at this size — they are about
  twenty nodes each and the browser is not being asked to lay anything out — but it is not
  a technique that scales to eleven-a-side without a second look.

**Revisit if**

- Bernardo sources character art. The seam is `Footballer`: it takes a team, a role and a
  gaze, and what it returns is nobody else's business.
- The board grows to 7- or 11-a-side, where the node count stops being free.
- Sound arrives, which is the other half of "feels like a game" and is still out of scope.
