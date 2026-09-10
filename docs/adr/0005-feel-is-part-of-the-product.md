# 0005 — Feel is part of the product, and lives entirely in the client

- **Status:** Accepted
- **Date:** 2026-09-10
- **Supersedes:** nothing (revises the scope boundary set in GDD v1.0 §14)
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

GDD §14 listed "no cosmetics" among the things explicitly out of v1. That was a
reasonable call while the game was a specification: cosmetics do not change what a rule
does, and a milestone that ships polish before it ships rules ships nothing.

Playing the first interactive build changed the assessment. The rules were right and the
board was legible, and it still did not feel like football. A dribble did not travel — the
piece was in one place and then it was in another. A pass did not cross the pitch; the
ball simply belonged to somebody else. Every outcome arrived as a completed fact.

That is a Pillar 1 problem, not a decoration problem. **"One more game"** depends on a
match producing _moments_, and a result that appears instantly is information rather than
an event. Pillar 2 — earned outcomes — is served well by the odds being visible before a
commit, but it is undercut when the outcome itself has no beat to it: a 67% chance you
took and won should feel different from a number changing.

The risk in reversing the call is obvious and specific: this project's entire
architecture rests on a deterministic engine, and animation is time. Anything that lets
elapsed time reach the rules would break replays, shareable match URLs and the
authoritative server in one move.

## Decision

**Feel is in scope for v1**, as three slices: movement, the goal moment, and the duel
reveal. Sound and the wider visual theme remain out.

**Animation is presentation only, and the boundary is structural rather than a matter of
care:**

- Everything animated lives in `apps/web`. The engine gains nothing, not even a duration
  constant.
- The engine resolves **synchronously** when a command is committed. The board then
  spends a few hundred milliseconds catching up to a state that is already true.
- **No timer, transition event or animation callback may call into the engine.** There is
  no "animation finished, now apply the result" path, because that path is how timing
  becomes a rule.
- Timing values live in CSS custom properties, so tuning the feel cannot touch behaviour.

To make movement possible at all, the board is drawn in two layers: a grid that owns the
turf, the goals, targeting and every click, and a pieces layer above it that owns the
players and the ball. The pieces layer is inert to the mouse.

## Rationale

- **A piece drawn inside its cell cannot move.** React unmounts it from the old cell and
  mounts a new one in the new cell, so there is no continuous element to travel. Keying
  pieces by player id in a layer of their own gives each one a single node for the whole
  match — even across the rebuild that follows a goal, because ids are stable — and a
  change of position becomes a change of transform, which the browser tweens for nothing.
- **The ball has to be its own piece.** It was a dot pinned to a shirt, which is fine
  while it only ever moves with its carrier and impossible the moment it should cross the
  pitch on its own.
- **CSS transitions rather than a motion library.** The problem is one property on a
  uniform grid. Transforms are the one thing browsers animate without re-laying out the
  page, `prefers-reduced-motion` is one media query, and the dependency-free version is
  small enough to read in full. A library earns its place when the choreography stops
  being "move this there", which the goal moment may well do — that is a decision for
  slice 2, not a default now.
- **Timing in CSS custom properties, not in TypeScript.** It keeps the tunable numbers
  away from the code paths that make decisions, and makes the reduced-motion override a
  two-line media query rather than a branch in a component.

## Consequences

**Positive**

- Outcomes land as events. The gap the odds created — you saw 67%, you took it — now has
  somewhere to resolve.
- The two-layer board is the structure the remaining slices need: a goal celebration and
  a dice reveal both want to overlay the pitch without disturbing targeting.
- Reduced-motion readers get the previous behaviour exactly, rather than a degraded
  version of the new one.

**Negative / accepted costs**

- **The board can be visually behind the truth.** For roughly a quarter of a second the
  pieces are mid-slide while the state, the status line and the accessible description
  have already moved on. Assistive technology is deliberately _not_ held back to match
  the animation; a screen-reader user should not wait for an effect they cannot see.
- **A fast player can act during a slide.** Input is not gated on animation, on purpose:
  gating it would put a timer in the interaction path, which is the first step toward
  putting one in the rules. The cost is that two quick clicks can overlap visually.
- The board is now two layers to reason about instead of one, and a target ring drawn in
  the grid can briefly sit where a piece no longer is.

**Revisit if**

- The goal moment or the duel reveal need real choreography — several elements, staggered
  timing, interruption. That is when a motion library stops being weight and starts being
  leverage.
- Overlapping input during animation proves confusing in play, in which case the fix is a
  visual one (a piece in flight reads as busy) rather than a timing gate.
- Anything ever needs the engine to know how long something took. It does not, and the
  answer is to model the thing as an explicit input rather than to read a clock.
