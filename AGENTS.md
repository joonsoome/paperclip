# AGENTS.md

Guidance for Human and AI contributors working in this repository.

This repository is a fork-oriented Paperclip workspace running in a Proxmox development LXC.
Primary goal: keep `/root/paperclip` usable for local dev/deploy, while making upstreamable changes in small, clean branches.
This AGENTS.md is fork-local and origin-only. Do not propose it upstream unless explicitly requested.

---

## 1. Purpose

- This workspace is for developing and testing **Paperclip** (`paperclip.ing`) in a self-hosted dev CT.
- Treat this repo as a **fork-first workspace**:
  - `origin` = your fork
  - `upstream` = `paperclipai/paperclip`
- Prefer changes that can be proposed upstream as focused PRs.
- Prefer plugins/extensions over core product divergence when possible.

---

## 2. Local Environment Contract

- Repo root: `/root/paperclip`
- Dev CT role: code-server + Codex + OpenCode + Paperclip source checkout
- Default runtime mode in this CT:
  - local/self-hosted
  - single-node
  - persistent filesystem
  - loopback-only unless the user explicitly asks otherwise
- Do **not** assume Kubernetes, horizontal scaling, or ephemeral workers.
- This CT intentionally runs as `root`.
  - Root-only embedded PostgreSQL bootstrap is supported here.
  - If you change local DB/bootstrap/worktree code, keep it root-safe.
  - Do not reintroduce assumptions that require a non-root user just to make local embedded PostgreSQL work.

### Paths

- Repository root: `/root/paperclip`
- Optional sibling workspaces for experiments: `/root/workspaces/*`
- Temporary notes/plans inside repo: `doc/plans/`
- Never create random planning docs in the repo root.

---

## 3. Read This First

Before making changes, read in this order when relevant:

1. `AGENTS.md`
2. `doc/GOAL.md`
3. `doc/PRODUCT.md`
4. `doc/SPEC-implementation.md`
5. `doc/DEVELOPING.md`
6. `doc/DATABASE.md`
7. `CONTRIBUTING.md`

Notes:
- `doc/SPEC-implementation.md` is the concrete build contract.
- `doc/SPEC.md` is longer-horizon context.
- If repo guidance conflicts with local habits, follow repository docs first, then this file.
- When present, treat `.claude/` as supplemental workspace guidance for local operator behavior.

---

## 4. Repo Map

- `server/` - Express REST API and orchestration services
- `ui/` - React + Vite UI
- `packages/db/` - schema, migrations, DB clients
- `packages/shared/` - shared types/constants/validators
- `packages/adapters/` - adapter implementations
- `packages/adapter-utils/` - shared adapter utilities
- `packages/plugins/` - plugin system packages
- `doc/` - product, architecture, ops, and plan docs
- `deploy/` - local operational artifacts for this CT
- `instances/` - local runtime data and instance state

Keep local deployment/service files isolated from upstream PRs.

---

## 5. Fork / Remote Strategy

Expected git remote model:

```bash
git remote -v
# origin   <your-fork-url>
# upstream https://github.com/paperclipai/paperclip.git
```

If `upstream` is missing, add it:

```bash
git remote add upstream https://github.com/paperclipai/paperclip.git
git fetch upstream --prune
```

### Branch roles

- `master`: local fork's default integration branch
- `lab/dev`: optional branch for CT-specific convenience changes that should not be proposed upstream
- `feat/...`: upstreamable feature work
- `fix/...`: upstreamable bug fixes
- `docs/...`: documentation-only work
- `chore/...`: local maintenance or tooling-only changes

### Golden rule

If a change is potentially upstreamable, branch from a fresh sync of `upstream/master` (or the upstream default branch if renamed), not from a messy local branch.

### Operational workflow

1. Local operation and deploy notes belong on this fork and should be reflected on `origin/master` in small, readable commits.
   - Keep local CT-specific docs, service files, and bootstrap fixes here.
   - Keep runtime state in `deploy/` and `instances/`, not in tracked source files.
2. Upstreamable work belongs on a fresh branch from `upstream/master`.
   - Use a focused `fix/...`, `feat/...`, or `docs/...` branch.
   - Keep fork-local deploy/ops changes out of the upstream PR unless they are generally useful.
