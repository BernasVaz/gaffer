# Gaffer — Master Setup & Roadmap

*From-scratch build plan. Written by your CTO for a fresh Mac and a first serious software project. `Gaffer` is a codename — a stable handle for the repo, packages, and folders until you pick the real name (renaming later is a 20-minute job).*

*Read top to bottom once. Then work it phase by phase — each phase has an **exit gate** that tells you when you're truly done and can move on.*

---

## 0. The five principles we build on

Everything below serves these. When a decision is unclear, choose the option that best honours them.

1. **The game rules are a pure, deterministic engine.** All game logic lives in one framework-free TypeScript package. Same input → same output, always. This is what makes tests, replays, and cheat-proof multiplayer possible.
2. **Separate engine, rendering, and networking.** The web client draws the engine; the server runs the *same* engine as the referee. Never mix them.
3. **Documentation and tests are part of "done," not chores for later.** Code without a test or a doc-comment is unfinished code.
4. **Small, reversible steps.** Every change is a small commit on a branch, reviewed by CI, merged only when green. `main` always works.
5. **Decisions are written down.** Design and architecture choices become dated records (GDD entries and ADRs) so we never re-litigate the same question.

---

## 1. The locked stack (my call as CTO, with the why)

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Language | **TypeScript (strict)** | One language across game logic, web client, and server. Types catch a whole class of bugs before they run. |
| Monorepo | **pnpm workspaces + Turborepo** | Engine, web, and server live in one repo, share code, and build/test together with caching. |
| Rules engine | **Pure TypeScript** (`@gaffer/engine`) | The heart of the game. Deterministic, seeded, 100% testable without a browser. |
| Contracts | **Zod** | Runtime validation at every network/DB boundary; types you can trust at the edges. |
| Web client | **Vite + React + TypeScript** | Fast dev server, huge ecosystem, easy to deploy and share via a URL. |
| Board rendering | **DOM + CSS-grid** (not a game engine) | For a turn-based grid game, plain DOM is simpler, lighter, and easier to make accessible than Phaser/canvas. We can add Pixi.js later *only if* the art becomes animation-heavy. |
| Styling | **Tailwind CSS** | Fast, consistent styling with design tokens. |
| Multiplayer | **Colyseus** (authoritative Node/TS server) | Purpose-built for authoritative turn/real-time rooms; the pure engine drops in as the referee. Added *after* the single-player prototype. |
| Auth / DB / storage | **Supabase** (Postgres, Auth, Storage) | Batteries-included backend; generous free tier; you already know it. |
| Mobile | **Capacitor** | Wraps the finished web build into iOS/Android from one codebase. Later. |
| Testing | **Vitest + Testing Library + fast-check + Playwright** | Unit, component, property-based (for engine invariants), and real-browser end-to-end. |
| Lint / format | **ESLint + Prettier** | Consistent, machine-enforced code style. |
| Git hooks | **Husky + lint-staged + commitlint** | Bad code and bad commit messages can't even be committed. |
| Versioning | **Changesets** | Human-readable changelogs and versioning for the engine package. |
| Docs | **TypeDoc** (from TSDoc comments) + Markdown `docs/` + ADRs + a living GDD | Documentation generated from the code plus decisions written by hand. |
| CI/CD | **GitHub Actions** → deploy web to **Vercel** | Every push is type-checked, linted, tested, built; main auto-deploys to a shareable URL. |
| AI pair | **Claude Code CLI**, run inside VS Code | Your day-to-day build partner, reading `CLAUDE.md` as its contract. |

**Why not Godot/Unity:** a native game engine means a second language, a full rewrite to add multiplayer, and no code-sharing between client and server. For a turn-based, web-first, online game, staying in TypeScript with one deterministic engine powering both sides is faster and more robust. We revisit only if we hit a rendering ceiling the web genuinely can't clear.

---

## 2. Phase 0 — Your Mac dev environment (Claude Code does the heavy lifting)

You're starting from basically nothing, so here's the trick that makes this painless: **install Claude Code first** — its native installer needs no other software, not even Node — then let Claude Code install and configure everything else on your Mac while you approve each step. You'll type just two commands by hand; Claude Code runs the rest and fixes anything that goes wrong.

Go slowly, one block at a time. Nothing here can harm your Mac.

### 2.0 Open Terminal
Press **Cmd-Space**, type **Terminal**, press Enter. A small window opens with a text prompt — this is where you type commands. "Run a command" means: click into that window, paste the line, press Enter. That's it.

