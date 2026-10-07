# Worktree setup: from 10 minutes of workarounds to one command

Status: reviewed plan (not implemented). Source: /plan-devex-review on `claude/lucid-banach-4b4f29` @ f536e35, 2026-10-07.
Scope: how a contributor (mostly Claude Code agents in fresh git worktrees) gets this repo to a green `npm run check` and a recruitment page with data. The branch's page change has no developer surface and is out of scope here.

## Decision ledger

| # | Evidence | Current | Decided | Answer |
|---|----------|---------|---------|--------|
| D1 | Branch diff touches only a public page | — | Review contributor setup | A |
| D2 | Branch lives in `.claude/worktrees/`; CLAUDE.md + MCP | — | Persona: you + agents in worktrees | A |
| D3 | Session log | — | Journey confirmed as observed | A |
| D4 | ~10 min observed | ~10 min | Target 2–5 min via `.worktreeinclude` + `npm run setup` | B (Competitive) |
| D5 | No migration seeds recruitments | empty DB | Copy local D1 state via `.worktreeinclude` | A |
| D6 | Enhancement to existing repo | — | DX POLISH | A |
| D7 | `.gitignore:182` ignores `*.test.ts`; `npm test` fails on clean checkout | local-only tests | Track tests; `check` = test + typecheck + build | A |
| D8 | gstack config unset | unset | cross-project learnings on | A |
| D9 | Raw errors give no fix | none | 4-line setup block in CLAUDE.md | A |
| D10 | `deploy` uses vinext against Astro build | untracked | Added to TODOS.md | A |

Routine follow-through (no separate decision; restores contracts the README already states): add `typescript` devDependency; `typecheck` runs `astro sync` first; CLAUDE.md links made relative; README setup/validation text made true.

## Developer Persona Card

```
TARGET DEVELOPER PERSONA
========================
Who:       The maintainer plus Claude Code agents, each in a fresh git worktree under .claude/worktrees/
Context:   Session starts on a clean branch and is asked to change code and run typecheck/test/build/browser checks
Tolerance: ~2 minutes of setup before improvising workarounds
Expects:   One command makes tests, typecheck, build and a page with data work; CLAUDE.md says what it is
```

## Developer Empathy Narrative (confirmed, D3)

"I'm a Claude session in `.claude/worktrees/lucid-banach-4b4f29`, asked to fix a page and run `npm run typecheck`, `npm test` and `astro build`. The tree is clean but there's no `node_modules`; I link the main checkout's. `typecheck` fails with *Cannot find module 'astro:middleware'*; nothing says why; I guess at `astro sync` and it passes. `npm test` fails with *Cannot find module src/engine/eligibility.test.ts*; the file is gitignored as 'local-only', so I copy three test files from the main checkout. The README says `npm run check` 'runs the tests'; it doesn't. To see the page I need data: the worktree's `.wrangler/state` is empty and the README's migrate step would leave no recruitments, so I copy the main checkout's D1 state. About ten minutes and five workarounds before my first real check, none written down."

Found after confirmation: `typecheck` actually ran a **global** `tsc` 5.9.3 (`%APPDATA%\npm\tsc`); `typescript` is not in `package.json` or the lockfile.

## Competitive DX Benchmark

Clock: fresh worktree created → `npm run check` green **and** a recruitment detail page renders with data.

| Tool | Start → result | Time + evidence | DX choice | Source |
|------|----------------|-----------------|-----------|--------|
| This repo today | as above | ~10 min, observed, 5 manual steps | none | this session |
| This repo after plan | as above | 2–5 min, **estimated** (npm ci dominates) | `.worktreeinclude` + `npm run setup` | this plan |
| Claude Code `.worktreeinclude` | worktree → gitignored files present | at creation, documented | declarative copy list | https://code.claude.com/docs/en/worktrees |
| WorktreeCreate hook | worktree → deps + env | reported, not measured | scripted setup (replaces default) | https://github.com/tfriedel/claude-worktree-hooks |
| Typical Astro repo | clone → typecheck green | not measured | `astro sync` before `tsc` | https://flaviocopes.com/fixing-ts-issues-in-vs-code-astro.md |

Boundaries differ between rows; compare approaches, not minutes. Target tier: Competitive (D4).

## Magical Moment Specification (D5)

A fresh worktree runs `npm run setup`, then `npm run check` is green and `/recruitments/<slug>` shows the same recruitments the maintainer sees locally.
Requirements: `.worktreeinclude` lists `.dev.vars` and `.wrangler/state/`; `npm run setup` re-applies local migrations after the copy so branch migrations land on the copied DB. **Unverified:** that `.worktreeinclude` copies a directory pattern; prove once (T4).

## Developer Journey Map

