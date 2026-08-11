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

The commands are already in the repo, so **you can use `/inject-standards` and `/shape-spec` with no setup at all.**

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
| `/inject-standards` | Before implementing. Pulls the relevant standards into context. |
| `/shape-spec` | Starting significant work. **Must be run in plan mode.** Writes a spec folder. |
| `/discover-standards` | You spot a convention in the code that isn't written down. |
| `/index-standards` | After hand-adding a standards file, to rebuild `index.yml`. |
| `/plan-product` | Mission, roadmap, or stack changed. |

Typical feature flow:

1. Enter plan mode → `/shape-spec` → answer the shaping questions
2. Approve the plan; Task 1 saves the spec to `agent-os/specs/`
3. Implement, with the standards already in context

Quick fix flow: `/inject-standards frontend/mobile-ui` → make the change.

## Adding a standard

Standards are read by agents on every relevant task, so **length is a cost**. Lead with the rule, show code, skip anything the code already makes obvious.

1. Write `agent-os/standards/<folder>/<name>.md`
2. Add it to `index.yml` — the description is what agents match against, so make it specific
3. Add a row to the table in `CLAUDE.md`
4. `npm run sync:agents`

Prefer `/discover-standards`, which does all four and asks about the *why* behind the pattern.

## CLAUDE.md and AGENTS.md

`CLAUDE.md` is the source of truth. Everything between `<!-- AGENT-CONTEXT:START -->` and `<!-- AGENT-CONTEXT:END -->` is shared with every other agent.

```bash
npm run sync:agents            # regenerate AGENTS.md
npm run sync:agents -- --check # verify (CI runs this)
```

**Never edit `AGENTS.md` directly** — it is generated, and CI fails if it drifts. Edit `CLAUDE.md` and re-run the sync.

## Upstream

Agent OS v3 deliberately dropped its orchestration and implementation phases; modern models handle those without scripting. What remains is standards + spec shaping, deferring to native plan mode. That's why `/shape-spec` is preferred over the `team-lead` agent profile for new work.
