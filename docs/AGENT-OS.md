# Agent OS

[Agent OS](https://buildermethods.com/agent-os) v3 is how this repo gives AI coding agents its real conventions. Instead of one large always-loaded context file, standards live as small markdown files that get injected only when relevant.

## What's in the repo

```
agent-os/
├── standards/          # How we build things — injected on demand
│   ├── index.yml       # What exists, one line each (agents read this first)
│   ├── backend/        # api-layers, response-format, errors, models, events, routes
│   ├── frontend/       # data-fetching, api-client, components, design-tokens, mobile-ui
│   └── global/         # tech-stack, domain-conventions, testing, critical-rules
├── product/            # mission.md, roadmap.md, tech-stack.md
└── specs/              # One folder per significant feature
    └── YYYY-MM-DD-HHMM-{slug}/
        ├── plan.md         # The implementation plan
        ├── shape.md        # Scope and decisions, and why
        ├── standards.md    # Which standards apply
        └── references.md   # Similar code worth studying

.claude/commands/agent-os/   # The 5 slash commands (committed)
```

`agent-os/` and the commands are committed. Nothing here is generated at runtime — a fresh clone has everything.

## First-time setup

The commands are already in the repo, so **you can use `/agent-os:inject-standards` and `/agent-os:shape-spec` with no setup at all.**

You only need the base installation to *re-run the installer* (to pull upstream command updates):

```bash
git clone https://github.com/buildermethods/agent-os.git ~/.agent-os
```

Then, from the repo root:

```bash
# Update commands only — never touches our standards
bash ~/.agent-os/scripts/project-install.sh --commands-only
```

> Run it **with `--commands-only`**. A bare `project-install.sh` offers to overwrite `agent-os/standards/` with the empty default profile. It prompts first, but there is no reason to say yes.

## Daily use

| Command | When |
|---|---|
| `/agent-os:inject-standards` | Before implementing. Pulls the relevant standards into context. |
| `/agent-os:shape-spec` | Starting significant work. **Must be run in plan mode.** Writes a spec folder. |
| `/agent-os:discover-standards` | You spot a convention in the code that isn't written down. |
| `/agent-os:index-standards` | After hand-adding a standards file, to rebuild `index.yml`. |
| `/agent-os:plan-product` | Mission, roadmap, or stack changed. |

Typical feature flow:

1. Enter plan mode → `/agent-os:shape-spec` → answer the shaping questions
2. Approve the plan; Task 1 saves the spec to `agent-os/specs/`
3. Implement, with the standards already in context

Quick fix flow: `/agent-os:inject-standards frontend/mobile-ui` → make the change.

## Adding a standard

Standards are read by agents on every relevant task, so **length is a cost**. Lead with the rule, show code, skip anything the code already makes obvious.

1. Write `agent-os/standards/<folder>/<name>.md` — folders are `backend/`, `frontend/`, `global/`
2. Add it to `index.yml` — the description is what agents match against, so make it specific
3. Add a row to the table in `CLAUDE.md`
4. `npm run sync:agents`

`/agent-os:discover-standards` handles steps 1 and 2 and asks about the *why* behind the pattern, which is worth using. **It does not do steps 3 and 4** — do those yourself, or the standard never appears in the always-loaded `CLAUDE.md` table and agents won't know it exists.

### The commands are upstream, their examples are generic

The five files in `.claude/commands/agent-os/` are vendored from upstream unmodified, so `--commands-only` can update them cleanly. That means their worked examples describe a generic project, not this one:

- They suggest folders we don't use (`api/`, `database/`, `javascript/`, `css/`). **Use `backend/`, `frontend/`, `global/`** — a new `api/response-format.md` would sit alongside the existing `backend/response-format.md` and break the `CLAUDE.md` paths.
- They reference standards that don't exist here (`api/error-handling`, `database/migrations`, `global/naming`). `agent-os/standards/index.yml` is the real list.
- `/agent-os:inject-standards` has a "Creating a Skill" branch keyed on `.claude/skills/`, which this repo doesn't have. Our equivalent is `.claude/commands/`.

Treat the command files as procedure, and this repo's `index.yml` as truth.

## CLAUDE.md and AGENTS.md

`CLAUDE.md` is the source of truth. Everything between `<!-- AGENT-CONTEXT:START -->` and `<!-- AGENT-CONTEXT:END -->` is shared with every other agent.

```bash
npm run sync:agents            # regenerate AGENTS.md
npm run sync:agents -- --check # verify (CI runs this)
```

**Never edit `AGENTS.md` directly** — it is generated, and CI fails if it drifts. Edit `CLAUDE.md` and re-run the sync.

## Upstream

Agent OS v3 deliberately dropped its orchestration and implementation phases; modern models handle those without scripting. What remains is standards + spec shaping, deferring to native plan mode.

Following that, the `team-lead` agent profile was retired — it scripted a plan → delegate-to-coder → delegate-to-tester loop that plan mode now covers. The remaining profiles (`coder`, `tester`, `reviewer`, `devops`, `product-manager`) are focused single-purpose agents, not orchestrators. Start work with `/agent-os:shape-spec` in plan mode.