```
STAGE           | DEVELOPER DOES                                  | FRICTION (evidence)                                   | STATUS
----------------|-------------------------------------------------|-------------------------------------------------------|--------
1. Discover     | Reads CLAUDE.md                                 | No setup step; absolute links open main checkout      | fixed (T5)
2. Install      | npm ci / copies .dev.vars, D1 by hand           | Nothing copied into worktrees; no setup script        | fixed (T3, T4)
3. Hello World  | npm run typecheck / npm test                    | needs astro sync; global tsc; tests gitignored        | fixed (T1, T2)
4. Real Usage   | npm run check, astro dev, open a page           | check skips tests (README says otherwise); empty DB   | fixed (T2, T4, T6)
5. Debug        | Reads raw TS / Node errors                      | No cause or fix in either error                       | fixed (T5, D9)
6. Upgrade      | Pulls a branch with new migrations              | Copied DB may lag migrations                          | fixed (setup re-applies)
```

## First-Time Developer Confusion Report (observed, this session)

```
Persona: agent in fresh worktree
T+0:00  Clean tree, no node_modules. Links main checkout's node_modules (not documented).       -> T3
T+1:00  npm run typecheck: TS2307 'astro:middleware' + 7 implicit-any errors.                    -> T1, T5
T+3:00  Guesses `astro sync`; typecheck passes (with a global tsc it didn't know it was using).   -> T1
T+4:00  npm test: ERR_MODULE_NOT_FOUND eligibility.test.ts; finds `*.test.ts` in .gitignore.     -> T2
T+6:00  Copies 3 test files from main checkout; tests pass.                                      -> T2
T+7:00  astro dev: needs data; copies main checkout's .wrangler/state.                           -> T4
T+10:00 First real check runs.
```
All items addressed by tasks below.

## NOT in scope

- Fixing `npm run deploy` / removing vinext scripts: deploy path, not setup; tracked in TODOS.md (D10).
- Restoring `markdown/CONTEXT.md` and `docs/RECRUITMENT_LIFECYCLE_DOMAIN.md`: already in TODOS.md.
- WorktreeCreate hook reusing node_modules (<2 min): declined in D4 for maintenance cost.
- Committed dev seed for clones/CI: declined in D5; revisit if outside contributors or CI page checks appear.
- LICENSE / CONTRIBUTING.md: no outside contributors yet (Pass 7).
- Recurring setup-time measurement in CI: new policy, not proposed (Pass 8).

## What already exists