3. The same checkout may be used for deployment, but not as a moving target.
   - Deploy from a stable branch state, preferably `master` or a release branch pinned for ops.
   - Do not make and ship code changes from the same uncommitted tree at the same time.
   - When switching between deploy and development states, stop/restart the managed service cleanly.

---

## 6. Standard Branch Workflow

### A. Sync before starting work

```bash
cd /root/paperclip
git fetch origin --prune
git fetch upstream --prune
git checkout master
git rebase upstream/master || git merge --ff-only upstream/master
```

If the fork uses a different default branch than `master`, inspect `upstream/HEAD` and adapt.

### B. Create a focused branch

```bash
git checkout -b fix/<short-topic>
# or
git checkout -b feat/<short-topic>
# or
git checkout -b docs/<short-topic>
```

### C. Implement and verify

Run the smallest relevant verification first, then the full handoff checks before claiming completion.

### D. Keep commits clean

- One logical change per branch.
- Avoid mixing refactors with behavior changes.
- Avoid bundling local CT/systemd/nginx tweaks with upstream PR code.

### E. Push to fork

```bash
git push -u origin <branch-name>
```

### F. Upstream PR target

- Target upstream Paperclip, not only the fork, when the change is generic and maintainable.
- Use the repo PR template exactly.
- This AGENTS.md and other local ops docs stay origin-only unless the user explicitly asks to sync them upstream.

---

## 7. Development Commands

Assume Node.js + pnpm environment is already available in the CT.

### Install

```bash
cd /root/paperclip
pnpm install
```

### Main development loop

```bash
pnpm dev
pnpm dev:once
pnpm dev:server
```

### Build and verification

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

### DB workflow

```bash
pnpm db:generate
pnpm db:migrate
```

### Health checks

```bash
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

### Local dev DB reset

```bash
rm -rf data/pglite
pnpm dev
```

---

## 8. Dev Deploy Policy in This CT

There are two approved local run modes.

### Interactive hacking mode

Use when actively editing code:

```bash
cd /root/paperclip
pnpm dev
```

### Stable smoke mode

Use when you want a persistent local instance without watch churn:

```bash
cd /root/paperclip
pnpm dev:once
```

Rules:
- Prefer loopback binding only.
- Do not expose Paperclip publicly from this CT unless the user explicitly asks.
- Do not treat this dev CT as production.
- Keep root-compatible embedded PostgreSQL and worktree flows working in the local CT.
- Avoid introducing hard dependencies on a host `psql` binary for required local flows when a repository-native fallback exists.

---

## 9. Recommended Plugin Strategy for This Workspace

Current recommendation for this CT:

### Default plugin set

1. **ACP runtime plugin**
   - Purpose: run Codex CLI / OpenCode / Gemini CLI / Claude Code as subprocess-backed coding sessions.
   - This is the primary plugin for this workspace.

2. **GitHub Issues Sync plugin**
   - Install only when issue sync is actually needed.
   - Good fit when Paperclip work should mirror GitHub issues.

### Deferred for another session

- Hindsight memory integration
- Slack / Discord / Telegram chat plugins
- Obsidian or other document-centric plugins

Reasoning:
- This CT is mainly a coding/dev orchestration environment.
- ACP is the highest-value integration for Codex/OpenCode.
- Keep memory/inbox/chat expansion out of scope unless explicitly requested.

---

## 10. ACP Plugin Expectations

When ACP is installed/configured, use these local assumptions:

- enabled agents: `codex,opencode`
- default agent: `codex`
- default mode: `persistent`
- default cwd: `/root/paperclip`
- max sessions per thread: conservative in local dev

Recommended local ACP baseline:

```text
enabledAgents=codex,opencode
defaultAgent=codex
defaultMode=persistent
defaultCwd=/root/paperclip
sessionIdleTimeoutMs=1800000
sessionMaxAgeMs=28800000
maxSessionsPerThread=2
```

Notes:
- The upstream ACP README defaults `defaultCwd` to `/workspace`; in this CT we intentionally override it to `/root/paperclip`.
- Keep concurrency conservative to reduce repo contamination and context confusion.
- If parallel agent work is necessary, prefer separate branches or separate sibling workspaces.

---

## 11. Workspace Safety Rules

Because this is a live fork workspace:

1. Never delete or reset unrelated user work.
2. Never force-push without explicit instruction.
3. Never rewrite `main`/`master` history unless explicitly requested.
4. Never commit secrets, tokens, `.env`, auth cookies, or local machine identifiers.
5. Do not bake `/root/...`-specific paths into upstreamable code unless they are local examples or config.
6. Keep local deployment/service files isolated from upstream PRs.
7. Keep root-only container support working for local embedded PostgreSQL and worktree bootstrap paths.

### Parallel work caution

- Avoid multiple agents editing the same checked-out tree simultaneously.
- If separate efforts run in parallel, use one of:
  - separate git branches
  - separate sibling worktrees/workspaces
  - separate issue-focused sessions

---

## 12. Core Engineering Rules

1. Keep changes company-scoped.
2. Keep contracts synchronized across db/shared/server/ui.
3. Preserve governance and control-plane invariants.
4. Prefer additive changes over wholesale strategic rewrites.
5. Use plugins for extension-shaped features when that is the better architectural fit.

Do not turn Paperclip core into:
- a general chat app
- a pull-request review tool
- a random local-lab fork with hidden behavior

---

## 13. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure exports are updated in `packages/db/src/schema/index.ts`
3. Generate migration:

```bash
pnpm db:generate
```

4. Validate compile:

```bash
pnpm -r typecheck
```

If a local flow uses embedded PostgreSQL, keep it root-safe and avoid hidden non-root assumptions.

---

## 14. Verification Before Hand-off

### Minimum verification

Run what matches the change:

```bash
pnpm test
```

### Full handoff check

Before saying work is complete, run:

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```

