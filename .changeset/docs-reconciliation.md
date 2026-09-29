---
"@gaffer/web": patch
---

Reconcile every document with the live engine, and add a test so they cannot drift apart
again. The GDD's locked table disagreed with the code in three places and with itself in
one; the Master Plan still described a Colyseus server and a Vercel deploy; five ADRs were
superseded without saying so. No rule moved.
