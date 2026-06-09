# TrackVibe Backend

Node.js + Express + TypeScript REST API for the TrackVibe wellness application. Handles authentication, domain CRUD (workouts, food entries, check-ins, goals), intelligent food search, voice intent parsing (Google Gemini), vector embeddings, file uploads (S3), and an event-driven architecture with optional Redis and extracted microservices.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [LLM / Gemini Integration](#llm--gemini-integration)
  - [Voice Intent Parsing](#1-voice-intent-parsing)
  - [Food Nutrition Lookup](#2-food-nutrition-lookup)
- [Food Lookup Pipeline](#food-lookup-pipeline)
- [Food Search Algorithm](#food-search-algorithm)
- [Vector Embeddings & Semantic Search](#vector-embeddings--semantic-search)
- [Redis Architecture](#redis-architecture)
- [Database Schema](#database-schema)
- [Image & Video Handling](#image--video-handling)
- [Voice Pipeline](#voice-pipeline)
- [Guardrails & Validation](#guardrails--validation)
- [Event Bus](#event-bus)
- [API Reference](#api-reference)
- [Auth Middleware](#auth-middleware)
- [Meal Copying & Repetition](#meal-copying--repetition)
- [Future: Meal Plan Feature](#future-meal-plan-feature)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Overview

The backend serves:

- **Auth**: Register, login (email/password + social: Google, Facebook, Twitter), JWT sessions
- **Domain APIs**: CRUD for workouts, food entries, daily check-ins, goals, weight, water, cycle tracking
- **Food search**: Public search against the `foods` table with multi-tier matching (word-split, trigram, FTS, aliases)
- **Voice**: Natural language understanding via Gemini function calling -- parse text/audio into structured actions
- **Food lookup**: 2-tier pipeline (database -> Gemini AI) that resolves food names to nutrition data
- **Embeddings**: Semantic search across user content using 768-dim vectors
- **File uploads**: S3 pre-signed URLs for images and videos
- **Event bus**: Publish domain events after every write (Redis BullMQ or SQS)

The backend is **event-ready** and supports three deployment modes: single process, API + event consumer, or gateway + extracted services. See the [root README](../README.md) for architecture diagrams.

---

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Node.js 20 (ES modules) | Server runtime |
| Framework | Express | HTTP routing, middleware |
| Language | TypeScript | Type safety, compiled with tsup |
| Database | PostgreSQL (pg) | Primary data store |
| Extensions | pgvector, pg_trgm | Vector similarity search, fuzzy text matching |
| Migrations | node-pg-migrate | Versioned schema migrations |
| Schema | Prisma | Schema definition and management |
| Auth | jsonwebtoken, bcrypt | JWT signing, password hashing |
| OAuth | google-auth-library | Google social login |
| LLM | @google/generative-ai | Gemini for voice + food lookup |
| Validation | Zod | Config, request body, LLM response validation |
| Logging | Pino | Structured JSON logging |
| Security | Helmet | HTTP security headers |
| Rate Limiting | express-rate-limit, rate-limit-redis | Per-IP request throttling |
| Cache/Queue | Redis, BullMQ | Food search cache, voice queue, event bus |
| File Storage | @aws-sdk/client-s3 | Pre-signed URLs for uploads |
| Gateway | http-proxy-middleware | Proxy to extracted services |
| Event Bus | BullMQ, @aws-sdk/client-sqs | Domain event transport |

### Conventions
- **TypeScript-only**: All new backend source files must be `.ts`; no new `.js` source files
- **Nutrition values**: Stored per 100g/100ml in the `foods` reference table
- **Dates**: Local calendar `YYYY-MM-DD`

---

## Project Structure

```
backend/
├── app.ts                    # Express app: CORS, Helmet, rate limit, gateway proxy, routes, error handler
├── index.ts                  # Entry: load config, init DB, start HTTP server, optional voice worker
├── body-service.ts           # Optional standalone Body (workouts) API
├── energy-service.ts         # Optional standalone Energy (food, check-ins) API
├── goals-service.ts          # Optional standalone Goals API
├── workers/
│   └── event-consumer.js     # Standalone event consumer (no HTTP; requires Redis/SQS)
├── src/
│   ├── config/
│   │   ├── index.ts          # Env loading + Zod validation
│   │   └── constants.ts      # App constants
│   ├── db/
│   │   ├── index.ts          # initSchema, getPool, closePool
│   │   ├── pool.ts           # pg Pool; getPool(context) for per-context DB URLs
│   │   └── schema.ts         # CREATE TABLE statements for schema init
│   ├── redis/
│   │   └── client.ts         # getRedisClient, closeRedis, isRedisConfigured
│   ├── events/
│   │   ├── bus.ts            # Event bus: publish, subscribe (Redis BullMQ or SQS)
│   │   ├── schema.ts         # Zod event envelope schema
│   │   ├── publish.ts        # publishEvent helper
│   │   └── transports/
│   │       └── sqs.ts        # AWS SQS transport
│   ├── queue/
│   │   └── index.ts          # BullMQ voice queue setup
│   ├── middleware/
│   │   ├── auth.ts           # requireAuth, requireAdmin, resolveEffectiveUserId
│   │   ├── errorHandler.ts   # Global error handler (JSON responses)
│   │   ├── validateBody.ts   # Zod request body validation
│   │   └── idempotency.ts    # Idempotency key middleware
│   ├── routes/
│   │   ├── index.ts          # Mount all routes; skip context routes when *_SERVICE_URL set
│   │   ├── workout.ts        # GET/POST/PATCH/DELETE /api/workouts
│   │   ├── foodEntry.ts      # GET/POST/PATCH/DELETE /api/food-entries
│   │   ├── dailyCheckIn.ts   # GET/POST/PATCH/DELETE /api/daily-check-ins
│   │   ├── goal.ts           # GET/POST/PATCH/DELETE /api/goals
│   │   ├── foodSearch.ts     # GET /api/food/search (public, cached)
│   │   ├── voice.ts          # POST /api/voice/understand
│   │   └── uploads.ts        # POST /api/uploads/presigned-url
│   ├── controllers/
│   │   ├── foodSearch.ts     # Search handler with Redis caching
│   │   ├── voice.ts          # Voice understanding controller
│   │   ├── uploads.ts        # Pre-signed URL generation
│   │   ├── jobs.ts           # Voice job polling
│   │   └── ...               # Domain controllers (workouts, food entries, etc.)
│   ├── services/
│   │   ├── voice.ts          # Voice service: parseTranscript, parseAudio, VOICE_PROMPT
│   │   ├── voice/
│   │   │   ├── geminiClient.ts     # Gemini API client, processGeminiResponse
│   │   │   ├── actionBuilders.ts   # Map function calls to actions (HANDLERS registry)
│   │   │   └── foodLookupPipeline.ts # 2-tier food lookup: DB -> Gemini
│   │   ├── foodLookupGemini.ts     # Gemini-based food nutrition lookup + DB insert
│   │   ├── embeddings.ts          # Vector embedding generation + semantic search
│   │   ├── voiceExecutor.ts       # Execute voice actions server-side
│   │   ├── storage.ts             # S3 pre-signed URL generation
│   │   └── ...                    # Domain services
│   ├── models/
│   │   ├── foodSearch.ts     # Food search: multi-tier matching, getNutritionForFoodName
│   │   └── ...               # Domain models (workouts, food entries, etc.)
│   ├── workers/
│   │   └── voiceWorker.ts    # BullMQ worker: process audio jobs via Gemini
│   ├── lib/
│   │   ├── logger.ts         # Pino structured logger
│   │   ├── genai.ts          # Cached Google Generative AI client + model singletons
│   │   └── keyValueStore.ts  # Redis KV with in-memory LRU fallback
│   └── utils/
│       ├── response.ts       # sendJson, sendError, sendCreated, sendNoContent
│       ├── validation.ts     # normTime, parseDate, validateNonNegative
│       └── escapeLike.ts     # SQL LIKE character escaping
├── voice/
│   ├── tools.js              # 23 Gemini function declarations (VOICE_TOOLS)
│   └── agentTools.js         # Extended tools: read + copy operations (AGENT_TOOLS)
├── migrations/               # node-pg-migrate versioned migrations
├── prisma/
│   └── schema.prisma         # Prisma schema definition
├── mcp-server/               # MCP server for Claude integration
├── scripts/
│   ├── importFoundationFoods.js   # USDA Foundation Foods import
│   └── seedPopularFoods.js        # Seed ~100 popular foods
├── lambdas/                  # AWS Lambda handlers (event, voice)
├── template.yaml             # AWS SAM template
└── package.json
```

---

## LLM / Gemini Integration

TrackVibe uses Google Gemini (`@google/generative-ai`) in two distinct roles. Both are configured in `src/config/index.ts`:

```
Model: gemini-2.5-flash (configurable via GEMINI_MODEL env var)
Safety: All harm categories set to BLOCK_NONE
```

### 1. Voice Intent Parsing

**Files:** `src/services/voice.ts`, `src/services/voice/geminiClient.ts`, `voice/tools.js`

The voice system sends user text to Gemini along with **23 function declarations** (tools). Gemini returns structured function calls that map to CRUD operations.

**System prompt** (`src/services/voice.ts`):
```
The voice prompt instructs Gemini to:
- Extract exact food names (preserve brand names, percentages like "cheese 28%")
- Parse sleep hours (only from sleep-related phrases)
- Parse workouts with sets/reps/weight and program names
- Handle goals with periods (weekly/monthly/yearly)
- Route food-only phrases directly to add_food
- Support trainer operations for managing client data
```

**Function declarations** (`voice/tools.js`):
23 tools covering all domain operations:

| Category | Tools |
|----------|-------|
| Food | `add_food` (food, amount, unit, date, startTime, endTime), `edit_food_entry`, `delete_food_entry` |
| Workouts | `add_workout` (title, type, exercises[], date), `edit_workout`, `delete_workout` |
| Sleep | `log_sleep` (hours, date), `edit_check_in`, `delete_check_in` |
| Goals | `add_goal` (type, target, period), `edit_goal`, `delete_goal` |
| Health | `log_weight`, `log_water`, `log_cycle`, `update_profile` |
| Trainer | `trainer_add_food`, `trainer_add_workout`, `trainer_edit_food_entry`, `trainer_delete_food_entry`, `trainer_edit_workout`, `trainer_delete_workout` |

**Processing flow** (`src/services/voice/geminiClient.ts`):
1. `processGeminiResponse()` receives Gemini's response
2. Extracts function call parts from the response
3. Maps each function call name to a handler via the `HANDLERS` registry in `actionBuilders.ts`
4. Each handler builds a structured action (e.g., `{ type: "add_food", food: "egg", amount: 2, ... }`)
5. If `VOICE_EXECUTE_ON_SERVER=true`, `voiceExecutor.ts` executes actions immediately against the database

**Safety settings:**
All harm categories (`HATE_SPEECH`, `SEXUALLY_EXPLICIT`, `HARASSMENT`, `DANGEROUS_CONTENT`) are set to `BLOCK_NONE`. This is intentional -- food-related phrases like "bloody steak" or "killer brownie" could trigger content filters and block legitimate food logging.

**Fallback on Gemini failure:**
If Gemini blocks the response, throws an error, or returns no function calls, the backend returns a fallback `add_food` action with the raw transcript as the food name and zero nutrition values. This ensures the user can always log food and edit details later.

### 2. Food Nutrition Lookup

**File:** `src/services/foodLookupGemini.ts`

When a food is not found in the local database, Gemini acts as a nutrition data assistant.

**Prompt** (excerpt from `src/services/foodLookupGemini.ts:10-33`):
```
You are a nutrition data assistant. Given a food or drink name, return exactly
one JSON object with nutrition per 100g for solid foods or per 100ml for liquids.

Response shape:
{
  "name": "Official or common name in English",
  "calories": number (kcal per 100g or 100ml),
  "protein": number (g),
  "carbs": number (g),
  "fat": number (g),
  "is_liquid": boolean,
  "serving_sizes_ml": { "can": number, "bottle": number, "glass": number },
  "default_unit": string or null,
  "unit_weight_grams": number or null,
  "search_aliases": array of strings or null
}

Rules:
- For countable foods (eggs, slices) set default_unit and unit_weight_grams
- For branded foods, include search_aliases with common nicknames
- Include "cooked" or "uncooked" in name when relevant (default: cooked)
- For drinks: is_liquid=true, per-100ml values, include serving_sizes_ml
```

**Zod validation schema** (`GeminiFoodSchema`):
```typescript
{
  name: z.string().min(1).transform(s => s.trim()),
  calories: z.number().min(0).max(1000),    // Guard: max 1000 kcal/100g
  protein: z.number().min(0).max(100),       // Guard: max 100g/100g
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  is_liquid: z.boolean(),
  serving_sizes_ml: z.object({ can, bottle, glass }).nullable().optional(),
  default_unit: z.string().min(1).nullable().optional(),
  unit_weight_grams: z.number().min(1).max(5000).nullable().optional(),
  search_aliases: z.array(z.string().min(1)).nullable().optional()
}
```

**Response processing:**
1. Raw text from Gemini is stripped of markdown code fences
2. First JSON object is extracted via regex
3. Parsed and validated with `GeminiFoodSchema.safeParse()`
4. If validation fails, returns `null` (pipeline falls through to fallback)

---

## Food Lookup Pipeline

**File:** `src/services/voice/foodLookupPipeline.ts`

The central function `lookupNutrition(foodName, amount, unit)` resolves any food name to nutrition data using a 2-tier strategy:

```
Input: foodName="coke zero", amount=330, unit="ml"

┌──────────────────────────────────────────┐
│ Tier 1: Local Database                   │
│ getNutritionForFoodName(pool, name, ...) │
│                                          │
│ Strategies:                              │
│ - Word-boundary regex on common_name     │
│ - Word-boundary regex on name            │
│ - Trigram similarity > 0.6               │
│                                          │
│ Ranking:                                 │
│ 1. Exact name match                      │
│ 2. Prefix match                          │
│ 3. Similarity score                      │
│ 4. Cooking method (prefer cooked)        │
│ 5. Shorter name (more specific)          │
└──────────────────┬───────────────────────┘
                   │
           Found?  ├── Yes → Scale to portion → Return (source: "db")
                   │
                   No
                   │
┌──────────────────▼───────────────────────┐
│ Tier 2: Gemini AI                        │
│ lookupAndCreateFood(pool, name)          │
│                                          │
│ Steps:                                   │
│ 1. Send prompt to Gemini                 │
│ 2. Extract JSON from response            │
│ 3. Validate with GeminiFoodSchema (Zod)  │
│ 4. Check for existing duplicate          │
│    (case-insensitive name or alias)      │
│ 5. INSERT into foods table               │
│    (cached for all future lookups)       │
│ 6. Scale to portion                      │
└──────────────────┬───────────────────────┘
                   │
           Valid?  ├── Yes → Return (source: "gemini")
                   │
                   No
                   │
┌──────────────────▼───────────────────────┐
│ Tier 3: Fallback                         │
│ Return: name + zero nutrition            │
│ source: "fallback"                       │
│ (User can edit manually)                 │
└──────────────────────────────────────────┘
```

### Portion Scaling

All nutrition in the `foods` table is stored **per 100g** (or per 100ml for liquids). When a user specifies a portion, the pipeline scales:

```typescript
const grams = unitToGrams(amount, unit);
const scale = grams / 100;
return {
  calories: Math.round(food.calories * scale),
  protein: Math.round(food.protein * scale * 10) / 10,
  carbs: Math.round(food.carbs * scale * 10) / 10,
  fats: Math.round(food.fat * scale * 10) / 10,
};
```

### Unit Conversion (`unitToGrams`)

| Unit | Conversion |
|------|-----------|
| `g` | As-is |
| `kg` | × 1000 |
| `ml` | As-is (treated as grams for scaling) |
| `L` | × 1000 |
| `cup` | × 240 |
| `tbsp` | × 15 |
| `tsp` | × 5 |
| `egg/eggs` | × 50g |
| `banana/bananas` | × 120g |
| `apple/apples` | × 180g |
| `slice/slices` | × 30g |
| `piece/pieces` | × 50g |
| `serving/servings` | × 100g |

### Complete Example

```
User says: "I had two eggs"

1. Voice parses: add_food { food: "egg", amount: 2, unit: "eggs" }

2. lookupNutrition("egg", 2, "eggs"):
   - Tier 1: Search DB for "egg"
   - Found: "Egg, scrambled" with per-100g: { cal: 148, protein: 9.99, carbs: 1.61, fat: 10.98 }
   - unitToGrams(2, "eggs") = 2 × 50 = 100g
   - scale = 100 / 100 = 1.0
   - Result: { calories: 148, protein: 10.0, carbs: 1.6, fats: 11.0, source: "db" }

3. INSERT into food_entries: { name: "Egg", calories: 148, protein: 10, carbs: 1.6, fats: 11 }
```

---

## Food Search Algorithm

**File:** `src/models/foodSearch.ts`

The public `GET /api/food/search?q=<query>&limit=10` endpoint uses a sophisticated multi-tier search.

### Primary Search (Full Feature Set)

```sql
SELECT id, name, common_name, calories, protein, carbs, fat,
       is_liquid, serving_sizes_ml, preparation, default_unit,
       unit_weight_grams, image_url
FROM foods
WHERE
  -- Word-split LIKE on common_name (all words must appear)
  (lower(COALESCE(common_name, name)) LIKE '%word1%' AND ... LIKE '%wordN%')
  -- Word-split LIKE on name
  OR (lower(name) LIKE '%word1%' AND ... LIKE '%wordN%')
  -- Trigram similarity > 0.15 (fuzzy matching for typos)
  OR similarity(lower(COALESCE(common_name, name)), $query) > 0.15
  -- Full-text search (stemmed matching)
  OR name_tsv @@ plainto_tsquery('english', $query)
  -- Search aliases exact match
  OR lower($query) = ANY(search_aliases)
ORDER BY
  (lower(COALESCE(common_name, name)) = $query) DESC,       -- 1. Exact match
  (lower($query) = ANY(search_aliases)) DESC,                -- 2. Alias match
  (lower(COALESCE(common_name, name)) LIKE $query || '%') DESC, -- 3. Prefix match
  CASE WHEN name_tsv @@ plainto_tsquery(...) THEN 1 ELSE 0 END DESC, -- 4. FTS match
  similarity(lower(COALESCE(common_name, name)), $query) DESC, -- 5. Similarity
  (COALESCE(preparation, 'cooked') = 'cooked') DESC,        -- 6. Prefer cooked
  length(COALESCE(common_name, name)) ASC                    -- 7. Shorter = more specific
LIMIT $limit
```

### Fallback Tiers

If the primary search fails (e.g., missing pg_trgm extension or common_name column):

| Tier | Available Features | Matching |
|------|--------------------|----------|
| **Primary** | common_name, pg_trgm, tsvector, search_aliases | All strategies |
| **Fallback 1** | name only, no pg_trgm | Word-split LIKE on name |
| **Fallback 2** | Baseline columns only | Basic LIKE on name |

### Common Name Extraction

USDA foods have verbose descriptions like "Chicken, broilers or fryers, breast, skinless, boneless, meat only, cooked, grilled". The `extractCommonName()` function cleans these to user-friendly names:

```
"Chicken, broilers or fryers, breast, skinless, boneless, meat only, cooked, grilled"
  → "Chicken breast, grilled"

"Rice, white, medium-grain, cooked"
  → "White rice"

"Egg, whole, cooked, scrambled"
  → "Egg, scrambled"
```

The algorithm:
1. Splits by comma into segments
2. First segment = main ingredient
3. Filters out noise (e.g., "broilers or fryers", "skinless", "enriched")
4. Keeps qualifiers (e.g., "white", "breast", "whole wheat")
5. Keeps specific cooking methods (e.g., "grilled", "scrambled") but drops generic "cooked"
6. Reassembles: "[Adjectives] Main [Noun parts], [cooking method]"

### Barcode Search

`getByBarcode(pool, barcode)` does an indexed lookup on the `barcode` column for packaged food scanning.

### Caching Search Results

In `src/controllers/foodSearch.ts`:
- Cache key: `food:search:{query}:{limit}`
- TTL: 3600 seconds (1 hour)
- Stored in Redis when available
- On cache hit, returns immediately without touching PostgreSQL

---

## Vector Embeddings & Semantic Search

**File:** `src/services/embeddings.ts`

### Configuration

| Property | Value |
|----------|-------|
| Model | Google `text-embedding-004` |
| Dimensions | 768 |
| Database | PostgreSQL with `pgvector` extension |
| Column type | `vector(768)` |
| Index | HNSW with `vector_cosine_ops` |

### How Embeddings Are Created

When a food entry or workout is created, the system:
1. Generates descriptive text for the record (e.g., "Chicken breast 200g 330 calories")
2. Calls `text-embedding-004` to produce a 768-dimensional vector
3. Upserts into `user_embeddings` table with `record_type`, `record_id`, `content_text`, and `embedding`

### Semantic Search

```typescript
async function semanticSearch(userId, query, { types?, limit? }) {
  // 1. Embed the query text
  const queryEmbedding = await embed(query);

  // 2. Find nearest neighbors using cosine similarity
  SELECT record_type, record_id, content_text,
         1 - (embedding <=> $queryVector) AS similarity
  FROM user_embeddings
  WHERE user_id = $userId
    AND record_type = ANY($types)
  ORDER BY embedding <=> $queryVector
  LIMIT $limit;

  // 3. Return ranked results with similarity scores
}
```

### Database Table

```sql
CREATE TABLE user_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_type text NOT NULL,      -- 'food_entry' or 'workout'
  record_id text NOT NULL,
  content_text text NOT NULL,
  embedding vector(768),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(record_id, record_type)
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_user_embeddings_hnsw
  ON user_embeddings USING hnsw (embedding vector_cosine_ops);

-- User + type index for filtered queries
CREATE INDEX idx_user_embeddings_user_type
  ON user_embeddings (user_id, record_type);
```

---

## Redis Architecture

**Files:** `src/redis/client.ts`, `src/lib/keyValueStore.ts`

Redis is **optional**. When `REDIS_URL` is not set, the app degrades gracefully:

| Feature | With Redis | Without Redis |
|---------|-----------|---------------|
| Food search cache | 1h TTL in Redis | No cache (hits DB every time) |
| Voice queue | BullMQ async processing | Text-only sync mode |
| Rate limiting | Distributed Redis store | In-memory per-process |
| Key-value store | Redis-backed | In-memory LRU (10K entries) |
| Event bus | Redis BullMQ transport | In-memory (sync) |
| Health check | `/ready` checks Redis reachability | `/ready` skips Redis check |

### Redis Client (`src/redis/client.ts`)

- Connects to `REDIS_URL` or `REDIS_PRIVATE_URL`
- Lazy initialization on first use
- Closed gracefully on shutdown
- `isRedisConfigured()` returns false when URL is not set

### Food Search Cache (`src/controllers/foodSearch.ts`)

```
Key:    food:search:{normalized_query}:{limit}
Value:  JSON-serialized array of food results
TTL:    3600 seconds (1 hour)
```

Flow:
1. Check Redis for cached result
2. Cache hit → parse and return immediately
3. Cache miss → query PostgreSQL → cache result → return

### Key-Value Store (`src/lib/keyValueStore.ts`)

A TTL-enabled key-value store with automatic fallback:

```
Redis mode:
  - kvSet(key, value, ttlSeconds) → SET with EX
  - kvGet(key) → GET
  - kvDelete(key) → DEL
  - kvGetAndDelete(key) → GET + DEL (atomic)

In-memory fallback:
  - Max entries: 10,000 (LRU eviction when full)
  - Cleanup interval: 5 minutes (removes expired entries)
  - TTL tracked per entry
```

Used for:
- **Voice job results**: Worker writes result, client polls and reads
- **Idempotency keys**: Prevent duplicate operations
- **Temporary data**: Short-lived state

### BullMQ Voice Queue (`src/queue/index.ts`)

- Queue name: configurable
- Connection: shares Redis client
- Job data: audio buffer, MIME type, user context
- Worker: `src/workers/voiceWorker.ts` processes jobs by calling Gemini
- On completion: result stored in KV store for client polling
- Fallback: AWS SQS when `VOICE_QUEUE_URL` is set

### Rate Limiting

```
General API: 200 requests / 15 minutes / IP
Auth routes: 10 requests / 15 minutes / IP

Redis store:  rate-limit-redis (shared across instances)
Memory store: express-rate-limit default (per-process)
```

### Event Bus Transport

When `EVENT_TRANSPORT=redis` (default):
- BullMQ queue named `events`
- API processes publish events
- Optional consumer process subscribes and runs handlers

---

## Database Schema

PostgreSQL with `pgvector` and `pg_trgm` extensions. Managed by node-pg-migrate (migrations in `migrations/`) and Prisma (`prisma/schema.prisma` for schema definition).

### Tables

#### `users`
```sql
id uuid PK, email text UNIQUE, password_hash text, name text,
role text DEFAULT 'user', auth_provider text, provider_id text,
email_verified boolean, created_at timestamptz, updated_at timestamptz
```

#### `foods` (Reference Nutrition Database)
```sql
id uuid PK, name text NOT NULL, common_name text,
calories numeric, protein numeric, carbs numeric, fat numeric,
is_liquid boolean DEFAULT false, serving_sizes_ml jsonb,
preparation text DEFAULT 'cooked', default_unit text,
unit_weight_grams numeric, search_aliases text[],
barcode text UNIQUE, source text DEFAULT 'usda', off_id text UNIQUE,
name_he text, image_url text, name_tsv tsvector,
created_at timestamptz

Indexes: barcode, off_id, name trigram, name_tsv FTS, common_name lower
```

#### `food_entries` (User Food Log)
```sql
id uuid PK, user_id uuid FK->users, date date, name text,
calories numeric, protein numeric, carbs numeric, fats numeric,
portion_amount numeric, portion_unit text, serving_type text,
start_time text, end_time text, created_at timestamptz

Index: (user_id, date)
```

#### `workouts`
```sql
id uuid PK, user_id uuid FK->users, date date, title text,
type text (strength|cardio|flexibility|sports),
duration_minutes int, exercises jsonb, notes text,
created_at timestamptz, updated_at timestamptz

Index: (user_id, date)
```

#### `daily_check_ins`
```sql
id uuid PK, user_id uuid FK->users, date date,
sleep_hours numeric, created_at timestamptz

Unique: (user_id, date)
```

#### `goals`
```sql
id uuid PK, user_id uuid FK->users,
type text (calories|workouts|sleep),
target numeric, period text (weekly|monthly|yearly),
created_at timestamptz, updated_at timestamptz

Index: (user_id, type, period)
```

#### `user_embeddings`
```sql
id uuid PK, user_id uuid FK->users,
record_type text, record_id text,
content_text text, embedding vector(768),
created_at timestamptz, updated_at timestamptz

Unique: (record_id, record_type)
Indexes: (user_id, record_type), HNSW on embedding
```

#### `user_daily_stats`
```sql
id uuid PK, user_id uuid, date date,
total_calories numeric DEFAULT 0, workout_count int DEFAULT 0,
sleep_hours numeric, total_income numeric, total_expenses numeric,
updated_at timestamptz

Unique: (user_id, date)
```

#### `weight_entries`
```sql
id uuid PK, user_id uuid FK->users, date date,
weight float (kg), notes text, created_at timestamptz

Unique: (user_id, date)
```

#### `water_entries`
```sql
id uuid PK, user_id uuid FK->users, date date,
glasses int DEFAULT 0, ml_total int DEFAULT 0,
created_at timestamptz, updated_at timestamptz

Unique: (user_id, date)
```

#### `cycle_entries`
```sql
id uuid PK, user_id uuid FK->users, date date,
period_start boolean DEFAULT false, period_end boolean DEFAULT false,
flow text, symptoms jsonb DEFAULT '[]', notes text,
created_at timestamptz

Unique: (user_id, date)
```

#### `user_profiles`
```sql
id uuid PK, user_id uuid UNIQUE FK->users,
date_of_birth date, sex text, height_cm float,
current_weight float (kg), target_weight float (kg),
activity_level text, water_goal_glasses int DEFAULT 8,
cycle_tracking_enabled boolean DEFAULT false,
average_cycle_length int DEFAULT 28,
setup_completed boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

#### `user_settings`
```sql
id uuid PK, user_id uuid UNIQUE FK->users,
theme text DEFAULT 'system', currency text DEFAULT 'USD',
language text DEFAULT 'en', timezone text DEFAULT 'UTC',
created_at timestamptz, updated_at timestamptz
```

### Food Data Import

**USDA Foundation Foods:**
```bash
cd backend
npm run import:foods  # Requires Foundation Foods JSON + DATABASE_URL
```

The import script (`scripts/importFoundationFoods.js`):
1. Reads USDA FoodData Central JSON
2. Parses each food for name, macros, preparation
3. Estimates calories from macros using Atwater factors when Energy values are missing
4. Inserts into `foods` table with `source: 'usda'`

**Popular foods seed (alternative):**
```bash
npm run seed:popular-foods  # Seeds ~100 common foods, no external JSON needed
```

---

## Image & Video Handling

**Files:** `src/services/storage.ts`, `src/controllers/uploads.ts`

### Pre-Signed URL Flow

```
Client                          Backend                         S3
  |                               |                              |
  |-- POST /api/uploads/          |                              |
  |   presigned-url               |                              |
  |   { mimeType, context }       |                              |
  |                               |-- Generate pre-signed        |
  |                               |   PUT URL (5min expiry)      |
  |                               |                              |
  |<-- { uploadUrl, fileUrl }-----|                              |
  |                               |                              |
  |-- PUT file directly -------->-|----------------------------->|
  |   to uploadUrl                |                              |
  |                               |                              |
  |-- Store fileUrl on resource   |                              |
```

### Valid Contexts

| Context | Use Case | S3 Path |
|---------|----------|---------|
| `avatar` | User profile picture | `users/{userId}/avatar/{id}.{ext}` |
| `workout` | Workout photo | `users/{userId}/workout/{id}.{ext}` |
| `food` | Food photo | `users/{userId}/food/{id}.{ext}` |
| `exercise-video` | Exercise demonstration | `users/{userId}/exercise-video/{id}.{ext}` |

### Allowed MIME Types

| Category | Types |
|----------|-------|
| Images | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Videos | `video/mp4`, `video/quicktime`, `video/webm` |

### Food & Exercise Images in Database

- `foods.image_url` -- URL for food reference images (seeded via migration)
- Exercise catalog has `image_url` for exercise demonstration images
- Search results include `imageUrl` in the response object
- Missing images are handled by frontend placeholders

---

## Voice Pipeline

### Text Mode (Synchronous)

```
POST /api/voice/understand { transcript: "two eggs and a coffee" }
  → voice.parseTranscript(transcript, userId)
    → Gemini with VOICE_TOOLS
    → processGeminiResponse()
    → buildActions() via HANDLERS registry
    → executeActions() (if VOICE_EXECUTE_ON_SERVER=true)
  → { actions: [...], results: [...] }
```

### Audio Mode (Asynchronous, requires Redis)

```
POST /api/voice/understand { audio: "<base64>", mimeType: "audio/webm" }
  → Create BullMQ job
  → { jobId: "abc123", pollUrl: "/api/jobs/abc123" }

Voice Worker picks up job:
  → voice.parseAudio(audioBuffer, mimeType, userId)
    → Gemini with audio input + VOICE_TOOLS
    → processGeminiResponse()
    → buildActions()
  → Store result in KV store

Client polls: GET /api/jobs/abc123
  → { status: "completed", actions: [...] }
```

### Agent Mode (Extended Tools)

`voice/agentTools.js` extends the standard 23 voice tools with 7 additional read/copy tools:

| Tool | Description |
|------|-------------|
| `get_workouts` | Fetch workouts, optionally by date |
| `get_food_entries` | Fetch food entries, optionally by date |
| `get_goals` | Fetch all user goals |
| `get_weight_entries` | Fetch weight history with date range |
| `get_water_today` | Get water intake for a date |
| `copy_food_entries` | Copy all food entries from one date to multiple target dates |
| `copy_workout` | Copy a workout from one date to another |

These enable multi-step reasoning where Gemini can first read data, then act on it.

### Performance & Reliability

The voice path is optimized for real multi-action utterances and for cost/latency:

| Concern | Implementation | Files |
|---------|----------------|-------|
| Re-instantiating the Gemini SDK per call | Singleton client + cached models keyed by name/options | `src/lib/genai.ts` (`getModel`, `SAFETY_BLOCK_NONE`) |
| Per-food nutrition lookups run serially | `buildActionsFromFunctionCalls()` runs handlers with `Promise.all`; shared by batch + streaming | `src/services/voice/geminiClient.ts` |
| Hallucination filter duplicated across paths | Single `filterHallucinatedActions()` used by both | `src/services/voice/geminiClient.ts` |
| One `INSERT` per food | ≥2 same-date `add_food` actions go through one transactional `createBatch`; falls back to per-item on batch error | `src/services/voiceExecutor.ts`, `src/services/foodEntry.ts` |
| One embedding write per food | `upsertEmbeddingsBatch()` embeds concurrently + one multi-row upsert | `src/services/embeddings.ts` |
| Edit/delete loads whole tables | Targeted single-row finders (`findForVoice`, `findByDate`, `findLatest`, `findOne`) | `src/services/{workout,foodEntry,goal,dailyCheckIn}.ts`, `src/models/{weight,cycle,...}.ts` |
| Prompt re-sent as user content | `VOICE_PROMPT` baked into the model as a cached `systemInstruction` | `src/services/voice.ts`, `geminiClient.ts` (`getGeminiModel(systemInstruction)`) |
| Cache stampede / duplicate `foods` rows | In-flight promise de-duplication keyed by normalized name; 1 retry on transient Gemini error | `src/services/foodLookupGemini.ts` |
| `add_water` writes N rows for N glasses | Single count-based upsert | `src/models/water.ts` (`addGlasses`) |
| Streaming double-execution | `finished` guard so `executeActions` runs once | `src/ws/voiceStreaming.ts` |
| Free AI call burned on empty/failed attempts | Gate with non-consuming `checkAiQuota`; consume only on a real result | `src/services/aiQuota.ts`, `src/ws/voiceStreaming.ts` |
| Server-UTC date defaults | User's local `today` threaded through `executeActions(actions, userId, { today })` | `src/services/voice.ts`, `voiceExecutor.ts`, `ws/voiceStreaming.ts` |
| Silent 0-kcal entries | `add_food` actions carry `nutritionResolved`; the result message flags unresolved nutrition | `actionBuilders.ts`, `voiceExecutor.ts` |

`executeActions` returns results in the original action order and never throws; per-action errors are captured individually.

---

## Guardrails & Validation

### Input Validation

| Layer | Mechanism | File |
|-------|-----------|------|
| Config | Zod schema validates all env vars at startup | `src/config/index.ts` |
| Request bodies | `validateBody` middleware with Zod schemas | `src/middleware/validateBody.ts` |
| LLM food response | `GeminiFoodSchema` with strict ranges | `src/services/foodLookupGemini.ts` |
| Event envelopes | Zod schema for event type, payload, metadata | `src/events/schema.ts` |

### Gemini Food Response Guardrails

| Field | Constraint | Rationale |
|-------|-----------|-----------|
| `name` | string, min 1, trimmed | Prevent empty names |
| `calories` | 0-1000 | No food has >1000 kcal/100g (pure fat is ~884) |
| `protein` | 0-100 | Cannot exceed 100g per 100g |
| `carbs` | 0-100 | Cannot exceed 100g per 100g |
| `fat` | 0-100 | Cannot exceed 100g per 100g |
| `is_liquid` | boolean | Must be explicit |
| `unit_weight_grams` | 1-5000 or null | Reasonable range for food units |

### JSON Extraction Safety

The `extractJson()` function handles malformed Gemini responses:
1. Strips markdown code fences (` ```json ... ``` `)
2. Tries direct `JSON.parse`
3. Falls back to regex extraction of first `{...}` block
4. Returns `null` if nothing parseable (pipeline continues to fallback)

### Duplicate Prevention

Before inserting a Gemini-created food, `findExistingByName()` checks:
```sql
WHERE lower(trim(regexp_replace(name, '\s+', ' ', 'g'))) = $normalized
   OR $normalized = ANY(search_aliases)
```
This prevents duplicate entries for the same food with different formatting.

### Voice Fallback Chain

1. Gemini returns function calls → process normally
2. Gemini blocks (safety filter) → return `add_food` with transcript, zero nutrition
3. Gemini error/timeout → return `add_food` with transcript, zero nutrition
4. Food not in DB + no Gemini key → return zero nutrition with `source: 'fallback'`

The user is **never blocked** from logging food, regardless of failures.

---

## Event Bus

**Files:** `src/events/bus.ts`, `src/events/schema.ts`, `src/events/publish.ts`

### Event Envelope

```typescript
{
  eventId: string,     // UUID
  type: string,        // e.g., "energy.FoodEntryCreated"
  payload: object,     // Domain-specific data
  metadata: {
    userId: string,
    timestamp: string, // ISO 8601
    version: number    // Schema version
  }
}
```

### Event Types

| Context | Events |
|---------|--------|
| **Body** | `body.WorkoutCreated`, `body.WorkoutUpdated`, `body.WorkoutDeleted` |
| **Energy** | `energy.FoodEntryCreated`, `energy.FoodEntryUpdated`, `energy.FoodEntryDeleted`, `energy.CheckInCreated`, `energy.CheckInUpdated`, `energy.CheckInDeleted` |
| **Goals** | `goals.GoalCreated`, `goals.GoalUpdated`, `goals.GoalDeleted` |

### Transport Options

| Transport | Configuration | Notes |
|-----------|--------------|-------|
| **Redis** (default) | `REDIS_URL` set | BullMQ queue `events` |
| **SQS** | `EVENT_TRANSPORT=sqs`, `EVENT_QUEUE_URL` | AWS SQS with DLQ |
| **In-memory** | No Redis, no SQS | Synchronous, for testing |

### Consumer

Run as a separate process for production:
```bash
node workers/event-consumer.js  # Requires REDIS_URL or SQS config
```

See [docs/event-schema.md](../docs/event-schema.md) and [docs/bounded-contexts.md](../docs/bounded-contexts.md).

---

## API Reference

### Health (no rate limit)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{ status: 'ok' }` (200) |
| GET | `/ready` | 200 if DB + Redis reachable, 503 otherwise |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register (email, password, name) |
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/google` | Google OAuth → JWT |
| POST | `/api/auth/facebook` | Facebook token → JWT |
| POST | `/api/auth/twitter` | Twitter token → JWT |
| GET | `/api/auth/me` | Current user (auth required) |

### Domain APIs (auth required)

| Resource | GET (list) | POST (create) | PATCH (update) | DELETE |
|----------|-----------|---------------|----------------|--------|
| `/api/workouts` | List by user | Add workout | Update `:id` | Delete `:id` |
| `/api/food-entries` | List by user | Add entry | Update `:id` | Delete `:id` |
| `/api/daily-check-ins` | List by user | Add check-in | Update `:id` | Delete `:id` |
| `/api/goals` | List by user | Add goal | Update `:id` | Delete `:id` |

### Food Search (public)

| Method | Path | Parameters | Description |
|--------|------|-----------|-------------|
| GET | `/api/food/search` | `q` (query), `limit` (default 10) | Search foods table |

### Voice (auth required)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/voice/understand` | `{ transcript }` or `{ audio, mimeType }` | Parse natural language → actions |

### Jobs (auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/jobs/:jobId` | Poll voice job status |

### Uploads (auth required)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/uploads/presigned-url` | `{ mimeType, context }` | Get S3 pre-signed upload URL |

---

## Auth Middleware

**File:** `src/middleware/auth.ts`

| Function | Description |
|----------|-------------|
| `requireAuth` | Reads `Authorization: Bearer <token>`, verifies JWT, sets `req.user` (id, email, role). Returns 401 if invalid. |
| `requireAdmin` | After `requireAuth`; returns 403 if role is not `admin` |
| `getEffectiveUserId(req)` | Returns admin-overridden user ID or authenticated user ID |
| `resolveEffectiveUserId` | For admin: validates target user exists, sets `req.effectiveUserId` |

---

## Meal Copying & Repetition

**File:** `voice/agentTools.js`

The `copy_food_entries` tool enables voice-driven meal repetition:

```javascript
{
  name: 'copy_food_entries',
  description: 'Copy all food entries from one date to another date (or multiple dates).',
  parameters: {
    fromDate: 'YYYY-MM-DD',    // Source date
    toDates: ['YYYY-MM-DD']    // Array of target dates
  }
}
```

**Voice examples:**
- "Copy today's meals to tomorrow"
- "Repeat this meal plan for the next 3 days"
- "Copy Monday's food to Wednesday and Thursday"

Similarly, `copy_workout` copies workouts between dates.

---

## Future: Meal Plan Feature

The following capabilities are planned for future development:

| Feature | Description |
|---------|-------------|
| **CSV Import** | Upload a CSV with columns: day, meal, food, portion, calories to bulk-create entries |
| **Named Meal Plans** | Create reusable plans ("Cutting Diet", "Bulking Plan") with foods per meal slot |
| **Recurring Schedules** | Apply a plan to a date range or repeat pattern (daily, weekdays only) |
| **Meal Templates** | Save a day's entries as a template for one-tap reuse |

**Current alternative:** Use the `copy_food_entries` voice command to duplicate a day's entries to future dates.

---

## Configuration

**File:** `src/config/index.ts`

Configuration is loaded from `backend/.env` (then `.env.{NODE_ENV}`). All values are validated at startup with a Zod schema -- invalid values cause the server to crash immediately with a clear error message.

See the [root README](../README.md#environment-variables) for the full environment variables table.

Key behaviors:
- **Missing `DATABASE_URL`**: Server starts but auth/data APIs are not mounted
- **Missing `GEMINI_API_KEY`**: Voice endpoint returns an error; food lookup skips Tier 2
- **Missing `REDIS_URL`**: In-memory rate limiting, no cache, text-only voice, sync events

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | `node index.js` -- start server |
| `npm run dev` | Start with auto-reload (tsx watch) |
| `npm run build` | Build with tsup |
| `npm test` | Run Vitest unit tests |
| `npm run migrate:up` | Run pending migrations |
| `npm run migrate:create <name>` | Create new migration |
| `npm run import:foods` | Import USDA Foundation Foods |
| `npm run seed:popular-foods` | Seed ~100 popular foods |
| `npm run start:consumer` | Run event consumer process |
| `npm run start:body` | Run Body service only |
| `npm run start:energy` | Run Energy service only |
| `npm run start:goals` | Run Goals service only |
| `npm run lint` | Syntax check |

---

## Testing

Unit tests use [Vitest](https://vitest.dev/). Run with `npm test`.

Test coverage:
- `validation.ts` -- Input normalization and validation
- `appLog.ts` -- Action and error logging (DB mocked)
- `src/events/schema.test.ts` -- Event envelope validation
- `src/events/bus.test.ts` -- Event bus publish/subscribe
- `src/events/transports/sqs.test.ts` -- SQS transport
- `src/events/write-paths-emit-events.test.ts` -- All write paths emit events

---

## Deployment

### Docker

```bash
docker build -t trackvibe-backend ./backend
docker run -p 3000:3000 --env-file backend/.env trackvibe-backend
```

Multi-stage Dockerfile: Node 20-alpine builder → production stage (no devDependencies, non-root `node` user).

### Railway

Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `GEMINI_API_KEY`, `REDIS_URL`.

### AWS

SAM template (`template.yaml`) defines:
- **EventHandlerFunction** (Lambda): Processes domain events (30s timeout, 256MB)
- **VoiceHandlerFunction** (Lambda): Processes voice jobs (60s timeout, 512MB)
- SQS queues with DLQs for both
- 14-day message retention

See [docs/architecture-target-aws.md](../docs/architecture-target-aws.md).

---

## Logging

**File:** `src/lib/logger.ts`

Pino structured JSON logging. Set `LOG_LEVEL` env var (default: `info` in production, `debug` otherwise).

```typescript
import { logger } from './lib/logger.js';
logger.info({ userId }, 'Food entry created');
logger.error({ err }, 'Gemini lookup failed');
```

---

## Error Handling

- Controllers use `sendJson`, `sendError`, `sendCreated`, `sendNoContent` from `src/utils/response.ts`
- Request bodies validated with Zod via `validateBody` middleware (400 on failure)
- Global `errorHandler` middleware catches thrown errors → JSON `{ error: string }` response
- All 4xx/5xx responses are consistently JSON with an `error` field
