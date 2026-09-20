---
"@gaffer/web": patch
---

Add the end-to-end layer: a real browser playing a real match.

Eleven Playwright tests against the **built** app, not the dev server — including one
that plays a whole match a click at a time and asserts the engine never refuses a
command the board offered, which is exactly the bug the layer exists to catch. Two more
check the promise a shared link makes: the same seed plays out the same way twice.

It runs as its own CI job. Every locator is a role and an accessible name, so the suite
exercises the same surface a screen-reader user has.
