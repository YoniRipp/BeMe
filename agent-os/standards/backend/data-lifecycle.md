# Data Lifecycle (Growth, Compaction, Bounded Reads)

Per-user data grows forever unless something stops it, and the AI paths are the
biggest consumers of that growth. Two rules and one subsystem.

## Bounded reads

**Never read a user's whole history in a request path.** Model `findByUserId`
functions take an optional `PaginationParams` — pass it. Filter by date in SQL
rather than loading rows and filtering in JS.

```ts
// Wrong — pulls every workout the user has ever logged, on every chat turn
const result = await workoutService.list(userId);
return result.data.slice(0, 20);

// Right — the limit reaches SQL
const result = await workoutService.list(userId, { limit: 20, offset: 0 });
return result.data;

// Right — a single date is a targeted query, not a filter over history
return workoutService.listByDate(userId, date);
```

This matters most in `services/chatAgent.ts` and `services/chat.ts`, which run on
every AI turn.

## New per-user tables

- `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- A `created_at` or `date` column, so age-based compaction can find old rows
- An index on `(user_id, created_at)` or `(user_id, date DESC)`
- Added to **both** bootstrap paths: `src/db/schema.ts` and a `migrations/` file
- A decision about compaction: does this table need one, or is it naturally small?

Unbounded per-user growth is a defect, not a future problem.

## Compaction

`src/services/compaction.ts` bounds the AI layer. It exists because
`user_embeddings` stores a `vector(768)` per food entry and workout — ~3KB for the
vector plus `content_text`, plus a comparable HNSW index entry, so roughly 7–8KB
per logged item, or ~15MB/year for an active user.

**Compacted:**

| Table | What happens |
|---|---|
| `user_embeddings` | Per-record vectors older than the cutoff collapse into one rollup vector per record type per month (`record_type` gains a `_rollup` suffix) |
| `chat_messages` | Old turns are summarized into the user's single `chat_summaries` row, which `buildChatSystemPrompt` reads back |
| `user_activity_log` | Pruned — `user_daily_stats` already holds the aggregate. Missing days are backfilled first, and a 180-day floor keeps the admin feed usable |
| `ai_insights` | Only the newest row per `period_days` is live cache |

**Never compacted:** `food_entries`, `workouts`, `weight_entries`, `water_entries`,
`energy_checkins`, `daily_check_ins`, `cycle_entries`. Raw user data is not ours to
delete — nothing visible in the app may disappear.

**Triggers:** age first (`COMPACTION_AGE_MONTHS`, default 3). If a user is still
over `COMPACTION_MAX_BYTES_PER_USER` (default 10MB), the cutoff tightens through
60 → 30 → 14 days until they fit.

**Running it:** `npm run compact` (one-shot, for any external scheduler), a daily
BullMQ job when Redis is configured, or `POST /api/admin/compaction/run`. Inspect
footprints with `GET /api/admin/compaction/stats`.

**Adding a table to compaction:** add a measurement query to
`measureUserStorage`, a compaction function beside the existing ones, and a call
in `compactUser`. Summarize before deleting, and if summarization fails, keep the
raw rows — losing data silently is worse than staying over budget.