- README "Local setup" and "Validation" sections (update, don't replace).
- `npx wrangler d1 migrations apply EligibilityEngine-db --local` (idempotent; reuse in setup).
- `.dev.vars.example` (clones still copy it; worktrees get `.dev.vars` via `.worktreeinclude`).
- CI workflow `npm ci` + `npm run check` (keep; it starts passing once T1/T2 land).
- `tsx` and `wrangler` already devDependencies.

## DX Scorecard

```
+====================================================================+
|              DX PLAN REVIEW — SCORECARD                             |
+====================================================================+
| Dimension            | Before | After  | Trend  |
|----------------------|--------|--------|--------|
| Getting Started      |  3/10  |  8/10  |  ↑     |
| API/CLI/SDK (scripts)|  5/10  |  7/10  |  ↑     |
| Error Messages       |  2/10  |  7/10  |  ↑     |
| Documentation        |  4/10  |  7/10  |  ↑     |
| Upgrade Path         |  5/10  |  7/10  |  ↑     |
| Dev Environment      |  3/10  |  7/10  |  ↑     |
| Community            |  4/10  |  5/10  |  ↑     |
| DX Measurement       |  1/10  |  6/10  |  ↑     |
+--------------------------------------------------------------------+
| TTHW                 | ~10 min (observed) -> 2–5 min (estimated)   |
| Competitive Rank     | Needs Work -> Competitive (target)          |
| Magical Moment       | designed via .worktreeinclude D1 copy       |
| Product Type         | Contributor setup / docs                    |
| Mode                 | POLISH                                      |
| Overall DX           |  3/10  |  7/10  |  ↑     |
+====================================================================+
| Zero Friction      | covered (one command)                          |
| Learn by Doing     | covered (page with real data)                  |
| Fight Uncertainty  | covered (CLAUDE.md error -> fix)               |
| Opinionated + Escape Hatches | covered (setup script; manual steps stay in README) |
| Code in Context    | covered                                        |
| Magical Moments    | covered, unverified until T4/T7                |
+====================================================================+
```

No dimension below 6 except Community (5), which is out of scope for a solo repo.

## DX Implementation Checklist

```
[ ] Fresh worktree -> green check + page with data in < 5 min (T7)
[ ] Setup is one command: npm run setup (T3)
[ ] npm test / typecheck / check pass on a clean checkout and in CI (T1, T2)
[ ] Magical moment via .worktreeinclude D1 copy (T4)
[ ] The two raw setup errors map to the fix in CLAUDE.md (T5)
[ ] README Local setup and Validation describe what the scripts do (T6)
[ ] Works in CI without special configuration (T1, T2)
```

## Implementation Tasks

Synthesized from this review's findings. Effort ratio assumption: config/docs changes ~20x human/CC.

- [ ] **T1 (P1, human: ~20min / CC: ~3min)** — package.json — Make typecheck self-sufficient
  - Surfaced by: Pass 6 — `tsc` is a global 5.9.3, `typescript` missing from package.json/lockfile; Pass 3 — TS2307 'astro:middleware' until `astro sync`
  - Files: `package.json`, `package-lock.json`
  - Change: add `typescript` (^5.9) to devDependencies; `"typecheck": "astro sync && tsc --noEmit"`
  - Verify: in a fresh worktree with no global tsc on PATH, `npm ci && npm run typecheck` passes
- [ ] **T2 (P1, human: ~30min / CC: ~5min)** — tests — Track tests and gate on them (D7)
  - Surfaced by: Journey stage 3 — `npm test` ERR_MODULE_NOT_FOUND; README:40 claims check runs tests
  - Files: `.gitignore` (drop `*.test.ts`, `*.spec.ts`), `src/engine/eligibility.test.ts`, `src/services/viewer-state.test.ts`, `src/services/public-listing.test.ts`, `package.json` (`"check": "npm test && npm run typecheck && npm run build"`)
  - Sequencing: the main checkout has uncommitted `src/services/cadre-guide.test.ts` and a `package.json` test-script change; commit that file with the cadre-guide work once tests are tracked. Review test files for private fixtures before committing.
  - Verify: `npm run check` green locally and in CI; `npx astro build` output contains no `.test.` module
- [ ] **T3 (P2, human: ~20min / CC: ~3min)** — package.json — Add `npm run setup` (D4)
  - Surfaced by: Journey stage 2 — no setup script; README setup is four manual commands
  - Change: `"setup": "npm ci && astro sync && wrangler d1 migrations apply EligibilityEngine-db --local"`
  - Verify: run twice in a row (idempotent); confirm whether `migrations apply --local` prompts in a TTY (unverified; add `--yes`-equivalent only if it does); stop `astro dev` first on Windows (npm ci deletes node_modules)
- [ ] **T4 (P2, human: ~10min / CC: ~2min)** — repo root — Add `.worktreeinclude` (D5)
  - Surfaced by: Journey stage 4 — worktree has no `.dev.vars` or D1 data
  - Files: `.worktreeinclude` with `.dev.vars` and `.wrangler/state/`
  - Verify: create a new Claude Code worktree; both paths exist; a recruitment page renders
- [ ] **T5 (P2, human: ~15min / CC: ~3min)** — CLAUDE.md — Setup block + relative links (D9)
  - Surfaced by: Pass 3 — raw errors carry no fix; Pass 4 — absolute `file:///d:/...` links open the main checkout
  - Change: under Development: "New worktree: run `npm run setup`. `Cannot find module 'astro:*'` or a missing `*.test.ts` means setup was skipped." Make CONTEXT/lifecycle/DESIGN links relative.
  - Verify: links resolve from a worktree
- [ ] **T6 (P2, human: ~15min / CC: ~3min)** — README.md — Setup and validation text matches scripts
  - Surfaced by: Pass 4 — README:40 false; no worktree note
  - Change: Local setup = `Copy-Item .dev.vars.example .dev.vars` (clones only) + `npm run setup`; note worktrees get `.dev.vars`/D1 via `.worktreeinclude`; Validation line becomes true after T2
  - Verify: follow README literally on a fresh clone
- [ ] **T7 (P3, human: ~10min / CC: ~5min)** — verification — Time the approved clock once (Pass 8)
  - Change: none; after T1–T6, create one fresh worktree and time creation -> `npm run setup` -> `npm run check` green -> page renders
  - Verify: total < 5 min; record result in this doc

JSONL task artifact for /autoplan: **not written** — `jq` is not installed on this machine.

## Unresolved Decisions

None. All ten questions were answered.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | codex plan review (default-on) | Independent 2nd opinion | 1 | unavailable | Codex not installed; native fallback needs TaskOutput (absent) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | issues_open | score: 3/10 → 7/10, TTHW: ~10 min → 2–5 min (target) |

- **OUTSIDE COVERAGE:** codex, plan-review phase, unavailable (CLI not installed; no native fallback ran). Missing coverage, not clean.
- **Review log:** not persisted — `gstack-review-log` needs Bun, which is not installed (it reports this as "invalid JSON").
- **VERDICT:** no review CLEARED; eng review required.

NO UNRESOLVED DECISIONS
