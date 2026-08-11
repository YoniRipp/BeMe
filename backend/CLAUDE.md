# Backend

Express + TypeScript API server with PostgreSQL (+pgvector) and optional Redis.

## Commands
- Dev server: `npm run dev` (uses tsx watch)
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build` (tsup)
- Tests: `npm test` (vitest, `src/**/*.test.ts`)
- DB migrate: `npm run migrate:up` — new migration: `npm run migrate:create <name>`
- Data compaction sweep: `npm run compact`

## Layout
- `index.ts` — server entry: HTTP, WebSocket voice streaming, inline workers, shutdown
- `app.ts` — Express app setup, middleware, rate limiting
- `cluster.ts` — multi-process launcher (`npm run start:cluster`)
- `body-service.ts`, `energy-service.ts`, `goals-service.ts` — optional standalone
  bounded-context services; the monolith skips those routers when their `*_SERVICE_URL`
  is set (see `src/routes/index.ts`)
- `workers/` — standalone worker processes (`event-consumer`, `voice-worker`,
  `compaction-worker`)
- `lambdas/` — AWS Lambda handlers for the SQS/API-Gateway deployment
- `migrations/` — node-pg-migrate files; `prisma/` — schema only
- `mcp-server/` — MCP server (45 tools, 4 resources)

## src/
- `controllers/` — route handlers (thin, delegate to services)
- `services/` — business logic
- `models/` — DB access (raw SQL via pg Pool)
- `routes/` — route definitions, mounted in `routes/index.ts`
- `schemas/` — Zod request schemas
- `events/` — domain event bus (memory / Redis / SQS) and consumers
- `queue/` — BullMQ + SQS job enqueueing
- `workers/` — inline workers started by `index.ts`
- `ws/` — WebSocket voice streaming
- `middleware/` — auth, error handling, validation, idempotency
- `lib/`, `utils/`, `config/`, `db/`, `redis/`, `types/`, `data/`

## Patterns
- All route handlers use the `asyncHandler` wrapper
- Responses via `sendJson(res, data)` / `sendError(res, status, message)`
- Validation via Zod schemas or helpers in `utils/validation.ts`
  (`normOneOf`, `normTime`, `normCat`, `parseDate`, `validateNonNegative`)
- `config` (`src/config/index.ts`) validates env with Zod **at import time** and throws
  without `PORT`. Tests whose import graph reaches it must `vi.mock('../config/index.js')`.
- Embeddings via Google Generative AI (`text-embedding-004`, 768 dims)

## DB
- PostgreSQL via `pg` Pool (`src/db/pool.ts`); Prisma for schema management only
- **Two bootstrap paths must stay in sync**: `src/db/schema.ts` runs
  `CREATE TABLE IF NOT EXISTS` on startup, and `migrations/` holds the ordered history.
  Adding a table means updating both.
- pgvector is optional — `schema.ts` wraps `user_embeddings` in a try/catch, so code
  touching that table must tolerate error codes `42P01` / `42703`.
- Redis optional: rate limiting, BullMQ queues, key-value store

## Data compaction
`services/compaction.ts` bounds per-user AI data: `user_embeddings` per-record vectors roll
up into one vector per record type per month, old `chat_messages` become a `chat_summaries`
row, `user_activity_log` is pruned behind `user_daily_stats`, and stale `ai_insights` rows
are dropped. Triggered by age (`COMPACTION_AGE_MONTHS`, default 3) and by size
(`COMPACTION_MAX_BYTES_PER_USER`, default 10MB, which tightens the cutoff further).

**Raw user data is never compacted** — `food_entries`, `workouts`, `weight_entries`,
`water_entries`, `energy_checkins`, `daily_check_ins`, and `cycle_entries` are untouched.

Run it via `npm run compact`, the daily BullMQ job (Redis only), or
`POST /api/admin/compaction/run`.
