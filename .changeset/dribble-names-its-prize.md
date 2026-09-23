---
"@gaffer/engine": minor
"@gaffer/web": patch
---

Say where a won dribble finishes. The engine gains `dribbleFinish`, which answers ahead
of a die what a won dribble's destination would be, and the board uses it: a dribble that
carries on is labelled "on to column X, row Y if you win" and draws a second, fainter
ring on that cell. The odds were always honest; the prize was not, and §9 promises both
are knowable before committing. The rule stays in the engine — the client asks rather
than works it out.