### 2.1 Install Claude Code — the one manual install
Paste this single line and press Enter:
```bash
curl -fsSL https://claude.ai/install.sh | bash
```
What this does: downloads the official, Anthropic-signed Claude Code program and installs it. It needs nothing else (macOS already has `curl` built in), and it will keep itself up to date automatically from now on. Wait for it to finish and return you to the prompt.

If, in the next step, your Mac says `claude: command not found`, fully quit Terminal (**Cmd-Q**) and reopen it — that just lets it notice the newly installed program.

### 2.2 Make your project folder and open Claude Code inside it
Paste these two lines, pressing Enter after each:
```bash
mkdir -p ~/Developer/gaffer && cd ~/Developer/gaffer
claude
```
The first line creates a folder at `Users/you/Developer/gaffer` and moves into it. The second starts Claude Code **inside that folder**, so everything it builds later lands in the right place.

### 2.3 Sign in
The first time it runs, Claude Code opens your web browser to log in. Sign in with the **same Claude account** you use for this app, approve the access, and switch back to Terminal. You'll now see the Claude Code prompt waiting for you to type.

**How Claude Code works, in one breath:** you type what you want in plain English; before it runs any command or changes any file, it shows you exactly what it will do and waits for your **yes**. Nothing happens without your approval. On this fresh machine, say yes to the setup steps below.

### 2.4 What to say when Claude Code first opens — copy-paste this
Paste this as your very first message to Claude Code:

> You're my setup assistant on a brand-new Mac, and I'm new to all of this — explain what you're doing in plain language as you go. Set up a TypeScript game-development environment, running each step yourself and asking my approval before commands. In order:
> 1. Install **Homebrew** if it isn't already installed.
> 2. Install **Node.js LTS** using **fnm**, add fnm to my zsh shell so it loads in new terminals, and enable **pnpm** via corepack.
> 3. Install **VS Code** (the `visual-studio-code` Homebrew cask), install the `code` shell command, and add these extensions: ESLint, Prettier, Error Lens, GitLens, Vitest, Playwright Test for VS Code, Tailwind CSS IntelliSense, EditorConfig.
> 4. Configure **git** with user.name `Bernardo Rebocho Vaz`, user.email `bernardorebochovaz@gmail.com`, and default branch `main`.
> 5. Generate an **ed25519 SSH key** for GitHub using that email, then show me the public key so I can copy it.
>
> After each step, tell me what you did and confirm it worked. If anything fails, diagnose and fix it before moving on. When everything's done, verify that `node`, `pnpm`, `git`, `code`, `brew`, and `claude` all report a version, and give me a short summary of what's now installed.

Then just approve each step as it asks. Two interruptions are completely normal:
- A **macOS popup offering to install "Command Line Developer Tools"** the first time git is touched — click **Install** and wait a few minutes for it to finish, then tell Claude Code to continue.
- A **password prompt** while Homebrew installs — type your **Mac login password** and press Enter. The characters won't appear as you type; that's a security feature, not a bug.

### 2.5 What Claude Code is actually setting up (so the scrolling text makes sense)
- **Homebrew** — the macOS "app store for developer tools" that everything else installs through.
- **Node.js (via fnm) + pnpm** — the engine that runs JavaScript/TypeScript, and the tool that installs and builds your project's code.
- **VS Code + extensions** — your code editor, plus helpers that catch mistakes, format code, and run tests with a click.
- **git identity + SSH key** — git stamps your name on every saved change; the SSH key is a secure credential that lets your Mac push code to GitHub without typing a password each time.

### 2.6 Verify
When it says it's done, type to Claude Code: **"Run the Phase 0 verification checks and confirm my SSH key exists."** It should show a version for `brew`, `node`, `pnpm`, `git`, `code`, and `claude`, and confirm a public key at `~/.ssh/id_ed25519.pub`. Keep that key handy — you paste it into GitHub in Phase 1.

**Phase 0 exit gate:** all six tools report a version, VS Code opens, and your SSH public key exists.

---

## 3. Phase 1 — Accounts & services

### 3.1 GitHub
Create a free account at github.com. Settings → SSH and GPG keys → New SSH key → paste the key from step 2.4. **Check:** `ssh -T git@github.com` greets you by username.

Create a new **empty** repository named `gaffer` (private to start). Don't add any files yet — we scaffold locally and push.

### 3.2 Vercel
Sign up at vercel.com with your GitHub account. We'll connect the repo in Phase 6 for automatic deploys.

### 3.3 Supabase
Sign up at supabase.com with GitHub. Create a project named `gaffer` when we reach the backend milestone (M5) — no need yet.

**Phase 1 exit gate:** GitHub account + empty `gaffer` repo + SSH working; Vercel and Supabase accounts exist.

