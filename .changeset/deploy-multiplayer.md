---
"@gaffer/web": minor
---

A deployed release carries multiplayer and points at the Supabase project, and the setup
screen offers a way in — a tester cannot be expected to type a query parameter. Both are
gated on the build-time flag, so a build without it has neither the code nor the door, and
the bundle-isolation gate now checks for the door as well.
