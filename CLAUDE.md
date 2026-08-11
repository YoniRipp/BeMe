# Claude Project Context

## What this is

TrackVibe / BeMe — a voice-AI-first mobile fitness and nutrition tracker. Users log food
and workouts by speaking, and an AI coach with full access to their data answers questions
and takes actions on their behalf.

This is a working production application, not a prototype. It has paying users, an admin
console, a trainer portal, and a billing integration. Changes should preserve stability.

## Repository layout

| Path | What it is |
|---|---|
| `backend/` | Express + TypeScript API, PostgreSQL (+pgvector), optional Redis |
| `frontend/` | React 18 + Vite SPA — **the client**. Also ships as a PWA and as a native shell via Capacitor (iOS + Android). |
| `mobile/` | Expo / React Native client. **Dormant — not in use.** Untouched since May 2026; the mobile experience is delivered by `frontend/` through Capacitor. Don't spend effort here unless asked. |
| `backend/mcp-server/` | MCP server exposing the app's domain to AI agents |
| `langchain-prototype/` | Exploratory ops-agent prototype, not part of the deployed app |
| `docs/` | Architecture notes — see `architecture-principles.md`, `bounded-contexts.md` |
| `design-mockups/`, `TrackVibe/` | Static design explorations |

`AGENTS.md` points here — this file is the single source of truth for agent instructions.

---

# Critical Development Rules

1. Never break existing functionality, and never remove working features.
2. Prefer additive change. Existing API shapes are consumed by the web client and the MCP
   server — changing one means updating both. (The Expo app under `mobile/` is dormant and
   is not a consumer to keep in sync.)
3. Any new per-user table must have `user_id ... ON DELETE CASCADE` and be considered for
   the compaction policy below. Unbounded per-user growth is a defect.
4. Never read a user's full history in a request path. Pass `{ limit, offset }` or filter
   by date in SQL.
5. Run `npx tsc --noEmit` in both `backend/` and `frontend/` before finishing.

---

# Domains

The app is larger than its UI suggests. These all exist and are wired end to end:

| Domain | Backend | Frontend |
|---|---|---|
| Food & nutrition | `routes/foodEntry.ts`, `routes/foodSearch.ts`, `routes/barcode` | `pages/Energy.tsx` |
| Workouts & exercises | `routes/workout.ts`, `routes/exercises.ts` | `pages/Body.tsx` |
| Goals | `routes/goal.ts` | `pages/Goals.tsx` |
| AI insights | `routes/insights.ts`, `services/insights.ts` | `pages/Insights.tsx` |
| AI chat agent | `routes/chat.ts`, `services/chat.ts`, `services/chatAgent.ts` | `components/chat/` |
| Voice pipeline | `routes/voice.ts`, `ws/voiceStreaming.ts`, `workers/voice.ts` | `components/voice/` |
| Semantic search | `routes/search.ts`, `services/embeddings.ts` (pgvector) | `components/insights/` |
| Health tracking | `routes/weight.ts`, `water.ts`, `cycle.ts`, `dailyCheckIn.ts`, `streak.ts` | `pages/Water.tsx`, `components/energy/` |
| Trainer portal | `routes/trainer.ts` | `pages/Trainer.tsx`, `TrainerClientView.tsx` |
| Admin console | `routes/admin.ts`, `routes/users.ts` | `pages/Admin.tsx`, `pages/admin/` |
| Subscriptions | `routes/subscription.ts` (LemonSqueezy) | `components/subscription/` |
| Push & WhatsApp | `routes/push.ts`, `routes/whatsapp.ts` | `components/pwa/` |

---

# Backend architecture

Express + TypeScript. See `backend/CLAUDE.md` for commands and conventions.

- **Data access**: raw SQL via `pg` Pool (`src/db/pool.ts`). Prisma is used for schema
  management only. Two bootstrap paths exist and must stay in sync: `src/db/schema.ts`
  (`CREATE TABLE IF NOT EXISTS` on startup) and `migrations/` (node-pg-migrate).
- **Events**: domain event bus (`src/events/`) with memory/Redis/SQS transports.
  `user_daily_stats` is a CQRS read model maintained by `events/consumers/statsAggregator.ts`.
- **Background work**: BullMQ (Redis) or SQS. Workers in `backend/workers/` and
  `src/workers/`.
- **AI**: Google Gemini throughout — chat, insights, voice parsing, and `text-embedding-004`
  for embeddings.

## Data compaction

Per-user AI data is compacted on a schedule (`src/services/compaction.ts`). This exists
because `user_embeddings` writes a `vector(768)` per food entry and workout — roughly 7–8KB
per logged item once the HNSW index is counted, or ~15MB/year for an active user.

- **Triggers**: anything older than `COMPACTION_AGE_MONTHS` (default 3); then, if a user
  still exceeds `COMPACTION_MAX_BYTES_PER_USER` (default 10MB), the cutoff tightens
  (90 → 60 → 30 → 14 days) until they fit.
- **What is compacted**: `user_embeddings` (per-record vectors collapse into one rollup
  vector per record type per month), `chat_messages` (old turns become a rolling
  `chat_summaries` row), `user_activity_log` (pruned — `user_daily_stats` already holds the
  aggregate), `ai_insights` (only the newest row per `period_days` is live cache).
- **What is never compacted**: raw user data — `food_entries`, `workouts`, `weight_entries`,
  `water_entries`, `energy_checkins`, `daily_check_ins`, `cycle_entries`. Nothing the user
  can see in the app is ever deleted by compaction.