If UI/browser-specific behavior was touched, also consider:

```bash
pnpm test:e2e
```

If any step cannot be run, explicitly report:
- what was not run
- why it was not run
- what risk remains

---

## 15. Planning Docs

When creating a plan file in this repository:

- place it under `doc/plans/`
- use `YYYY-MM-DD-slug.md`
- do not scatter ad-hoc planning markdown across the repo

---

## 16. Pull Request Rules

When preparing a PR:

1. Read `.github/PULL_REQUEST_TEMPLATE.md`
2. Fill every section
3. Do not invent an ad-hoc PR body
4. Include a **Model Used** section
5. Keep PRs focused and reviewable

PR sections must include:
- Thinking Path
- What Changed
- Verification
- Risks
- Model Used
- Checklist

### Upstream contribution preference

Prefer upstream PRs for:
- bug fixes
- docs improvements
- small targeted improvements
- plugin-oriented extensions

Be careful with uncoordinated large core features. If the feature is more like an extension, prefer plugin route first.

---

## 17. What Codex Should Do By Default

When asked to work in `/root/paperclip`, Codex should generally:

1. Inspect current branch and remotes first.
2. Check for uncommitted local changes before editing.
3. Create a focused feature/fix/docs branch unless the user explicitly asks to work in-place.
4. Make the smallest change that solves the task.
5. Run relevant verification.
6. Summarize exactly what changed, what was verified, and what remains risky.
7. Prefer upstream-safe architecture over one-off local hacks.

### Default preflight commands

```bash
cd /root/paperclip
git status --short --branch
git remote -v
node -v
pnpm -v
```

---

## 18. What Codex Must Avoid

- Do not silently upgrade broad dependencies unless required.
- Do not add large new framework layers without need.
- Do not convert plugin-worthy work into hardcoded core logic too quickly.
- Do not expose the CT to LAN/public internet by default.
- Do not claim a PR is ready without verification.
- Do not create PRs with missing template sections.
- Do not propose this AGENTS.md upstream unless the user explicitly asks.

---

## 19. Suggested First Tasks for This Workspace

If the user asks for initial setup work, the preferred order is:

1. verify remotes and branch hygiene
2. install dependencies
3. confirm `pnpm dev` boots locally
4. install/configure ACP plugin for Codex/OpenCode path usage
5. set ACP default cwd to `/root/paperclip`
6. smoke test one Codex session and one OpenCode session
7. only then add optional plugins such as GitHub Issues sync

---

## 20. Local Notes for This User's Homelab

- This is a development CT, not the canonical long-term memory service.
- Keep the setup simple and reversible.
- Prefer source checkout + fork workflow over opaque one-click installs.
- Prefer changes that can graduate into upstream PRs.
- Keep operational root-only container assumptions explicit when they matter for local DB bootstrap or worktree flows.
