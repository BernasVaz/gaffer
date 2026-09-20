# 0009 — Ship on GitHub Pages, and keep Vercel one import away

- **Status:** Accepted (interim — see _Revisit if_)
- **Date:** 2026-09-20
- **Supersedes:** nothing (narrows the CD half of ADR 0001's stack table)
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

ADR 0001 picked "GitHub Actions → Vercel" for CI/CD, and Master Plan M3 ends with a
shareable URL. The client is finished and the exit gate is a link.

Connecting Vercel turned out not to be a code change. It is an account action: somebody
signs in to Vercel, imports the repository, and approves the GitHub app. There is no
Vercel CLI on this machine, no stored credential, and no token in the environment —
and there is no way to create one from here, because the first step is a browser
sign-in. The repository has no Vercel integration installed either, so pushing a
`vercel.json` deploys nothing.

That left three ways forward:

1. **Wait for Vercel to be connected**, and ship nothing until then.
2. **Deploy somewhere that needs no credential we do not already have.**
3. **Ask for a Vercel token**, and deploy with it.

## Decision

Option 2, without closing option 3.

**GitHub Pages is the deploy target for M3.** A workflow builds the client on every push
to `main` and publishes it. It needs nothing but the token Actions already issues itself,
costs nothing, and produces a real public URL.

**`vercel.json` is committed anyway**, with the install command, the build command and
the output directory already correct for this monorepo. Importing the repository on
Vercel is then a two-minute job with **no code change** — and because the client builds
with a relative base, the same artifact serves correctly from a project subpath _or_ a
domain root.

## Rationale

- **Option 1 is the expensive one.** The whole point of M3 is feedback, and a link that
  does not exist collects none. Holding a finished client hostage to an account action is
  the tail wagging the dog.
- **Option 3 asks for a credential to solve a problem that does not need one.** A
  long-lived deploy token, created under time pressure so an agent can use it, is a worse
  artefact than a free static host. If Vercel is wanted, the right move is the two-minute
  import, done deliberately.
- **Pages is genuinely sufficient for what M3 needs.** The client is a static single page
  with no server, no API and no secrets: it holds its entire state in the query string.
  Everything Vercel would add here — serverless functions, edge config, preview
  deployments — is either unused or already covered by CI.
- **This is not a stack decision.** M4 puts a Colyseus server in front of the same engine,
  and that genuinely needs a host. This ADR is about where a static bundle lives today,
  not about where the product lives.

## Consequences

**Positive**

- There is a link, and it is always what `main` says. No manual publish step to forget.
- Zero cost, zero new credentials, and no third-party app with write access to the repo.
- The relative base means the build is portable — the artifact that works on Pages works
  unchanged at a domain root.

**Negative / accepted costs**

- **No preview deployments per pull request.** Vercel's best feature, and the one actually
  missed. Mitigated by the Playwright job, which drives the real build in CI, but reviewing
  a look still means running it locally.
- **The URL is `bernasvaz.github.io/gaffer/`**, which is nobody's idea of a product
  address. A custom domain is a DNS record away, and so is Vercel.
- **ADR 0001's stack table now overstates the present.** Recorded here rather than edited
  there, per the rule that an accepted ADR is superseded, not rewritten.
- Pages serves from a subpath, which is why the base is relative and the font is bundled
  rather than sitting in `public/`. That is a constraint that would not exist on Vercel,
  and it is one an end-to-end test against the _built_ app is well placed to catch.

**Revisit if**

- Vercel gets connected — which is a click, and needs nothing from this repository that is
  not already in `vercel.json`. Both can run side by side for as long as is useful.
- M4 arrives with a server, at which point the client should live wherever the server does.
- A custom domain is wanted, which either host supports.
