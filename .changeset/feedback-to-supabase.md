---
"@gaffer/web": minor
---

Feedback is sent rather than downloaded. A flagged note goes to the database as it is
typed, and full time asks "how was that match?" — one tap, a sentence only if they want
one. Everything else is captured for them: seed, game type, difficulty, rules edition,
online match, turn and score, build tag, device and theme.

Nothing is lost when the network is: an unsent note is queued in local storage and flushed
when the browser comes back online, and the Markdown download remains. Nobody can read
feedback back through the API — the table has no select policy at all.