---

## 4. Phase 2 — Repository scaffolding

Create the monorepo and push the first green commit. (This is the first place you'll pair with Claude Code — hand it §4–§7 of this doc and let it generate the files, then you review.)

### 4.1 Target layout
```
gaffer/
├── apps/
│   ├── web/                 # Vite + React client (added M3)
│   └── server/              # Colyseus server (added M4)
├── packages/
│   ├── engine/              # PURE deterministic rules — the game
│   │   ├── src/
│   │   └── tests/
│   └── shared/              # Zod schemas, shared types & constants
├── docs/
│   ├── GDD.md               # Game Design Document (the source of truth for rules)
│   ├── adr/                 # Architecture Decision Records (0001-*.md ...)
│   └── engineering.md       # how we build (conventions)
├── .github/workflows/ci.yml # typecheck + lint + test + build on every push
├── .changeset/              # Changesets config
├── CLAUDE.md                # the contract Claude Code reads first
├── README.md
├── CONTRIBUTING.md
├── package.json             # root scripts (turbo)
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .editorconfig · .gitignore · .prettierrc · eslint.config.js
```

### 4.2 Root config files (what each is for)
- **`pnpm-workspace.yaml`** — declares `apps/*` and `packages/*` as workspaces.
- **`turbo.json`** — defines the `build`, `test`, `lint`, `typecheck` pipelines and caches them.
- **`tsconfig.base.json`** — one strict TypeScript config every package extends (`strict: true`, `noUncheckedIndexedAccess: true`).
- **`.editorconfig` / `.prettierrc` / `eslint.config.js`** — machine-enforced formatting and linting.
- **`.gitignore`** — ignores `node_modules`, `dist`, `.env`, Playwright artifacts, coverage.

### 4.3 First commit
```bash
cd ~/Developer            # or wherever you keep projects (mkdir -p ~/Developer)
# scaffold with Claude Code here, then:
git init
git add -A
git commit -m "chore: scaffold monorepo"
git branch -M main
git remote add origin git@github.com:<you>/gaffer.git
git push -u origin main
```
**Phase 2 exit gate:** `pnpm install` succeeds; `pnpm turbo run build lint test typecheck` runs (even with near-empty packages); the repo is on GitHub.

---

## 5. Phase 3 — Documentation system ("docs on all the code")

This is what you specifically asked for. Three layers, each with a clear job:

1. **Code-level docs — TSDoc comments + TypeDoc.** Every exported function, type, and module gets a `/** ... */` TSDoc comment explaining *what* and *why*. **TypeDoc** turns those comments into a browsable API reference (`pnpm docs` → HTML site). Rule of thumb: if someone would ask "why does this exist?", the answer lives in the comment.
2. **Repo-level docs — the `docs/` folder.**
   - **`GDD.md`** — the Game Design Document. The rules of the game in plain language. The engine is built to match this; when they disagree, one of them is a bug.
   - **`adr/NNNN-title.md`** — Architecture Decision Records. One short file per real decision (e.g. "0001: use Colyseus for multiplayer"), with context, the decision, and consequences. Dated, numbered, never edited after acceptance — superseded by a new one instead.
   - **`engineering.md`** — the conventions (naming, folder rules, test expectations). A distilled `CLAUDE.md`.
3. **Living project docs — README + CONTRIBUTING + CHANGELOG.**
   - **`README.md`** — what Gaffer is, how to run it, the scripts.
   - **`CONTRIBUTING.md`** — branch/commit/PR rules; how to run tests.
   - **`CHANGELOG.md`** — generated by **Changesets**, not hand-written.

**Phase 3 exit gate:** `docs/` exists with a GDD stub, ADR `0001` (the stack decision), TypeDoc generating an API site, and README + CONTRIBUTING written.

---

## 6. Phase 4 — Quality gates (make bad code impossible to commit)

- **TypeScript strict** — the base config rejects implicit `any`, unchecked indexing, unused locals.
- **ESLint + Prettier** — one command formats and lints; CI fails on violations.
- **Husky pre-commit hook + lint-staged** — on every `git commit`, staged files are auto-formatted and linted. Broken code never reaches a commit.
- **commitlint + Conventional Commits** — commit messages must read `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`. This is what lets Changesets and the changelog work.
- **CI (`.github/workflows/ci.yml`)** — on every push and PR: install → typecheck → lint → test (with coverage) → build. Branch protection on `main` requires CI green before merge.

**Phase 4 exit gate:** a deliberately-broken commit is blocked locally by the hook; a broken PR is blocked by CI.

---

## 7. Phase 5 — Testing strategy (the pyramid for this game)

Four test types, each pulling its weight:

1. **Unit tests — Vitest.** The bulk. Every engine rule (move, pass, dribble, shoot, press, discipline, win conditions) gets direct tests: given this state and this action, assert the next state. Fast, run on every save.
2. **Property-based tests — fast-check.** For engine *invariants* that must hold across thousands of random inputs: "a match never has two pieces on one cell", "score never decreases", "a replayed move log reproduces the exact final state". These catch the bugs you didn't think to write a case for.
3. **Component tests — Testing Library.** For React UI pieces (the board, the setup screen, the HUD): render, interact, assert what the user sees.
4. **Browser / end-to-end tests — Playwright.** Real Chromium/WebKit driving the deployed app: start a match, make moves, score a goal, see the result. Also produces screenshots/video for you to eyeball. Runs in CI and can record a GIF of a full match.

**Coverage:** enforce a floor on `@gaffer/engine` (e.g. 90%+ lines) since it's the crown jewel; lighter thresholds on UI. **Determinism test** is mandatory: a saved seed + move log must always replay to the identical final state — this single test protects the entire engine.

**Phase 5 exit gate:** `pnpm test` runs all four layers; the determinism replay test passes; coverage thresholds enforced in CI.

---

## 8. The milestone roadmap

Setup (Phases 0–5) is the foundation. These milestones are the game itself. Each has an exit gate.

### 🟦 M1 — Game Design Document (before any game code)
Lock the concept: the pitch, pieces and stats, how a turn works, how actions resolve (the dice math), win/lose conditions, match length, and — critically — the **scope of v1** (what's in, what's explicitly out). We'll write it together; it becomes `docs/GDD.md` and the contract the engine is tested against.
**Exit gate:** a GDD complete enough that someone could implement the rules from it with no further questions.

### 🟩 M2 — The engine (`@gaffer/engine`)
Build the pure, deterministic rules engine from the GDD: state model, seeded RNG, action resolvers, turn flow, win conditions. Test-driven — write the test from the GDD, then the code. No rendering, no network.
**Exit gate:** every GDD rule has a passing test; the determinism replay test is green; coverage floor met.

### 🟨 M3 — The shareable web prototype ⭐
Build the React + CSS-grid client against the engine. Setup screen, board, legal-move highlights, dice/goal feedback, hotseat + vs a basic AI. Deploy to a Vercel URL with a seed in the link so matches are reproducible.
**Exit gate:** anyone with the link plays a full match, no rule bugs. **Ship it to communities for feedback.**

### 🟧 M4 — Online multiplayer (Colyseus)
Authoritative server running the engine as referee; clients send intents and reconcile. Lobby + simple matchmaking; reconnect mid-match.
**Exit gate:** two people on different machines complete a match; disconnect/reconnect recovers cleanly.

### 🟥 M5 — Accounts & persistence (Supabase)
Real auth (sign-in UI), profiles, saved results, a basic leaderboard — all behind Zod-validated boundaries, service-role key server-only.
**Exit gate:** a new user signs up, plays a ranked online match, sees the result recorded.

### 🟪 M6 — Mobile & launch (Capacitor)
Wrap the web build for iOS/Android (touch input, safe areas); store assets; closed beta → public v1.
**Exit gate:** installable web + at least one mobile platform; v1 tagged.

---

## 9. Your day-one checklist (the very first sitting)

1. Install Claude Code (`curl -fsSL https://claude.ai/install.sh | bash`), open it in `~/Developer/gaffer`, and sign in (§2.1–2.3).
2. Give it the Phase 0 setup prompt (§2.4) and approve each step until all six `--version` checks pass.
3. Create your GitHub account + an empty `gaffer` repo, and paste in the SSH key Claude Code generated for you (Phase 1).
4. Back in Claude Code, hand it this Master Plan and scaffold the monorepo (Phase 2) — end with the first green `git push`.

That's a complete, satisfying first day: a real, tooled, CI-backed repo on GitHub — before a single line of game code. From there, M1 (the GDD) is our next working session.

## 10. How we'll work together (CTO cadence)

You bring the game vision; I own architecture, standards, and unblocking. For each milestone: I hand you (or Claude Code) a precise task with acceptance criteria, we build in small green commits, and we record real decisions as ADRs. When you're unsure, ask one focused question rather than guessing. I'll flag risks early and keep us honest about scope — the fastest path to a game people play is a small, correct v1 shipped, then iterated.

---

*Next working session: write the GDD together (M1). Tell me the football-chess concept in your own words — as much or as little as you have — and I'll shape it into a complete design document we can build against.*
