---
"@gaffer/web": patch
---

Ship it: every push to `main` now publishes the client, and the build is portable.

The client builds with a relative base and bundles its font, so one artifact serves
correctly from a project subpath or a domain root. `LazyMotion` trims the bundle from
134 KB to 121 KB gzipped, with `strict` on so the full build cannot be reintroduced by
importing the obvious thing.

Deploys go to GitHub Pages, which needs no credential CI does not already have.
`vercel.json` is committed and correct, so importing the repo on Vercel later is a
two-minute job with no code change. See ADR 0009.