- **Running it**: `npm run compact` (one-shot, for any external scheduler), a daily BullMQ
  job when Redis is configured, or `POST /api/admin/compaction/run`. Inspect footprints via
  `GET /api/admin/compaction/stats`.

---

# Frontend architecture

React 18 + Vite + TypeScript + React Query + Tailwind + shadcn/ui.
See `frontend/CLAUDE.md` for commands and conventions.

Bottom navigation is defined in `components/layout/Base44Layout.tsx` and rendered by
`components/layout/BottomNavigation.tsx`. The tab set varies by role — the default is
Home · Workouts · Journal · Goals · Insights · Settings, with a center mic button for the
voice agent. Routes live in `src/routes.tsx`.

---

# Voice-AI First Design

Voice is the **primary** input method for food logging; manual entry (search, barcode,
form) is secondary.

1. User taps a mic button inside a meal section (Breakfast, Lunch, Dinner, Snack)
2. A bottom sheet opens with a large mic button
3. User speaks naturally ("2 eggs and toast with butter")
4. The app parses the text, resolves nutrition via search/AI, and shows a review
5. User confirms — entries land in the correct meal section

The global Voice Agent FAB is available on all pages except Home.

## Meal types

Food entries carry an explicit `mealType` (`breakfast` | `lunch` | `dinner` | `snack`),
stored in `food_entries.meal_type`. The FoodEntryModal shows a pill selector; voice entries
inherit the meal section they were spoken into. Entries without `mealType` fall back to
time-based inference.

---

# Design system

The app should feel like a native consumer fitness app — MyFitnessPal, Strong, Apple
Fitness, Nike Training Club. Modern, simple, fast, mobile-first. Avoid generic
AI-generated layouts and desktop-style dashboards.

**Mobile-first principles**: vertical scrolling, clear sections, large touch targets
(44px minimum), comfortable spacing, readable typography, minimal clutter.

**Layout**: card-based. Food items, workouts, and exercises each live in a card with
rounded corners, soft shadows, clear spacing, and a readable text hierarchy.

**Spacing scale**: 4 · 8 · 12 · 16 · 24 · 32 px. Never crowd elements; always keep padding
from screen edges.

**Typography levels**: Primary Title → Section Title → Item Title → Body → Secondary.
Food and workout names are visually prominent; calories and sets/reps are secondary but
readable.

**Food cards** show image, name, portion, and calories — calories emphasized, name largest.
**Workout cards** show name plus its exercises with sets and reps, clearly separated.

**Images**: square, rounded, consistently sized, optimized for mobile. When an image is
missing, render `components/shared/ImagePlaceholder.tsx` — there are no placeholder PNG
assets, the placeholder is a component. Food and exercise imagery is resolved through
`hooks/useFoodImages.ts` and `hooks/useExerciseImages.ts`.

**When changing UI**, also fix what's nearby: broken alignment, text overflow, inconsistent
spacing, elements touching screen edges, touch targets under 44px, poor responsiveness.

**Before large UI changes**: analyze the current layout, identify the UX problem, propose
the improvement, then implement it. Deliberate changes, not random ones.

---

# Code style

Small, focused, reusable components; clear separation; no monolithic UI files. Avoid
unnecessary re-renders, heavy layouts, and excessive DOM nesting.

---

# Claude tooling

## MCP server

`backend/mcp-server/` exposes the app's domain over MCP. Config: `.mcp.json` (root),
`.cursor/mcp.json` (Cursor).

**45 tools** across 12 modules in `backend/mcp-server/tools/`:

- *goals* — `list_goals`, `add_goal`, `update_goal`, `delete_goal`
- *workouts* — `list_workouts`, `add_workout`, `update_workout`, `delete_workout`
- *food-entries* — `list_food_entries`, `add_food_entry`, `add_food_entries_batch`,
  `update_food_entry`, `delete_food_entry`, `duplicate_food_day`
- *food-search* — `search_foods`, `lookup_food_barcode`
- *exercises* — `search_exercises`, `get_exercise`
- *weight* — `list_weight_entries`, `add_weight_entry`, `delete_weight_entry`
- *water* — `get_water_today`, `get_water_history`, `add_water_glass`, `remove_water_glass`
- *checkins* — `list_daily_checkins`, `add_daily_checkin`, `update_daily_checkin`
- *profile* — `get_profile`, `update_profile`
- *streaks* — `get_streaks`
- *ops* — `ops_business_overview`, `ops_activity`, `ops_action_logs`, `ops_error_logs`,
  `ops_runtime_metrics`, `ops_search_users`
- *test-mode* — `seed_test_data`, `reset_test_data`, `run_tests`, `run_typecheck`,
  `get_admin_stats`, `get_app_logs`, `get_metrics`, `call_raw`

**4 resources**: `trackvibe://goals`, `trackvibe://profile`, `trackvibe://water-today`,
`trackvibe://streaks`.

## Agent profiles (`.claude/agents/`)

`coder`, `devops`, `reviewer`, `team-lead`, `tester`, `product-manager`.

## Slash commands (`.claude/commands/`)

`/add-feature`, `/fix-tests`, `/test-e2e`, `/typecheck`, `/test-all`.

## Settings (`.claude/settings.json`)

A `PostToolUse` hook runs a backend typecheck after Write/Edit. Permissions allow the usual
dev/build/test commands and deny `.env` reads, `curl`, and force-push.
