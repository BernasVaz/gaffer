---
"@gaffer/web": minor
---

Online play uses the single-player match screen. A real two-person match failed two ways:
nobody could find the one player of eleven with a legal action at kickoff, because the
online view had no scoreboard, status line or hint; and the opponent was left stuck,
because the view computed its board with a fabricated generator rather than the match's
own, so the two phones disagreed about a duel and the match stopped.

The online view is deleted. `Match` now takes a controller, `useRemoteMatch` replays the
log rather than carrying a generator, and each player sees their own team at the bottom
attacking up. See ADR 0035.
