---
"@gaffer/shared": minor
"@gaffer/web": minor
---

Add a setup screen and a playable solo match.

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
